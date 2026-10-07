// HTML Previewer 브라우저 테스트: Edge(없으면 Chrome)를 헤드리스로 띄워 CDP로 클릭·입력·파일 올리기·스크린샷.
//
// 사용 (html/ 폴더에서):
//   node tests/previewer/browser_test.mjs page     # ① 고르기: 카드·필터·검색·미리보기·선택·내보내기·다크·모바일
//   node tests/previewer/browser_test.mjs make     # ② 만들기: 선택 연동·샘플·엑셀·CSV·디자인 변경·다운로드·spec·모바일
//   node tests/previewer/browser_test.mjs html     # HTML 입력: 표·spec 재입력·스크립트 차단·실패 후 초기화 (assert)
//   node tests/previewer/browser_test.mjs text     # 원문 텍스트 입력: 감지·수동 형식·오류·파일 경합 (assert)
//   node tests/previewer/browser_test.mjs embedded # application/json 내장 레코드 HTML (합성 데이터, assert)
//   node tests/previewer/browser_test.mjs render   # 원본 HTML 렌더링·분석과 원본/다른 디자인 적용 (assert)
//   embedded 모드의 선택적 4번째 인자는 로컬 전용 HTML 첨부 경로입니다(원문·출력 파일 저장 없음).
//   node tests/previewer/browser_test.mjs search   # 검색만
//   node tests/previewer/browser_test.mjs embed    # 페이지 안 미리보기가 되는 데모를 전부 실제로 열어 캡처 (몇 분 걸림)
//   node tests/previewer/browser_test.mjs page dist/html-previewer.html   # 단일 파일판 검사
// 결과(로그·스크린샷·다운로드 파일)는 tests/previewer/out/<mode>/ 에 남는다. 마지막 줄이 '콘솔 오류·예외 없음'이면 통과.
import { spawn, execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const EDGE = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
].find((p) => existsSync(p));
if (!EDGE) { console.error('Edge 또는 Chrome을 찾지 못했습니다'); process.exit(2); }
const mode = process.argv[2] || 'page';
const pagePath = resolve(ROOT, process.argv[3] || 'index.html');
const outDir = join(HERE, 'out', mode);
process.argv[5] = process.argv[5] || join(ROOT, 'tests', 'convertor', 'fixtures'); // make 모드의 테스트 입력 폴더
const PORT = mode === 'embed' ? 9334 : mode === 'make' ? 9335 : mode === 'html' ? 9336 : mode === 'text' ? 9338 : mode === 'embedded' ? 9339 : mode === 'render' ? 9342 : 9333;
mkdirSync(outDir, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(...a);

const profile = mkdtempSync(join(tmpdir(), 'edge-cdp-'));
spawn(EDGE, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check',
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, '--window-size=1440,900', 'about:blank'],
  { stdio: 'ignore', detached: false });

async function getJSON(path) {
  for (let i = 0; i < 60; i++) {
    try { const r = await fetch(`http://127.0.0.1:${PORT}${path}`); if (r.ok) return await r.json(); } catch { /* 대기 */ }
    await sleep(500);
  }
  throw new Error('CDP 연결 실패');
}

class CDP {
  constructor(url) { this.url = url; this.id = 0; this.pending = new Map(); this.handlers = []; }
  open() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.url);
      this.ws.onopen = () => resolve();
      this.ws.onerror = (e) => reject(e);
      this.ws.onmessage = (ev) => {
        const msg = JSON.parse(ev.data);
        if (msg.id && this.pending.has(msg.id)) {
          const { resolve: ok, reject: no } = this.pending.get(msg.id);
          this.pending.delete(msg.id);
          if (msg.error) no(new Error(msg.error.message)); else ok(msg.result);
        } else if (msg.method) this.handlers.forEach((h) => h(msg));
      };
    });
  }
  send(method, params = {}, sessionId) {
    const id = ++this.id;
    this.ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }));
  }
  on(h) { this.handlers.push(h); }
}

const version = await getJSON('/json/version');
const targets = await getJSON('/json/list');
const pageTarget = targets.find((t) => t.type === 'page');
const cdp = new CDP(pageTarget.webSocketDebuggerUrl);
await cdp.open();

const problems = [];
cdp.on((m) => {
  if (m.method === 'Runtime.exceptionThrown') {
    const description = m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text;
    if (!(mode === 'render' && description.includes('RENDER_TEST_EXPECTED_FAILURE'))) problems.push(`예외: ${description}`);
  }
  if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
    const description = m.params.args.map((a) => a.value || a.description).join(' ');
    if (!(mode === 'render' && description.includes('RENDER_TEST_EXPECTED_FAILURE'))) problems.push(`console.error: ${description}`);
  }
  if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error' && /file:\/\//.test(m.params.entry.url || '')) problems.push(`로드 오류: ${m.params.entry.text} ${m.params.entry.url}`);
});
await cdp.send('Page.enable');
await cdp.send('Runtime.enable');
await cdp.send('Log.enable');

