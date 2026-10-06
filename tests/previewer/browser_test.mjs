// HTML Previewer 브라우저 테스트: Edge(없으면 Chrome)를 헤드리스로 띄워 CDP로 클릭·입력·파일 올리기·스크린샷.
//
// 사용 (html/ 폴더에서):
//   node tests/previewer/browser_test.mjs page     # ① 고르기: 카드·필터·검색·미리보기·선택·내보내기·다크·모바일
//   node tests/previewer/browser_test.mjs make     # ② 만들기: 선택 연동·샘플·엑셀·CSV·디자인 변경·다운로드·spec·모바일
//   node tests/previewer/browser_test.mjs search   # 검색만
//   node tests/previewer/browser_test.mjs embed    # 페이지 안 미리보기가 되는 데모를 전부 실제로 열어 캡처 (몇 분 걸림)
//   node tests/previewer/browser_test.mjs page dist/html-previewer.html   # 단일 파일판 검사
// 결과(로그·스크린샷·다운로드 파일)는 tests/previewer/out/<mode>/ 에 남는다. 마지막 줄이 '콘솔 오류·예외 없음'이면 통과.
import { spawn, execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

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
const PORT = mode === 'embed' ? 9334 : mode === 'make' ? 9335 : 9333;
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
  send(method, params = {}) {
    const id = ++this.id;
    this.ws.send(JSON.stringify({ id, method, params }));
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
  if (m.method === 'Runtime.exceptionThrown') problems.push(`예외: ${m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text}`);
  if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') problems.push(`console.error: ${m.params.args.map((a) => a.value || a.description).join(' ')}`);
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
  process.exit(0);
}
