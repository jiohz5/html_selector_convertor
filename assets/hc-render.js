/* html-convertor 브라우저 렌더러 — html-convertor/scripts/render.py 의 build()를 그대로 옮긴 것.
 * 같은 spec·디자인·옵션이면 render.py와 같은 HTML을 만든다(줄바꿈만 LF).
 * 키트·엔진·designs.json은 assets/convertor-bundle.js(자동 생성)에서 읽는다.
 * render.py를 고치면 이 파일도 같이 고치고, tests/convertor의 비교 테스트로 확인한다. */
(() => {
  'use strict';

  const PRETENDARD = 'https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css';
  const SANS_FALLBACK = "'Pretendard Variable', Pretendard, system-ui, -apple-system, 'Segoe UI', 'Malgun Gothic', sans-serif";
  const SERIF_FALLBACK = "'Noto Serif KR', Georgia, 'Times New Roman', serif";
  const FONT_WEIGHTS = { Merriweather: '400;700', 'Roboto Slab': '400;700', Lexend: '400;500;600;700' };
  const CHART_IDS = { echarts: 'echarts', chartjs: 'chartjs', plotly: 'plotly', 'observable-plot': 'plot', apexcharts: 'apexcharts' };

  const bundle = () => {
    if (!window.HC_BUNDLE) throw new Error('assets/convertor-bundle.js를 불러오지 못했습니다');
    return window.HC_BUNDLE;
  };
  const catalogItem = (id) => ((window.PREVIEWER_DATA && window.PREVIEWER_DATA.items) || []).find((it) => it.id === id) || null;
  const isDict = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

  // Python html.escape(s, quote=True)
  const pyEscape = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#x27;');
  // Python urllib.parse.quote_plus
  const quotePlus = (s) => encodeURIComponent(s)
    .replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)
    .replace(/%20/g, '+');
  // Python json.dumps(obj, ensure_ascii=False, indent=1).replace("</", "<\\/")
  const safeJson = (obj) => JSON.stringify(obj, null, 1).replace(/<\//g, '<\\/');

  function googleFontUrl(families) {
    if (!families.length) return null;
    const parts = families.map((f) => `family=${quotePlus(f)}:wght@${FONT_WEIGHTS[f] || '400;500;600;700'}`);
    return `https://fonts.googleapis.com/css2?${parts.join('&')}&display=swap`;
  }

  function resolve(designId) {
    const D = bundle().designs;
    const table = D.designs;
    if (table[designId]) return { usedId: designId, d: table[designId], notice: null };
    const item = catalogItem(designId);
    if (item) {
      const fb = D.fallbackByCategory[item.category] || 'tabler';
      return { usedId: fb, d: table[fb], notice: `'${item.name}' 레시피가 없어 같은 유형의 '${fb}'로 대신 렌더링합니다.` };
    }
    throw new Error(`알 수 없는 디자인: ${designId}`);
  }

  function cssTokens(tokens) {
    const out = [];
    Object.entries(tokens).forEach(([k, v]) => {
      if (k === 'palette') v.slice(0, 8).forEach((c, i) => out.push(`--hc-c${i + 1}: ${c};`));
      else out.push(`--hc-${k}: ${v};`);
    });
    return out;
  }

  const themeSelector = (theme) => (theme.attr === 'class'
    ? `:root.${theme.dark || 'dark'}`
    : `:root[${theme.attr}="${theme.dark}"]`);

  function applyClassMap(markup, classMap) {
    if (!classMap || !Object.keys(classMap).length) return markup;
    return markup.replace(/(\bclass=)"([^"]*)"/g, (m, attr, value) => {
      const classes = value.split(/\s+/).filter(Boolean);
      let extra = [];
      classes.forEach((c) => { extra = extra.concat(String(classMap[c] || '').split(/\s+/).filter(Boolean)); });
      const merged = classes.concat(extra.filter((e) => !classes.includes(e)));
      return `${attr}"${merged.join(' ')}"`;
    });
  }

  /**
   * spec(객체) + 디자인 id → { html, design, kit, chartLib, notice }
   * opts: kit · chartLib · layout · theme(light|dark|system) · kpiStyle · tokens(객체 또는 JSON 문자열) · css
   */
  function build(spec, designId, opts = {}) {
    const D = bundle().designs;
    const { usedId, d, notice } = resolve(designId);
    const defaults = D.defaults;

    const kitName = opts.kit || d.kit || 'dashboard';
    if (!D.kits[kitName]) throw new Error(`알 수 없는 키트: ${kitName}`);
    const kit = D.kits[kitName];
    const markup = bundle().kits[kit.file];

    const meta = spec.meta || {};
    const title = meta.title || '결과 보고';

    // ── 토큰: 기본값 ← 디자인 ← 사용자 덮어쓰기 ──
    const tokens = { ...defaults.tokens, ...(d.tokens || {}) };
    const dark = { ...defaults.dark, ...(d.dark || {}) };
    if (opts.tokens) {
      const override = typeof opts.tokens === 'string' ? JSON.parse(opts.tokens) : opts.tokens;
      Object.assign(tokens, isDict(override) ? ('light' in override ? override.light : override) : {});
      if (isDict(override) && 'dark' in override) Object.assign(dark, override.dark);
      else if (isDict(override) && 'primary' in override && !('primary' in (d.dark || {}))) dark.primary = override.primary;
    }
    const fonts = [...(d.fonts || [])];
    const serif = d.fontKind === 'serif';
    if (!('font' in tokens)) {
      const stack = fonts.slice(0, 1).map((f) => `'${f}'`).join(', ');
      tokens.font = `${stack ? `${stack}, ` : ''}${serif ? SERIF_FALLBACK : SANS_FALLBACK}`;
    }
    if (serif) fonts.push('Noto Serif KR');

    const theme = { ...defaults.theme, ...(d.theme || {}) };
    if (opts.theme) theme.default = opts.theme;
    let rootCss = `:root {\n  ${cssTokens(tokens).join('\n  ')}\n}\n`;
    rootCss += `${themeSelector(theme)} {\n  ${cssTokens(dark).join('\n  ')}\n}\n`;

    // ── <head>: 폰트 → 원본 CSS → 키트 공통 CSS ──
    const head = [
      `<meta name="description" content="${pyEscape(meta.subtitle || title)}">`,
      '<meta name="color-scheme" content="light dark">',
      `<meta name="generator" content="html-convertor · design=${usedId} · kit=${kitName}">`,
      `<link rel="stylesheet" href="${PRETENDARD}">`,
    ];
    const gf = googleFontUrl(fonts);
    if (gf) {
      head.push('<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>');
      head.push(`<link rel="stylesheet" href="${gf}">`);
    }
    const libJs = [];
    (d.libs || []).forEach((lib) => {
      if (['reveal', 'reveal-white', 'impress'].includes(lib) && kit.mode !== 'slides') return;
      const L = D.libs[lib];
      (L.css || []).forEach((u) => head.push(`<link rel="stylesheet" href="${u}">`));
      libJs.push(...(L.js || []));
    });
    if (kitName === 'slides' && !(d.libs || []).includes('reveal')) {
      const L = D.libs.reveal;
      L.css.forEach((u) => head.push(`<link rel="stylesheet" href="${u}">`));
      libJs.push(...L.js);
    }
    if (kitName === 'impress' && !(d.libs || []).includes('impress')) libJs.push(...D.libs.impress.js);

    const chartLib = opts.chartLib || d.chartLib || 'echarts';
    if (!D.chartLibs[chartLib]) throw new Error(`알 수 없는 차트 라이브러리: ${chartLib}`);
    const charts = spec.charts;
    if (Array.isArray(charts) ? charts.length : charts) libJs.push(...D.chartLibs[chartLib].js);

    head.push(`<style>\n/* 디자인 토큰: ${usedId} */\n${rootCss}</style>`);
    head.push(`<style>\n${bundle().commonCss}</style>`);
    const extraCss = [d.css, opts.css].filter(Boolean).join('\n');
    const styleExtra = extraCss ? `<style>\n${extraCss}\n</style>` : '';

    // ── <body> 끝: spec·설정·라이브러리·엔진 ──
    const config = { mode: kit.mode, chartLib, theme, design: usedId, kit: kitName };
    const bodyEnd = [
      `<script type="application/json" id="hc-spec">${safeJson(spec)}<\/script>`,
      `<script type="application/json" id="hc-config">${safeJson(config)}<\/script>`,
      ...libJs.map((u) => `<script src="${u}"><\/script>`),
      `<script>\n${bundle().engine}\n<\/script>`,
    ];

    const layout = opts.layout || d.layout || (kitName === 'dashboard' ? 'sidebar' : '');
    const kpiStyle = opts.kpiStyle || d.kpiStyle || 'plain';
    const bodyClass = [`hc-kit-${kitName}`, `hc-design-${usedId}`, layout ? `hc-layout-${layout}` : '', `hc-kpi-${kpiStyle}`]
      .filter(Boolean).join(' ');

    let themeAttr = '';
    if (theme.attr !== 'class') {
      const start = theme.default !== 'dark' ? theme.light : theme.dark;
      themeAttr = `${theme.attr}="${start}"`;
    } else if (theme.default === 'dark') {
      themeAttr = `class="${theme.dark || 'dark'}"`;
    }

    let credit = d.credit;
    const item = catalogItem(usedId);
    if (!credit && item && !d.chartOnly) {
      const verb = d.paid ? '디자인 스타일 참고(원본 코드 미사용)' : '디자인 참고';
      credit = `${verb}: ${item.name} (${item.license})`;
    }
    const creditHtml = credit ? `<span class="hc-credit">${pyEscape(credit)}</span>` : '';

    // 로고 칸 글자: meta.brand → 제목에서 숫자·기호가 아닌 첫 글자 (Python의 [^\W\d_])
    const mBrand = title.match(/[\p{L}\p{Nl}\p{No}]/u);
    const brand = String(meta.brand || (mBrand ? mBrand[0] : 'R')).slice(0, 2).toUpperCase();

    const replacements = {
      '%%HTML_ATTRS%%': themeAttr,
      '%%TITLE%%': pyEscape(title),
      '%%BODY_CLASS%%': bodyClass,
      '%%BRAND_MARK%%': pyEscape(brand),
      '%%CREDIT%%': creditHtml,
      '<!--HC:HEAD-->': head.join('\n  '),
      '<!--HC:STYLE-->': styleExtra,
      '<!--HC:BODY_END-->': bodyEnd.join('\n  '),
    };
    // 엔진·spec 안의 문자열이 치환되지 않도록 마커는 키트 원문에서만 바꾼다
    let out = markup;
    Object.entries(replacements).forEach(([k, v]) => { if (k.startsWith('%%')) out = out.split(k).join(v); });
    out = applyClassMap(out, d.classMap || {});
    ['<!--HC:HEAD-->', '<!--HC:STYLE-->', '<!--HC:BODY_END-->'].forEach((k) => {
      out = out.replace(k, () => replacements[k]); // 함수로 넘겨야 '$' 특수 패턴이 해석되지 않는다
    });
    return { html: out, design: usedId, kit: kitName, chartLib, notice };
  }

  /** 디자인·차트 조합에 대한 라이선스·대체 안내 (resolve_design.py의 notes와 같은 기준) */
  function notes(designId, chartLib) {
    const out = [];
    let r;
    try { r = resolve(designId); } catch (e) { return [e.message]; }
    if (r.notice) out.push(r.notice);
    const it = catalogItem(designId);
    if (it) {
      if (r.d.paid || it.pricing === 'paid') out.push(`${it.name}: 유료 템플릿이라 원본 코드 없이 색·배치·타이포만 재현합니다. 결과물에 '스타일 참고'로 표기됩니다.`);
      if (String(it.license).startsWith('CC BY')) out.push(`${it.name}: ${it.license} — 출처 표기가 필요합니다(푸터에 자동 표기).`);
    }
    const lib = chartLib || r.d.chartLib || 'echarts';
    if (lib === 'apexcharts') out.push('차트가 ApexCharts입니다. 연매출·예산 200만 달러 이상 조직은 유료 라이선스가 필요하니, 회사 업무용이면 ECharts(Apache-2.0)로 바꾸세요.');
    return out;
  }

  /** 전체 디자인 목록 (designs.json 순서, Previewer 이름·분류와 함께) */
  function list() {
    const D = bundle().designs;
    return Object.entries(D.designs).map(([id, d]) => {
      const it = catalogItem(id) || {};
      return { id, name: it.name || id, category: it.category || '', kit: d.kit || 'dashboard', chartLib: d.chartLib || 'echarts', paid: !!d.paid, chartOnly: !!d.chartOnly };
    });
  }

  window.HC = Object.assign(window.HC || {}, {
    build, notes, list, resolve,
    kits: () => bundle().designs.kits,
    chartLibs: () => Object.keys(bundle().designs.chartLibs),
    CHART_IDS,
  });
})();
