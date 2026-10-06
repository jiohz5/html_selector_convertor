/* html-convertor 렌더링 엔진 — spec(JSON)을 키트의 <template>에 채워 화면을 만든다.
 * 키트 계약: [data-region], [data-meta], [data-slot], <template id="tpl-*"> (references/kits.md 참고)
 * 의존성 없음. 차트 라이브러리는 설정(chartLib)에 따라 전역 객체를 사용한다. */
(() => {
  'use strict';

  const readJSON = (id) => {
    const el = document.getElementById(id);
    try { return el ? JSON.parse(el.textContent) : {}; } catch (e) { console.error(`${id} JSON 오류`, e); return {}; }
  };
  const SPEC = readJSON('hc-spec');
  const CFG = Object.assign({ mode: 'page', chartLib: 'echarts', theme: { attr: 'data-bs-theme', light: 'light', dark: 'dark', default: 'light' } }, readJSON('hc-config'));
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const arr = (v) => (Array.isArray(v) ? v : v == null ? [] : [v]);
  const slug = (s, i) => (String(s || '').toLowerCase().replace(/[^\w가-힣]+/g, '-').replace(/^-|-$/g, '') || `item-${i}`);

  // ── 숫자 형식 ──
  // fixed=true면 끝자리 0도 남긴다(decimals를 명시한 경우: 1.60%가 1.6%로 줄어 표의 자릿수가 어긋나지 않게)
  const nfBase = (v, d, fixed = false) => v.toLocaleString('ko-KR', { minimumFractionDigits: fixed ? d : 0, maximumFractionDigits: d });
  const nf = (v, d) => nfBase(v, d);
  function compactKo(v, d = 1) {
    const a = Math.abs(v);
    const units = [[1e12, '조'], [1e8, '억'], [1e4, '만']];
    for (const [n, u] of units) if (a >= n) return `${nf(v / n, d)}${u}`;
    return nf(v, Number.isInteger(v) ? 0 : d);
  }
  function fmt(v, o = {}) {
    if (v == null || v === '' || (typeof v === 'number' && !Number.isFinite(v))) return '–';
    if (typeof v !== 'number') return String(v);
    const f = o.format || 'number';
    const d = o.decimals;
    const fx = d != null;
    const nf = (x, dd) => nfBase(x, dd, fx);
    let s;
    if (f === 'compact') s = compactKo(v, d ?? 1);
    else if (f === 'percent') s = `${nf(v, d ?? 1)}%`;
    else if (f === 'currency') {
      const cur = o.currency || 'KRW';
      // 원화: 표·툴팁은 전체 자릿수로 통일하고, 축약(12.8억원)은 compact:true일 때만(KPI는 1억 이상이면 자동)
      const short = o.compact ?? (o._kpi && Math.abs(v) >= 1e8);
      if (cur === 'KRW') s = short ? `${compactKo(v, d ?? 1)}원` : `${nf(v, d ?? 0)}원`;
      else s = new Intl.NumberFormat('en-US', { style: 'currency', currency: cur, maximumFractionDigits: d ?? 0, notation: short ? 'compact' : 'standard' }).format(v);
    } else if (f === 'decimal') s = nf(v, d ?? 1);
    else s = nf(v, d ?? (Number.isInteger(v) ? 0 : 1));
    // 영문 단위(ms, kg)만 띄어 쓰고 %·%p·한글 단위는 붙인다
    return o.unit ? `${s}${/^[a-zA-Z]/.test(o.unit) ? ' ' : ''}${o.unit}` : s;
  }
  // 축 눈금: 단위·통화 기호 없이 숫자만(큰 수는 만·억), 퍼센트만 % 유지
  const axisFmt = (o) => (v) => {
    if (typeof v !== 'number') return v;
    if (Math.abs(v) >= 1e4) return compactKo(v, 1);
    return o.format === 'percent' ? `${nf(v, 1)}%` : nf(v, Number.isInteger(v) ? 0 : 2);
  };

  const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ESC[c]);
  const richText = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  const addCls = (el, cls) => { if (el && cls) el.classList.add(...cls.split(/\s+/).filter(Boolean)); };

  // ── 템플릿 ──
  const tpl = (id) => document.getElementById(id);
  function clone(id) {
    const t = tpl(id);
    if (!t) return null;
    return t.content.firstElementChild.cloneNode(true);
  }
  const slot = (root, name) => root.querySelector(`[data-slot="${name}"]`) || (root.matches && root.matches(`[data-slot="${name}"]`) ? root : null);
  function setSlot(root, name, value, html) {
    const el = slot(root, name);
    if (!el) return null;
    if (value == null || value === '') { el.remove(); return null; }
    if (html) el.innerHTML = value; else el.textContent = value;
    return el;
  }

  // ── 테마 ──
  const THEME_KEY = `hc-theme:${location.pathname}`;
  const store = {
    get() { try { return localStorage.getItem(THEME_KEY); } catch { return null; } },
    set(v) { try { localStorage.setItem(THEME_KEY, v); } catch { /* 저장 불가 환경 */ } },
  };
  const T = CFG.theme || {};
  function currentTheme() {
    const html = document.documentElement;
    if (T.attr === 'class') return html.classList.contains(T.dark || 'dark') ? 'dark' : 'light';
    return html.getAttribute(T.attr) === T.dark ? 'dark' : 'light';
  }
  function applyTheme(mode) {
    const html = document.documentElement;
    if (T.attr === 'class') html.classList.toggle(T.dark || 'dark', mode === 'dark');
    else html.setAttribute(T.attr, mode === 'dark' ? T.dark : T.light);
    html.style.colorScheme = mode;
    $$('[data-action="theme"]').forEach((b) => {
      b.setAttribute('aria-pressed', String(mode === 'dark'));
      b.setAttribute('title', mode === 'dark' ? '라이트 모드로 전환' : '다크 모드로 전환');
      const icon = slot(b, 'theme-icon');
      if (icon) icon.textContent = mode === 'dark' ? '☀' : '☾';
    });
  }
  (function initTheme() {
    let mode = store.get();
    if (mode !== 'light' && mode !== 'dark') {
      mode = T.default === 'system'
        ? (window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
        : (T.default || 'light');
    }
    applyTheme(mode);
  }());

  // ── 팔레트: 키트/디자인이 정한 CSS 변수(--hc-*)를 읽는다 ──
  // 토큰 값(var(), oklch(), color-mix() 등 무엇이든)을 차트 라이브러리가 읽을 수 있는 rgb()로 바꾼다
  let ctx2d = null;
  function cssColor(name, fallback) {
    const probe = document.createElement('span');
    probe.style.color = `var(${name}, ${fallback})`;
    probe.style.display = 'none';
    document.body.appendChild(probe);
    const computed = getComputedStyle(probe).color;
    probe.remove();
    if (/^rgba?\(/.test(computed)) return computed;
    try {
      ctx2d = ctx2d || Object.assign(document.createElement('canvas'), { width: 1, height: 1 }).getContext('2d', { willReadFrequently: true });
      ctx2d.clearRect(0, 0, 1, 1);
      ctx2d.fillStyle = computed;
      ctx2d.fillRect(0, 0, 1, 1);
      const [r, g, b, a] = ctx2d.getImageData(0, 0, 1, 1).data;
      return a === 255 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${(a / 255).toFixed(2)})`;
    } catch { return fallback; }
  }
  function palette() {
    const series = [];
    for (let i = 1; i <= 8; i += 1) series.push(cssColor(`--hc-c${i}`, ['#2563eb', '#16a34a', '#f59e0b', '#dc2626', '#7c3aed', '#0891b2', '#db2777', '#65a30d'][i - 1]));
    const font = getComputedStyle(document.documentElement).getPropertyValue('--hc-font').trim() || getComputedStyle(document.body).fontFamily;
    return {
      series,
      fg: cssColor('--hc-fg', '#1f2937'),
      muted: cssColor('--hc-muted', '#6b7280'),
      grid: cssColor('--hc-grid', '#e5e7eb'),
      surface: cssColor('--hc-surface', '#ffffff'),
      font,
      dark: currentTheme() === 'dark',
    };
  }
  function alpha(color, a) {
    const m = String(color).match(/rgba?\(([^)]+)\)/);
    if (!m) return color;
    const [r, g, b] = m[1].split(/[\s,/]+/).map(Number);
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  }

  // ── 차트 어댑터 ──
  const isPie = (t) => t === 'pie' || t === 'donut';
  // 값 축 범위: spec의 min/max(달성률 95~100%처럼 차이가 작을 때). 한쪽만 주면 나머지는 데이터로 채운다
  const valueRange = (c) => {
    if (c.min == null && c.max == null) return null;
    const all = c.series.flatMap((s) => s.data).filter((v) => typeof v === 'number');
    const hi = Math.max(...all);
    const lo = Math.min(...all);
    return [c.min ?? Math.min(0, lo), c.max ?? hi + (hi - (c.min ?? 0)) * 0.05];
  };
  const seriesType = (c, s) => s.type || ({ area: 'line', stacked: 'bar', hbar: 'bar' }[c.type] || c.type || 'line');

  const ADAPTERS = {
    echarts(el, c, p) {
      const t = c.type || 'line';
      const vf = (v) => fmt(v, c);
      const multi = c.series.length > 1;
      const tooltipBase = { backgroundColor: p.surface, borderColor: p.grid, textStyle: { color: p.fg, fontFamily: p.font }, valueFormatter: vf };
      const legend = { show: multi || isPie(t), top: isPie(t) ? 'bottom' : 0, left: isPie(t) ? 'center' : 0, icon: 'circle', itemWidth: 8, itemHeight: 8, textStyle: { color: p.muted, fontFamily: p.font } };
      const axis = { axisLine: { lineStyle: { color: p.grid } }, axisTick: { show: false }, axisLabel: { color: p.muted, fontFamily: p.font }, splitLine: { lineStyle: { color: p.grid } } };
      let opt;
      if (isPie(t)) {
        opt = {
          color: p.series, tooltip: { ...tooltipBase, trigger: 'item' }, legend,
          series: [{
            type: 'pie', radius: t === 'donut' ? ['44%', '66%'] : '64%', center: ['50%', '45%'], avoidLabelOverlap: true,
            itemStyle: { borderColor: p.surface, borderWidth: 2, borderRadius: t === 'donut' ? 4 : 0 },
            label: { color: p.fg, fontFamily: p.font, overflow: 'none', formatter: (q) => `${nf(q.percent, 1)}%` }, labelLine: { length: 8, length2: 6 },
            data: c.x.map((name, i) => ({ name, value: c.series[0].data[i] })),
          }],
        };
      } else if (t === 'scatter') {
        opt = {
          color: p.series, legend, tooltip: { ...tooltipBase, trigger: 'item', valueFormatter: undefined },
          grid: { left: 8, right: 16, top: multi ? 32 : 16, bottom: 8, containLabel: true },
          xAxis: { type: 'value', name: c.xLabel, nameLocation: 'middle', nameGap: 28, nameTextStyle: { color: p.muted }, ...axis, scale: true },
          yAxis: { type: 'value', name: c.yLabel, nameTextStyle: { color: p.muted }, ...axis, scale: true },
          series: c.series.map((s) => ({ name: s.name, type: 'scatter', symbolSize: 8, data: s.data })),
        };
      } else {
        const hbar = t === 'hbar';
        const cat = { type: 'category', data: c.x, ...axis, splitLine: { show: false }, inverse: hbar, axisLabel: { ...axis.axisLabel, hideOverlap: true } };
        // 선 그래프는 값 범위에 맞춰 축을 잡고(scale), 면적·막대는 0부터 시작해 크기 비교가 왜곡되지 않게 한다
        const val = { type: 'value', min: c.min, max: c.max, ...axis, scale: t === 'line' && !c.series.some((s) => s.type === 'bar'), axisLabel: { ...axis.axisLabel, formatter: axisFmt(c) } };
        opt = {
          color: p.series, legend, tooltip: { ...tooltipBase, trigger: 'axis' },
          grid: { left: 8, right: 16, top: multi ? 32 : 12, bottom: 8, containLabel: true },
          xAxis: hbar ? val : { ...cat, boundaryGap: t !== 'line' && t !== 'area' ? true : c.series.some((s) => s.type === 'bar') },
          yAxis: hbar ? cat : val,
          series: c.series.map((s, i) => {
            const st = seriesType(c, s);
            const col = p.series[i % 8];
            return {
              name: s.name, type: st, data: s.data, smooth: st === 'line' ? 0.3 : undefined, smoothMonotone: 'x', showSymbol: false,  // monotone: 곡선이 실제 값 위아래로 튀지 않게
              areaStyle: t === 'area' && st === 'line' ? { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: alpha(col, 0.28) }, { offset: 1, color: alpha(col, 0.02) }]) } : undefined,
              stack: t === 'stacked' ? 'total' : undefined, barMaxWidth: 36,
              itemStyle: st === 'bar' && t !== 'stacked' ? { borderRadius: hbar ? [0, 4, 4, 0] : [4, 4, 0, 0] } : undefined,
              lineStyle: st === 'line' ? { width: 2 } : undefined, emphasis: { focus: 'series' },
            };
          }),
        };
      }
      const inst = echarts.init(el, null, { renderer: 'svg' });
      inst.setOption(opt);
      return { resize: () => inst.resize(), destroy: () => inst.dispose() };
    },

    chartjs(el, c, p) {
      const t = c.type || 'line';
      const canvas = document.createElement('canvas');
      el.appendChild(canvas);
      Chart.defaults.font.family = p.font;
      Chart.defaults.color = p.muted;
      const bar = ['bar', 'stacked', 'hbar'].includes(t);
      const type = { line: 'line', area: 'line', bar: 'bar', stacked: 'bar', hbar: 'bar', pie: 'pie', donut: 'doughnut', scatter: 'scatter' }[t] || 'line';
      let datasets;
      if (isPie(t)) {
        datasets = [{ label: c.series[0].name, data: c.series[0].data, backgroundColor: c.x.map((_, i) => p.series[i % 8]), borderColor: p.surface, borderWidth: 2 }];
      } else if (t === 'scatter') {
        datasets = c.series.map((s, i) => ({ label: s.name, data: s.data.map(([x, y]) => ({ x, y })), backgroundColor: p.series[i % 8], pointRadius: 4 }));
      } else {
        datasets = c.series.map((s, i) => {
          const col = p.series[i % 8];
          const st = s.type ? (s.type === 'bar' ? 'bar' : 'line') : undefined;
          const isBar = st ? st === 'bar' : bar;
          return {
            label: s.name, data: s.data, type: st, borderColor: col,
            backgroundColor: t === 'area' ? alpha(col, 0.15) : col, fill: t === 'area' && !isBar,
            tension: 0.3, cubicInterpolationMode: 'monotone', pointRadius: 0, pointHoverRadius: 4, borderWidth: isBar ? 0 : 2, borderRadius: 4, maxBarThickness: 36,
          };
        });
      }
      const valFmt = axisFmt(c);
      const chart = new Chart(canvas, {
        type,
        data: { labels: t === 'scatter' ? undefined : c.x, datasets },
        options: {
          responsive: true, maintainAspectRatio: false, indexAxis: t === 'hbar' ? 'y' : 'x',
          interaction: { mode: isPie(t) || t === 'scatter' ? 'nearest' : 'index', intersect: false },
          plugins: {
            legend: { display: c.series.length > 1 || isPie(t), position: isPie(t) ? 'bottom' : 'top', align: isPie(t) ? 'center' : 'start', labels: { boxWidth: 8, boxHeight: 8, usePointStyle: true } },
            tooltip: {
              callbacks: {
                label: (ctx) => {
                  const r = ctx.raw;
                  const v = typeof r === 'object' && r ? `(${fmt(r.x)}, ${fmt(r.y)})` : fmt(r, c);
                  return `${isPie(t) ? ctx.label : ctx.dataset.label}: ${v}`;
                },
              },
            },
          },
          scales: isPie(t) ? {} : {
            x: { min: t === 'hbar' ? c.min : undefined, max: t === 'hbar' ? c.max : undefined, stacked: t === 'stacked', grid: { color: p.grid, display: t === 'hbar' || t === 'scatter' }, ticks: t === 'hbar' ? { callback: valFmt } : { maxRotation: 0, autoSkip: true }, title: { display: !!c.xLabel, text: c.xLabel } },
            y: { min: t === 'hbar' ? undefined : c.min, max: t === 'hbar' ? undefined : c.max, stacked: t === 'stacked', grid: { color: p.grid, display: t !== 'hbar' }, ticks: t === 'hbar' ? {} : { callback: valFmt }, title: { display: !!c.yLabel, text: c.yLabel } },
          },
        },
      });
      return { resize: () => chart.resize(), destroy: () => chart.destroy() };
    },

    apexcharts(el, c, p) {
      const t = c.type || 'line';
      const type = { line: 'line', area: 'area', bar: 'bar', stacked: 'bar', hbar: 'bar', pie: 'pie', donut: 'donut', scatter: 'scatter' }[t] || 'line';
      const bar = type === 'bar';
      const o = {
        chart: { type, height: el.clientHeight || c.height || 300, fontFamily: p.font, foreColor: p.muted, toolbar: { show: false }, stacked: t === 'stacked', background: 'transparent', zoom: { enabled: false } },
        colors: p.series, theme: { mode: p.dark ? 'dark' : 'light' },
        grid: { borderColor: p.grid, strokeDashArray: 3 }, dataLabels: { enabled: false },
        stroke: { curve: 'smooth', width: bar ? 0 : 2 },
        legend: { show: c.series.length > 1 || isPie(t), position: isPie(t) ? 'bottom' : 'top', horizontalAlign: isPie(t) ? 'center' : 'left' },
        tooltip: { theme: p.dark ? 'dark' : 'light', y: { formatter: (v) => fmt(v, c) } },
        plotOptions: { bar: { horizontal: t === 'hbar', borderRadius: 4, columnWidth: '55%', barHeight: '60%' } },
        fill: type === 'area' ? { type: 'gradient', gradient: { opacityFrom: 0.35, opacityTo: 0.02 } } : {},
      };
      if (isPie(t)) {
        o.series = c.series[0].data;
        o.labels = c.x;
        o.stroke = { colors: [p.surface], width: 2 };
        o.dataLabels = { enabled: true, dropShadow: { enabled: false } };
        o.plotOptions.pie = { donut: { size: '62%', labels: { show: t === 'donut', total: { show: true, label: '합계', formatter: (w) => fmt(w.globals.seriesTotals.reduce((a, b) => a + b, 0), c) } } } };
      } else if (t === 'scatter') {
        o.series = c.series.map((s) => ({ name: s.name, data: s.data }));
        o.xaxis = { type: 'numeric', title: { text: c.xLabel }, tickAmount: 8 };
        o.yaxis = { title: { text: c.yLabel } };
        o.tooltip.y = { formatter: (v) => fmt(v) };
      } else {
        // 시리즈별 type이 섞이면 ApexCharts 콤보(chart.type=line + series.type) 방식으로 그린다
        const mixed = t !== 'hbar' && c.series.some((s) => s.type && s.type !== seriesType(c, {}));
        if (mixed) {
          const apexType = (st) => (st === 'bar' ? 'column' : st === 'area' ? 'area' : 'line');
          o.chart.type = 'line';
          o.series = c.series.map((s) => ({ name: s.name, data: s.data, type: apexType(s.type || seriesType(c, {})) }));
          o.stroke = { curve: 'smooth', width: o.series.map((s) => (s.type === 'column' ? 0 : 2.5)) };
        } else {
          o.series = c.series.map((s) => ({ name: s.name, data: s.data }));
        }
        o.xaxis = { categories: c.x, labels: t === 'hbar' ? { formatter: axisFmt(c) } : { rotate: 0, hideOverlappingLabels: true }, ...(t === 'hbar' ? { min: c.min, max: c.max } : {}) };
        o.yaxis = t === 'hbar' ? {} : { min: c.min, max: c.max, labels: { formatter: axisFmt(c) } };
      }
      const ch = new ApexCharts(el, o);
      ch.render();
      return { resize: () => {}, destroy: () => ch.destroy() };
    },

    plotly(el, c, p) {
      const t = c.type || 'line';
      const hbar = t === 'hbar';
      const hover = (s) => s.data.map((v) => fmt(v, c));
      let traces;
      if (isPie(t)) {
        traces = [{ type: 'pie', labels: c.x, values: c.series[0].data, hole: t === 'donut' ? 0.55 : 0, sort: false, marker: { colors: p.series, line: { color: p.surface, width: 2 } }, texttemplate: '%{percent:.1%}', textposition: 'inside', insidetextorientation: 'horizontal', customdata: hover(c.series[0]), hovertemplate: '%{label}: %{customdata}<extra></extra>' }];
      } else if (t === 'scatter') {
        traces = c.series.map((s) => ({ type: 'scatter', mode: 'markers', name: s.name, x: s.data.map((d) => d[0]), y: s.data.map((d) => d[1]), marker: { size: 8 } }));
      } else {
        traces = c.series.map((s) => {
          const st = seriesType(c, s);
          const base = { name: s.name, customdata: hover(s), hovertemplate: `${esc(s.name)}: %{customdata}<extra></extra>` };
          if (st === 'bar') return { ...base, type: 'bar', orientation: hbar ? 'h' : 'v', x: hbar ? s.data : c.x, y: hbar ? c.x : s.data };
          const i = c.series.indexOf(s);
          return { ...base, type: 'scatter', mode: 'lines', x: c.x, y: s.data, line: { shape: 'spline', smoothing: 0.6, width: 2, color: p.series[i % 8] }, fill: t === 'area' ? 'tozeroy' : undefined, fillcolor: t === 'area' ? alpha(p.series[i % 8], 0.12) : undefined };
        });
      }
      const ax = { gridcolor: p.grid, zeroline: false, linecolor: p.grid, automargin: true };
      const layout = {
        barmode: t === 'stacked' ? 'stack' : 'group', paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)',
        font: { family: p.font, color: p.muted, size: 12 }, colorway: p.series,
        margin: { l: 8, r: 16, t: c.series.length > 1 ? 32 : 12, b: 8 },
        // '09-01' 같은 범주를 날짜로 오인하지 않도록 범주 축을 명시한다
        xaxis: { ...ax, ...(hbar && valueRange(c) ? { range: valueRange(c) } : {}), title: { text: c.xLabel || '' }, showgrid: hbar || t === 'scatter', type: t === 'scatter' || hbar ? undefined : 'category' },
        yaxis: { ...ax, title: { text: c.yLabel || '' }, autorange: hbar ? 'reversed' : !valueRange(c), range: hbar ? undefined : valueRange(c) || undefined, type: hbar ? 'category' : undefined },
        showlegend: c.series.length > 1 || isPie(t), legend: { orientation: 'h', x: 0, y: isPie(t) ? -0.1 : 1.12 },
        hoverlabel: { bgcolor: p.surface, bordercolor: p.grid, font: { color: p.fg, family: p.font } },
      };
      Plotly.newPlot(el, traces, layout, { displayModeBar: false, responsive: true });
      return { resize: () => Plotly.Plots.resize(el), destroy: () => Plotly.purge(el) };
    },

    plot(el, c, p) {
      const t = c.type || 'line';
      const names = c.series.map((s) => s.name);
      const draw = () => {
        const W = Math.max(280, el.clientWidth || 640);
        const H = el.clientHeight || c.height || 300;
        if (isPie(t)) return pieSVG(c, p, W, H);
        const rows = t === 'scatter'
          ? c.series.flatMap((s) => s.data.map(([x, y]) => ({ x, y, s: s.name })))
          : c.series.flatMap((s) => s.data.map((y, i) => ({ x: c.x[i], y, s: s.name })));
        const title = (d) => `${d.s}\n${d.x}: ${fmt(d.y, c)}`;
        let marks;
        let xOpt = { label: c.xLabel || null };
        let yOpt = { grid: true, label: c.yLabel || null, tickFormat: axisFmt(c), ...(valueRange(c) ? { domain: valueRange(c), clamp: true } : {}) };
        const extra = {};
        if (t === 'scatter') {
          marks = [Plot.dot(rows, { x: 'x', y: 'y', fill: 's', r: 4, tip: true })];
        } else if (t === 'hbar') {
          marks = [Plot.barX(rows, { y: 'x', x: 'y', fill: 's', title, tip: true }), Plot.ruleX([0])];
          xOpt = { grid: true, label: null, tickFormat: axisFmt(c), ...(valueRange(c) ? { domain: valueRange(c), clamp: true } : {}) };
          yOpt = { label: null, domain: c.x };
          extra.marginLeft = 96;
        } else if (t === 'bar' && c.series.length > 1) {
          marks = [Plot.barY(rows, { fx: 'x', x: 's', y: 'y', fill: 's', title, tip: true }), Plot.ruleY([0])];
          xOpt = { axis: null, domain: names };
          extra.fx = { domain: c.x, label: null };
        } else if (t === 'bar' || t === 'stacked') {
          marks = [Plot.barY(rows, { x: 'x', y: 'y', fill: 's', title, tip: true }), Plot.ruleY([0])];
          xOpt = { label: null, domain: c.x };
        } else {
          xOpt = { label: null, type: 'point', domain: c.x };
          marks = [
            ...(t === 'area' ? [Plot.areaY(rows, { x: 'x', y1: 0, y2: 'y', fill: 's', fillOpacity: 0.12, curve: 'monotone-x' })] : []),  // y1/y2로 누적(stack) 방지
            Plot.lineY(rows, { x: 'x', y: 'y', stroke: 's', strokeWidth: 2, curve: 'monotone-x' }),
            Plot.ruleY([0]),
            Plot.tip(rows, Plot.pointerX({ x: 'x', y: 'y', title })),
          ];
        }
        return Plot.plot({
          width: W, height: H, marginLeft: 56, ...extra,
          style: { fontFamily: p.font, color: p.muted, background: 'transparent', fontSize: '12px' },
          color: { domain: names, range: p.series, legend: names.length > 1 },
          x: xOpt, y: yOpt, marks,
        });
      };
      el.replaceChildren(draw());
      let lastW = el.clientWidth;
      return {
        resize: () => { if (el.clientWidth !== lastW) { lastW = el.clientWidth; el.replaceChildren(draw()); } },
        destroy: () => el.replaceChildren(),
      };
    },
  };

  // Observable Plot에는 원형 차트가 없어 d3로 직접 그린다
  function pieSVG(c, p, W, H) {
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.setAttribute('width', W);
    svg.setAttribute('height', H);
    const r = Math.min(W, H - 40) / 2 - 8;
    const g = document.createElementNS(NS, 'g');
    g.setAttribute('transform', `translate(${W / 2},${(H - 40) / 2 + 4})`);
    const data = c.series[0].data;
    const total = data.reduce((a, b) => a + b, 0) || 1;
    const arcs = d3.pie().sort(null)(data);
    const arc = d3.arc().innerRadius(c.type === 'donut' ? r * 0.62 : 0).outerRadius(r).padAngle(0.01);
    arcs.forEach((a, i) => {
      const path = document.createElementNS(NS, 'path');
      path.setAttribute('d', arc(a));
      path.setAttribute('fill', p.series[i % 8]);
      const tt = document.createElementNS(NS, 'title');
      tt.textContent = `${c.x[i]}: ${fmt(data[i], c)} (${nf((data[i] / total) * 100, 1)}%)`;
      path.appendChild(tt);
      g.appendChild(path);
    });
    svg.appendChild(g);
    const legend = document.createElementNS(NS, 'text');
    legend.setAttribute('x', W / 2);
    legend.setAttribute('y', H - 8);
    legend.setAttribute('text-anchor', 'middle');
    legend.setAttribute('fill', p.muted);
    legend.setAttribute('font-size', '12');
    c.x.forEach((n, i) => {
      const s = document.createElementNS(NS, 'tspan');
      s.setAttribute('fill', p.series[i % 8]);
      s.textContent = `● `;
      const l = document.createElementNS(NS, 'tspan');
      l.textContent = `${n}  `;
      legend.append(s, l);
    });
    svg.appendChild(legend);
    return svg;
  }

  const LIB_GLOBAL = { echarts: 'echarts', chartjs: 'Chart', apexcharts: 'ApexCharts', plotly: 'Plotly', plot: 'Plot' };
  function pickAdapter() {
    const want = CFG.chartLib in ADAPTERS ? CFG.chartLib : 'echarts';
    if (window[LIB_GLOBAL[want]]) return want;
    return Object.keys(ADAPTERS).find((k) => window[LIB_GLOBAL[k]]) || null;
  }

  // 라이브러리를 못 불러온 환경(오프라인 등)에서도 데이터는 보이도록 값을 표로 대신 보여 준다
  function fallbackTable(el, c) {
    const head = isPie(c.type) || c.type === 'scatter' ? '' : `<tr><th></th>${c.series.map((s) => `<th>${esc(s.name)}</th>`).join('')}</tr>`;
    const rows = c.type === 'scatter'
      ? c.series.flatMap((s) => s.data.map((d) => `<tr><td>${esc(s.name)}</td><td>${fmt(d[0])}</td><td>${fmt(d[1])}</td></tr>`))
      : (c.x || []).map((x, i) => `<tr><th>${esc(x)}</th>${c.series.map((s) => `<td>${fmt(s.data[i], c)}</td>`).join('')}</tr>`);
    el.innerHTML = `<p class="hc-fallback-note">차트 라이브러리를 불러오지 못해 값을 표로 표시합니다.</p><table class="hc-fallback">${head}${rows.join('')}</table>`;
    el.style.height = 'auto';
  }

  const charts = [];
  const pending = [];
  function normalizeChart(c) {
    const out = { ...c };
    out.series = arr(c.series).map((s, i) => (Array.isArray(s) ? { name: `시리즈 ${i + 1}`, data: s } : { name: s.name || `시리즈 ${i + 1}`, ...s }));
    out.x = arr(c.x || c.labels);
    return out;
  }
  function mountChart(el, c) {
    if (el.offsetWidth === 0) { pending.push([el, c]); return; }
    const lib = pickAdapter();
    if (!lib) { fallbackTable(el, c); return; }
    try {
      const inst = ADAPTERS[lib](el, c, palette());
      charts.push({ el, c, inst });
    } catch (e) {
      console.error('차트 렌더링 실패', c.id, e);
      fallbackTable(el, c);
    }
  }
  function flushPending() {
    const list = pending.splice(0);
    list.forEach(([el, c]) => mountChart(el, c));
    charts.forEach((ch) => ch.inst.resize());
  }
  function rerenderCharts() {
    const list = charts.splice(0);
    list.forEach(({ el, c, inst }) => { inst.destroy(); el.replaceChildren(); mountChart(el, c); });
  }

  // ── 영역별 렌더링 ──
  const CHARTS = arr(SPEC.charts).map((c, i) => ({ ...normalizeChart(c), id: c.id || `chart-${i + 1}` }));
  const TABLES = arr(SPEC.tables).map((t, i) => ({ ...t, id: t.id || `table-${i + 1}` }));
  const SECTIONS = arr(SPEC.sections).map((s, i) => ({ ...s, id: s.id || slug(s.title, i) }));
  const embedded = { charts: new Set(), tables: new Set() };
  SECTIONS.forEach((s) => { arr(s.charts).forEach((id) => embedded.charts.add(id)); arr(s.tables).forEach((id) => embedded.tables.add(id)); });

  function sparkSVG(values) {
    const v = arr(values).filter((n) => typeof n === 'number');
    if (v.length < 2) return '';
    const min = Math.min(...v);
    const max = Math.max(...v);
    const pts = v.map((n, i) => `${(i / (v.length - 1)) * 100},${28 - ((n - min) / (max - min || 1)) * 24 - 2}`).join(' ');
    return `<svg viewBox="0 0 100 28" preserveAspectRatio="none" width="100%" height="28" aria-hidden="true"><polyline points="${pts}" fill="none" stroke="currentColor" stroke-width="2" vector-effect="non-scaling-stroke" stroke-linejoin="round" stroke-linecap="round"/></svg>`;
  }

  function kpiEl(k) {
    const t = tpl('tpl-kpi');
    const el = clone('tpl-kpi');
    if (!el) return null;
    setSlot(el, 'label', k.label);
    setSlot(el, 'value', fmt(k.value, { ...k, _kpi: true }));
    setSlot(el, 'hint', k.hint);
    if (typeof k.delta === 'number') {
      const good = (k.good || 'up') === 'up' ? k.delta > 0 : k.delta < 0;
      const tone = k.delta === 0 ? 'flat' : good ? 'good' : 'bad';
      const arrow = k.delta > 0 ? '▲' : k.delta < 0 ? '▼' : '—';
      const d = setSlot(el, 'delta', `${arrow} ${nf(Math.abs(k.delta), k.deltaDecimals ?? 1)}${k.deltaSuffix ?? '%'}`);
      if (d) { addCls(d, t.dataset[tone]); d.dataset.tone = tone; }
      setSlot(el, 'delta-label', k.deltaLabel);
    } else {
      setSlot(el, 'delta', null);
      setSlot(el, 'delta-label', null);
    }
    const sp = slot(el, 'spark');
    if (sp) { if (k.spark) sp.innerHTML = sparkSVG(k.spark); else sp.remove(); }
    return el;
  }

  function chartEl(c, tplId = 'tpl-chart') {
    const el = clone(tplId) || clone('tpl-chart');
    if (!el) return null;
    el.id = `chart-${c.id}`;
    setSlot(el, 'title', c.title);
    setSlot(el, 'subtitle', c.subtitle);
    setSlot(el, 'note', c.note);
    const box = slot(el, 'chart');
    box.style.height = `${c.height || (isPie(c.type) ? 280 : 300)}px`;
    box.setAttribute('role', 'img');
    box.setAttribute('aria-label', c.title || '차트');
    return { el, box };
  }

  function tableEl(tb, opts = {}) {
    const t = tpl('tpl-table');
    const el = clone('tpl-table');
    if (!el) return null;
    el.id = `table-${tb.id}`;
    setSlot(el, 'title', tb.title);
    setSlot(el, 'subtitle', tb.subtitle);
    const cols = arr(tb.columns).length ? tb.columns : Object.keys(arr(tb.rows)[0] || {}).map((key) => ({ key, label: key }));
    let rows = arr(tb.rows).slice();
    if (opts.limit) rows = rows.slice(0, opts.limit);
    const table = slot(el, 'table');
    const numCls = t.dataset.num || '';
    const pageSize = opts.limit || tb.pageSize || 15;
    let shown = pageSize;
    let sortKey = null;
    let sortDir = 1;
    let q = '';

    const thead = document.createElement('thead');
    const tr = document.createElement('tr');
    cols.forEach((col) => {
      const th = document.createElement('th');
      th.scope = 'col';
      if (col.type === 'number') addCls(th, numCls);
      if (opts.limit) th.textContent = col.label || col.key;
      else {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'hc-sort';
        b.textContent = col.label || col.key;
        b.addEventListener('click', () => {
          sortDir = sortKey === col.key ? -sortDir : 1;
          sortKey = col.key;
          $$('th', thead).forEach((x) => x.removeAttribute('aria-sort'));
          th.setAttribute('aria-sort', sortDir === 1 ? 'ascending' : 'descending');
          draw();
        });
        th.appendChild(b);
      }
      tr.appendChild(th);
    });
    thead.appendChild(tr);
    const tbody = document.createElement('tbody');
    table.replaceChildren(thead, tbody);

    const cell = (col, v) => {
      const td = document.createElement('td');
      if (col.type === 'number') { addCls(td, numCls); td.textContent = fmt(v, col); td.style.fontVariantNumeric = 'tabular-nums'; }
      else if (col.type === 'badge') {
        const tone = (col.tones && col.tones[v]) || 'neutral';
        const span = document.createElement('span');
        addCls(span, t.dataset[`badge${tone[0].toUpperCase()}${tone.slice(1)}`] || t.dataset.badgeNeutral);
        span.textContent = v == null ? '–' : v;
        td.appendChild(span);
      } else td.textContent = v == null || v === '' ? '–' : v;
      return td;
    };

    const more = slot(el, 'more');
    const count = slot(el, 'count');
    function draw() {
      let list = rows;
      if (q) list = list.filter((r) => cols.some((c) => String(r[c.key] ?? '').toLowerCase().includes(q)));
      if (sortKey) {
        list = list.slice().sort((a, b) => {
          const x = a[sortKey];
          const y = b[sortKey];
          if (typeof x === 'number' && typeof y === 'number') return (x - y) * sortDir;
          return String(x ?? '').localeCompare(String(y ?? ''), 'ko', { numeric: true }) * sortDir;
        });
      }
      tbody.replaceChildren(...list.slice(0, shown).map((r) => {
        const row = document.createElement('tr');
        cols.forEach((c) => row.appendChild(cell(c, r[c.key])));
        return row;
      }));
      if (count) count.textContent = q ? `${list.length} / ${rows.length}행` : `총 ${rows.length.toLocaleString('ko-KR')}행`;
      if (more) {
        const left = list.length - shown;
        more.hidden = left <= 0;
        more.textContent = `더 보기 (${left.toLocaleString('ko-KR')}행 남음)`;
      }
    }
    if (more) more.addEventListener('click', () => { shown += pageSize * 2; draw(); });
    const search = slot(el, 'search');
    const wantSearch = !opts.limit && (tb.search ?? rows.length > 10);
    if (search) {
      if (!wantSearch) search.remove();
      else {
        const input = search.matches('input') ? search : $('input', search);
        input.addEventListener('input', () => { q = input.value.trim().toLowerCase(); shown = pageSize; draw(); });
      }
    }
    if (opts.limit && count) count.textContent = arr(tb.rows).length > opts.limit ? `상위 ${opts.limit}행 / 총 ${arr(tb.rows).length.toLocaleString('ko-KR')}행` : '';
    draw();
    return el;
  }

  function calloutEl(c) {
    const t = tpl('tpl-callout');
    const el = clone('tpl-callout');
    if (!el) return null;
    addCls(el, t.dataset[c.tone || 'info']);
    setSlot(el, 'title', c.title);
    setSlot(el, 'text', richText(c.text), true);
    return el;
  }

  function sectionBody(s, body, figure) {
    String(s.text || '').split(/\n{2,}/).filter((x) => x.trim()).forEach((para) => {
      const p = document.createElement('p');
      p.innerHTML = richText(para).replace(/\n/g, '<br>');
      body.appendChild(p);
    });
    if (arr(s.bullets).length) {
      const ul = document.createElement('ul');
      s.bullets.forEach((b) => { const li = document.createElement('li'); li.innerHTML = richText(b); ul.appendChild(li); });
      body.appendChild(ul);
    }
    if (s.callout) { const co = calloutEl(s.callout); if (co) body.appendChild(co); }
    arr(s.charts).forEach((id) => {
      const c = CHARTS.find((x) => x.id === id);
      if (!c) return;
      const r = chartEl(c.height || !figure.height ? c : { ...c, height: figure.height }, figure.chart);
      if (r) { body.appendChild(r.el); figure.queue.push([r.box, c]); }
    });
    arr(s.tables).forEach((id) => {
      const tb = TABLES.find((x) => x.id === id);
      const el = tb && tableEl(tb, figure.tableOpts);
      if (el) body.appendChild(el);
    });
  }

  function renderMeta() {
    const m = SPEC.meta || {};
    if (m.title) document.title = m.title;
    $$('[data-meta]').forEach((el) => {
      const key = el.dataset.meta;
      if (key === 'summary') {
        const s = SPEC.summary;
        if (!s || (Array.isArray(s) && !s.length)) { (el.closest('[data-requires="summary"]') || el).remove(); return; }
        if (Array.isArray(s)) {
          const ul = document.createElement('ul');
          addCls(ul, el.dataset.listClass);
          s.forEach((x) => { const li = document.createElement('li'); li.innerHTML = richText(x); ul.appendChild(li); });
          el.replaceChildren(ul);
        } else el.innerHTML = String(s).split(/\n{2,}/).map((p) => `<p>${richText(p)}</p>`).join('');
        return;
      }
      const v = m[key];
      if (v == null || v === '') { if (el.hasAttribute('data-optional')) el.remove(); return; }
      el.textContent = v;
    });
  }

  function renderNav(items) {
    const region = $('[data-region="nav"]');
    if (!region || !tpl('tpl-nav')) return;
    const t = tpl('tpl-nav');
    const links = [];
    items.forEach((it) => {
      const el = clone('tpl-nav');
      const a = slot(el, 'link') || el.querySelector('a') || el;
      a.href = `#${it.id}`;
      const label = slot(el, 'label');
      (label || a).textContent = it.label;
      region.appendChild(el);
      links.push([a, it.id]);
    });
    const active = t.dataset.active;
    if (!active || !('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver((ents) => {
      ents.forEach((e) => {
        if (!e.isIntersecting) return;
        links.forEach(([a, id]) => {
          const on = id === e.target.id;
          active.split(/\s+/).filter(Boolean).forEach((c) => a.classList.toggle(c, on));
          if (on) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
        });
      });
    }, { rootMargin: '-20% 0px -70% 0px' });
    items.forEach((it) => { const target = document.getElementById(it.id); if (target) io.observe(target); });
  }

  // 내비게이션이 가리킬 요소: 키트가 [data-anchor]로 감싼 영역이 있으면 그것, 없으면 영역 자체
  function anchorFor(name, region) {
    const el = $(`[data-anchor="${name}"]`) || region;
    if (!el.id) el.id = `hc-${name}`;
    return el.id;
  }

  function renderPage() {
    const queue = [];
    const navItems = [];
    const kpiRegion = $('[data-region="kpis"]');
    const kpis = arr(SPEC.kpis);
    if (kpiRegion && kpis.length) {
      kpiRegion.dataset.count = String(kpis.length);
      kpis.forEach((k) => { const el = kpiEl(k); if (el) kpiRegion.appendChild(el); });
      navItems.push({ id: anchorFor('kpis', kpiRegion), label: '핵심 지표' });
    }

    const chartRegion = $('[data-region="charts"]');
    const sectionRegion = $('[data-region="sections"]');
    const tableRegion = $('[data-region="tables"]');
    const freeCharts = CHARTS.filter((c) => !embedded.charts.has(c.id));
    const freeTables = TABLES.filter((t) => !embedded.tables.has(t.id));

    if (chartRegion && freeCharts.length) {
      freeCharts.forEach((c) => {
        const r = chartEl(c);
        if (!r) return;
        addCls(r.el, chartRegion.dataset[`span${Math.min(3, Math.max(1, c.span || 1))}`]);
        chartRegion.appendChild(r.el);
        queue.push([r.box, c]);
      });
      navItems.push({ id: anchorFor('charts', chartRegion), label: '차트' });
    }

    const figure = { chart: tpl('tpl-figure') ? 'tpl-figure' : 'tpl-chart', queue, tableOpts: {} };
    if (sectionRegion) {
      SECTIONS.forEach((s) => {
        const el = clone('tpl-section');
        if (!el) return;
        el.id = s.id;
        setSlot(el, 'title', s.title);
        sectionBody(s, slot(el, 'body') || el, figure);
        sectionRegion.appendChild(el);
        if (s.title) navItems.push({ id: s.id, label: s.title });
      });
    }
    if (freeCharts.length && !chartRegion && sectionRegion) {
      freeCharts.forEach((c) => { const r = chartEl(c, figure.chart); if (r) { sectionRegion.appendChild(r.el); queue.push([r.box, c]); } });
    }

    const tableHost = tableRegion || sectionRegion;
    if (tableHost) {
      freeTables.forEach((tb) => {
        const el = tableEl(tb);
        if (!el) return;
        tableHost.appendChild(el);
        if (tb.title) navItems.push({ id: el.id, label: tb.title });
      });
    }

    // 내용이 없는 영역은 감춘다
    $$('[data-requires]').forEach((el) => {
      const need = el.dataset.requires;
      const has = {
        kpis: kpis.length > 0, charts: freeCharts.length > 0, tables: freeTables.length > 0,
        sections: SECTIONS.length > 0, summary: !!(SPEC.summary && arr(SPEC.summary).length),
        nav: SPEC.nav !== false && navItems.length > 1,
      }[need];
      if (has === false) el.remove();
    });
    if (SPEC.nav !== false) renderNav(navItems);
    return queue;
  }

  function renderSlides() {
    const deck = $('[data-region="slides"]');
    const queue = [];
    const add = (id) => { const el = clone(id); if (el) deck.appendChild(el); return el; };
    const titleSlide = add('tpl-slide-title');
    if (titleSlide) {
      const m = SPEC.meta || {};
      ['title', 'subtitle', 'source', 'generatedAt', 'author'].forEach((k) => setSlot(titleSlide, k, m[k]));
    }
    if (SPEC.summary && arr(SPEC.summary).length) {
      const el = add('tpl-slide-summary');
      if (el) {
        const box = slot(el, 'body');
        const ul = document.createElement('ul');
        arr(SPEC.summary).forEach((x) => { const li = document.createElement('li'); li.innerHTML = richText(x); addCls(li, 'fragment'); ul.appendChild(li); });
        box.replaceChildren(ul);
      }
    }
    const kpis = arr(SPEC.kpis);
    for (let i = 0; i < kpis.length; i += 4) {
      const el = add('tpl-slide-kpis');
      if (!el) break;
      setSlot(el, 'title', i === 0 ? '핵심 지표' : '핵심 지표 (계속)');
      const box = slot(el, 'kpis');
      kpis.slice(i, i + 4).forEach((k) => { const ke = kpiEl(k); if (ke) box.appendChild(ke); });
    }
    const figure = { chart: tpl('tpl-figure') ? 'tpl-figure' : 'tpl-chart', queue, tableOpts: { limit: 8 }, height: 380 };
    SECTIONS.forEach((s) => {
      const el = add('tpl-slide-section');
      if (!el) return;
      setSlot(el, 'title', s.title);
      sectionBody(s, slot(el, 'body'), figure);
    });
    CHARTS.filter((c) => !embedded.charts.has(c.id)).forEach((c) => {
      const el = add('tpl-slide-chart');
      if (!el) return;
      setSlot(el, 'title', c.title);
      setSlot(el, 'subtitle', c.subtitle);
      setSlot(el, 'note', c.note);
      const box = slot(el, 'chart');
      box.style.height = `${c.height || 440}px`;
      queue.push([box, c]);
    });
    TABLES.filter((t) => !embedded.tables.has(t.id)).forEach((tb) => {
      const el = add('tpl-slide-table');
      if (!el) return;
      setSlot(el, 'title', tb.title);
      const te = tableEl({ ...tb, title: null, subtitle: tb.subtitle }, { limit: 8 });
      if (te) slot(el, 'body').appendChild(te);
    });
    add('tpl-slide-end');
    return queue;
  }

  // ── 실행 ──
  renderMeta();
  const queue = CFG.mode === 'slides' ? renderSlides() : renderPage();
  $$('[data-meta="year"]').forEach((el) => { el.textContent = new Date().getFullYear(); });

  // 색이 꽉 찬 KPI 카드는 배경 밝기에 따라 글자색을 정한다
  function inkForSolidKpis() {
    if (!document.body.classList.contains('hc-kpi-solid')) return;
    $$('.hc-kpi').forEach((el) => {
      el.style.removeProperty('--hc-kpi-ink');
      const m = getComputedStyle(el).backgroundColor.match(/\d+(\.\d+)?/g);
      if (!m) return;
      const [r, g, b] = m.map(Number);
      const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
      el.style.setProperty('--hc-kpi-ink', lum > 0.62 ? '#1f2328' : '#ffffff');
    });
  }

  const start = () => {
    inkForSolidKpis();
    queue.forEach(([el, c]) => mountChart(el, c));
    if (typeof window.HC_AFTER_RENDER === 'function') window.HC_AFTER_RENDER();
  };
  if (document.readyState === 'complete') start(); else window.addEventListener('load', start);

  $$('[data-action="theme"]').forEach((b) => b.addEventListener('click', () => {
    const next = currentTheme() === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    store.set(next);
    requestAnimationFrame(() => { inkForSolidKpis(); rerenderCharts(); });
  }));
  $$('[data-action="print"]').forEach((b) => b.addEventListener('click', () => window.print()));
  let rT = 0;
  window.addEventListener('resize', () => { clearTimeout(rT); rT = setTimeout(() => charts.forEach((ch) => ch.inst.resize()), 120); });
  window.addEventListener('beforeprint', () => charts.forEach((ch) => ch.inst.resize()));

  // 키트(발표 등)가 숨겨진 영역을 보여 줄 때 호출: 지연된 차트를 그리고 크기를 맞춘다
  window.HC = { flush: flushPending, rerender: rerenderCharts, fmt, spec: SPEC };
})();
