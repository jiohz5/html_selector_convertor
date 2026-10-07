/* ② 데이터로 HTML 만들기 — 파일 읽기 · 열 판별 · 규칙 기반 spec 자동 구성 · 미리보기 · 다운로드.
 * 데이터는 이 브라우저 안에서만 처리되며 어디에도 전송되지 않는다.
 * 엑셀(.xlsx)을 넣을 때만 SheetJS를 CDN에서 불러온다. 렌더링은 assets/hc-render.js(render.py와 같은 결과). */
(() => {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const HC = window.HC;
  if (!HC) return;

  const DAY = 86400000;
  const STORE_KEY = 'html-previewer:make-v1';
  const SHEETJS = [
    'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js', // 보안 패치된 공식 배포판
    'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js', // 공식 CDN이 막힌 환경용
  ];
  const GRAN = { day: '일', week: '주', month: '월', quarter: '분기', year: '연' };
  const ROLE_LABEL = { time: '시간 축', sum: '지표 · 합계', mean: '지표 · 평균', dim: '구분(범주)', ignore: '사용 안 함' };
  const KIND_LABEL = { date: '날짜', number: '숫자', category: '범주', bool: '참/거짓', text: '텍스트', empty: '빈 열' };
  const KIT_LABEL = { dashboard: '대시보드', report: '보고서', article: '아티클', landing: '소개(랜딩)', slides: '발표(reveal.js)', impress: '발표(impress.js)' };
  const LIB_LABEL = { echarts: 'ECharts', chartjs: 'Chart.js', apexcharts: 'ApexCharts', plotly: 'Plotly', plot: 'Observable Plot' };

  // 3분기 생산 실적 샘플 (tests/convertor/fixtures/production.csv 와 같은 형식) — 누를 때 만든다
  const SAMPLE_NAME = '샘플_3분기_생산실적.csv';

  // ───────────────────────── 1. 파일 읽기 ─────────────────────────
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = () => resolve();
      s.onerror = () => { s.remove(); reject(new Error(src)); };
      document.head.appendChild(s);
    });
  }

  async function loadSheetJS() {
    if (window.XLSX) return window.XLSX;
    for (const u of SHEETJS) {
      try { await loadScript(u); if (window.XLSX) return window.XLSX; } catch { /* 다음 주소 시도 */ }
    }
    throw new Error('엑셀을 읽는 라이브러리를 불러오지 못했습니다(인터넷 연결 확인). 엑셀에서 CSV로 저장해 넣어 주세요.');
  }

  function decodeText(buf) {
    const b = new Uint8Array(buf);
    if (b[0] === 0xFF && b[1] === 0xFE) return new TextDecoder('utf-16le').decode(b.subarray(2));
    if (b[0] === 0xFE && b[1] === 0xFF) return new TextDecoder('utf-16be').decode(b.subarray(2));
    try {
      return new TextDecoder('utf-8', { fatal: true }).decode(b).replace(/^﻿/, '');
    } catch {
      return new TextDecoder('euc-kr').decode(b); // 한글 엑셀이 저장한 CSV(cp949)
    }
  }

  function detectDelimiter(text) {
    const counts = new Map([',', '\t', ';', '|'].map((delimiter) => [delimiter, 0]));
    let quoted = false;
    let hasContent = false;
    // 첫 논리 행의 따옴표 밖 구분자만 센다. 머리글의 줄바꿈·이스케이프도 보존한다.
    for (let i = 0; i < text.length; i += 1) {
      const c = text[i];
      if (c === '"') {
        if (quoted && text[i + 1] === '"') { i += 1; continue; }
        quoted = !quoted;
        hasContent = true;
      } else if (!quoted && c === '\n') {
        if (hasContent) break;
        counts.forEach((_, delimiter) => counts.set(delimiter, 0));
      } else {
        if (!quoted && counts.has(c)) counts.set(c, counts.get(c) + 1);
        if (c.trim()) hasContent = true;
      }
    }
    let best = ',';
    let bestN = 0;
    for (const [d, n] of counts) {
      if (n > bestN) { best = d; bestN = n; }
    }
    return best;
  }

  function parseCSV(text, delim) {
    const rows = [];
    let row = [];
    let field = '';
    let inQ = false;
    for (let i = 0; i < text.length; i += 1) {
      const c = text[i];
      if (inQ) {
        if (c === '"') {
          if (text[i + 1] === '"') { field += '"'; i += 1; } else inQ = false;
        } else field += c;
      } else if (c === '"' && field === '') inQ = true;
      else if (c === delim) { row.push(field); field = ''; }
      else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
      else if (c !== '\r') field += c;
    }
    if (field !== '' || row.length) { row.push(field); rows.push(row); }
    return rows.filter((r) => r.some((v) => v.trim() !== ''));
  }

  function tableFromRows(header, body) {
    const seen = Object.create(null);
    const columns = header.map((h, i) => {
      let name = String(h == null ? '' : h).trim() || `열${i + 1}`;
      if (seen[name]) { seen[name] += 1; name = `${name}_${seen[name]}`; } else seen[name] = 1;
      return name;
    });
    const rows = body.map((r) => columns.map((_, i) => normalizeCell(r[i])));
    return { columns, rows };
  }

  function normalizeCell(v) {
    if (v === undefined || v === null) return null;
    if (v instanceof Date) return isoLocal(v);
    if (typeof v === 'string') { const t = v.trim(); return t === '' ? null : t; }
    if (typeof v === 'object') return JSON.stringify(v);
    return v;
  }

  const isSpec = (o) => o && typeof o === 'object' && !Array.isArray(o)
    && ['kpis', 'charts', 'tables', 'sections', 'summary'].some((k) => k in o)
    && !['rows', 'data', 'items', 'records', 'result'].some((k) => Array.isArray(o[k]));

  function tableFromJSON(data) {
    let arr = Array.isArray(data) ? data : null;
    if (!arr && data && typeof data === 'object') {
      for (const k of ['rows', 'data', 'items', 'records', 'result']) if (Array.isArray(data[k])) { arr = data[k]; break; }
    }
    if (!arr || !arr.length || typeof arr[0] !== 'object' || arr[0] === null) {
      throw new Error('표 형태(객체 배열)의 JSON이 아닙니다. spec.json이면 "spec.json 불러오기"로 넣어 주세요.');
    }
    const columns = [];
    arr.slice(0, 500).forEach((o) => Object.keys(o).forEach((k) => { if (!columns.includes(k)) columns.push(k); }));
    return tableFromRows(columns, arr.map((o) => columns.map((c) => o[c])));
  }

  function readerContext() {
    return {
      decodeText, isSpec, tableFromRows, parseCSV, detectDelimiter,
      async readWorkbook(buffer, name) {
        const XLSX = await loadSheetJS();
        const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
        return { kind: 'workbook', name, workbook, sheets: workbook.SheetNames };
      },
      readJSON(text, name) {
        let data;
        try { data = JSON.parse(text); } catch (e) { throw new Error(`JSON을 읽지 못했습니다: ${e.message}`); }
        return isSpec(data) ? { kind: 'spec', name, spec: data } : { kind: 'table', name, table: tableFromJSON(data) };
      },
      readDelimited(text, name) {
        const rows = parseCSV(text, /\.tsv$/i.test(name) ? '\t' : detectDelimiter(text));
        if (rows.length < 2) throw new Error('머리글과 데이터 행이 있는 표를 찾지 못했습니다.');
        return { kind: 'table', name, table: tableFromRows(rows[0], rows.slice(1)) };
      },
    };
  }

  async function readFile(file) {
    return window.HC_INPUT.read(file, readerContext());
  }

  async function readText(text, format) {
    return window.HC_INPUT.readText(text, format, readerContext());
  }

  function sheetTable(wb, sheet) {
    const aoa = window.XLSX.utils.sheet_to_json(wb.Sheets[sheet], { header: 1, raw: true, defval: null, blankrows: false });
    if (aoa.length < 2) return null;
    return tableFromRows(aoa[0], aoa.slice(1));
  }

  // ───────────────────────── 2. 열 판별 (profile_data.py 규칙) ─────────────────────────
  const pad = (n) => String(n).padStart(2, '0');
  const isoUTC = (d) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  function isoLocal(d) {
    const base = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    return d.getHours() || d.getMinutes() ? `${base} ${pad(d.getHours())}:${pad(d.getMinutes())}` : base;
  }

  function toNum(v) {
    if (typeof v === 'number') return Number.isFinite(v) ? v : null;
    if (typeof v === 'boolean' || v === null || v === undefined) return null;
    const s = String(v).replace(/[,\s₩$%원]/g, '');
    if (s === '' || s === '-' || s.toLowerCase() === 'nan') return null;
    return /^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/.test(s) ? Number(s) : null;
  }

  const DATE_RE = /^(\d{4})[-./](\d{1,2})(?:[-./](\d{1,2}))?/;
  function toDateMs(v) {
    const m = typeof v === 'string' ? v.match(DATE_RE) : null;
    if (!m) return null;
    const y = +m[1];
    const mo = +m[2];
    const d = m[3] ? +m[3] : 1;
    if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
    return Date.UTC(y, mo - 1, d);
  }

  function kindOf(values) {
    const nn = values.filter((v) => v !== null);
    if (!nn.length) return 'empty';
    if (nn.every((v) => typeof v === 'boolean')) return 'bool';
    if (nn.every((v) => typeof v === 'number')) return 'number';
    if (nn.filter((v) => toNum(v) !== null).length / nn.length > 0.9) return 'number';
    const sample = nn.slice(0, 200).map(String);
    if (sample.filter((s) => DATE_RE.test(s)).length / sample.length > 0.8) return 'date';
    const uniq = new Set(nn.map(String)).size;
    if (uniq <= 20 || uniq / nn.length < 0.05) return 'category';
    return 'text';
  }

  const ID_RE = /(^|[\s_])(id|no|key|idx|index|code|번호|코드|순번)([\s_]|$)|(번호|코드|ID)$/i;
  const YEAR_RE = /연도|년도|year|^년$/i;
  const MEAN_RE = /률|율|%|rate|ratio|평균|avg|mean|점수|score|온도|temp|지수|단가|가격|price|만족|비중|비율/i;
  const DOWN_RE = /불량|결함|오류|에러|error|defect|비용|원가|cost|지연|delay|대기|비가동|다운타임|downtime|이탈|churn|손실|loss|클레임|claim|반품|사고|incident|장애|고장|failure|리드\s?타임|lead\s?time/i;
  const MONEY_RE = /금액|매출|원가|비용|가격|단가|수익|이익|예산|amount|revenue|sales|cost|price|profit|budget/i;

  function profile(table) {
    const n = table.rows.length;
    let timeSet = false;
    return table.columns.map((name, i) => {
      const values = table.rows.map((r) => r[i]);
      const kind = kindOf(values);
      const nn = values.filter((v) => v !== null);
      const uniq = new Set(nn.map(String)).size;
      const col = { name, index: i, kind, unique: uniq, nulls: n - nn.length, sample: [...new Set(nn.slice(0, 50).map(String))].slice(0, 2) };
      if (kind === 'number') {
        col.nums = values.map(toNum);
        const ok = col.nums.filter((v) => v !== null);
        col.integer = ok.every((v) => Number.isInteger(v));
        col.min = Math.min(...ok);
        col.max = Math.max(...ok);
      }
      if (kind === 'date') col.dates = values.map((v) => toDateMs(v == null ? v : String(v)));
      // 기본 역할
      if (kind === 'date') { col.role = timeSet ? 'ignore' : 'time'; timeSet = true; }
      else if (kind === 'number') {
        // 1씩 늘어나는 정수(행 번호·일련번호)만 ID로 본다 — 값이 모두 다른 것만으로는 지표일 수 있다
        const ok = col.nums.filter((v) => v !== null);
        const sequence = col.integer && ok.length >= 10 && ok.every((v, j) => j === 0 || v === ok[j - 1] + 1);
        if (ID_RE.test(name) || sequence) col.role = 'ignore';
        else if (col.integer && col.min >= 1900 && col.max <= 2100 && YEAR_RE.test(name)) col.role = 'dim';
        else col.role = MEAN_RE.test(name) ? 'mean' : 'sum';
      } else if (kind === 'category' || kind === 'bool') col.role = 'dim';
      else col.role = 'ignore';
      return col;
    });
  }

  // ───────────────────────── 3. 규칙 기반 spec 구성 ─────────────────────────
  const round = (v, d = 2) => (v == null || !Number.isFinite(v) ? null : Math.round(v * 10 ** d) / 10 ** d);

  function measureMeta(col) {
    let label = col.name.trim();
    let unit = '';
    const m = label.match(/^(.*?)\s*[([]\s*([^)\]]{1,8})\s*[)\]]\s*$/);
    if (m && m[1]) { label = m[1].trim(); unit = m[2].trim(); }
    const ok = col.nums.filter((v) => v !== null);
    const absMax = Math.max(0, ...ok.map(Math.abs));
    const fractional = !col.integer;
    const fmt = {};
    if (unit === '%' || (/률|율|%|rate|ratio|비율|비중/i.test(col.name) && absMax > 1 && absMax <= 1000)) {
      fmt.format = 'percent'; unit = '';
      fmt.decimals = 2;
    } else if (/^(원|₩|krw)$/i.test(unit)) {
      fmt.format = 'currency'; unit = '';
    } else if (MONEY_RE.test(label) && absMax >= 1e6) {
      fmt.format = 'compact';
    } else if (fractional || col.role === 'mean') {
      fmt.format = 'decimal';
      fmt.decimals = absMax < 10 ? 2 : 1;
    }
    if (unit) fmt.unit = unit;
    return { label, fmt, good: DOWN_RE.test(col.name) ? 'down' : 'up' };
  }

  const nfKo = (v, d) => v.toLocaleString('ko-KR', { minimumFractionDigits: 0, maximumFractionDigits: d });
  function compactKo(v, d = 2) {
    const a = Math.abs(v);
    for (const [n, u] of [[1e12, '조'], [1e8, '억'], [1e4, '만']]) if (a >= n) return `${nfKo(v / n, d)}${u}`;
    return nfKo(v, Number.isInteger(v) ? 0 : d);
  }
  function fmtValue(v, m) {
    if (v == null) return '-';
    const f = m.fmt || {};
    if (f.format === 'percent') return `${v.toFixed(f.decimals ?? 1)}%`;
    if (f.format === 'currency') return `${compactKo(v)}원`;
    if (f.format === 'compact') return `${compactKo(v)}${f.unit || ''}`;
    return `${nfKo(v, f.decimals ?? (Number.isInteger(v) ? 0 : 2))}${f.unit || ''}`;
  }

  // 한국어 조사: 받침 유무로 은/는·이/가를 고른다
  function hasBatchim(word) {
    const ch = String(word).trim().slice(-1);
    const code = ch.charCodeAt(0);
    if (code >= 0xAC00 && code <= 0xD7A3) return (code - 0xAC00) % 28 !== 0;
    if (/[0-9]/.test(ch)) return '013678'.includes(ch);
    if (ch === '%') return false;
    if (/[a-z]/i.test(ch)) return 'lmnr'.includes(ch.toLowerCase());
    return null;
  }
  function josa(word, pair) {
    const [a, b] = pair.split('/');
    const h = hasBatchim(word);
    return h === null ? `${word}${a}(${b})` : `${word}${h ? a : b}`;
  }
  // 으로/로: 받침이 없거나 ㄹ 받침이면 '로'
  function euro(word) {
    const ch = String(word).trim().slice(-1);
    const code = ch.charCodeAt(0);
    let rieul = false;
    if (code >= 0xAC00 && code <= 0xD7A3) rieul = (code - 0xAC00) % 28 === 8;
    else if (/[178]/.test(ch)) rieul = true; // 일·칠·팔
    const h = hasBatchim(word);
    if (h === null) return `${word}(으)로`;
    return `${word}${h && !rieul ? '으로' : '로'}`;
  }

  function periodKey(ms, gran) {
    const d = new Date(ms);
    const y = d.getUTCFullYear();
    const mo = d.getUTCMonth() + 1;
    if (gran === 'day') return isoUTC(d);
    if (gran === 'week') return isoUTC(new Date(ms - ((d.getUTCDay() + 6) % 7) * DAY));
    if (gran === 'month') return `${y}-${pad(mo)}`;
    if (gran === 'quarter') return `${y}-Q${Math.ceil(mo / 3)}`;
    return `${y}`;
  }
  function periodLabel(key, gran, sameYear) {
    if (gran === 'day' || gran === 'week') return sameYear ? key.slice(5) : key.slice(2);
    if (gran === 'month') return sameYear ? `${+key.slice(5)}월` : `${key.slice(2, 4)}.${key.slice(5)}`;
    if (gran === 'quarter') return sameYear ? `${key.slice(-1)}분기` : `${key.slice(2, 4)}년 ${key.slice(-1)}분기`;
    return `${key}년`;
  }
  function autoGran(days) {
    if (days <= 62) return 'day';
    if (days <= 210) return 'week';
    if (days <= 1100) return 'month';
    return days <= 3000 ? 'quarter' : 'year';
  }

  function buildSpec(model) {
    const { cols, table, fileName, sheet, tableLabel } = model;
    const n = table.rows.length;
    const time = cols.find((c) => c.role === 'time');
    let measures = cols.filter((c) => c.role === 'sum' || c.role === 'mean').slice(0, 6).map((c) => ({ col: c, agg: c.role, ...measureMeta(c) }));
    const counting = !measures.length;
    if (counting) measures = [{ col: null, agg: 'count', label: '건수', fmt: { unit: '건' }, good: 'up' }];
    const dimCols = cols.filter((c) => c.role === 'dim');
    const dimLabel = (c) => c.name.replace(/\s*[([].*[)\]]\s*$/, '').trim() || c.name;
    const dimValue = (c, r) => { const v = table.rows[r][c.index]; return v == null ? '(없음)' : String(v); };
    const dims = dimCols.map((c) => ({ col: c, label: dimLabel(c), uniq: new Set(table.rows.map((_, r) => dimValue(c, r))).size }))
      .filter((d) => d.uniq >= 2 && d.uniq <= 50);
    const pd = dims.find((d) => d.uniq <= 12) || dims[0] || null;
    const sd = dims.find((d) => d !== pd && d.uniq <= 30) || null;
    const pm = measures.find((m) => m.agg !== 'mean') || measures[0];

    const val = (m, r) => (m.agg === 'count' ? 1 : m.col.nums[r]);
    const aggOf = (m, idx) => {
      if (m.agg === 'count') return idx.length;
      const v = idx.map((r) => m.col.nums[r]).filter((x) => x !== null);
      if (!v.length) return null;
      const s = v.reduce((a, b) => a + b, 0);
      return m.agg === 'mean' ? s / v.length : s;
    };
    const all = table.rows.map((_, r) => r);
    const groupBy = (idx, keyFn) => {
      const g = new Map();
      idx.forEach((r) => { const k = keyFn(r); if (!g.has(k)) g.set(k, []); g.get(k).push(r); });
      return g;
    };
    const decimalsOf = (m) => (m.agg === 'mean' || m.fmt.format === 'percent' || m.fmt.format === 'decimal' ? 2 : (m.col && !m.col.integer ? 2 : 0));
    const rv = (v, m) => round(v, decimalsOf(m));
    const chartFmt = (m) => ({ ...(m.fmt.format ? { format: m.fmt.format } : {}), ...(m.fmt.decimals != null ? { decimals: m.fmt.decimals } : {}), ...(m.fmt.unit ? { unit: m.fmt.unit } : {}) });

    // ── 시간 축 ──
    let T = null;
    if (time) {
      const idx = all.filter((r) => time.dates[r] !== null);
      if (idx.length) {
        const ms = idx.map((r) => time.dates[r]);
        const min = Math.min(...ms);
        const max = Math.max(...ms);
        const days = (max - min) / DAY;
        const gran = model.gran && model.gran !== 'auto' ? model.gran : autoGran(days);
        const sameYear = new Date(min).getUTCFullYear() === new Date(max).getUTCFullYear();
        const byP = groupBy(idx, (r) => periodKey(time.dates[r], gran));
        const keys = [...byP.keys()].sort();
        const distinctDays = (rs) => new Set(rs.map((r) => time.dates[r])).size;
        const uniqDates = [...new Set(ms)].sort((a, b) => a - b);
        const gaps = uniqDates.slice(1).map((d, i) => (d - uniqDates[i]) / DAY).sort((a, b) => a - b);
        const daily = gaps.length ? gaps[Math.floor(gaps.length / 2)] <= 1 : false;
        // 일 단위 데이터를 주·월로 묶으면 일부 기간이 낮게 보이므로 합계 지표는 '일평균'으로 그린다
        const perDay = daily && gran !== 'day';
        // 날짜가 모두 1일이고 간격이 한 달 안팎이면 월 단위 데이터 → 기간을 YYYY-MM으로 적는다
        const monthly = uniqDates.every((d) => new Date(d).getUTCDate() === 1) && gaps.length > 0 && gaps[Math.floor(gaps.length / 2)] >= 28;
        const fmtD = (t) => (monthly ? isoUTC(new Date(t)).slice(0, 7) : isoUTC(new Date(t)));
        T = { idx, min, max, days, gran, sameYear, byP, keys, distinctDays, perDay,
          labels: keys.map((k) => periodLabel(k, gran, sameYear)),
          range: `${fmtD(min)} ~ ${fmtD(max)}` };
        // KPI 비교 단위: 기간이 두 달 이상이면 월, 2주 이상이면 주
        const cg = days >= 55 ? 'month' : days >= 13 ? 'week' : 'day';
        const byC = groupBy(idx, (r) => periodKey(time.dates[r], cg));
        const ck = [...byC.keys()].sort();
        if (ck.length >= 2) {
          const counts = ck.slice(0, -1).map((k) => T.distinctDays(byC.get(k))).sort((a, b) => a - b);
          const median = counts[Math.floor(counts.length / 2)];
          const lastDays = T.distinctDays(byC.get(ck[ck.length - 1]));
          const wk = cg === 'week' ? ' 주' : '';
          T.cmp = {
            gran: cg, last: ck[ck.length - 1], prev: ck[ck.length - 2], byC,
            complete: !(median > 1 && lastDays < 0.7 * median),
            lastLabel: `${periodLabel(ck[ck.length - 1], cg, sameYear)}${wk}`,
            prevLabel: `${periodLabel(ck[ck.length - 2], cg, sameYear)}${wk}`,
          };
        }
      }
    }
    const periodValue = (m, rs) => {
      const v = aggOf(m, rs);
      if (v == null) return null;
      return T.perDay && m.agg !== 'mean' ? v / T.distinctDays(rs) : v;
    };

    // ── KPI ──
    const kpis = [];
    measures.slice(0, 4).forEach((m) => {
      const total = aggOf(m, all);
      const k = {
        label: m.agg === 'count' ? '전체 건수' : m.agg === 'mean' ? `평균 ${m.label}` : `총 ${m.label}`,
        value: rv(total, m), ...chartFmt(m),
      };
      if (m.good === 'down') k.good = 'down';
      if (T) {
        k.spark = T.keys.slice(-24).map((key) => rv(periodValue(m, T.byP.get(key)), m));
        k.hint = m.agg === 'mean' ? `${T.range} · 행 단순 평균` : T.range;
      } else if (m.agg === 'mean') k.hint = '행 단순 평균';
      kpis.push(k);
    });
    const cmpFacts = {};
    if (T && T.cmp) {
      const extra = [pm, measures.find((m) => m !== pm && m.good === 'down')].filter(Boolean);
      extra.forEach((m) => {
        if (kpis.length >= 6) return;
        const last = aggOf(m, T.cmp.byC.get(T.cmp.last));
        const prev = aggOf(m, T.cmp.byC.get(T.cmp.prev));
        const k = { label: `${T.cmp.lastLabel} ${m.label}`, value: rv(last, m), ...chartFmt(m), deltaLabel: `${T.cmp.prevLabel} 대비` };
        if (m.good === 'down') k.good = 'down';
        if (!T.cmp.complete) k.hint = `${josa(T.cmp.lastLabel, '은/는')} 일부 기간이라 증감을 표시하지 않습니다`;
        else if (last != null && prev != null) {
          if (m.fmt.format === 'percent') { k.delta = round(last - prev, 2); k.deltaSuffix = '%p'; }
          else if (prev !== 0) k.delta = round(((last - prev) / Math.abs(prev)) * 100, 1);
          // 엔진은 변화량을 소수 1자리로 보여 주므로, 0.1 미만이면 0으로 보이지 않게 2자리로
          if (k.delta != null && k.delta !== 0 && Math.abs(k.delta) < 0.1) k.deltaDecimals = 2;
        }
        cmpFacts[m.label] = { last, prev, delta: k.delta, suffix: k.deltaSuffix || '%' };
        kpis.push(k);
      });
    }

    // ── 차트 ──
    const charts = [];
    if (T) {
      const G = GRAN[T.gran];
      const perDayLabel = (m) => (T.perDay && m.agg !== 'mean' ? '일평균 ' : '');
      const sub = (m) => [m.fmt.unit ? `단위: ${m.fmt.unit}` : '', T.gran === 'week' ? '주 시작일(월) 기준' : '', T.perDay && m.agg !== 'mean' ? `${G}마다 날짜 수로 나눈 값` : ''].filter(Boolean).join(' · ');
      let series;
      let type;
      if (pd && pd.uniq <= 5 && pm.agg !== 'mean') {
        const cats = [...new Set(T.idx.map((r) => dimValue(pd.col, r)))].sort();
        series = cats.map((cat) => ({ name: cat, data: T.keys.map((key) => rv(periodValue(pm, T.byP.get(key).filter((r) => dimValue(pd.col, r) === cat)), pm)) }));
        type = cats.length <= 2 ? 'area' : 'line';
      } else {
        series = [{ name: pm.label, data: T.keys.map((key) => rv(periodValue(pm, T.byP.get(key)), pm)) }];
        type = pm.agg === 'mean' ? 'line' : 'area';
      }
      charts.push({ id: 'trend', title: `${G}별 ${perDayLabel(pm)}${pm.label} 추이${series.length > 1 ? ` (${pd.label}별)` : ''}`, subtitle: sub(pm), type, span: 2, x: T.labels, series, ...chartFmt(pm) });
      const m2 = measures.find((m) => m !== pm);
      if (m2) {
        charts.push({ id: 'trend2', title: `${G}별 ${perDayLabel(m2)}${m2.label} 추이`, subtitle: sub(m2), type: 'line', span: pd ? 1 : 2, x: T.labels, series: [{ name: m2.label, data: T.keys.map((key) => rv(periodValue(m2, T.byP.get(key)), m2)) }], ...chartFmt(m2) });
      }
    }
    const ranked = (dim, m) => [...groupBy(all, (r) => dimValue(dim.col, r)).entries()]
      .map(([k, rs]) => ({ name: k, value: aggOf(m, rs), rows: rs }))
      .filter((g) => g.value != null)
      .sort((a, b) => b.value - a.value);
    let pdRank = null;
    if (pd) {
      pdRank = ranked(pd, pm);
      if (pm.agg !== 'mean' && pd.uniq <= 6) {
        charts.push({ id: 'share', title: `${pd.label}별 ${pm.label} 비중`, subtitle: '전체 기간 합계 기준', type: 'donut', x: pdRank.map((g) => g.name), series: [{ name: pm.label, data: pdRank.map((g) => rv(g.value, pm)) }], ...chartFmt(pm) });
      } else {
        const top = pdRank.slice(0, 10);
        charts.push({ id: 'by-dim', title: `${pd.label}별 ${pm.label}`, subtitle: pdRank.length > 10 ? '상위 10개' : '', type: top.length > 6 ? 'hbar' : 'bar', x: top.map((g) => g.name), series: [{ name: pm.label, data: top.map((g) => rv(g.value, pm)) }], ...chartFmt(pm) });
      }
      measures.filter((m) => m !== pm).slice(0, 2).forEach((m, i) => {
        const rk = ranked(pd, m).slice(0, 10);
        charts.push({ id: `by-dim-${i + 2}`, title: `${pd.label}별 ${m.label}${m.agg === 'mean' ? ' (평균)' : ' (합계)'}`, type: rk.length > 6 ? 'hbar' : 'bar', x: rk.map((g) => g.name), series: [{ name: m.label, data: rk.map((g) => rv(g.value, m)) }], ...chartFmt(m) });
      });
    }
    if (sd && charts.length < 6) {
      const rk = ranked(sd, pm).slice(0, 10);
      charts.push({ id: 'by-dim2', title: `${sd.label}별 ${pm.label}`, subtitle: sd.uniq > 10 ? '상위 10개' : '', type: 'hbar', x: rk.map((g) => g.name), series: [{ name: pm.label, data: rk.map((g) => rv(g.value, pm)) }], ...chartFmt(pm) });
    }
    if (!T && !pd && measures.length >= 2 && measures[0].col && measures[1].col) {
      const [a, b] = measures;
      const pts = all.map((r) => [a.col.nums[r], b.col.nums[r]]).filter(([x, y]) => x !== null && y !== null).slice(0, 500);
      charts.push({ id: 'relation', title: `${josa(a.label, '과/와')} ${b.label}의 관계`, type: 'scatter', span: 2, xLabel: a.label, yLabel: b.label, series: [{ name: '행', data: pts }] });
    }

    // ── 표 ──
    const tables = [];
    if (pd) {
      const columns = [{ key: 'k', label: pd.label }];
      measures.forEach((m, i) => columns.push({ key: `m${i}`, label: m.agg === 'mean' ? `${m.label}(평균)` : m.label, type: 'number', ...chartFmt(m) }));
      const share = pm.agg !== 'mean';
      if (share) columns.push({ key: 'share', label: `${pm.label} 비중`, type: 'number', format: 'percent', decimals: 1 });
      const tot = pdRank.reduce((a, g) => a + g.value, 0);
      const rows = pdRank.slice(0, 50).map((g) => {
        const row = { k: g.name };
        measures.forEach((m, i) => { row[`m${i}`] = rv(aggOf(m, g.rows), m); });
        if (share) row.share = tot ? round((g.value / tot) * 100, 1) : null;
        return row;
      });
      tables.push({ id: 'by-dim-table', title: `${pd.label}별 집계`, subtitle: pdRank.length > 50 ? `${pm.label} 상위 50개` : '전체 기간', columns, rows, pageSize: 15 });
    } else if (T) {
      const columns = [{ key: 'p', label: `${GRAN[T.gran]}` }];
      measures.forEach((m, i) => columns.push({ key: `m${i}`, label: m.agg === 'mean' ? `${m.label}(평균)` : m.label, type: 'number', ...chartFmt(m) }));
      const rows = T.keys.map((key, j) => {
        const row = { p: T.labels[j] };
        measures.forEach((m, i) => { row[`m${i}`] = rv(aggOf(m, T.byP.get(key)), m); });
        return row;
      });
      tables.push({ id: 'by-period', title: `${GRAN[T.gran]}별 집계`, columns, rows, pageSize: 15 });
    } else {
      const used = cols.filter((c) => c.role !== 'ignore').slice(0, 8);
      tables.push({ id: 'rows', title: '데이터 미리보기', subtitle: `앞 ${Math.min(50, n)}행`, columns: used.map((c) => ({ key: `c${c.index}`, label: c.name, ...(c.kind === 'number' ? { type: 'number' } : {}) })), rows: table.rows.slice(0, 50).map((r, ri) => Object.fromEntries(used.map((c) => [`c${c.index}`, c.kind === 'number' ? c.nums[ri] : r[c.index]]))) });
    }

    // ── 요약: 계산한 사실만 ──
    const summary = [];
    summary.push(T ? `${T.range} 기간의 데이터 ${n.toLocaleString('ko-KR')}행을 집계했습니다.` : `데이터 ${n.toLocaleString('ko-KR')}행을 집계했습니다.`);
    const pmTotal = aggOf(pm, all);
    const aggWord = pm.agg === 'count' ? '전체 건수' : pm.agg === 'mean' ? `${pm.label} 평균` : `${pm.label} 합계`;
    summary.push(`${josa(aggWord, '은/는')} ${fmtValue(rv(pmTotal, pm), pm)}입니다.`);
    const cf = cmpFacts[pm.label];
    if (T && T.cmp && cf && T.cmp.complete && cf.delta != null) {
      const sign = cf.delta > 0 ? '+' : '';
      summary.push(`${T.cmp.lastLabel} ${josa(pm.label, '은/는')} ${euro(fmtValue(rv(cf.last, pm), pm))} ${T.cmp.prevLabel} 대비 ${sign}${cf.delta}${cf.suffix}입니다.`);
    } else if (T && T.cmp && !T.cmp.complete) {
      summary.push(`${josa(T.cmp.lastLabel, '은/는')} 일부 기간만 있어 직전 기간과 비교하지 않았습니다.`);
    }
    if (pd && pm.agg !== 'mean' && pdRank.length >= 2) {
      const tot = pdRank.reduce((a, g) => a + g.value, 0);
      const top = pdRank[0];
      const bottom = pdRank[pdRank.length - 1];
      if (tot) summary.push(`${pd.label}별로는 ${josa(top.name, '이/가')} ${euro(`${round((top.value / tot) * 100, 1)}%`)} 가장 많고, ${josa(bottom.name, '이/가')} ${euro(`${round((bottom.value / tot) * 100, 1)}%`)} 가장 적습니다.`);
    }
    const dm = measures.find((m) => m.good === 'down' && m.agg === 'mean');
    if (dm && pd) {
      const rk = ranked(pd, dm);
      if (rk.length >= 2) summary.push(`${josa(dm.label, '은/는')} 평균 ${fmtValue(rv(aggOf(dm, all), dm), dm)}이며, ${pd.label} 중 ${josa(rk[0].name, '이/가')} ${euro(fmtValue(rv(rk[0].value, dm), dm))} 가장 높습니다.`);
    } else {
      const m2 = measures.find((m) => m !== pm && m.agg === 'sum');
      if (m2) summary.push(`${josa(`${m2.label} 합계`, '은/는')} ${fmtValue(rv(aggOf(m2, all), m2), m2)}입니다.`);
    }

    // ── 참고 메모 ──
    const bullets = [];
    if (T && T.perDay) bullets.push(`추이 차트의 합계 지표는 ${GRAN[T.gran]}마다 날짜 수로 나눈 일평균입니다(첫·마지막 ${GRAN[T.gran]}이 일부 기간이어도 비교할 수 있게).`);
    if (measures.some((m) => m.agg === 'mean')) bullets.push('평균 지표는 행 단순 평균입니다(가중 평균이 필요하면 직접 계산해 넣으세요).');
    bullets.push('이 요약과 차트는 규칙에 따라 자동으로 구성했습니다. 원인·해석은 직접 보태 주세요.');
    const sections = [{ id: 'notes', title: '참고', bullets }];

    const base = fileName.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
    return {
      meta: {
        title: base ? (/(현황|분석|보고|리포트|요약|실적)$/.test(base) ? base : `${base} 현황`) : '데이터 요약',
        subtitle: T ? `${T.range} · ${n.toLocaleString('ko-KR')}행` : `${n.toLocaleString('ko-KR')}행 · ${table.columns.length}개 열`,
        source: `${fileName}${sheet ? ` · ${sheet} 시트` : tableLabel ? ` · ${tableLabel}` : ''} (${n.toLocaleString('ko-KR')}행)`,
        generatedAt: isoLocal(new Date()).slice(0, 10),
      },
      summary,
      kpis,
      charts: charts.slice(0, 6),
      tables,
      sections,
    };
  }

  function buildSample() {
    // 7~9월 3개 라인 생산 실적(결정적 의사 난수) — 실제 데이터가 아니라 화면 확인용
    let seed = 7;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
    const lines = [['A라인', 'EQ-01', 840], ['B라인', 'EQ-03', 850], ['C라인', 'EQ-07', 700]];
    const out = ['일자,라인,설비,생산량,불량률(%),비가동(분)'];
    for (let t = Date.UTC(2026, 6, 1); t <= Date.UTC(2026, 8, 30); t += DAY) {
      lines.forEach(([line, eq, base]) => {
        const qty = Math.round(base * (0.85 + rnd() * 0.3));
        const defect = (0.9 + rnd() * 1.2).toFixed(2);
        const down = Math.round(rnd() * 90);
        out.push(`${isoUTC(new Date(t))},${line},${eq},${qty},${defect},${down}`);
      });
    }
    return out.join('\n');
  }

  // 계산 함수는 화면이 없어도 쓸 수 있게 먼저 내보낸다 (콘솔·테스트용)
  window.HC.make = { readFile, readText, profile, buildSpec, parseCSV, decodeText, tableFromRows, tableFromJSON, isSpec, sampleText: buildSample };

  // ───────────────────────── 4. 화면 ─────────────────────────
  if (!$('#view-make')) return;
  const el = {
    view: $('#view-make'), pick: $('#view-pick'), drop: $('#mk-drop'), file: $('#mk-file'), sample: $('#mk-sample'),
    specBtn: $('#mk-spec-btn'), specFile: $('#mk-spec-file'), info: $('#mk-file-info'), sheet: $('#mk-sheet'), sheetLabel: $('#mk-sheet-label'),
    textSource: $('#mk-text-source'), textFormat: $('#mk-text-format'), textApply: $('#mk-text-apply'), textResult: $('#mk-text-result'),
    colsPanel: $('#mk-cols'), colBody: $('#mk-col-body'), gran: $('#mk-gran'),
    contentPanel: $('#mk-content'), title: $('#mk-title'), subtitle: $('#mk-subtitle'), summary: $('#mk-summary'),
    design: $('#mk-design-select'), picked: $('#mk-picked'), kit: $('#mk-kit'), chart: $('#mk-chart'),
    theme: $('#mk-theme'), brandOn: $('#mk-brand-on'), brand: $('#mk-brand'), notes: $('#mk-notes'),
    status: $('#mk-status'), stage: $('#mk-stage'), empty: $('#mk-empty'), device: $('#mk-device'), frame: $('#mk-frame'),
    download: $('#mk-download'), saveSpec: $('#mk-save-spec'), open: $('#mk-open'),
    aiCopy: $('#mk-ai-copy'), aiPaste: $('#mk-ai-paste'), aiApply: $('#mk-ai-apply'), error: $('#mk-error'),
  };

  const storage = {
    get() { try { return JSON.parse(localStorage.getItem(STORE_KEY)) || {}; } catch { return {}; } },
    set(v) { try { localStorage.setItem(STORE_KEY, JSON.stringify(v)); } catch { /* 저장 불가 환경 */ } },
  };
  const saved = storage.get();
  const st = {
    source: null, table: null, cols: [], gran: 'auto', spec: null, specFromFile: false,
    edited: { title: false, subtitle: false, summary: false },
    design: saved.design || 'tabler', designChosen: !!saved.designChosen,
    kit: saved.kit || '', chartLib: saved.chartLib || '', theme: saved.theme || '',
    brandOn: !!saved.brandOn, brand: saved.brand || '#1428a0',
    device: 'desktop', html: '',
  };
  const persist = () => storage.set({ design: st.design, designChosen: st.designChosen, kit: st.kit, chartLib: st.chartLib, theme: st.theme, brandOn: st.brandOn, brand: st.brand });
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const toast = (msg) => document.dispatchEvent(new CustomEvent('previewer:toast', { detail: msg }));

  function showError(msg) {
    el.error.textContent = msg || '';
    el.error.hidden = !msg;
  }

  // ── 디자인 선택지 ──
  function fillDesignOptions() {
    const cats = (window.PREVIEWER_DATA && window.PREVIEWER_DATA.categories) || [];
    const list = HC.list();
    el.design.innerHTML = cats.map((c) => {
      const opts = list.filter((d) => d.category === c.id)
        .map((d) => `<option value="${esc(d.id)}">${esc(d.name)}${d.paid ? ' · 유료(스타일만)' : ''}</option>`).join('');
      return opts ? `<optgroup label="${esc(c.label)}">${opts}</optgroup>` : '';
    }).join('');
    el.kit.innerHTML = `<option value="">디자인 기본값</option>${Object.keys(HC.kits()).map((k) => `<option value="${k}">${KIT_LABEL[k] || k}</option>`).join('')}`;
    el.chart.innerHTML = `<option value="">디자인 기본값</option>${HC.chartLibs().map((k) => `<option value="${k}">${LIB_LABEL[k] || k}</option>`).join('')}`;
  }

  function syncControls() {
    el.design.value = st.design;
    el.kit.value = st.kit;
    el.chart.value = st.chartLib;
    el.theme.value = st.theme;
    el.brandOn.checked = st.brandOn;
    el.brand.value = st.brand;
    el.brand.disabled = !st.brandOn;
    const d = HC.resolve(st.design).d;
    const kitDefault = KIT_LABEL[d.kit || 'dashboard'] || d.kit;
    const libDefault = LIB_LABEL[d.chartLib || 'echarts'] || d.chartLib;
    el.kit.options[0].textContent = `디자인 기본값 (${kitDefault})`;
    el.chart.options[0].textContent = `디자인 기본값 (${libDefault})`;
  }

  function selectedFromPreviewer() {
    return (window.PreviewerApp && window.PreviewerApp.selected()) || [];
  }

  function renderPicked() {
    const sel = selectedFromPreviewer();
    if (!sel.length) {
      el.picked.innerHTML = '<p class="hint">① 디자인 고르기에서 ☆로 담은 디자인이 여기 나타납니다.</p>';
      return;
    }
    el.picked.innerHTML = `<p class="hint">①에서 담은 디자인 — 누르면 적용됩니다</p>${sel.map((it) => {
      const lib = HC.CHART_IDS[it.id];
      const active = lib ? (st.chartLib || HC.resolve(st.design).d.chartLib) === lib : st.design === it.id;
      return `<button type="button" class="mk-chip${active ? ' is-active' : ''}" data-pick="${esc(it.id)}" title="${esc(it.memo ? `메모: ${it.memo}` : it.name)}">
        <span>${esc(it.name)}</span>${lib ? '<small>차트</small>' : ''}${it.memo ? `<em>${esc(it.memo)}</em>` : ''}</button>`;
    }).join('')}`;
  }

  // ①에서 고른 것 적용: 차트 라이브러리가 아닌 첫 항목 = 디자인, 차트 항목 = 차트 라이브러리 (resolve_design.py와 같은 규칙)
  function applySelection(force) {
    const sel = selectedFromPreviewer();
    if (!sel.length || (st.designChosen && !force)) return;
    const layout = sel.find((it) => !HC.CHART_IDS[it.id] && HC.list().some((d) => d.id === it.id));
    const chart = sel.find((it) => HC.CHART_IDS[it.id]);
    if (layout) st.design = layout.id;
    if (chart) st.chartLib = HC.CHART_IDS[chart.id];
  }

  // ── 열 역할 표 ──
  function renderCols() {
    el.colBody.innerHTML = st.cols.map((c) => {
      const roles = c.kind === 'date' ? ['time', 'ignore']
        : c.kind === 'number' ? ['sum', 'mean', 'dim', 'ignore']
          : ['dim', 'ignore'];
      return `<tr>
        <th scope="row"><span class="mk-colname">${esc(c.name)}</span><span class="mk-kind mk-kind-${c.kind}">${KIND_LABEL[c.kind]}</span></th>
        <td class="mk-sample">${esc(c.sample.join(', '))}</td>
        <td><select class="select select-sm" data-col="${c.index}" aria-label="${esc(c.name)} 역할">${roles.map((r) => `<option value="${r}"${c.role === r ? ' selected' : ''}>${ROLE_LABEL[r]}</option>`).join('')}</select></td>
      </tr>`;
    }).join('');
  }

  // ── spec 만들기 · 그리기 ──
  function regenerate() {
    if (!st.table) return;
    const prev = st.spec;
    const spec = buildSpec({ cols: st.cols, table: st.table, fileName: st.source.name, sheet: st.source.sheet, tableLabel: st.source.tableLabel, gran: st.gran });
    if (prev && st.edited.title) spec.meta.title = prev.meta.title;
    if (prev && st.edited.subtitle) spec.meta.subtitle = prev.meta.subtitle;
    if (prev && st.edited.summary) spec.summary = prev.summary;
    st.spec = spec;
    fillContent();
    scheduleRender(0);
  }

  function fillContent() {
    const s = st.spec;
    el.title.value = (s.meta && s.meta.title) || '';
    el.subtitle.value = (s.meta && s.meta.subtitle) || '';
    el.summary.value = Array.isArray(s.summary) ? s.summary.join('\n') : (s.summary || '');
  }

  function renderOpts() {
    const o = {};
    if (st.kit) o.kit = st.kit;
    if (st.chartLib) o.chartLib = st.chartLib;
    if (st.theme) o.theme = st.theme;
    if (st.brandOn) o.tokens = { primary: st.brand };
    return o;
  }

  // 미리보기(srcdoc) 사본에만 넣는 보정: srcdoc 문서에서는 주소 바꾸기(history.replaceState)가 막혀
  // reveal.js의 슬라이드 번호 기록이 오류를 낸다. 다운로드하는 HTML에는 넣지 않는다.
  const PREVIEW_SHIM = '<script>(function(){var h=history;["replaceState","pushState"].forEach(function(k){var f=h[k];h[k]=function(){try{return f.apply(h,arguments)}catch(e){}}})})();<\/script>';
  const previewHtml = (html) => html.replace(/<head[^>]*>/i, (m) => m + PREVIEW_SHIM);

  let renderTimer = 0;
  let inputGeneration = 0;
  function clearResult() {
    clearTimeout(renderTimer);
    Object.assign(st, { source: null, table: null, cols: [], spec: null, specFromFile: false, html: '', edited: { title: false, subtitle: false, summary: false } });
    el.frame.srcdoc = '';
    el.empty.hidden = false;
    el.device.hidden = true;
    el.info.hidden = true;
    el.colsPanel.hidden = true;
    el.contentPanel.hidden = true;
    el.sheet.innerHTML = '';
    el.sheet.closest('label').hidden = true;
    el.colBody.innerHTML = '';
    [el.title, el.subtitle, el.summary].forEach((input) => { input.value = ''; });
    el.status.textContent = '';
    el.textResult.textContent = '';
    [el.download, el.saveSpec, el.open, el.aiCopy].forEach((button) => { button.disabled = true; });
  }
  function scheduleRender(ms = 250) {
    clearTimeout(renderTimer);
    renderTimer = setTimeout(render, ms);
  }

  function render() {
    syncControls();
    renderPicked();
    const lib = st.chartLib || HC.resolve(st.design).d.chartLib || 'echarts';
    const notes = HC.notes(st.design, lib);
    el.notes.innerHTML = notes.map((t) => `<p class="note"><svg class="icon" aria-hidden="true"><use href="#i-alert"></use></svg><span>${esc(t)}</span>${/ApexCharts/.test(t) ? ' <button type="button" class="link-btn" data-fix-chart="echarts">ECharts로 바꾸기</button>' : ''}</p>`).join('');
    if (!st.spec) return;
    try {
      const res = HC.build(st.spec, st.design, renderOpts());
      st.html = res.html;
      el.empty.hidden = true;
      el.device.hidden = false;
      el.frame.srcdoc = previewHtml(res.html);
      const D = (window.PREVIEWER_DATA.items || []).find((it) => it.id === res.design);
      el.status.innerHTML = `<b>${esc(D ? D.name : res.design)}</b> · ${esc(KIT_LABEL[res.kit] || res.kit)} · ${esc(LIB_LABEL[res.chartLib] || res.chartLib)} · ${Math.round(new Blob([res.html]).size / 1024)}KB`;
      [el.download, el.saveSpec, el.open, el.aiCopy].forEach((b) => { b.disabled = false; });
      showError('');
      fit();
    } catch (e) {
      clearResult();
      showError(`만들지 못했습니다: ${e.message}`);
    }
  }

  // 미리보기 크기 맞춤 (① 미리보기와 같은 방식)
  const DEVICES = { desktop: { w: 1440, h: 900 }, tablet: { w: 820, h: 1180 }, mobile: { w: 390, h: 844 } };
  function fit() {
    if (el.device.hidden || el.view.hidden) return;
    const d = DEVICES[st.device];
    const desk = st.device === 'desktop';
    const pad = desk ? 0 : 24;
    const aw = Math.max(200, el.stage.clientWidth - pad * 2);
    const ah = Math.max(200, el.stage.clientHeight - pad * 2);
    const w = desk ? Math.max(d.w, aw) : d.w;
    const scale = desk ? Math.min(1, aw / w) : Math.min(1, aw / d.w, ah / d.h);
    const h = desk ? Math.ceil(ah / scale) : d.h;
    Object.assign(el.frame.style, { width: `${w}px`, height: `${h}px`, transform: `scale(${scale})` });
    Object.assign(el.device.style, { width: `${Math.floor(w * scale)}px`, height: `${Math.floor(h * scale)}px` });
    el.stage.dataset.device = st.device;
  }

  const fileBase = () => (((st.spec && st.spec.meta && st.spec.meta.title) || 'result').replace(/[\\/:*?"<>|]+/g, '_').trim() || 'result');
  function download(text, filename, type) {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const a = Object.assign(document.createElement('a'), { href: url, download: filename });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    toast(`${filename} 파일을 저장했습니다`);
  }

  // ── 데이터 넣기 ──
  function sourceTable(src, selection) {
    if (src.kind === 'workbook') {
      const table = sheetTable(src.workbook, selection);
      if (!table) throw new Error('데이터가 있는 시트를 찾지 못했습니다.');
      src.sheet = selection;
      return table;
    }
    if (src.kind === 'html') {
      const entry = src.tables.find((candidate) => candidate.id === selection);
      if (!entry?.table) throw new Error(entry?.error || '선택한 HTML 데이터를 찾지 못했습니다.');
      src.tableId = entry.id;
      src.tableLabel = entry.label;
      return entry.table;
    }
    return src.table;
  }

  async function ingest(file, { specOnly = false } = {}) {
    return loadSource(() => readFile(file), file.name, { specOnly });
  }

  async function ingestText(text = el.textSource.value, format = el.textFormat.value) {
    return loadSource(() => readText(text, format), '원문 텍스트', { autoText: format === 'auto' });
  }

  async function loadSource(readSource, name, { specOnly = false, autoText = false } = {}) {
    const generation = ++inputGeneration;
    clearResult();
    showError('');
    el.status.textContent = `${name} 읽는 중…`;
    try {
      const src = await readSource();
      if (generation !== inputGeneration) return;
      if (src.textFormat) el.textResult.textContent = `${autoText ? '자동 인식' : '지정한 형식'}: ${src.textFormat.toUpperCase()} (.${src.textFormat})`;
      if (specOnly && src.kind !== 'spec') throw new Error('spec.json 형식이 아닙니다(meta·kpis·charts·tables 등이 필요).');
      if (src.kind === 'spec') { useSpec(src.spec, src.name); return; }
      let table = src.table;
      if (src.kind === 'workbook') {
        const sheets = src.sheets.filter((s) => sheetTable(src.workbook, s));
        if (!sheets.length) throw new Error('데이터가 있는 시트를 찾지 못했습니다.');
        table = sourceTable(src, sheets[0]);
        el.sheetLabel.textContent = '시트';
        el.sheet.innerHTML = sheets.map((s) => `<option>${esc(s)}</option>`).join('');
        el.sheet.closest('label').hidden = sheets.length < 2;
      } else if (src.kind === 'html') {
        table = sourceTable(src, src.tableId);
        el.sheetLabel.textContent = src.selectionLabel || '표';
        el.sheet.innerHTML = src.tables.map((entry) => `<option value="${esc(entry.id)}"${entry.table ? '' : ' disabled'}>${esc(entry.label)}${entry.error ? ` · 사용 불가: ${esc(entry.error)}` : ''}</option>`).join('');
        el.sheet.value = src.tableId;
        el.sheet.closest('label').hidden = src.tables.length < 2;
      } else {
        el.sheet.closest('label').hidden = true;
      }
      useTable(src, table);
    } catch (e) {
      if (generation !== inputGeneration) return;
      clearResult();
      showError(e.message);
    }
  }

  function useTable(src, table) {
    st.source = src;
    st.table = table;
    st.cols = profile(table);
    st.specFromFile = false;
    st.edited = { title: false, subtitle: false, summary: false };
    el.info.hidden = false;
    $('.mk-file-name', el.info).textContent = src.name;
    $('.mk-file-meta', el.info).textContent = `${table.rows.length.toLocaleString('ko-KR')}행 · ${table.columns.length}개 열`;
    el.colsPanel.hidden = false;
    el.contentPanel.hidden = false;
    renderCols();
    regenerate();
  }

  function useSpec(spec, name) {
    if (!spec.meta || !spec.meta.title) throw new Error('spec.json에 meta.title이 필요합니다.');
    st.source = { kind: 'spec', name };
    st.table = null;
    st.cols = [];
    st.spec = spec;
    st.specFromFile = true;
    el.info.hidden = false;
    $('.mk-file-name', el.info).textContent = name;
    $('.mk-file-meta', el.info).textContent = `spec · KPI ${(spec.kpis || []).length} · 차트 ${(spec.charts || []).length} · 표 ${(spec.tables || []).length}`;
    el.sheet.closest('label').hidden = true;
    el.colsPanel.hidden = true;
    el.contentPanel.hidden = false;
    fillContent();
    scheduleRender(0);
  }

  // ── AI로 다듬기 (서버 없이: 프롬프트 복사 → Claude → 돌려받은 spec 붙여넣기) ──
  function aiPrompt() {
    return [
      `아래 spec.json은 '${st.source ? st.source.name : '데이터'}'를 규칙으로 집계해 만든 html-convertor spec입니다.`,
      '숫자·차트·표 값은 바꾸지 말고, summary(3~5문장)와 sections(주요 발견·주의점)를 이 숫자들에 근거해 더 읽기 좋게 다듬어 주세요.',
      '데이터에 없는 원인이나 수치는 지어내지 말고, 확인이 필요한 해석은 "확인 필요"라고 적어 주세요.',
      '결과는 spec.json 전체를 JSON 코드 블록 하나로만 답해 주세요.',
      '',
      '```json',
      JSON.stringify(st.spec, null, 2),
      '```',
    ].join('\n');
  }

  async function copy(text, msg) {
    try { await navigator.clipboard.writeText(text); toast(msg); } catch {
      const ta = Object.assign(document.createElement('textarea'), { value: text });
      ta.style.cssText = 'position:fixed;opacity:0';
      document.body.appendChild(ta);
      ta.select();
      let ok = false;
      try { ok = document.execCommand('copy'); } catch { ok = false; }
      ta.remove();
      toast(ok ? msg : '복사하지 못했습니다');
    }
  }

  // ── 화면 전환 (① 고르기 ↔ ② 만들기) ──
  function showView(view, push = true) {
    const make = view === 'make';
    el.view.hidden = !make;
    el.pick.hidden = make;
    $$('[data-view]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === view)));
    if (push) {
      const hash = make ? '#make' : (location.hash === '#make' ? '' : location.hash);
      history.replaceState(null, '', hash || location.pathname + location.search);
    }
    if (make) {
      applySelection(false);
      // 좁은 화면에서는 1440px 데스크톱을 30% 아래로 줄여 보여 주면 알아보기 어려우므로 모바일 크기로 시작
      if (!st.deviceChosen) setDevice(window.innerWidth < 760 ? 'mobile' : 'desktop');
      render();
      window.scrollTo(0, 0);
      requestAnimationFrame(fit);
    }
  }

  // ── 이벤트 ──
  el.drop.addEventListener('click', () => el.file.click());
  el.drop.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); el.file.click(); } });
  el.file.addEventListener('change', () => { if (el.file.files[0]) ingest(el.file.files[0]); el.file.value = ''; });
  ['dragenter', 'dragover'].forEach((t) => el.drop.addEventListener(t, (e) => { e.preventDefault(); el.drop.classList.add('is-over'); }));
  ['dragleave', 'drop'].forEach((t) => el.drop.addEventListener(t, (e) => { e.preventDefault(); el.drop.classList.remove('is-over'); }));
  el.drop.addEventListener('drop', (e) => { const f = e.dataTransfer.files[0]; if (f) ingest(f); });
  el.sample.addEventListener('click', () => ingest(new File([buildSample()], SAMPLE_NAME, { type: 'text/csv' })));
  el.textApply.addEventListener('click', () => ingestText());
  $$('[data-mk-sample]').forEach((b) => b.addEventListener('click', () => el.sample.click()));
  el.specBtn.addEventListener('click', () => el.specFile.click());
  el.specFile.addEventListener('change', () => {
    const f = el.specFile.files[0];
    el.specFile.value = '';
    if (!f) return;
    ingest(f, { specOnly: true });
  });
  el.sheet.addEventListener('change', () => {
    const src = st.source;
    if (!src) return;
    try { useTable(src, sourceTable(src, el.sheet.value)); } catch (e) { clearResult(); showError(e.message); }
  });
  el.colBody.addEventListener('change', (e) => {
    const i = e.target.dataset && e.target.dataset.col;
    if (i == null) return;
    const col = st.cols.find((c) => String(c.index) === i);
    if (e.target.value === 'time') st.cols.forEach((c) => { if (c.role === 'time' && c !== col) c.role = 'ignore'; });
    col.role = e.target.value;
    renderCols();
    regenerate();
  });
  el.gran.addEventListener('change', () => { st.gran = el.gran.value; regenerate(); });
  // 글자를 칠 때마다 미리보기를 다시 그리면 무거우므로 입력이 멈춘 뒤 그린다
  el.title.addEventListener('input', () => { if (!st.spec) return; st.edited.title = true; st.spec.meta.title = el.title.value; scheduleRender(500); });
  el.subtitle.addEventListener('input', () => { if (!st.spec) return; st.edited.subtitle = true; st.spec.meta.subtitle = el.subtitle.value; scheduleRender(500); });
  el.summary.addEventListener('input', () => {
    if (!st.spec) return;
    st.edited.summary = true;
    st.spec.summary = el.summary.value.split('\n').map((s) => s.trim()).filter(Boolean);
    scheduleRender(600);
  });
  el.design.addEventListener('change', () => { st.design = el.design.value; st.designChosen = true; persist(); scheduleRender(0); });
  el.kit.addEventListener('change', () => { st.kit = el.kit.value; persist(); scheduleRender(0); });
  el.chart.addEventListener('change', () => { st.chartLib = el.chart.value; persist(); scheduleRender(0); });
  el.theme.addEventListener('change', () => { st.theme = el.theme.value; persist(); scheduleRender(0); });
  el.brandOn.addEventListener('change', () => { st.brandOn = el.brandOn.checked; persist(); scheduleRender(0); });
  el.brand.addEventListener('input', () => { st.brand = el.brand.value; persist(); scheduleRender(300); });
  el.picked.addEventListener('click', (e) => {
    const b = e.target.closest('[data-pick]');
    if (!b) return;
    const id = b.dataset.pick;
    if (HC.CHART_IDS[id]) st.chartLib = HC.CHART_IDS[id];
    else { st.design = id; st.designChosen = true; }
    persist();
    scheduleRender(0);
  });
  el.notes.addEventListener('click', (e) => {
    const b = e.target.closest('[data-fix-chart]');
    if (!b) return;
    st.chartLib = b.dataset.fixChart;
    persist();
    scheduleRender(0);
    toast('차트 라이브러리를 ECharts로 바꿨습니다');
  });
  function setDevice(device) {
    st.device = device;
    $$('[data-mk-device]').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.mkDevice === device)));
    fit();
  }
  $$('[data-mk-device]').forEach((b) => b.addEventListener('click', () => { st.deviceChosen = true; setDevice(b.dataset.mkDevice); }));
  el.download.addEventListener('click', () => { if (st.html) download(st.html, `${fileBase()}.html`, 'text/html;charset=utf-8'); });
  el.saveSpec.addEventListener('click', () => { if (st.spec) download(JSON.stringify(st.spec, null, 2), `${fileBase()}.spec.json`, 'application/json;charset=utf-8'); });
  el.open.addEventListener('click', () => {
    if (!st.html) return;
    const w = window.open('', '_blank');
    if (!w) { toast('팝업이 막혀 있습니다. 브라우저에서 팝업을 허용해 주세요'); return; }
    w.document.open();
    w.document.write(st.html);
    w.document.close();
  });
  el.aiCopy.addEventListener('click', () => { if (st.spec) copy(aiPrompt(), 'Claude에게 줄 요청문을 복사했습니다'); });
  el.aiApply.addEventListener('click', () => {
    const text = el.aiPaste.value;
    const m = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    try {
      const data = JSON.parse(m ? m[1] : text);
      if (!isSpec(data)) throw new Error('spec.json 형식이 아닙니다.');
      const name = st.source ? st.source.name : 'spec.json';
      useSpec(data, name);
      el.aiPaste.value = '';
      toast('다듬어진 spec을 적용했습니다');
    } catch (e) { showError(`붙여 넣은 내용을 읽지 못했습니다: ${e.message}`); }
  });
  $$('[data-view]').forEach((b) => b.addEventListener('click', () => showView(b.dataset.view)));
  document.addEventListener('previewer:make', (e) => {
    const id = e.detail && e.detail.id;
    if (id) {
      if (HC.CHART_IDS[id]) st.chartLib = HC.CHART_IDS[id];
      else { st.design = id; st.designChosen = true; }
      persist();
    } else applySelection(true);
    showView('make');
  });
  document.addEventListener('previewer:selection', () => { if (!el.view.hidden) { applySelection(false); render(); } });
  if ('ResizeObserver' in window) new ResizeObserver(() => fit()).observe(el.stage);
  else window.addEventListener('resize', fit);

  // ── 시작 ──
  el.file.accept = window.HC_INPUT.accept();
  $('#mk-drop-hint').textContent = window.HC_INPUT.hint();
  el.textFormat.innerHTML = '<option value="auto">자동 인식</option>' + window.HC_INPUT.textFormats().map((format) => `<option value="${esc(format.extension)}">${esc(format.label)}</option>`).join('');
  if (!HC.list().some((d) => d.id === st.design)) st.design = 'tabler';
  if (st.chartLib && !HC.chartLibs().includes(st.chartLib)) st.chartLib = '';
  if (st.kit && !HC.kits()[st.kit]) st.kit = '';
  fillDesignOptions();
  syncControls();
  if (location.hash === '#make') showView('make', false);

  // 콘솔·테스트용
  Object.assign(window.HC.make, { ingest, ingestText, render, showView, state: st });
})();
