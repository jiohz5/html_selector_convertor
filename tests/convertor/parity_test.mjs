// 브라우저 렌더러(assets/hc-render.js)가 render.py와 같은 HTML을 만드는지 확인한다.
// 견본 spec × (디자인 45종 + Tabler × 차트 3종 + 옵션 조합)을 양쪽으로 렌더링해 줄바꿈만 맞춘 뒤 비교한다.
// - spec 데이터 블록(<script id="hc-spec">)은 값으로 비교한다: Python은 실수 97.0을 "97.0", JS는 "97"로 쓰지만
//   결과 HTML의 엔진은 JSON.parse로 읽으므로 같은 값이다.
// - 그 밖의 HTML 전체(키트·토큰·CSS·라이브러리·엔진·설정)는 바이트 단위로 비교한다.
//
// 사용 (html/ 폴더에서):  node tests/convertor/parity_test.mjs
import { execFileSync } from 'node:child_process';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const SPEC_PATH = join(HERE, 'fixtures', 'sample-spec.json');
const RENDER = join(ROOT, 'html-convertor', 'scripts', 'render.py');

// 브라우저 대신 vm 컨텍스트에 Previewer 데이터·번들·렌더러를 읽어 들인다
const ctx = { window: {} };
vm.createContext(ctx);
for (const f of ['assets/templates.js', 'assets/convertor-bundle.js', 'assets/hc-render.js']) {
  vm.runInContext(readFileSync(join(ROOT, f), 'utf8'), ctx, { filename: f });
}
const HC = ctx.window.HC;
const spec = JSON.parse(readFileSync(SPEC_PATH, 'utf8'));

const cases = HC.list().map((d) => ({ name: d.id, design: d.id, opts: {} }));
cases.push(
  { name: 'tabler-chartjs', design: 'tabler', opts: { chartLib: 'chartjs' } },
  { name: 'tabler-plot', design: 'tabler', opts: { chartLib: 'plot' } },
  { name: 'tabler-plotly', design: 'tabler', opts: { chartLib: 'plotly' } },
  { name: 'tabler-slides', design: 'tabler', opts: { kit: 'slides' } },
  { name: 'quarto-impress-dark', design: 'quarto', opts: { kit: 'impress', theme: 'dark' } },
  { name: 'adminlte-topnav-gradient', design: 'adminlte', opts: { layout: 'topnav', kpiStyle: 'gradient' } },
  { name: 'shadcn-brand', design: 'shadcn-dashboard', opts: { tokens: '{"primary": "#1428a0"}' } },
  { name: 'tufte-landing-css', design: 'tufte-css', opts: { kit: 'landing', css: '.hc-kpi{outline:1px solid red}' } },
  { name: 'daisyui-class-theme-dark', design: 'daisyui', opts: { theme: 'dark' } },
);

const flags = { kit: '--kit', chartLib: '--chart-lib', layout: '--layout', theme: '--theme', kpiStyle: '--kpi-style', tokens: '--tokens', css: '--css' };
const SPEC_BLOCK = /(<script type="application\/json" id="hc-spec">)([\s\S]*?)(<\/script>)/;

// 키 순서와 무관하게 값이 같은지 비교
function sameValue(a, b) {
  if (a === b) return true;
  if (typeof a !== typeof b || a === null || b === null || typeof a !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  return ka.length === kb.length && ka.every((k) => Object.prototype.hasOwnProperty.call(b, k) && sameValue(a[k], b[k]));
}

function compare(py, js) {
  const mp = py.match(SPEC_BLOCK);
  const mj = js.match(SPEC_BLOCK);
  if (!mp || !mj) return 'spec 블록을 찾지 못함';
  const unescape = (s) => JSON.parse(s.replace(/<\\\//g, '</'));
  if (!sameValue(unescape(mp[2]), unescape(mj[2]))) return 'spec 값이 다름';
  const rest = (s) => s.replace(SPEC_BLOCK, '$1@@SPEC@@$3');
  const a = rest(py);
  const b = rest(js);
  if (a === b) return null;
  let i = 0;
  while (i < a.length && a[i] === b[i]) i += 1;
  return `${i}번째 글자부터 다름\n    py: ${JSON.stringify(a.slice(Math.max(0, i - 40), i + 60))}\n    js: ${JSON.stringify(b.slice(Math.max(0, i - 40), i + 60))}`;
}
const tmp = mkdtempSync(join(tmpdir(), 'hc-parity-'));
let same = 0;
const diffs = [];
for (const c of cases) {
  const out = join(tmp, `${c.name}.html`);
  const args = [RENDER, '--design', c.design, '--spec', SPEC_PATH, '--out', out];
  for (const [k, v] of Object.entries(c.opts)) args.push(flags[k], v);
  execFileSync('python', args, { stdio: 'pipe' });
  const py = readFileSync(out, 'utf8').replace(/\r\n/g, '\n');
  const js = HC.build(spec, c.design, c.opts).html;
  const diff = compare(py, js);
  if (!diff) { same += 1; continue; }
  diffs.push(`${c.name}: ${diff}`);
}
rmSync(tmp, { recursive: true, force: true });
console.log(`render.py와 비교: ${cases.length}개 중 동일 ${same}개, 다름 ${diffs.length}개 (spec 블록은 값 비교, 나머지는 바이트 비교)`);
diffs.forEach((d) => console.log(` - ${d}`));
process.exit(diffs.length ? 1 : 0);
