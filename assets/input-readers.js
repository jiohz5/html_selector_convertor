/* 입력 형식 등록과 HTML 데이터 읽기. 새 형식은 READERS에 등록한다.
 * 입력 HTML의 노드를 화면에 붙이지 않고 표·내장 JSON 레코드 또는 spec만 반환한다. */
(() => {
  'use strict';

  function textOf(node) {
    const copy = node.cloneNode(true);
    copy.querySelectorAll('script,style,template,noscript,iframe,object,embed').forEach((el) => el.remove());
    copy.querySelectorAll('br').forEach((el) => el.replaceWith(document.createTextNode('\n')));
    return copy.textContent.replace(/\r\n?/g, '\n').trim();
  }

  function htmlTable(table, toTable) {
    if (table.querySelector('table')) throw new Error('중첩 표는 지원하지 않습니다. 단일 표로 정리해 주세요.');
    const headRows = table.tHead ? Array.from(table.tHead.rows) : [];
    if (headRows.length > 1) throw new Error('여러 줄 머리글은 지원하지 않습니다. 머리글을 한 행으로 정리해 주세요.');
    const rows = Array.from(table.rows).filter((row) => row.closest('table') === table && !row.closest('tfoot'));
    if (rows.length < 2) throw new Error('머리글과 데이터 행이 있는 표가 필요합니다. JavaScript로 행을 채우는 페이지는 내장 JSON 또는 CSV 데이터가 필요합니다.');
    const header = headRows[0] || rows[0];
    const width = header.cells.length;
    if (!width) throw new Error('머리글 열을 찾지 못했습니다.');
    for (const row of rows) {
      const cells = Array.from(row.cells);
      if (cells.some((cell) => cell.rowSpan !== 1 || cell.colSpan !== 1)) {
        throw new Error('병합 셀(rowspan·colspan)은 지원하지 않습니다. 셀 병합을 풀어 주세요.');
      }
      if (cells.length !== width) throw new Error('행마다 열 수가 다릅니다. 모든 행의 열 수를 맞춰 주세요.');
    }
    const body = rows.filter((row) => row !== header).map((row) => Array.from(row.cells, textOf));
    return toTable(Array.from(header.cells, textOf), body);
  }

  function embeddedJSONTables(root, context) {
    const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
    const scripts = Array.from(root.querySelectorAll('script[type]')).filter((script) =>
      script.type.trim().toLowerCase() === 'application/json' && !script.hasAttribute('src'));
    return scripts.flatMap((script, index) => {
      const label = `내장 JSON ${index + 1}${script.id ? ` · ${script.id}` : ''}`;
      let data;
      try { data = JSON.parse(script.textContent.replace(/^\uFEFF/, '')); } catch (e) {
        return [{ id: `json-${index}-error`, label, embeddedJSON: true, error: `JSON을 읽지 못했습니다: ${e.message}` }];
      }
      const entries = [];
      const pending = [{ value: data, path: '$' }];
      while (pending.length) {
        const { value, path } = pending.pop();
        if (Array.isArray(value)) {
          // 좌표 같은 속성의 스칼라 배열은 표가 아니다. 레코드 내부 배열은 더 탐색하지 않는다.
          if (path !== '$' && value.length && !value.some(isRecord)) continue;
          const entry = { id: `json-${index}-${entries.length}`, label: `${label} · ${path}`, embeddedJSON: true };
          if (!value.length) entry.error = '빈 레코드 배열입니다.';
          else if (!value.every(isRecord)) entry.error = '모든 행이 null이 아닌 객체인 레코드 배열이 필요합니다.';
          else {
            const columns = new Set();
            value.forEach((record) => Object.keys(record).forEach((key) => columns.add(key)));
            if (!columns.size) entry.error = '레코드에서 데이터 열을 찾지 못했습니다.';
            else {
              const header = Array.from(columns);
              entry.table = context.tableFromRows(header, value.map((record) => header.map((key) => Object.hasOwn(record, key) ? record[key] : null)));
              entry.label += ` · ${value.length.toLocaleString('ko-KR')}행`;
            }
          }
          entries.push(entry);
        } else if (isRecord(value)) {
          // 역순으로 쌓아 원문의 속성 순서대로 목록을 제공한다.
          Object.entries(value).reverse().forEach(([key, child]) => {
            if (child !== null && typeof child === 'object') {
              const suffix = /^[A-Za-z_$][\w$]*$/.test(key) ? `.${key}` : `[${JSON.stringify(key)}]`;
              pending.push({ value: child, path: path + suffix });
            }
          });
        }
      }
      return entries.length ? entries : [{ id: `json-${index}-empty`, label, embeddedJSON: true, error: '표로 읽을 객체 배열을 찾지 못했습니다.' }];
    });
  }

  function readHTML(text, name, context) {
    context.captureHTML?.(text, name);
    // template의 분리된 문서 조각은 스크립트와 외부 리소스를 활성화하지 않는다.
    const template = document.createElement('template');
    template.innerHTML = text;
    const root = template.content;
    const markers = Array.from(root.querySelectorAll('[id="hc-spec"]'));
    let embeddedSpec;
    if (markers.length) {
      const marker = markers[0];
      if (markers.length !== 1 || marker.tagName !== 'SCRIPT' || marker.type.toLowerCase() !== 'application/json') {
        throw new Error('HTML의 내장 spec 표식이 올바르지 않습니다.');
      }
      let spec;
      try { spec = JSON.parse(marker.textContent); } catch (e) { throw new Error(`HTML의 내장 spec JSON을 읽지 못했습니다: ${e.message}`); }
      const arrays = ['kpis', 'charts', 'tables', 'sections'];
      const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
      if (!spec || typeof spec !== 'object' || Array.isArray(spec) ||
          typeof spec.meta?.title !== 'string' || !spec.meta.title.trim() ||
          arrays.some((key) => spec[key] != null && (!Array.isArray(spec[key]) || !spec[key].every(isObject))) ||
          (spec.summary != null && typeof spec.summary !== 'string' &&
            (!Array.isArray(spec.summary) || !spec.summary.every((value) => typeof value === 'string')))) {
        throw new Error('HTML의 내장 spec 형식이 올바르지 않습니다(meta.title과 올바른 데이터 영역이 필요).');
      }
      embeddedSpec = { kind: 'spec', name, spec };
      if (!context.preferRenderedTables) return embeddedSpec;
    }
    const candidates = Array.from(root.querySelectorAll('table')).filter((table) => !table.parentElement?.closest('table'));
    const tables = candidates.map((table, index) => {
      const title = table.caption ? textOf(table.caption) : table.id;
      const entry = { id: `table-${index}`, label: `표 ${index + 1}${title ? ` · ${title}` : ''}` };
      try { entry.table = htmlTable(table, context.tableFromRows); } catch (e) { entry.error = e.message; }
      return entry;
    });
    // 선택적 렌더 분석에서는 화면에 생성된 실제 표를 내장 원데이터보다 먼저 읽는다.
    if (context.preferRenderedTables && tables.some((entry) => entry.table)) {
      return { kind: 'html', name, tables, tableId: tables.find((entry) => entry.table).id, selectionLabel: '표' };
    }
    if (embeddedSpec) return embeddedSpec;
    tables.push(...embeddedJSONTables(root, context));
    if (!tables.length) throw new Error('HTML에서 정적 데이터 표, 내장 JSON 레코드 또는 내장 spec을 찾지 못했습니다.');
    const first = tables.find((entry) => entry.table);
    if (!first) throw new Error(tables.map((entry) => `${entry.label}: ${entry.error}`).join('\n'));
    return { kind: 'html', name, tables, tableId: first.id, selectionLabel: tables.some((entry) => entry.embeddedJSON) ? '데이터' : '표' };
  }

  const READERS = [
    // 구조가 있는 형식을 구분표보다 먼저 판별한다. 손상 JSON/HTML도 CSV로 우회하지 않는다.
    { id: 'json', extensions: ['json'], label: 'JSON', text: true, detectText: (text) => /^[\[{]/.test(text.trimStart()) ? 'json' : null, read: (buffer, file, ctx) => ctx.readJSON(ctx.decodeText(buffer), file.name) },
    { id: 'html', extensions: ['html', 'htm'], label: 'HTML', text: true, detectText: (text) => text.trimStart().startsWith('<') ? 'html' : null, read: (buffer, file, ctx) => readHTML(ctx.decodeText(buffer), file.name, ctx) },
    {
      id: 'delimited', extensions: ['csv', 'tsv', 'txt'], label: 'CSV·TSV·TXT', text: true,
      detectText(text, ctx) {
        const delimiter = ctx.detectDelimiter(text);
        const rows = ctx.parseCSV(text, delimiter);
        const width = rows[0]?.length || 0;
        if (rows.length < 2 || width < 2 || rows.some((row) => row.length !== width)) return null;
        return delimiter === '\t' ? 'tsv' : 'csv';
      },
      read: (buffer, file, ctx) => ctx.readDelimited(ctx.decodeText(buffer), file.name),
    },
    { id: 'workbook', extensions: ['xlsx', 'xlsm', 'xls'], label: '엑셀', read: (buffer, file, ctx) => ctx.readWorkbook(buffer, file.name) },
  ];

  async function read(file, context) {
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    const reader = READERS.find((entry) => entry.extensions.includes(ext));
    if (!reader) throw new Error(`지원하지 않는 파일 형식입니다(.${ext}). ${READERS.map((entry) => entry.label).join(' · ')} 파일을 넣어 주세요.`);
    return reader.read(await file.arrayBuffer(), file, context);
  }

  async function readText(text, format, context) {
    // 표의 선행/후행 탭도 빈 열이다. 공백 검사는 하되 판별할 표를 trim하지 않는다.
    const probe = typeof text === 'string' ? text.replace(/^\uFEFF/, '') : '';
    if (!probe.trim()) throw new Error('붙여 넣을 원문 텍스트를 입력해 주세요.');
    let extension = format;
    if (format === 'auto') {
      for (const reader of READERS) {
        extension = reader.detectText?.(probe, context);
        if (extension) break;
      }
      if (!extension) throw new Error('형식을 자동으로 인식하지 못했습니다. 원문 텍스트의 입력 형식을 직접 선택해 주세요.');
    }
    if (!READERS.some((reader) => reader.text && reader.extensions.includes(extension))) {
      throw new Error('텍스트로 지원하지 않는 입력 형식입니다. 엑셀은 셀을 복사하거나 CSV로 저장해 넣어 주세요.');
    }
    const source = await read(new File([text], `붙여넣은 데이터.${extension}`), context);
    return { ...source, textFormat: extension };
  }

  window.HC_INPUT = {
    read, readText,
    textFormats: () => READERS.filter((reader) => reader.text).flatMap((reader) => reader.extensions.map((extension) => ({ extension, label: `${extension.toUpperCase()} (.${extension})` }))),
    accept: () => READERS.flatMap((entry) => entry.extensions.map((ext) => `.${ext}`)).join(','),
    hint: () => READERS.map((entry) => entry.label).join(' · '),
  };
})();