async function evaluate(expression) {
  const r = await cdp.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(`${r.exceptionDetails.text} ${r.exceptionDetails.exception?.description || ''}`);
  return r.result.value;
}
async function shot(name, { full = false, scale = 1, format = 'png', quality } = {}) {
  const params = { format };
  if (quality) params.quality = quality;
  if (full || scale !== 1) {
    const m = await cdp.send('Page.getLayoutMetrics');
    const vw = Math.ceil(m.cssLayoutViewport.clientWidth);
    const h = full ? Math.ceil(m.cssContentSize.height) : Math.ceil(m.cssLayoutViewport.clientHeight);
    params.captureBeyondViewport = full;
    // clip 좌표는 문서 기준이므로 스크롤 위치를 더해야 현재 화면이 찍힌다
    params.clip = { x: 0, y: full ? 0 : m.cssVisualViewport.pageY, width: vw, height: h, scale };
  }
  const r = await cdp.send('Page.captureScreenshot', params);
  const file = join(outDir, `${name}.${format === 'jpeg' ? 'jpg' : 'png'}`);
  writeFileSync(file, Buffer.from(r.data, 'base64'));
  return file;
}
async function navigate(url) {
  const loaded = new Promise((res) => { const h = (m) => { if (m.method === 'Page.loadEventFired') res(); }; cdp.on(h); });
  await cdp.send('Page.navigate', { url });
  await Promise.race([loaded, sleep(20000)]); // 같은 문서 안 이동이면 load가 오지 않으므로 최대 20초
  await sleep(1200);
}
async function waitPreviewLoaded(maxMs = 12000) {
  const t0 = Date.now();
  while (Date.now() - t0 < maxMs) {
    const done = await evaluate(`document.getElementById('pv-loading').hidden`);
    if (done) return Date.now() - t0;
    await sleep(300);
  }
  return -1;
}
const click = (sel) => evaluate(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) throw new Error('없음: ' + ${JSON.stringify(sel)}); e.click(); return true; })()`);

const url = pathToFileURL(pagePath).href;

try {
  if (mode === 'render') {
    const fixtures = join(ROOT, 'tests', 'convertor', 'fixtures', 'html-input');
    const S = 'window.HC.make.state';
    const source = readFileSync(join(fixtures, 'render-dynamic.html'), 'utf8');
    const sourceOrigin = 'https://render-html-test.invalid';
    const sourceRequests = new Map();
    const contexts = new Map();
    cdp.on((m) => {
      const session = m.sessionId || '';
      if (m.method === 'Runtime.executionContextCreated' && m.params.context.auxData?.isDefault) {
        contexts.set(`${session}:${m.params.context.id}`, { id: m.params.context.id, session });
      }
      if (m.method === 'Runtime.executionContextDestroyed') contexts.delete(`${session}:${m.params.executionContextId}`);
      if (m.method === 'Runtime.executionContextsCleared') {
        for (const [key, context] of contexts) if (context.session === session) contexts.delete(key);
      }
      if (m.method === 'Network.requestWillBeSent' && m.params.request.url.startsWith(sourceOrigin)) {
        sourceRequests.set(`${session}:${m.params.requestId}`, { url: m.params.request.url });
      }
      if (m.method === 'Network.loadingFailed') {
        const request = sourceRequests.get(`${session}:${m.params.requestId}`);
        if (request) request.blockedReason = m.params.blockedReason;
      }
      if (m.method === 'Target.attachedToTarget' && m.params.targetInfo.type === 'iframe') {
        const childSession = m.params.sessionId;
        // Opaque frames may be separate renderer targets; observe their real realms through CDP.
        (async () => {
          await cdp.send('Runtime.enable', {}, childSession);
          await cdp.send('Network.enable', {}, childSession);
          await cdp.send('Target.setAutoAttach', { autoAttach: true, waitForDebuggerOnStart: false, flatten: true }, childSession);
        })().catch(() => { /* A new input can remove a frame while its observation is being enabled. */ });
      }
    });
    await cdp.send('Network.enable');
    // Observe the renderer's CSP directly; a CDP blocker would replace its reason with "inspector".
    await cdp.send('Target.setAutoAttach', { autoAttach: true, waitForDebuggerOnStart: false, flatten: true });
    const waitUntil = async (expression, description, maxMs = 12000) => {
      const start = Date.now();
      while (Date.now() - start < maxMs) {
        if (await evaluate(expression)) return;
        await sleep(50);
      }
      const status = await evaluate("document.getElementById('mk-html-analysis')?.textContent || document.getElementById('mk-error').textContent");
      assert.fail(`${description} timed out${status ? `: ${status}` : ''}`);
    };
    const setFile = async (path) => {
      const { root } = await cdp.send('DOM.getDocument', { depth: -1 });
      const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector: '#mk-file' });
      await cdp.send('DOM.setFileInputFiles', { files: [path], nodeId });
    };
    const load = async (filename) => {
      await setFile(join(fixtures, filename));
      await waitUntil(`${S}.htmlInput?.name === ${JSON.stringify(filename)}`, `read ${filename}`);
    };
    const renderSource = async () => {
      await click('#mk-html-render');
      await waitUntil(`${S}.htmlInput?.rendered && !document.getElementById('mk-html-apply').disabled`, 'source rendering and analysis');
    };
    const applyMode = async (modeName) => {
      await evaluate(`(() => { const mode = document.getElementById('mk-html-mode'); mode.value = ${JSON.stringify(modeName)}; mode.dispatchEvent(new Event('change')); document.getElementById('mk-html-apply').click(); })()`);
      await waitUntil(`${S}.htmlMode === ${JSON.stringify(modeName)} && ${S}.html.length > 0 && ${S}.originalMode === ${modeName === 'preserve'}`, `apply ${modeName}`);
    };
    const originalValue = async (expression) => {
      const start = Date.now();
      while (Date.now() - start < 4000) {
        for (const context of [...contexts.values()].reverse()) {
          try {
            const result = await cdp.send('Runtime.evaluate', {
              contextId: context.id, returnByValue: true,
              expression: `(() => { if (!document.getElementById('counterButton')) return {found:false}; return {found:true,value:(${expression})}; })()`,
            }, context.session || undefined);
            if (result.result?.value?.found) return result.result.value.value;
          } catch { /* Ignore realms removed by an input or mode change. */ }
        }
        await sleep(50);
      }
      assert.fail('the opaque original source realm is available to CDP');
    };
    const expectRedesign = async () => {
      assert.deepEqual(await evaluate(`({columns:${S}.table.columns,rows:${S}.table.rows})`), { columns: ['부서', '매출'], rows: [['서울', '100'], ['부산', '200']] });
      assert.equal(await evaluate(`${S}.spec.kpis.find(k => k.label === '총 매출')?.value`), 300);
      assert.equal(await evaluate(`${S}.html.includes('parent.document.body.dataset.renderSourceTouched')`), false, 'source JavaScript is absent from redesigned output');
      assert.equal(await evaluate("document.getElementById('mk-save-spec').disabled"), false);
    };

    await navigate(`${url}#make`);
    await evaluate('localStorage.clear()');
    await navigate(`${url}?render-test=1#make`);
    assert.equal(await evaluate("Boolean(document.getElementById('mk-html-panel'))"), true, 'the HTML render/analyze panel exists');
    assert.equal(await evaluate("Boolean(document.getElementById('mk-html-render'))"), true, 'the original rendering action exists');
    assert.equal(await evaluate("Boolean(document.getElementById('mk-original-frame'))"), true, 'original HTML uses its dedicated frame');
    assert.deepEqual(await evaluate("[...document.getElementById('mk-html-mode').options].map(o => o.value).sort()"), ['preserve', 'redesign']);

    await load('render-dynamic.html');
    assert.equal(await evaluate("document.getElementById('mk-html-panel').hidden"), false);
    assert.equal(await evaluate(`${S}.htmlInput.html`), source);
    assert.equal(await evaluate(`${S}.htmlInput.rendered`), null, 'HTML upload keeps source execution opt-in');
    assert.equal(await evaluate(`${S}.originalMode`), false);
    assert.equal(await evaluate("document.body.dataset.renderSourceTouched"), undefined);
    log('PASS: HTML upload stays inert and offers explicit rendering');

    await renderSource();
    assert.deepEqual(await evaluate(`({tables:${S}.htmlInput.rendered.analysis.tableCount,svg:${S}.htmlInput.rendered.analysis.svgCount})`), { tables: 1, svg: 1 });
    assert.deepEqual(await evaluate(`(() => {
      const snapshot = document.createElement('template'); snapshot.innerHTML = ${S}.htmlInput.rendered.snapshot;
      return {
        rows: [...snapshot.content.querySelectorAll('#salesRows tr')].map(row => [...row.cells].map(cell => cell.textContent)),
        circles: snapshot.content.querySelectorAll('#drawing circle').length,
        executableScripts: snapshot.content.querySelectorAll('script:not([type="application/json"])').length,
        eventAttribute: snapshot.content.querySelector('#counterButton').hasAttribute('onclick')
      };
    })()`), { rows: [['서울', '100'], ['부산', '200']], circles: 3, executableScripts: 0, eventAttribute: false });
    assert.equal(await evaluate(`${S}.html`), '', 'rendering collects a snapshot before a mode is applied');
    assert.equal(await evaluate("document.getElementById('mk-download').disabled"), true);
    assert.match(await evaluate("document.getElementById('mk-html-analysis').textContent"), /표|table|SVG/i);
    log('PASS: explicit rendering captures dynamic table and SVG without auto-applying');

    await applyMode('preserve');
    assert.equal(await evaluate(`${S}.html`), source, 'preserve output is byte-for-byte source text');
    assert.equal(await evaluate(`${S}.spec`), null);
    assert.equal(await evaluate("document.getElementById('mk-save-spec').disabled"), true);
    assert.equal(await evaluate("document.getElementById('mk-download').disabled"), false);
    assert.equal(await evaluate("document.getElementById('mk-original-device').hidden"), false);
    const sandbox = await evaluate("document.getElementById('mk-original-frame').getAttribute('sandbox').split(/\\s+/)");
    assert.ok(sandbox.includes('allow-scripts') && !sandbox.includes('allow-same-origin'), 'original preview uses an opaque sandbox');
    assert.equal(await originalValue("document.getElementById('counterValue').textContent"), '0');
    await originalValue("(document.getElementById('counterButton').click(), 'clicked')");
    assert.equal(await originalValue("document.getElementById('counterValue').textContent"), '1', 'the preserved source button keeps its original behavior');
    assert.equal(await originalValue('window.__renderTopBlocked'), true);
    assert.equal(await evaluate("document.body.dataset.renderSourceTouched"), undefined);
    log('PASS: preserve keeps source text, interactive controls and sandbox isolation');
    await shot('render_original');

    const downloads = [];
    const completedDownloads = new Set();
    const browser = new CDP(version.webSocketDebuggerUrl); await browser.open();
    browser.on(m => {
      if (m.method === 'Browser.downloadWillBegin') downloads.push(m.params);
      if (m.method === 'Browser.downloadProgress' && m.params.state === 'completed') completedDownloads.add(m.params.guid);
    });
    await browser.send('Browser.setDownloadBehavior', { behavior: 'allowAndName', downloadPath: outDir, eventsEnabled: true });
    const downloadBytes = async () => {
      const before = downloads.length;
      await click('#mk-download');
      for (let attempts = 0; attempts < 100 && (!downloads[before] || !completedDownloads.has(downloads[before].guid)); attempts += 1) await sleep(50);
      assert.equal(downloads.length, before + 1, 'preserve starts one real download');
      const item = downloads[before];
      assert.ok(completedDownloads.has(item.guid), 'the original download finishes before its bytes are checked');
      assert.match(item.suggestedFilename, /\.html$/i);
      return readFileSync(join(outDir, item.guid));
    };
    assert.equal((await downloadBytes()).toString('utf8'), source, 'the downloaded original remains unchanged');
    log('PASS: preserved HTML download contains exact original source');

    await applyMode('redesign');
    await expectRedesign();
    await waitUntil("(() => { const text=document.getElementById('mk-frame').contentDocument?.body?.innerText || ''; return text.includes('서울') && text.includes('300'); })()", 'visible redesigned frame content before screenshot', 20000);
    await waitUntil("!document.getElementById('toast').classList.contains('show')", 'download notification closes before screenshot');
    await shot('render_redesign', { full: true });
    await applyMode('preserve');
    assert.equal(await evaluate(`${S}.html`), source);
    assert.equal(await evaluate(`${S}.htmlInput.html`), source);
    await applyMode('redesign');
    await expectRedesign();
    log('PASS: redesign uses rendered rows and mode round trips keep the same original');

    await evaluate(`(() => { document.getElementById('mk-text-input').open = true; document.getElementById('mk-text-format').value = 'auto'; document.getElementById('mk-text-source').value = ${JSON.stringify(source)}; document.getElementById('mk-text-apply').click(); })()`);
    await waitUntil(`${S}.htmlInput?.name === '붙여넣은 데이터.html'`, 'pasted HTML source');
    assert.equal(await evaluate(`${S}.htmlInput.rendered`), null);
    await renderSource();
    await applyMode('redesign');
    await expectRedesign();
    await applyMode('preserve');
    assert.equal(await evaluate(`${S}.html`), source);
    log('PASS: pasted HTML offers both source and redesigned modes');

    await load('render-body.html');
    await renderSource();
    await applyMode('redesign');
    assert.equal(await evaluate(`${S}.table`), null);
    assert.match(await evaluate(`JSON.stringify({sections:${S}.spec.sections,summary:${S}.spec.summary})`), /동적으로 채운 본문/);
    assert.equal(await evaluate(`${S}.html.includes("document.getElementById('dynamicBody').textContent")`), false,
      `body redesign excludes source JavaScript; analyzed body: ${await evaluate(`${S}.htmlInput.rendered.analysis.bodyText`)}`);
    log('PASS: rendered body text redesigns without a table');

    await load('render-network.html');
    await renderSource();
    assert.equal(await evaluate(`${S}.htmlInput.rendered.analysis.partial`), true);
    assert.match(await evaluate(`JSON.stringify(${S}.htmlInput.rendered.analysis.warnings)`), /CSP|외부|차단|restrict/i);
    const networkWarnings = await evaluate(`JSON.stringify(${S}.htmlInput.rendered.analysis.warnings)`);
    // Edge reports a blocked cross-origin frame navigation using its origin, without the URL path.
    assert.match(networkWarnings, /frame-src.*https:\/\/render-html-test\.invalid/, 'an attempted source-frame navigation is reported as a CSP frame restriction');
    assert.ok(sourceRequests.size > 0, 'CDP observes source resource requests and their blocked outcomes');
    assert.ok([...sourceRequests.values()].every(request => request.blockedReason === 'csp'), `source resource requests are blocked by CSP: ${JSON.stringify([...sourceRequests.values()])}`);
    assert.equal(await evaluate("document.body.dataset.renderSourceTouched"), undefined);
    log('PASS: source resource restrictions produce partial-result warnings');

    await load('render-failure.html');
    await renderSource();
    assert.equal(await evaluate(`${S}.htmlInput.rendered.analysis.partial`), true);
    assert.match(await evaluate(`JSON.stringify(${S}.htmlInput.rendered.analysis.warnings)`), /RENDER_TEST_EXPECTED_FAILURE/);
    assert.equal(await evaluate(`${S}.html`), '');
    assert.equal(await evaluate(`${S}.spec`), null);
    assert.equal(await evaluate("document.getElementById('mk-download').disabled"), true);
    log('PASS: source script failure is reported without retaining a previous output');

    await load('render-dynamic.html');
    await click('#mk-html-render');
    await load('render-body.html');
    await sleep(1400);
    assert.equal(await evaluate(`${S}.htmlInput.name`), 'render-body.html');
    assert.equal(await evaluate(`${S}.htmlInput.rendered`), null, 'an older source render cannot attach its snapshot to a new input');
    assert.equal(await evaluate("document.getElementById('mk-html-apply').disabled"), true);
    log('PASS: replacing HTML ignores an older pending render');

    await renderSource(); await applyMode('preserve');
    await evaluate("(() => { document.getElementById('mk-text-format').value='csv'; document.getElementById('mk-text-source').value='부서,매출\\n서울,100\\n부산,200'; document.getElementById('mk-text-apply').click(); })()");
    await waitUntil(`${S}.source?.name === '붙여넣은 데이터.csv' && ${S}.html.length > 0`, 'CSV replaces preserved HTML');
    assert.equal(await evaluate(`${S}.htmlInput`), null);
    assert.equal(await evaluate(`${S}.originalMode`), false);
    assert.equal(await evaluate("document.getElementById('mk-original-device').hidden"), true);
    assert.equal(await evaluate("document.getElementById('mk-html-panel').hidden"), true);
    log('PASS: ordinary data input clears preserved source state');

    await evaluate(`(() => {
      const file = new File([${JSON.stringify(source)}], 'late-render-source.html');
      const readBytes = file.arrayBuffer.bind(file);
      file.arrayBuffer = async () => { await new Promise(resolve => {window.__releaseRenderRead=resolve;}); return readBytes(); };
      window.__lateRenderRead=window.HC.make.ingest(file);
    })()`);
    await evaluate("(() => { document.getElementById('mk-text-format').value='csv'; document.getElementById('mk-text-source').value='부서,매출\\n서울,100\\n부산,200'; document.getElementById('mk-text-apply').click(); })()");
    await waitUntil(`${S}.source?.name === '붙여넣은 데이터.csv' && ${S}.html.length > 0`, 'newer CSV while HTML bytes wait');
    await evaluate('(async () => { window.__releaseRenderRead(); await window.__lateRenderRead; })()');
    assert.equal(await evaluate(`${S}.htmlInput`), null, 'late HTML bytes cannot restore stale rendering state');
    assert.equal(await evaluate(`${S}.originalMode`), false);
    log('PASS: late HTML reads cannot overwrite newer source state');

    await load('render-spec-priority.html');
    await waitUntil(`${S}.spec?.kpis?.[0]?.value === 100`, 'default embedded spec');
    assert.equal(await evaluate(`${S}.spec.kpis[0].value`), 100, 'inert HTML import keeps the embedded spec contract');
    await renderSource();
    await applyMode('redesign');
    assert.deepEqual(await evaluate(`({columns:${S}.table.columns,rows:${S}.table.rows})`), { columns: ['부서', '매출'], rows: [['부산', '200']] });
    assert.equal(await evaluate(`${S}.spec.kpis.find(k => k.label === '총 매출')?.value`), 200, 'opt-in redesign prioritizes the current rendered table');
    log('PASS: embedded spec is the default while redesign uses updated rendered table values');

    for (const filename of ['render-body-layout.html', 'render-body-empty-table.html']) {
      await load(filename);
      await renderSource();
      await applyMode('redesign');
      assert.equal(await evaluate(`${S}.table`), null, `${filename}: unsupported table falls back to prose`);
      assert.deepEqual(await evaluate(`${S}.spec.kpis`), [], `${filename}: prose fallback invents no numeric KPI`);
      assert.match(await evaluate(`JSON.stringify(${S}.spec.sections)`), /읽을 본문/);
      assert.match(await evaluate("document.getElementById('mk-html-analysis').textContent"), /본문으로|본문.*적용/);
      assert.match(await evaluate("document.getElementById('mk-html-analysis').textContent"), /집계.*않|집계.*없/);
      log(`PASS: ${filename} keeps prose and explains why no data table was applied`);
    }

    await load('render-delayed.html');
    await renderSource();
    assert.deepEqual(await evaluate(`(() => {
      const snapshot=document.createElement('template');snapshot.innerHTML=${S}.htmlInput.rendered.snapshot;
      return [...snapshot.content.querySelectorAll('#delayedRows tr')].map(row=>[...row.cells].map(cell=>cell.textContent));
    })()`), [['서울', '3']], 'analysis includes a table populated after a 1.5 second timer');
    await applyMode('redesign');
    assert.deepEqual(await evaluate(`({columns:${S}.table.columns,rows:${S}.table.rows})`), { columns: ['부서', '매출'], rows: [['서울', '3']] });
    assert.equal(await evaluate(`${S}.spec.kpis.find(k => k.label === '총 매출')?.value`), 3);
    log('PASS: analysis captures a table created by a delayed inline timer');

    const legacySource = '<!doctype html><meta charset="euc-kr"><title>한글 원본</title><table><thead><tr><th>부서</th><th>매출</th></tr></thead><tbody><tr><td>서울</td><td>3</td></tr></tbody></table>';
    // Independent EUC-KR byte literals protect the source charset, rather than using app decoding as an oracle.
    const legacyBytes = Buffer.concat([
      Buffer.from('<!doctype html><meta charset="euc-kr"><title>'), Buffer.from('c7d1b1db20bff8babb', 'hex'),
      Buffer.from('</title><table><thead><tr><th>'), Buffer.from('bacebcad', 'hex'),
      Buffer.from('</th><th>'), Buffer.from('b8c5c3e2', 'hex'),
      Buffer.from('</th></tr></thead><tbody><tr><td>'), Buffer.from('bcadbfef', 'hex'),
      Buffer.from('</td><td>3</td></tr></tbody></table>'),
    ]);
    const byteSources = [
      { name: 'render-legacy-euckr.html', bytes: legacyBytes, expected: legacySource },
      { name: 'render-utf8-bom.html', bytes: Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(source)]), expected: source },
    ];
    for (const sample of byteSources) {
      const path = join(outDir, sample.name); writeFileSync(path, sample.bytes);
      await setFile(path);
      await waitUntil(`${S}.htmlInput?.name === ${JSON.stringify(sample.name)}`, `read ${sample.name}`);
      assert.equal(await evaluate(`${S}.htmlInput.html`), sample.expected);
      await renderSource(); await applyMode('preserve');
      assert.equal(await evaluate(`${S}.html`), sample.expected);
      assert.deepEqual(await downloadBytes(), sample.bytes, `${sample.name}: original download preserves exact bytes including charset/BOM`);
      log(`PASS: ${sample.name} preservation downloads exact original file bytes`);
    }
    await evaluate(`window.HC.make.ingestText(${JSON.stringify(legacySource)}, 'html')`);
    await renderSource(); await applyMode('preserve');
    assert.equal(await evaluate(`${S}.html`), legacySource, 'pasted legacy meta keeps the entered Unicode source');
    const pastedBytes = await downloadBytes();
    assert.deepEqual(pastedBytes, Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(legacySource)]), 'pasted legacy charset source downloads Unicode as UTF-8 with a BOM');
    const reopened = join(outDir, 'render-pasted-legacy-reopened.html'); writeFileSync(reopened, pastedBytes);
    await navigate(pathToFileURL(reopened).href);
    assert.equal(await evaluate('document.title'), '한글 원본', 'reopened pasted output honors the UTF-8 BOM');
    assert.match(await evaluate('document.body.innerText'), /부서.*매출.*서울/s);
    log('PASS: pasted HTML with a legacy charset reopens with correct Unicode');
    await navigate(`${url}?render-test=2#make`);

    if (process.argv[4]) {
      // Read this attachment only into the browser; never save its source, output or screenshots.
      await setFile(resolve(process.argv[4]));
      await waitUntil(`${S}.htmlInput`, 'local attachment input');
      await renderSource();
      assert.deepEqual(await evaluate(`(() => {
        const snapshot=document.createElement('template');snapshot.innerHTML=${S}.htmlInput.rendered.snapshot;
        const rows=[...snapshot.content.querySelectorAll('#viaRows tr')];
        return {rows:rows.length,cuts:rows.reduce((sum,row)=>sum+Number(row.cells[1].textContent),0)};
      })()`), { rows: 15, cuts: 189 });
      assert.ok(await evaluate(`${S}.htmlInput.rendered.analysis.svgCount > 0`));
      log('PASS: local attachment rendering captures 15 visible VIA rows and Cut total 189');
      await applyMode('preserve');
      assert.equal(await evaluate(`${S}.html === ${S}.htmlInput.html`), true);
      assert.equal(await evaluate(`${S}.spec`), null);
      assert.equal(await evaluate("document.getElementById('mk-save-spec').disabled"), true);
      log('PASS: local attachment preservation keeps exact source and disables spec output');
      await applyMode('redesign');
      assert.deepEqual(await evaluate(`(() => {
        const table=${S}.table;
        const cutIndex=table.columns.findIndex(column=>/cut/i.test(column));
        if(cutIndex<0)return {rows:table.rows.length,cuts:null};
        return {rows:table.rows.length,cuts:table.rows.reduce((sum,row)=>sum+Number(String(row[cutIndex]).replace(/,/g,'')),0)};
      })()`), { rows: 15, cuts: 189 });
      assert.equal(await evaluate(`${S}.originalMode`), false);
      log('PASS: local attachment redesign uses 15 rendered VIA rows and Cut total 189');
    }
  }

  if (mode === 'embedded') {
    const fixtures = join(ROOT, 'tests', 'convertor', 'fixtures', 'html-input');
    const S = 'window.HC.make.state';
    const metals = {
      columns: ['name', 'z', 'bbox', 'meta'],
      rows: [['M1', 1, '[0,1,2,3]', '{"color":"red"}'], ['M2', 2, '[4,5,6,7]', '{"color":"blue"}']],
    };
    const sourceRequests = [];
    const sourceOrigin = 'https://embedded-html-test.invalid';
    cdp.on((m) => {
      if (m.method === 'Network.requestWillBeSent' && m.params.request.url.startsWith(sourceOrigin)) sourceRequests.push(m.params.request.url);
    });
    await cdp.send('Network.enable');
    await cdp.send('Network.setBlockedURLs', { urls: [`${sourceOrigin}/*`] });
    const waitUntil = async (expression, description, maxMs = 8000) => {
      const t0 = Date.now();
      while (Date.now() - t0 < maxMs) {
        if (await evaluate(expression)) return;
        await sleep(50);
      }
      assert.fail(`${description} timed out`);
    };
    const check = async (description, action) => {
      try { await action(); log(`PASS: ${description}`); }
      catch (e) { problems.push(`테스트 실패: ${description}: ${e.message}`); }
    };
    const setFile = async (path) => {
      const { root } = await cdp.send('DOM.getDocument', { depth: -1 });
      const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector: '#mk-file' });
      await cdp.send('DOM.setFileInputFiles', { files: [path], nodeId });
    };
    const load = async (filename) => {
      await setFile(join(fixtures, filename));
      await waitUntil(`!document.getElementById('mk-error').hidden || (${S}.source?.name === ${JSON.stringify(filename)} && ${S}.html.length > 0)`, `settle ${filename}`);
      const error = await evaluate("document.getElementById('mk-error').textContent");
      assert.equal(await evaluate("document.getElementById('mk-error').hidden"), true, `embedded records import successfully${error ? `: ${error}` : ''}`);
    };
    const table = () => evaluate(`({ columns: ${S}.table.columns, rows: ${S}.table.rows })`);
    const choices = () => evaluate("[...document.getElementById('mk-sheet').options].map(o => ({value: o.value, label: o.textContent, disabled: o.disabled}))");
    const selectCandidate = async (labelPart) => {
      const candidate = (await choices()).find(o => !o.disabled && o.label.includes(labelPart));
      assert.ok(candidate, `selectable candidate ${labelPart}`);
      await evaluate(`(() => { const select = document.getElementById('mk-sheet'); select.value = ${JSON.stringify(candidate.value)}; select.dispatchEvent(new Event('change')); })()`);
      await waitUntil(`${S}.source?.tableId === ${JSON.stringify(candidate.value)} && ${S}.html.length > 0`, `select ${labelPart}`);
    };

    await navigate(`${url}#make`);
    await evaluate('localStorage.clear()');
    await navigate(`${url}?embedded-test=1#make`);
    await check('empty static tbody falls back to embedded metal records', async () => {
      await load('embedded-records.html');
      assert.deepEqual(await table(), metals, 'object and array cells stay JSON strings');
    });

    await check('embedded arrays expose paths without treating cell or coordinate arrays as tables', async () => {
      await load('embedded-records.html');
      const candidates = await choices();
      assert.equal(candidates.filter(o => !o.disabled).length, 3, 'only metals, vias and nested pins are record-array candidates');
      assert.ok(candidates.some(o => o.disabled), 'the empty static table remains an explained disabled candidate');
      assert.ok(candidates.every(o => !/\.(?:bbox|meta|points|xy)(?:\.|$)|\.outline\.rect(?:\.|$)/.test(o.label)), 'cell arrays and scalar coordinate properties stay outside the candidate list');
      await selectCandidate('$.vias');
      assert.deepEqual(await table(), { columns: ['name', 'from', 'to', 'points'], rows: [['V1', 'M1', 'M2', '[[0,0],[1,1]]']] });
      await selectCandidate('$.regions.pins');
      assert.deepEqual(await table(), { columns: ['id', 'xy'], rows: [['P1', '[2,3]']] });
    });

    for (const format of ['auto', 'html']) {
      await check(`embedded records through pasted ${format}`, async () => {
        const source = readFileSync(join(fixtures, 'embedded-records.html'), 'utf8');
        await evaluate("document.getElementById('mk-text-input').open = true");
        await evaluate(`(() => {
          document.getElementById('mk-text-format').value = ${JSON.stringify(format)};
          const text = document.getElementById('mk-text-source'); text.value = ${JSON.stringify(source)};
          text.dispatchEvent(new Event('input', { bubbles: true }));
          document.getElementById('mk-text-apply').click();
        })()`);
        await waitUntil(`!document.getElementById('mk-error').hidden || (${S}.source?.name === '붙여넣은 데이터.html' && ${S}.html.length > 0)`, `pasted embedded ${format}`);
        assert.equal(await evaluate("document.getElementById('mk-error').hidden"), true);
        assert.deepEqual(await table(), metals);
        assert.equal(await evaluate("document.getElementById('mk-text-source').value"), source);
      });
    }

    await check('root JSON record array remains a table with JSON-string cells', async () => {
      await load('embedded-root-array.html');
      assert.deepEqual(await table(), { columns: ['dept', 'sales', 'extra'], rows: [['서울', 100, '{"ok":true}'], ['부산', 200, '[1,2]']] });
    });

    await check('valid static table precedes available embedded JSON records', async () => {
      await load('embedded-static-priority.html');
      assert.deepEqual(await table(), { columns: ['부서', '매출'], rows: [['서울', '100'], ['부산', '200']] });
      assert.equal((await choices()).filter(o => !o.disabled).length, 2);
      await selectCandidate('$.metals');
      assert.deepEqual(await table(), { columns: ['name', 'z'], rows: [['M1', 1], ['M2', 2]] });
    });

    await check('hc-spec takes precedence over static tables and embedded record candidates', async () => {
      await load('embedded-spec-priority.html');
      assert.deepEqual(await evaluate(`${S}.spec`), { meta: { title: '내장 spec 우선' }, summary: ['우선순위 내용'], kpis: [{ label: '원본', value: 7 }], charts: null, tables: null, sections: null });
      assert.equal(await evaluate(`${S}.table`), null);
      assert.equal(await evaluate("document.querySelector('.mk-sheet').hidden"), true);
    });

    await check('bad embedded candidates are disabled beside usable records', async () => {
      await load('embedded-mixed-candidates.html');
      assert.deepEqual(await table(), { columns: ['name', 'z'], rows: [['M1', 1]] });
      const candidates = await choices();
      assert.equal(candidates.filter(o => !o.disabled).length, 1);
      for (const labelPart of ['$.mixed', '$.empty', 'brokenData']) {
        const candidate = candidates.find(o => o.label.includes(labelPart));
        assert.ok(candidate?.disabled, `${labelPart} carries a disabled error candidate`);
        assert.match(candidate.label, /사용 불가|오류|JSON|배열|객체/);
      }
      assert.ok(candidates.every(o => !/coordinates|linkedData/.test(o.label)), 'pure scalar properties and JSON-LD do not become record tables');
    });

    for (const [filename, reason] of [
      ['embedded-jsonld-only.html', /JSON|내장|지원|후보/],
      ['embedded-broken-json.html', /JSON|구문/],
      ['embedded-mixed-only.html', /객체|레코드|배열/],
      ['embedded-scalar-root.html', /객체|레코드|배열/],
      ['embedded-empty-only.html', /빈|데이터|레코드|배열/],
    ]) {
      await check(`${filename} rejects with a useful reason and clears stale output`, async () => {
        await load('simple-th.html');
        await setFile(join(fixtures, filename));
        await waitUntil("!document.getElementById('mk-error').hidden", `reject ${filename}`);
        assert.match(await evaluate("document.getElementById('mk-error').textContent"), reason);
        assert.deepEqual(await evaluate(`({
          html: ${S}.html, spec: ${S}.spec, table: ${S}.table, source: ${S}.source,
          frame: document.getElementById('mk-frame').srcdoc,
          actionsDisabled: ['mk-download', 'mk-save-spec', 'mk-open', 'mk-ai-copy'].every(id => document.getElementById(id).disabled)
        })`), { html: '', spec: null, table: null, source: null, frame: '', actionsDisabled: true });
      });
    }

    await check('embedded-data extraction leaves original scripts and resources inert', async () => {
      await load('embedded-records.html');
      await sleep(300);
      assert.equal(await evaluate('window.__embeddedImportSentinel'), undefined);
      assert.deepEqual(sourceRequests, []);
      assert.equal(await evaluate(`${S}.html.includes(${JSON.stringify(sourceOrigin)})`), false);
      assert.equal(await evaluate(`JSON.stringify(${S}.spec).includes('__embeddedImportSentinel')`), false);
    });

    await check('embedded records preserve special property names and absent own cells', async () => {
      await load('embedded-special-keys.html');
      assert.deepEqual(await table(), {
        columns: ['constructor', 'toString', '__proto__', 'sales'],
        rows: [['A', '직접 문자열', '{"x":1}', 100], [null, null, null, 200]],
      }, 'raw JSON property names remain unchanged and inherited properties never fill missing cells');
    });

    await check('embedded record columns include fields first appearing after row 500', async () => {
      const records = Array.from({ length: 501 }, (_, index) => index === 500 ? { base: index, late: '501번째 값' } : { base: index });
      const source = `<script type="application/json" id="lateField">${JSON.stringify({ records })}</script>`;
      await evaluate(`window.HC.make.ingestText(${JSON.stringify(source)}, 'auto')`);
      await waitUntil(`!document.getElementById('mk-error').hidden || (${S}.source?.name === '붙여넣은 데이터.html' && ${S}.html.length > 0)`, 'late embedded field import');
      assert.equal(await evaluate("document.getElementById('mk-error').hidden"), true);
      assert.deepEqual(await evaluate(`({
        columns: ${S}.table.columns, rowCount: ${S}.table.rows.length,
        first: ${S}.table.rows[0], beforeLateField: ${S}.table.rows[499], last: ${S}.table.rows[500],
        earlierMissingValuesAreNull: ${S}.table.rows.slice(0, 500).every(row => row[1] === null)
      })`), {
        columns: ['base', 'late'], rowCount: 501,
        first: [0, null], beforeLateField: [499, null], last: [500, '501번째 값'], earlierMissingValuesAreNull: true,
      }, 'the union includes all record keys and preserves absent values in earlier rows');
    });

    if (process.argv[4]) {
      // This optional check reads private source locally without creating any copy or screenshot.
      const attachmentPath = resolve(process.argv[4]);
      const attachment = readFileSync(attachmentPath, 'utf8');
      for (const format of ['file', 'auto', 'html']) {
        await check(`local attachment through ${format}`, async () => {
          if (format === 'file') await setFile(attachmentPath);
          else await evaluate(`window.HC.make.ingestText(${JSON.stringify(attachment)}, ${JSON.stringify(format)})`);
          await waitUntil(`!document.getElementById('mk-error').hidden || (${S}.spec && ${S}.html.length > 0)`, `local attachment ${format}`);
          const error = await evaluate("document.getElementById('mk-error').textContent");
          assert.equal(await evaluate("document.getElementById('mk-error').hidden"), true, `local embedded records import successfully${error ? `: ${error}` : ''}`);
          const metalChoice = await evaluate("[...document.getElementById('mk-sheet').options].find(o => !o.disabled && o.textContent.includes('$.metals'))?.value");
          assert.ok(metalChoice, 'local attachment exposes its metals record array');
          await evaluate(`(() => { const select = document.getElementById('mk-sheet'); select.value = ${JSON.stringify(metalChoice)}; select.dispatchEvent(new Event('change')); })()`);
          assert.equal(await evaluate(`${S}.table.rows.length`), 32);
          const viaChoice = await evaluate("[...document.getElementById('mk-sheet').options].find(o => !o.disabled && o.textContent.includes('$.vias'))?.value");
          assert.ok(viaChoice, 'local attachment exposes its vias record array');
          await evaluate(`(() => { const select = document.getElementById('mk-sheet'); select.value = ${JSON.stringify(viaChoice)}; select.dispatchEvent(new Event('change')); })()`);
          assert.equal(await evaluate(`${S}.table.rows.length`), 30);
        });
      }
    }
  }

  if (mode === 'text') {
    const S = 'window.HC.make.state';
    const csv = '부서,매출\n서울,100\n부산,200\n';
    const expectedTable = { columns: ['부서', '매출'], rows: [['서울', '100'], ['부산', '200']] };
    const waitUntil = async (expression, description, maxMs = 8000) => {
      const t0 = Date.now();
      while (Date.now() - t0 < maxMs) {
        if (await evaluate(expression)) return;
        await sleep(50);
      }
      const error = await evaluate("document.getElementById('mk-error').textContent");
      assert.fail(`${description} timed out${error ? `: ${error}` : ''}`);
    };
    const submitText = (contents, format = 'auto') => evaluate(`(() => {
      const select = document.getElementById('mk-text-format');
      select.value = ${JSON.stringify(format)};
      select.dispatchEvent(new Event('change', { bubbles: true }));
      const source = document.getElementById('mk-text-source');
      source.value = ${JSON.stringify(contents)};
      source.dispatchEvent(new Event('input', { bubbles: true }));
      document.getElementById('mk-text-apply').click();
    })()`);
    const applyText = async (contents, format, extension) => {
      await submitText(contents, format);
      const name = `붙여넣은 데이터.${extension}`;
      await waitUntil(`!document.getElementById('mk-error').hidden || (${S}.source?.name === ${JSON.stringify(name)} && ${S}.spec && ${S}.html.length > 0)`, `apply ${format} as ${extension}`);
      const error = await evaluate("document.getElementById('mk-error').textContent");
      assert.equal(await evaluate("document.getElementById('mk-error').hidden"), true, `pasted ${format} imports successfully${error ? `: ${error}` : ''}`);
      assert.equal(await evaluate(`${S}.source.name`), name);
      assert.equal(await evaluate("document.getElementById('mk-text-source').value"), contents, 'applying text preserves the editable original');
      assert.ok(await evaluate("document.getElementById('mk-text-result').textContent.trim().length > 0"), 'the result reports its input format');
    };
    const table = () => evaluate(`({ columns: ${S}.table.columns, rows: ${S}.table.rows })`);
    const total = () => evaluate(`${S}.spec.kpis.find(k => k.label === '총 매출')?.value`);

    await navigate(`${url}#make`);
    await evaluate('localStorage.clear()');
    await navigate(`${url}?text-test=1#make`);
    assert.equal(await evaluate("Boolean(document.querySelector('details#mk-text-input'))"), true, 'the original-text input form exists');
    assert.equal(await evaluate("document.querySelector('#mk-text-input summary').textContent.trim()"), '원문 텍스트로 입력');
    await evaluate("document.getElementById('mk-text-input').open = true");
    assert.deepEqual(await evaluate("[...document.getElementById('mk-text-format').options].map(o => o.value).sort()"), ['auto', 'csv', 'htm', 'html', 'json', 'tsv', 'txt'], 'text input offers supported text formats and excludes XLSX');

    await applyText(csv, 'auto', 'csv');
    assert.deepEqual(await table(), expectedTable, 'automatic CSV uses literal columns and rows');
    assert.equal(await total(), 300);
    assert.match(await evaluate("document.getElementById('mk-text-result').textContent"), /csv/i);
    log('PASS: text form and automatic CSV');

    const quotedCsv = '부서,매출,메모\n서울,100,"첫째\n둘째"\n부산,200,"쉼표, 있는 메모"\n';
    await applyText(quotedCsv, 'auto', 'csv');
    assert.deepEqual(await table(), { columns: ['부서', '매출', '메모'], rows: [['서울', '100', '첫째\n둘째'], ['부산', '200', '쉼표, 있는 메모']] }, 'CSV detection respects quoted newlines and commas');
    assert.equal(await total(), 300);
    log('PASS: automatic quoted CSV');

    const tsv = '부서\t매출\n서울\t100\n부산\t200\n';
    const json = '[{"부서":"서울","매출":100},{"부서":"부산","매출":200}]';
    const jsonTable = { columns: ['부서', '매출'], rows: [['서울', 100], ['부산', 200]] };
    const html = '<table><tr><th>부서</th><th>매출</th></tr><tr><td>서울</td><td>100</td></tr><tr><td>부산</td><td>200</td></tr></table>';
    for (const [extension, contents, expected] of [
      ['tsv', tsv, expectedTable], ['json', json, jsonTable], ['html', html, expectedTable],
    ]) {
      await applyText(contents, 'auto', extension);
      assert.deepEqual(await table(), expected, `automatic ${extension} produces the literal table`);
      assert.equal(await total(), 300);
      assert.match(await evaluate("document.getElementById('mk-text-result').textContent"), new RegExp(extension, 'i'));
      log(`PASS: automatic ${extension}`);
    }

    for (const [format, contents, expected] of [
      ['csv', csv, expectedTable], ['tsv', tsv, expectedTable], ['txt', csv, expectedTable],
      ['html', html, expectedTable], ['htm', html, expectedTable], ['json', json, jsonTable],
    ]) {
      await applyText(contents, format, format);
      assert.deepEqual(await table(), expected, `manual ${format} uses the selected reader`);
      assert.equal(await total(), 300);
      log(`PASS: manual ${format}`);
    }

    const assertEmpty = async (description, source) => {
      assert.deepEqual(await evaluate(`({
        html: ${S}.html, spec: ${S}.spec, table: ${S}.table, source: ${S}.source,
        frame: document.getElementById('mk-frame').srcdoc,
        empty: !document.getElementById('mk-empty').hidden,
        previewHidden: document.getElementById('mk-device').hidden,
        panelsHidden: ['mk-file-info', 'mk-cols', 'mk-content'].every(id => document.getElementById(id).hidden),
        actionsDisabled: ['mk-download', 'mk-save-spec', 'mk-open', 'mk-ai-copy'].every(id => document.getElementById(id).disabled)
      })`), { html: '', spec: null, table: null, source: null, frame: '', empty: true, previewHidden: true, panelsHidden: true, actionsDisabled: true }, `${description}: failure clears the previous output`);
      assert.equal(await evaluate("document.getElementById('mk-text-source').value"), source, `${description}: original text remains editable`);
    };
    const bracketCsv = '[분류],매출\n서울,100\n부산,200\n';
    for (const [description, contents, format, reason] of [
      ['empty text', '', 'auto', /입력|빈|비어|empty/i],
      ['whitespace text', ' \n \t ', 'auto', /입력|공백|빈|비어|empty/i],
      ['undetected text', '부서별 매출을 정리해 주세요.', 'auto', /형식|선택|format/i],
      ['broken leading JSON', '{broken JSON', 'auto', /JSON/i],
      ['CSV beginning with a bracket', bracketCsv, 'auto', /JSON/i],
      ['selected JSON overrides CSV detection', csv, 'json', /JSON/i],
    ]) {
      await applyText(csv, 'auto', 'csv');
      if (description === 'empty text') {
        await evaluate("(() => { const title = document.getElementById('mk-title'); title.value = '취소되어야 할 이전 결과'; title.dispatchEvent(new Event('input')); })()");
      }
      await submitText(contents, format);
      await waitUntil("!document.getElementById('mk-error').hidden && document.getElementById('mk-error').textContent.trim().length > 0", description);
      assert.match(await evaluate("document.getElementById('mk-error').textContent"), reason, `${description}: useful error`);
      if (description === 'empty text') await sleep(700);
      await assertEmpty(description, contents);
      log(`PASS: ${description} preserves text and clears stale results`);
    }

    await applyText(bracketCsv, 'csv', 'csv');
    assert.deepEqual(await table(), { columns: ['[분류]', '매출'], rows: [['서울', '100'], ['부산', '200']] }, 'manual CSV recovers input that automatic detection treats as JSON');
    assert.equal(await total(), 300);
    log('PASS: manual format takes precedence over automatic detection');

    const originalSpec = {
      meta: { title: '붙여넣은 원본', subtitle: '문자열 </script> 보존' },
      summary: '본문 한 문단', kpis: [{ label: '매출', value: 300 }], charts: null,
      tables: [{ id: 'detail', columns: [{ key: 'region', label: '부서' }, { key: 'sales', label: '매출', type: 'number' }], rows: [{ region: '서울', sales: 100 }, { region: '부산', sales: 200 }] }],
      sections: [{ title: '참고', text: '원본 내용 그대로' }],
    };
    const ownHtml = await evaluate(`window.HC.build(${JSON.stringify(originalSpec)}, 'tabler').html`);
    await applyText(ownHtml, 'auto', 'html');
    assert.deepEqual(await evaluate(`${S}.spec`), originalSpec, 'pasting an own HTML export preserves its complete embedded content');
    assert.equal(await evaluate(`${S}.table`), null);
    log('PASS: pasted own HTML preserves embedded spec');

    const multipleHtml = '<table><caption>지역 매출</caption><tr><th>부서</th><th>매출</th></tr><tr><td>서울</td><td>100</td></tr><tr><td>부산</td><td>200</td></tr></table><table><caption>지역 매출</caption><tr><th>부서</th><th>매출</th></tr><tr><td>서울</td><td>10</td></tr><tr><td>부산</td><td>20</td></tr></table>';
    await applyText(multipleHtml, 'auto', 'html');
    assert.deepEqual(await table(), expectedTable);
    assert.equal(await evaluate("document.getElementById('mk-sheet-label').textContent.trim()"), '표');
    const choices = await evaluate("[...document.getElementById('mk-sheet').options].map(o => o.value)");
    assert.equal(choices.length, 2);
    assert.notEqual(choices[0], choices[1]);
    const firstHtml = await evaluate(`${S}.html`);
    await evaluate(`(() => { const select = document.getElementById('mk-sheet'); select.value = ${JSON.stringify(choices[1])}; select.dispatchEvent(new Event('change')); })()`);
    await waitUntil(`${S}.html !== ${JSON.stringify(firstHtml)} && ${S}.spec.kpis.find(k => k.label === '총 매출')?.value === 30`, 'second pasted HTML table');
    assert.deepEqual(await table(), { columns: ['부서', '매출'], rows: [['서울', '10'], ['부산', '20']] });
    assert.equal(await total(), 30);
    log('PASS: pasted HTML table selection');

    // Preserve the actual File/parser path while controlling only when its bytes become available.
    await evaluate(`(() => {
      const file = new File([${JSON.stringify('부서,매출\n대전,900\n')}], 'late-file.csv');
      const readBytes = file.arrayBuffer.bind(file);
      file.arrayBuffer = async () => {
        await new Promise(resolve => { window.__releaseLateFile = resolve; });
        return readBytes();
      };
      window.__lateFileImport = window.HC.make.ingest(file);
    })()`);
    await applyText(csv, 'auto', 'csv');
    await evaluate(`(async () => {
      window.__releaseLateFile();
      await window.__lateFileImport;
      await new Promise(resolve => setTimeout(resolve, 50));
    })()`);
    assert.deepEqual(await table(), expectedTable, 'a late older file cannot replace newer pasted text');
    assert.equal(await total(), 300);
    assert.equal(await evaluate(`${S}.source.name`), '붙여넣은 데이터.csv');
    log('PASS: newer text survives an older file read');

    await evaluate(`(() => {
      const readBytes = File.prototype.arrayBuffer;
      window.__textReadStarted = false;
      window.__textReadFinished = false;
      File.prototype.arrayBuffer = async function () {
        if (this.name !== '붙여넣은 데이터.csv') return readBytes.call(this);
        File.prototype.arrayBuffer = readBytes;
        window.__textReadStarted = true;
        await new Promise(resolve => { window.__releaseTextRead = resolve; });
        const bytes = await readBytes.call(this);
        window.__textReadFinished = true;
        return bytes;
      };
    })()`);
    await submitText(csv, 'auto');
    await waitUntil('window.__textReadStarted', 'pasted text uses the shared File byte-reader');
    writeFileSync(join(outDir, 'newer-file.csv'), '부서,매출\n서울,10\n부산,20\n', 'utf8');
    const { root } = await cdp.send('DOM.getDocument', { depth: -1 });
    const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector: '#mk-file' });
    await cdp.send('DOM.setFileInputFiles', { files: [join(outDir, 'newer-file.csv')], nodeId });
    await waitUntil(`${S}.source?.name === 'newer-file.csv' && ${S}.html.length > 0`, 'newer actual file-picker import');
    await evaluate('window.__releaseTextRead()');
    await waitUntil('window.__textReadFinished', 'older text byte-reader completes');
    await sleep(50);
    assert.deepEqual(await table(), { columns: ['부서', '매출'], rows: [['서울', '10'], ['부산', '20']] }, 'a late older text import cannot replace a newer file');
    assert.equal(await total(), 30);
    assert.equal(await evaluate(`${S}.source.name`), 'newer-file.csv');
    log('PASS: newer file survives an older text read');

    await applyText(csv, 'auto', 'csv');
    await evaluate('window.scrollTo(0, 0)');
    await shot('text_input');
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
    await click('[data-mk-device="mobile"]');
    await sleep(200);
    const overflow = await evaluate('({ width: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth })');
    assert.ok(overflow.scrollWidth <= overflow.width, `text input has no horizontal overflow at 390px: ${JSON.stringify(overflow)}`);
    await shot('text_input_mobile', { scale: 0.5 });
    await cdp.send('Emulation.clearDeviceMetricsOverride');
    log('PASS: text input desktop/mobile layout');

    // Trimming for detection must not remove empty fields at either edge of a TSV row.
    for (const [description, contents, expected] of [
      ['empty first TSV heading', '\t매출\n서울\t100\n부산\t200', { columns: ['열1', '매출'], rows: [['서울', '100'], ['부산', '200']] }],
      ['empty final TSV column', '부서\t매출\t\n서울\t100\t\n부산\t200\t', { columns: ['부서', '매출', '열3'], rows: [['서울', '100', null], ['부산', '200', null]] }],
    ]) {
      try {
        await applyText(contents, 'auto', 'tsv');
        assert.deepEqual(await table(), expected, `${description}: preserve empty TSV fields`);
        assert.equal(await total(), 300);
        log(`PASS: ${description}`);
      } catch (e) {
        problems.push(`테스트 실패: ${description}: ${e.message}`);
      }
    }

    // Separator candidates inside a quoted heading are content, including across physical lines.
    for (const [description, contents, columns] of [
      ['semicolons in a quoted CSV heading', '"부서;구분;이름",매출\n서울,100\n부산,200\n', ['부서;구분;이름', '매출']],
      ['tabs in a quoted CSV heading', '"부서\t구분\t이름",매출\n서울,100\n부산,200\n', ['부서\t구분\t이름', '매출']],
      ['a multiline quoted CSV heading', '"부서;구분\n이름",매출\n서울,100\n부산,200\n', ['부서;구분\n이름', '매출']],
    ]) {
      for (const format of ['auto', 'csv']) {
        try {
          await applyText(contents, format, 'csv');
          assert.deepEqual(await table(), { columns, rows: [['서울', '100'], ['부산', '200']] }, `${description} (${format}): keep the CSV heading and body columns intact`);
          assert.equal(await total(), 300, `${description} (${format}): numeric data remains available for aggregation`);
          log(`PASS: ${description} (${format})`);
        } catch (e) {
          problems.push(`테스트 실패: ${description} (${format}): ${e.message}`);
        }
      }
    }

    try {
      writeFileSync(join(outDir, 'quoted-header.csv'), '"부서;구분;이름",매출\n서울,100\n부산,200\n', 'utf8');
      const { root: fileDocument } = await cdp.send('DOM.getDocument', { depth: -1 });
      const { nodeId: fileInputNode } = await cdp.send('DOM.querySelector', { nodeId: fileDocument.nodeId, selector: '#mk-file' });
      await cdp.send('DOM.setFileInputFiles', { files: [join(outDir, 'quoted-header.csv')], nodeId: fileInputNode });
      await waitUntil(`${S}.source?.name === 'quoted-header.csv' && ${S}.spec && ${S}.html.length > 0`, 'actual quoted-header CSV file upload');
      assert.deepEqual(await table(), { columns: ['부서;구분;이름', '매출'], rows: [['서울', '100'], ['부산', '200']] }, 'the shared file reader ignores semicolons inside the quoted CSV heading');
      assert.equal(await total(), 300);
      log('PASS: quoted CSV heading through the file picker');
    } catch (e) {
      problems.push(`테스트 실패: quoted CSV heading through the file picker: ${e.message}`);
    }
  }

  if (mode === 'html') {
    const fixtures = join(ROOT, 'tests', 'convertor', 'fixtures', 'html-input');
    const S = 'window.HC.make.state';
    const sourceRequests = [];
    const sourceOrigin = 'https://html-import-test.invalid';
    cdp.on((m) => {
      if (m.method === 'Network.requestWillBeSent' && m.params.request.url.startsWith(sourceOrigin)) {
        sourceRequests.push(m.params.request.url);
      }
    });
    await cdp.send('Network.enable');
    // The test records attempted source requests, while blocking contact with the sentinel host.
    await cdp.send('Network.setBlockedURLs', { urls: [`${sourceOrigin}/*`] });
    const waitUntil = async (expression, description, maxMs = 8000) => {
      const t0 = Date.now();
      while (Date.now() - t0 < maxMs) {
        if (await evaluate(expression)) return;
        await sleep(50);
      }
      const error = await evaluate(`document.getElementById('mk-error').textContent`);
      assert.fail(`${description} timed out${error ? `: ${error}` : ''}`);
    };
    const setFile = async (path) => {
      const { root } = await cdp.send('DOM.getDocument', { depth: -1 });
      const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector: '#mk-file' });
      assert.ok(nodeId, 'the main file input exists');
      await cdp.send('DOM.setFileInputFiles', { files: [path], nodeId });
    };
    const load = async (filename, directory = fixtures) => {
      await setFile(join(directory, filename));
      await waitUntil(`${S}.source?.name === ${JSON.stringify(filename)} && ${S}.spec && ${S}.html.length > 0 && document.getElementById('mk-error').hidden`, `import ${filename}`);
    };
    const table = () => evaluate(`({ columns: ${S}.table.columns, rows: ${S}.table.rows })`);
    const total = () => evaluate(`${S}.spec.kpis.find(k => k.label === '총 매출')?.value`);
    const assertEmpty = async (filename) => {
      const result = await evaluate(`({
        html: ${S}.html, spec: ${S}.spec, table: ${S}.table, source: ${S}.source,
        frame: document.getElementById('mk-frame').srcdoc,
        empty: !document.getElementById('mk-empty').hidden,
        previewHidden: document.getElementById('mk-device').hidden,
        panelsHidden: ['mk-file-info', 'mk-cols', 'mk-content'].every(id => document.getElementById(id).hidden),
        actionsDisabled: ['mk-download', 'mk-save-spec', 'mk-open', 'mk-ai-copy'].every(id => document.getElementById(id).disabled)
      })`);
      assert.deepEqual(result, {
        html: '', spec: null, table: null, source: null, frame: '',
        empty: true, previewHidden: true, panelsHidden: true, actionsDisabled: true,
      }, `${filename}: failed import clears the previous result and actions`);
    };

    await navigate(`${url}#make`);
    await evaluate('localStorage.clear()');
    await navigate(`${url}?html-test=1#make`);
    await waitUntil('Boolean(window.HC?.make?.state)', 'converter initialization');

    // A CSV fallback, TFOOT inclusion, or flattened markup changes these hand-checked values.
    await load('simple-th.html');
    assert.deepEqual(await table(), {
      columns: ['부서', '매출'], rows: [['서울', '100'], ['부산', '200']],
    }, 'TH headings and body cells are imported as data');
    assert.equal(await total(), 300, 'TFOOT total is excluded from the aggregation');
    assert.equal(await evaluate("document.querySelector('.mk-sheet').hidden"), true, 'one table needs no table selector');
    log('PASS: TH headings and TFOOT exclusion');

    await load('simple-td.htm');
    assert.deepEqual(await table(), {
      columns: ['부서', '매출'], rows: [['서울', '100'], ['부산', '200']],
    }, 'a first row of TD headings and the HTM extension are supported');
    assert.equal(await total(), 300);
    const accept = await evaluate("document.getElementById('mk-file').accept.split(',').map(s => s.trim())");
    assert.ok(accept.includes('.html') && accept.includes('.htm'), 'the picker offers HTML and HTM files');
    log('PASS: TD headings and HTML/HTM picker support');

    await load('text-bom.html');
    assert.deepEqual(await table(), {
      columns: ['부서', '매출', '메모', '빈칸'],
      rows: [['서울 & 경기', '100', '첫째\n둘째', null], ['부산 <지점>', '200', '메모', null]],
    }, 'UTF-8 BOM, entities, BR text separation and empty cells survive import');
    assert.equal(await total(), 300);
    log('PASS: BOM, text and empty cells');

    await load('multiple-tables.html');
    const choices = await evaluate(`({
      visible: !document.querySelector('.mk-sheet').hidden,
      label: document.getElementById('mk-sheet-label')?.textContent.trim(),
      options: [...document.getElementById('mk-sheet').options].map(o => ({value: o.value, label: o.textContent}))
    })`);
    assert.equal(choices.visible, true);
    assert.equal(choices.label, '표', 'HTML choices are labelled as tables');
    assert.equal(choices.options.length, 2);
    assert.notEqual(choices.options[0].value, choices.options[1].value, 'duplicate captions have independent selection values');
    assert.ok(choices.options.every(o => o.label.includes('월별 매출')));
    assert.deepEqual(await table(), { columns: ['부서', '매출'], rows: [['서울', '100'], ['부산', '200']] });
    const firstHtml = await evaluate(`${S}.html`);
    await evaluate(`(() => { const select = document.getElementById('mk-sheet'); select.value = ${JSON.stringify(choices.options[1].value)}; select.dispatchEvent(new Event('change')); })()`);
    await waitUntil(`${S}.html !== ${JSON.stringify(firstHtml)} && ${S}.spec.kpis.find(k => k.label === '총 매출')?.value === 30`, 'second table render');
    assert.deepEqual(await table(), { columns: ['부서', '매출'], rows: [['서울', '10'], ['부산', '20']] });
    assert.equal(await total(), 30);
    log('PASS: duplicate captions and table switching');
    await shot('html_tables');

    await load('mixed-tables.html');
    assert.deepEqual(await table(), { columns: ['부서', '매출'], rows: [['서울', '100'], ['부산', '200']] }, 'an unsupported candidate does not prevent importing another valid table');
    assert.equal(await total(), 300);
    log('PASS: valid table alongside an unsupported candidate');

    // Expectations originate in the literal spec, not the renderer output.
    const originalSpec = {
      meta: { title: 'HTML 재입력', subtitle: '문자열 </script> 그대로', source: '직접 작성한 spec' },
      summary: ['서울과 부산의 매출 합계는 300입니다.', '</script><script>top.__htmlImportSentinel = true</script>'],
      kpis: [{ label: '매출', value: 300, unit: '원' }],
      charts: [{ id: 'sales', title: '지역 매출', type: 'bar', x: ['서울', '부산'], series: [{ name: '매출', data: [100, 200] }] }],
      tables: [{ id: 'detail', title: '지역 표', columns: [{ key: 'region', label: '부서' }, { key: 'sales', label: '매출', type: 'number' }], rows: [{ region: '서울', sales: 100 }, { region: '부산', sales: 200 }] }],
      sections: [{ id: 'notes', title: '참고', text: '내용 보존 확인', bullets: ['합계 300', '문자열 </script>'], charts: ['sales'], tables: ['detail'] }],
    };
    const ownHtml = await evaluate(`window.HC.build(${JSON.stringify(originalSpec)}, 'tabler', { chartLib: 'echarts' }).html`);
    const conflictingTable = '<table><tr><th>잘못된 값</th></tr><tr><td>999</td></tr></table>';
    writeFileSync(join(outDir, 'own-roundtrip.html'), ownHtml.replace('</body>', `${conflictingTable}</body>`), 'utf8');
    await load('own-roundtrip.html', outDir);
    assert.deepEqual(await evaluate(`${S}.spec`), originalSpec, 'embedded hc-spec preserves every original content field and wins over static markup');
    assert.equal(await evaluate(`${S}.table`), null);
    assert.equal(await evaluate('window.__htmlImportSentinel'), undefined, 'closing-script text stays data');
    assert.equal(await evaluate("document.getElementById('mk-cols').hidden"), true);
    log('PASS: complete own-export round trip and embedded-spec precedence');

    await load('active-markup.html');
    assert.deepEqual(await table(), { columns: ['부서', '매출'], rows: [['서울', '100'], ['부산', '200']] }, 'active tags contribute no script/style text to cells');
    assert.equal(await total(), 300);
    // Allow delayed image errors and resource discovery to surface before checking the sentinels.
    await sleep(600);
    assert.equal(await evaluate('window.__htmlImportSentinel'), undefined, 'source script and event attributes never execute');
    assert.deepEqual(sourceRequests, [], 'source resources never start a network request');
    assert.equal(await evaluate(`${S}.html.includes(${JSON.stringify(sourceOrigin)})`), false, 'source URLs do not persist in regenerated HTML');
    assert.equal(await evaluate(`JSON.stringify(${S}.spec).includes('__htmlImportSentinel')`), false, 'source script text does not persist in spec');
    log('PASS: inert source markup and resources');

    for (const [filename, reason] of [
      ['invalid-spec.html', /spec|JSON/i],
      ['invalid-spec-shape.html', /spec|title/i],
      ['null-spec-item.html', /spec/i],
      ['no-table.html', /표|table/i],
      ['nested-table.html', /중첩|nested/i],
      ['merged-table.html', /병합|rowspan|colspan|merged/i],
      ['ragged-table.html', /열|cell|column/i],
    ]) {
      await load('simple-th.html');
      if (filename === 'invalid-spec.html') {
        await evaluate("(() => { const title = document.getElementById('mk-title'); title.value = '예약된 이전 결과'; title.dispatchEvent(new Event('input')); })()");
      }
      await setFile(join(fixtures, filename));
      await waitUntil("!document.getElementById('mk-error').hidden && document.getElementById('mk-error').textContent.trim().length > 0", `reject ${filename}`);
      const error = await evaluate("document.getElementById('mk-error').textContent");
      assert.match(error, reason, `${filename}: useful reason for rejection`);
      if (filename === 'invalid-spec.html') await sleep(700);
      await assertEmpty(filename);
      log(`PASS: ${filename} rejects and clears stale results`);
    }

    writeFileSync(join(outDir, 'csv-regression.csv'), '부서,매출\n서울,100\n부산,200\n', 'utf8');
    await load('csv-regression.csv', outDir);
    assert.deepEqual(await table(), { columns: ['부서', '매출'], rows: [['서울', '100'], ['부산', '200']] }, 'CSV still imports after failed HTML');
    assert.equal(await total(), 300);
    assert.equal(await evaluate("document.querySelector('.mk-sheet').hidden"), true);
    assert.deepEqual(sourceRequests, []);
    log('PASS: CSV regression');

    // The established spec contract permits string summaries, null optional regions and meta only.
    for (const [filename, expectedSpec] of [
      ['string-summary-roundtrip.html', { meta: { title: '문단 요약' }, summary: '본문 한 문단', kpis: null, charts: null, tables: null, sections: null }],
      ['meta-only-roundtrip.html', { meta: { title: '빈 보고서' } }],
    ]) {
      try {
        const generated = await evaluate(`window.HC.build(${JSON.stringify(expectedSpec)}, 'tabler').html`);
        writeFileSync(join(outDir, filename), generated, 'utf8');
        await setFile(join(outDir, filename));
        await waitUntil(`!document.getElementById('mk-error').hidden || (${S}.source?.name === ${JSON.stringify(filename)} && ${S}.html.length > 0)`, `settle ${filename}`);
        const error = await evaluate("document.getElementById('mk-error').textContent");
        assert.equal(await evaluate("document.getElementById('mk-error').hidden"), true, `${filename}: own HC.build export must import successfully${error ? ` (${error})` : ''}`);
        assert.deepEqual(await evaluate(`${S}.spec`), expectedSpec, `${filename}: preserve the complete literal spec`);
        log(`PASS: ${filename} preserves the established spec contract`);
      } catch (e) {
        // Report both independent compatibility regressions before returning a nonzero exit.
        problems.push(`테스트 실패: ${e.message}`);
      }
    }

    // These fixtures isolate unsupported header structure and unregistered extensions.
    for (const [filename, reason] of [
      ['multirow-thead.html', /머리글|thead|header/i],
      ['unsupported.pdf', /지원|형식|확장자|unsupported|format/i],
      ['unsupported.md', /지원|형식|확장자|unsupported|format/i],
      ['invalid-records.json', /JSON/i],
    ]) {
      await load('simple-th.html');
      await setFile(join(fixtures, filename));
      await waitUntil("!document.getElementById('mk-error').hidden", `reject ${filename}`);
      assert.match(await evaluate("document.getElementById('mk-error').textContent"), reason);
      await assertEmpty(filename);
      log(`PASS: ${filename} rejects and clears stale results`);
    }

    await load('records.json');
    assert.deepEqual(await table(), { columns: ['부서', '매출'], rows: [['서울', 100], ['부산', 200]] }, 'JSON records retain typed values through the registered reader');
    assert.equal(await total(), 300);
    log('PASS: JSON records');

    const setSpecFile = async (path) => {
      const { root } = await cdp.send('DOM.getDocument', { depth: -1 });
      const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector: '#mk-spec-file' });
      assert.ok(nodeId, 'the spec picker exists');
      await cdp.send('DOM.setFileInputFiles', { files: [path], nodeId });
    };
    writeFileSync(join(outDir, 'picker-spec.json'), JSON.stringify(originalSpec), 'utf8');
    await setSpecFile(join(outDir, 'picker-spec.json'));
    await waitUntil(`${S}.source?.name === 'picker-spec.json' && ${S}.specFromFile && ${S}.html.length > 0`, 'spec picker success');
    assert.deepEqual(await evaluate(`${S}.spec`), originalSpec, 'the dedicated spec picker preserves complete content');
    assert.equal(await evaluate(`${S}.table`), null);
    log('PASS: spec picker success');

    // Valid records are still invalid input for the dedicated spec picker.
    await setSpecFile(join(fixtures, 'records.json'));
    await waitUntil("!document.getElementById('mk-error').hidden", 'spec picker rejects records');
    assert.match(await evaluate("document.getElementById('mk-error').textContent"), /spec/i);
    await assertEmpty('records.json through spec picker');
    log('PASS: spec picker failure');

    // Delay only the byte-read boundary; both imports still use the real File and parser.
    const startDelayedMainImport = async (name, contents) => evaluate(`(() => {
      const file = new File([${JSON.stringify(contents)}], ${JSON.stringify(name)});
      const readBytes = file.arrayBuffer.bind(file);
      file.arrayBuffer = async () => {
        await new Promise(resolve => { window.__releaseImport = resolve; });
        return readBytes();
      };
      window.__delayedImport = window.HC.make.ingest(file);
    })()`);
    const releaseMainImport = async () => evaluate(`(async () => {
      window.__releaseImport();
      await window.__delayedImport;
      await new Promise(resolve => setTimeout(resolve, 50));
    })()`);

    await startDelayedMainImport('late-a.html', '<table><tr><th>부서</th><th>매출</th></tr><tr><td>서울</td><td>900</td></tr></table>');
    await load('simple-th.html');
    await releaseMainImport();
    assert.deepEqual(await table(), { columns: ['부서', '매출'], rows: [['서울', '100'], ['부산', '200']] }, 'a late first main import cannot replace the later file');
    assert.equal(await total(), 300);
    assert.equal(await evaluate(`${S}.source.name`), 'simple-th.html');
    log('PASS: latest main-file import wins');

    await startDelayedMainImport('late-invalid.json', '{broken JSON');
    await setSpecFile(join(outDir, 'picker-spec.json'));
    await waitUntil(`${S}.source?.name === 'picker-spec.json' && ${S}.specFromFile && ${S}.html.length > 0`, 'newer spec picker import');
    await releaseMainImport();
    assert.deepEqual(await evaluate(`${S}.spec`), originalSpec, 'an older main-file failure cannot clear a newer spec-picker result');
    assert.equal(await evaluate(`${S}.source.name`), 'picker-spec.json');
    assert.equal(await evaluate("document.getElementById('mk-error').hidden"), true);
    assert.equal(await evaluate("document.getElementById('mk-download').disabled"), false);
    log('PASS: newer spec picker survives older main-file failure');

    // Delay a File created by the actual spec picker, then restore its byte-reader immediately.
    await evaluate(`(() => {
      const readBytes = File.prototype.arrayBuffer;
      window.__specReadStarted = false;
      window.__specReadFinished = false;
      File.prototype.arrayBuffer = async function () {
        if (this.name !== 'picker-spec.json') return readBytes.call(this);
        File.prototype.arrayBuffer = readBytes;
        window.__specReadStarted = true;
        await new Promise(resolve => { window.__releaseSpecRead = resolve; });
        const result = await readBytes.call(this);
        window.__specReadFinished = true;
        return result;
      };
    })()`);
    await setSpecFile(join(outDir, 'picker-spec.json'));
    await waitUntil('window.__specReadStarted', 'delayed spec picker byte read');
    await load('simple-th.html');
    await evaluate('window.__releaseSpecRead()');
    await waitUntil('window.__specReadFinished', 'older spec byte read finishes');
    await sleep(50);
    assert.deepEqual(await table(), { columns: ['부서', '매출'], rows: [['서울', '100'], ['부산', '200']] }, 'an older spec-picker import cannot replace a newer main-file result');
    assert.equal(await total(), 300);
    assert.equal(await evaluate(`${S}.source.name`), 'simple-th.html');
    assert.equal(await evaluate(`${S}.specFromFile`), false);
    log('PASS: newer main file survives older spec-picker completion');

    await shot('html_input');
  }

  if (mode === 'page') {
    await navigate(url);
    await evaluate(`localStorage.clear()`);
    await navigate(url);
    const info = await evaluate(`({
      title: document.title,
      cards: document.querySelectorAll('.card').length,
      tabs: [...document.querySelectorAll('.tab')].map(t => t.textContent.trim()).join(' | '),
      stats: [...document.querySelectorAll('.stat b')].map(b => b.textContent).join(' / '),
      sources: document.querySelectorAll('.source').length,
      brokenImgs: [...document.images].filter(i => i.complete && i.naturalWidth === 0 && i.getAttribute('src')).map(i => i.src),
      overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      font: getComputedStyle(document.body).fontFamily.split(',')[0]
    })`);
    log('기본 렌더링:', JSON.stringify(info, null, 1));
    await shot('01_top');
    // 지연 로딩 썸네일을 모두 불러오도록 끝까지 스크롤
    await evaluate(`(async () => { const H = document.documentElement.scrollHeight; for (let y = 0; y < H; y += 600) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 150)); } window.scrollTo(0, 0); })()`);
    await sleep(1500);
    log('썸네일 로드:', await evaluate(`(() => { const imgs = [...document.querySelectorAll('.card-media img')]; return imgs.filter(i => i.complete && i.naturalWidth > 0).length + ' / ' + imgs.length; })()`));
    await shot('02_full', { full: true, scale: 0.5 });
    await evaluate(`window.scrollTo(0, document.getElementById('grid').offsetTop - 80)`); await sleep(400);
    await shot('02b_grid');
    await evaluate(`window.scrollTo(0, 0)`); await sleep(200);

    // 미리보기: Tabler (첫 카드)
    await click('.card[data-id="tabler"] [data-action="preview"]');
    log('Tabler 미리보기 로드(ms):', await waitPreviewLoaded());
    await sleep(1500);
    await shot('03_pv_tabler_desktop');
    await click('[data-device="tablet"]'); await sleep(1500); await shot('04_pv_tabler_tablet');
    await click('[data-device="mobile"]'); await sleep(1500); await shot('05_pv_tabler_mobile');
    await click('[data-device="desktop"]');
    await click('[data-pv="next"]');
    log('다음 데모 로드(ms):', await waitPreviewLoaded(), await evaluate(`document.getElementById('pv-title').textContent + ' ' + document.getElementById('pv-counter').textContent`));
    await sleep(2500);
    await shot('06_pv_next');
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    await sleep(300);
    log('Esc로 닫힘:', await evaluate(`document.getElementById('pv').hidden`));

    // iframe 차단 사이트(ECharts)
    await click('.tab[data-cat="charts"]'); await sleep(300);
    await click('.card[data-id="echarts"] [data-action="preview"]'); await sleep(1200);
    log('차단 안내 표시:', await evaluate(`!document.getElementById('pv-blocked').hidden && document.getElementById('pv-device').hidden`),
      '| 기기·새로고침 버튼 비활성:', await evaluate(`[...document.querySelectorAll('#pv [data-device], #pv [data-pv="reload"]')].every(b => b.disabled)`));
    await shot('07_pv_blocked');
    await click('[data-pv="close"]');
    await click('.tab[data-cat="report"]'); await sleep(300);
    await click('.card[data-id="observable-framework"] [data-action="preview"]'); await sleep(800);
    log('Observable 차단 안내:', await evaluate(`!document.getElementById('pv-blocked').hidden`),
      '| 카드 표시:', await evaluate(`document.querySelector('.card[data-id="observable-framework"] .card-meta').textContent.includes('새 탭 전용')`));
    await click('[data-pv="close"]');

    // 선택 → 패널 → 메모 → 내보내기
    await click('.tab[data-cat="all"]'); await sleep(300);
    for (const id of ['tabler', 'shadcn-dashboard', 'tufte-css']) await click(`.card[data-id="${id}"] [data-action="select"]`);
    log('선택 수 배지:', await evaluate(`document.getElementById('sel-count').textContent`));
    await click('#tray-btn'); await sleep(500);
    await evaluate(`(() => { const t = document.querySelector('[data-memo="tabler"]'); t.value = '카드 밀도와 KPI 배치가 좋음'; t.dispatchEvent(new Event('input', { bubbles: true })); })()`);
    await sleep(600);
    await shot('08_tray');
    await evaluate(`window.__copied = []; navigator.clipboard.writeText = async (t) => { window.__copied.push(t); };`);
    await click('[data-export="md-copy"]'); await sleep(200);
    await click('[data-export="json-copy"]'); await sleep(200);
    const copied = await evaluate(`window.__copied`);
    writeFileSync(join(outDir, 'export.md'), copied[0] || '');
    writeFileSync(join(outDir, 'export.json'), copied[1] || '');
    log('내보내기 길이(md/json):', (copied[0] || '').length, (copied[1] || '').length, 'JSON 파싱:', (() => { try { return JSON.parse(copied[1]).items.length + '개'; } catch (e) { return '실패 ' + e.message; } })());
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });

    // 새로고침 후 유지
    await navigate(url);
    log('새로고침 후 선택/메모 유지:', await evaluate(`document.getElementById('sel-count').textContent + ' / ' + (JSON.parse(localStorage.getItem('html-previewer:v1')).selected.tabler || {}).memo`));

    // 필터·검색
    await click('[data-toggle="htmlReady"]'); await sleep(200);
    const nHtml = await evaluate(`document.querySelectorAll('.card').length`);
    await click('[data-toggle="htmlReady"]');
    await evaluate(`(() => { const q = document.getElementById('q'); q.value = '다크 모드'; q.dispatchEvent(new Event('input')); })()`);
    for (let i = 0; i < 30 && (await evaluate(`document.querySelectorAll('.card').length`)) === 45; i++) await sleep(200);
    const nDark = await evaluate(`[...document.querySelectorAll('.card .card-title')].map(e => e.textContent).join(', ')`);
    await click('#reset-filters'); await sleep(200);
    await evaluate(`(() => { const s = document.getElementById('sort'); s.value = 'stars'; s.dispatchEvent(new Event('change')); })()`); await sleep(200);
    const topStars = await evaluate(`[...document.querySelectorAll('.card .card-title')].slice(0, 4).map(e => e.textContent).join(', ')`);
    await evaluate(`(() => { const s = document.getElementById('sort'); s.value = 'rank'; s.dispatchEvent(new Event('change')); })()`);
    log('HTML 바로 사용:', nHtml, '| "다크 모드" 검색:', nDark, '| 스타순 상위:', topStars);

    // 다크 모드
    await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'dark' }] });
    await sleep(500);
    await shot('09_dark_top');
    await click('.card[data-id="shadcn-dashboard"] [data-action="preview"]');
    await waitPreviewLoaded(); await sleep(2000);
    await shot('10_dark_preview');
    await click('[data-pv="close"]');
    await cdp.send('Emulation.setEmulatedMedia', { features: [] });

    // 모바일
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
    await navigate(url);
    log('모바일 가로 넘침:', await evaluate(`document.documentElement.scrollWidth + ' / ' + document.documentElement.clientWidth`));
    await shot('11_mobile_top', { scale: 0.5 });
    await evaluate(`window.scrollTo(0, document.querySelector('#grid').offsetTop - 70)`); await sleep(500);
    await shot('12_mobile_grid', { scale: 0.5 });
    await click('#tray-btn'); await sleep(500);
    await shot('13_mobile_tray', { scale: 0.5 });
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    await click('.card[data-id="tabler"] [data-action="preview"]'); await waitPreviewLoaded(); await sleep(1500);
    await shot('14_mobile_preview', { scale: 0.5 });
    await cdp.send('Emulation.clearDeviceMetricsOverride');
  }

  if (mode === 'make') {
    const fixtures = process.argv[5];
    const setFile = async (selector, path) => {
      const { root } = await cdp.send('DOM.getDocument', { depth: -1 });
      const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector });
      await cdp.send('DOM.setFileInputFiles', { files: [path], nodeId });
    };
    const waitFor = async (expr, ms = 15000) => {
      const t0 = Date.now();
      while (Date.now() - t0 < ms) { if (await evaluate(expr)) return Date.now() - t0; await sleep(200); }
      return -1;
    };
    const S = 'window.HC.make.state';
    const b = new CDP(version.webSocketDebuggerUrl); await b.open();
    await b.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: outDir, eventsEnabled: true });

    await navigate(url);
    await evaluate(`localStorage.clear()`);
    await navigate(url);
    // ①에서 담기 → 선택 패널 → 이 디자인으로 HTML 만들기
    for (const id of ['shadcn-dashboard', 'echarts']) await click(`.card[data-id="${id}"] [data-action="select"]`);
    await click('#tray-btn'); await sleep(400);
    await click('[data-export="make"]'); await sleep(600);
    log('② 화면 전환:', await evaluate(`!document.getElementById('view-make').hidden && document.getElementById('view-pick').hidden && location.hash`),
      '| 적용된 디자인/차트:', await evaluate(`${S}.design + ' / ' + (${S}.chartLib || '(기본)')`),
      '| 칩:', await evaluate(`[...document.querySelectorAll('.mk-chip')].map(c => c.textContent.trim().replace(/\\s+/g,' ')).join(' | ')`));
    await shot('m01_make_empty');

    // 샘플 데이터
    await click('#mk-sample');
    log('샘플 미리보기(ms):', await waitFor(`${S}.html.length > 0`));
    await sleep(5000);
    log('샘플:', await evaluate(`JSON.stringify({ cols: [...document.querySelectorAll('#mk-col-body tr')].length, kpis: ${S}.spec.kpis.length, charts: ${S}.spec.charts.length, title: ${S}.spec.meta.title, status: document.getElementById('mk-status').textContent, notes: document.getElementById('mk-notes').textContent.trim().slice(0, 60) })`));
    await shot('m02_sample_shadcn');
    writeFileSync(join(outDir, 'out_sample_shadcn.html'), await evaluate(`${S}.html`));

    // 실제 엑셀 (시트 2개)
    await setFile('#mk-file', join(fixtures, 'sales_2026.xlsx'));
    log('엑셀 로드(ms):', await waitFor(`${S}.source && ${S}.source.name === 'sales_2026.xlsx' && ${S}.html.includes('sales_2026')`, 20000));
    log('엑셀:', await evaluate(`JSON.stringify({ sheets: [...document.querySelectorAll('#mk-sheet option')].map(o => o.value), sheetVisible: !document.querySelector('.mk-sheet').hidden, cols: ${S}.cols.map(c => c.name + '=' + c.kind + '/' + c.role), kpis: ${S}.spec.kpis.map(k => k.label + '=' + k.value), summary: ${S}.spec.summary })`));
    await sleep(4000);
    await shot('m03_xlsx');
    writeFileSync(join(outDir, 'out_xlsx.html'), await evaluate(`${S}.html`));

    // cp949 CSV
    await setFile('#mk-file', join(fixtures, 'production.csv'));
    log('CSV 로드(ms):', await waitFor(`${S}.source && ${S}.source.name === 'production.csv'`));
    log('CSV:', await evaluate(`JSON.stringify({ title: ${S}.spec.meta.title, kpis: ${S}.spec.kpis.map(k => k.label + '=' + k.value + (k.delta != null ? '(' + k.delta + ')' : '')) })`));

    // 디자인·형태 바꾸기
    await evaluate(`(() => { const s = document.getElementById('mk-design-select'); s.value = 'quarto'; s.dispatchEvent(new Event('change')); })()`);
    await sleep(5000);
    log('Quarto:', await evaluate(`document.getElementById('mk-status').textContent`));
    await shot('m04_quarto');
    await evaluate(`(() => { const s = document.getElementById('mk-design-select'); s.value = 'tabler'; s.dispatchEvent(new Event('change')); })()`);
    await sleep(500);
    log('Tabler + ECharts(①에서 고름) 안내:', JSON.stringify(await evaluate(`document.getElementById('mk-notes').textContent.trim()`)));
    await evaluate(`(() => { const s = document.getElementById('mk-chart'); s.value = ''; s.dispatchEvent(new Event('change')); })()`);
    await sleep(800);
    log('Tabler 기본 차트 안내:', await evaluate(`document.getElementById('mk-notes').textContent.trim()`));
    await click('[data-fix-chart="echarts"]'); await sleep(600);
    log('ECharts로 바꾼 뒤:', await evaluate(`document.getElementById('mk-status').textContent + ' | 안내 ' + document.querySelectorAll('#mk-notes .note').length + '건'`));
    await evaluate(`(() => { const s = document.getElementById('mk-kit'); s.value = 'slides'; s.dispatchEvent(new Event('change')); })()`);
    await sleep(5000);
    await shot('m05_tabler_slides');
    await evaluate(`(() => { const s = document.getElementById('mk-kit'); s.value = ''; s.dispatchEvent(new Event('change')); })()`);
    // 제목 고치기 → 다시 그려지는지
    await evaluate(`(() => { const t = document.getElementById('mk-title'); t.value = '3분기 생산 현황 (테스트)'; t.dispatchEvent(new Event('input')); })()`);
    log('제목 반영(ms):', await waitFor(`${S}.html.includes('3분기 생산 현황 (테스트)')`, 8000));

    // 다운로드
    await click('#mk-download');
    const dl = join(outDir, '3분기 생산 현황 (테스트).html');
    const t0 = Date.now();
    while (Date.now() - t0 < 10000 && !existsSync(dl)) await sleep(300);
    log('HTML 다운로드:', existsSync(dl) ? `${dl.split(/[\\/]/).pop()} 저장됨` : '실패');

    // spec.json 불러오기 (Claude 스킬이 만든 spec 예시)
    await setFile('#mk-spec-file', join(fixtures, 'sample-spec.json'));
    log('spec 로드(ms):', await waitFor(`${S}.specFromFile && ${S}.spec.meta.title === '9월 생산 현황 대시보드'`),
      '| 열 역할 패널 숨김:', await evaluate(`document.getElementById('mk-cols').hidden`));

    // Claude 결과 붙여넣기
    await evaluate(`(() => { const s = JSON.parse(JSON.stringify(${S}.spec)); s.meta.title = 'Claude가 다듬은 제목'; s.summary = ['다듬은 요약 1', '다듬은 요약 2']; document.getElementById('mk-ai-paste').value = '좋습니다. 아래가 결과입니다.\\n\\n\\u0060\\u0060\\u0060json\\n' + JSON.stringify(s) + '\\n\\u0060\\u0060\\u0060'; })()`);
    await click('#mk-ai-apply'); await sleep(600);
    log('붙여넣기 적용:', await evaluate(`${S}.spec.meta.title + ' / 요약 ' + ${S}.spec.summary.length + '줄 / 화면 제목칸: ' + document.getElementById('mk-title').value`));

    // ①로 돌아가기
    await click('[data-view="pick"]'); await sleep(300);
    log('① 복귀:', await evaluate(`!document.getElementById('view-pick').hidden && document.querySelectorAll('.card').length`));

    // 모바일 (해시만 바꾸면 새로 로드되지 않으므로 쿼리를 붙여 새 문서로 연다)
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
    await navigate(`${url}?m=1#make`);
    await click('#mk-sample');
    await waitFor(`${S}.html.length > 0`); await sleep(4000);
    log('모바일 가로 넘침:', await evaluate(`document.documentElement.scrollWidth + ' / ' + document.documentElement.clientWidth`),
      '| 미리보기 기기:', await evaluate(`document.getElementById('mk-stage').dataset.device`));
    await shot('m06_mobile_top', { scale: 0.5 });
    await evaluate(`document.getElementById('mk-stage').scrollIntoView()`); await sleep(500);
    await shot('m07_mobile_stage', { scale: 0.5 });
    await cdp.send('Emulation.clearDeviceMetricsOverride');
  }

  if (mode === 'search') {
    await navigate(url);
    await evaluate(`localStorage.clear()`);
    await navigate(url);
    for (const q of ['다크 모드', 'tailwind', '보고서', 'MIT 대시보드', '없는검색어xyz']) {
      await evaluate(`(() => { const e = document.getElementById('q'); e.value = ${JSON.stringify(q)}; e.dispatchEvent(new Event('input')); })()`);
      await sleep(1000);
      const r = await evaluate(`({ n: document.querySelectorAll('.card').length, count: document.getElementById('result-count').textContent, empty: !document.getElementById('empty').hidden, names: [...document.querySelectorAll('.card .card-title')].slice(0, 6).map(e => e.textContent).join(', ') })`);
      log(`"${q}" → ${r.n}개 (${r.count}) 빈결과안내=${r.empty} ${r.names}`);
    }
  }

  if (mode === 'mobile') {
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
    await navigate(url);
    await evaluate(`window.scrollTo(0, document.querySelector('#grid').offsetTop - 70)`);
    await sleep(2500);
    log('모바일 썸네일(화면 근처) 로드:', await evaluate(`(() => { const imgs = [...document.querySelectorAll('.card-media img')].slice(0, 3); return imgs.map(i => i.complete && i.naturalWidth > 0).join(','); })()`));
    await shot('m1_grid', { scale: 0.5 });
    await click('.card[data-id="tabler"] [data-action="preview"]');
    log('기본 기기:', await evaluate(`document.querySelector('[data-device][aria-pressed="true"]').dataset.device`));
    log('로드(ms):', await waitPreviewLoaded(20000));
    await sleep(2000);
    await shot('m2_preview_mobile', { scale: 0.5 });
    await click('[data-device="desktop"]'); await sleep(3000);
    await shot('m3_preview_desktop', { scale: 0.5 });
    await click('[data-pv="close"]');
    await evaluate(`window.scrollTo(0, 0)`); await sleep(300);
    await click('#tray-btn'); await sleep(600);
    await shot('m4_tray', { scale: 0.5 });
  }

  if (mode === 'embed') {
    // 페이지 안 미리보기가 가능한 모든 데모를 실제로 열어서 캡처
    await navigate(url);
    const all = await evaluate(`window.PREVIEWER_DATA.items.filter(i => i.embeddable).map(i => i.id)`);
    const ids = all.filter((id) => !existsSync(join(outDir, `emb_${id}.jpg`))); // 이미 캡처한 데모는 건너뜀(이어서 실행)
    log(`대상 ${ids.length}개 (전체 ${all.length}개 중 남은 것)`);
    for (const id of ids) {
      await evaluate(`(() => { document.querySelector('.tab[data-cat="all"]').click(); })()`);
      await click(`.card[data-id="${id}"] [data-action="preview"]`);
      const ms = await waitPreviewLoaded(15000);
      await sleep(2500);
      await shot(`emb_${id}`, { scale: 0.5, format: 'jpeg', quality: 70 });
      log(`${id.padEnd(22)} load=${ms}ms`);
      await click('[data-pv="close"]');
      await sleep(200);
    }
  }
} catch (e) {
  problems.push(`테스트 실패: ${e.message}`);
} finally {
  log(problems.length ? `문제 ${problems.length}건:\n - ${[...new Set(problems)].join('\n - ')}` : '콘솔 오류·예외 없음');
  try {
    const b = new CDP(version.webSocketDebuggerUrl); await b.open(); await b.send('Browser.close');
  } catch { /* 이미 종료 */ }
  await sleep(800);
  try {
    execFileSync('powershell', ['-NoProfile', '-Command', `Get-CimInstance Win32_Process -Filter "Name='msedge.exe'" | Where-Object { $_.CommandLine -like '*${profile}*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }`]);
  } catch { /* 무시 */ }
  process.exit(problems.length ? 1 : 0);
}
