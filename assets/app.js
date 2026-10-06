/* HTML Previewer — 동작 스크립트 (의존성 없음) */
(() => {
  'use strict';

  const DATA = window.PREVIEWER_DATA;
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  if (!DATA || !Array.isArray(DATA.items)) {
    $('#grid').innerHTML = '<p class="empty">데이터 파일(assets/templates.js)을 불러오지 못했습니다.</p>';
    return;
  }

  const ITEMS = DATA.items;
  const BY_ID = new Map(ITEMS.map((it) => [it.id, it]));
  const CAT_LABEL = Object.fromEntries(DATA.categories.map((c) => [c.id, c.label]));
  const CAT_HINT = Object.fromEntries(DATA.categories.map((c) => [c.id, c.hint]));
  const STORE_KEY = 'html-previewer:v1';
  const THEME_KEY = 'html-previewer:theme';
  const STALE_DAYS = 540; // 약 18개월 이상 푸시가 없으면 '오래됨' 표시

  const PRICE = {
    free: { label: '무료', cls: 'price-free' },
    mixed: { label: '무료+유료', cls: 'price-mixed' },
    paid: { label: '유료', cls: 'price-paid' },
    conditional: { label: '조건부 유료', cls: 'price-cond' },
  };
  const STACKS = {
    all: { label: '모든 기술', test: () => true },
    bootstrap: { label: 'Bootstrap', test: (it) => it.stack.some((s) => /bootstrap/i.test(s)) },
    tailwind: { label: 'Tailwind CSS', test: (it) => it.stack.some((s) => /tailwind/i.test(s)) },
    react: { label: 'React · Next.js', test: (it) => it.stack.some((s) => /react|next/i.test(s)) },
    other: { label: '그 외', test: (it) => !it.stack.some((s) => /bootstrap|tailwind|react|next/i.test(s)) },
  };
  const SORTS = { rank: '추천순', stars: 'GitHub 스타순', updated: '최근 업데이트순', name: '이름순' };
  const DEVICES = {
    desktop: { w: 1440, h: 900 },
    tablet: { w: 820, h: 1180 },
    mobile: { w: 390, h: 844 },
  };
  const THEMES = ['system', 'light', 'dark'];
  const THEME_LABEL = { system: '시스템 설정', light: '라이트', dark: '다크' };

  // ── 저장소 (브라우저 저장이 막힌 환경에서도 동작하도록 모두 try/catch) ──
  const storage = {
    get(key) {
      try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
    },
    set(key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* 저장 불가 환경은 무시 */ }
    },
  };

  const saved = storage.get(STORE_KEY) || {};
  const state = {
    cat: CAT_LABEL[saved.cat] ? saved.cat : 'all',
    sort: SORTS[saved.sort] ? saved.sort : 'rank',
    stack: STACKS[saved.stack] ? saved.stack : 'all',
    free: !!saved.free,
    htmlReady: !!saved.htmlReady,
    embed: !!saved.embed,
    q: '',
    selected: {},
  };
  Object.entries(saved.selected || {}).forEach(([id, v]) => {
    if (BY_ID.has(id)) state.selected[id] = { memo: String((v && v.memo) || ''), at: Number(v && v.at) || Date.now() };
  });
  const hashCat = decodeURIComponent(location.hash.slice(1));
  if (CAT_LABEL[hashCat] || hashCat === 'all') state.cat = hashCat;

  const persist = () => storage.set(STORE_KEY, {
    cat: state.cat, sort: state.sort, stack: state.stack,
    free: state.free, htmlReady: state.htmlReady, embed: state.embed, selected: state.selected,
  });

  // ── 유틸 ──
  const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ESC[c]);
  const icon = (name) => `<svg class="icon" aria-hidden="true"><use href="#i-${name}"></use></svg>`;
  const fmtStars = (n) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 100000 ? 0 : 1).replace(/\.0$/, '')}k` : String(n));
  const fmtDate = (d) => d.replace(/-/g, '.');
  const daysBetween = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000);
  const today = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const norm = (s) => String(s).toLowerCase();
  const HAYSTACK = new Map(ITEMS.map((it) => [it.id, norm([
    it.name, it.vendor, it.desc, CAT_LABEL[it.category], it.license, PRICE[it.pricing].label,
    it.htmlReady ? 'HTML 바로 사용' : '', ...it.stack, ...(it.tags || []),
  ].join(' '))]));

  const el = {
    grid: $('#grid'), tabs: $('#tabs'), tabHint: $('#tab-hint'), q: $('#q'),
    sort: $('#sort'), stack: $('#stack'), resultCount: $('#result-count'),
    resetFilters: $('#reset-filters'), empty: $('#empty'), sources: $('#sources'),
    themeBtn: $('#theme-btn'), trayBtn: $('#tray-btn'), selCount: $('#sel-count'),
    tray: $('#tray'), scrim: $('#scrim'), trayList: $('#tray-list'), trayEmpty: $('#tray-empty'),
    trayCount: $('#tray-count'), trayClose: $('#tray-close'), toast: $('#toast'),
  };

  // ── 토스트 ──
  let toastTimer = 0;
  function toast(msg) {
    el.toast.textContent = msg;
    el.toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.toast.classList.remove('show'), 2200);
  }

  // ── 필터 · 정렬 ──
  function passes(it, ignoreCat) {
    if (!ignoreCat && state.cat !== 'all' && it.category !== state.cat) return false;
    if (state.free && (it.pricing === 'paid' || it.pricing === 'conditional')) return false;
    if (state.htmlReady && !it.htmlReady) return false;
    if (state.embed && !it.embeddable) return false;
    if (!STACKS[state.stack].test(it)) return false;
    if (state.q) {
      const hay = HAYSTACK.get(it.id);
      if (!state.q.split(/\s+/).every((t) => hay.includes(t))) return false;
    }
    return true;
  }
  const filtersActive = () => state.free || state.htmlReady || state.embed || state.stack !== 'all' || !!state.q;
  const SORTERS = {
    rank: (a, b) => a.rank - b.rank,
    stars: (a, b) => ((b.stars == null ? -1 : b.stars) - (a.stars == null ? -1 : a.stars)) || a.rank - b.rank,
    updated: (a, b) => (b.pushed || '').localeCompare(a.pushed || '') || a.rank - b.rank,
    name: (a, b) => a.name.localeCompare(b.name, 'ko'),
  };

  let current = [];

  // ── 렌더링 ──
  function renderTabs() {
    const counts = { all: 0 };
    ITEMS.forEach((it) => {
      if (!passes(it, true)) return;
      counts.all += 1;
      counts[it.category] = (counts[it.category] || 0) + 1;
    });
    const tabs = [{ id: 'all', label: '전체' }, ...DATA.categories];
    el.tabs.innerHTML = tabs.map((t) => `<button class="tab" type="button" data-cat="${t.id}" aria-pressed="${state.cat === t.id}">${esc(t.label)}<span class="n">${counts[t.id] || 0}</span></button>`).join('');
    el.tabHint.textContent = state.cat === 'all'
      ? '결과물 유형을 고르면 해당 분야의 데모만 보여 줍니다.'
      : `${CAT_LABEL[state.cat]} — ${CAT_HINT[state.cat]}`;
  }

  function cardHTML(it) {
    const sel = !!state.selected[it.id];
    const price = PRICE[it.pricing];
    const stale = it.pushed && daysBetween(it.pushed, DATA.checkedAt) > STALE_DAYS;
    const chips = it.stack.map((s) => `<span class="chip">${esc(s)}</span>`).join('')
      + (it.htmlReady ? '<span class="chip chip-ok" title="빌드 없이 단일 HTML 파일에서 바로 쓸 수 있습니다">HTML 바로 사용</span>' : '');
    const meta = [
      `<span title="라이선스">${icon('doc')}${esc(it.license)}</span>`,
      it.stars != null ? `<span class="stars" title="GitHub 스타 ${it.stars.toLocaleString('ko-KR')}개">${icon('star')}${fmtStars(it.stars)}</span>` : '',
      it.pushed ? `<span class="${stale ? 'stale' : ''}" title="저장소 최근 푸시일">${icon('clock')}${fmtDate(it.pushed)}${stale ? ' · 오래됨' : ''}</span>` : '',
      it.embeddable
        ? `<span title="이 페이지 안에서 바로 미리볼 수 있습니다">${icon('frame')}페이지 안 미리보기</span>`
        : `<span title="사이트가 다른 페이지 안에서 열리는 것을 막아 두어 새 탭으로 엽니다">${icon('external')}새 탭 전용</span>`,
    ].join('');
    return `<article class="card${sel ? ' is-selected' : ''}" data-id="${esc(it.id)}">
  <button class="card-media" type="button" data-action="preview" aria-label="${esc(it.name)} 미리보기">
    <img src="${esc(it.thumb)}" alt="" loading="lazy" decoding="async" width="960" height="600">
    <span class="media-fallback" aria-hidden="true">${esc(it.name)}</span>
    <span class="media-badges">${it.pick ? '<span class="badge badge-pick">추천</span>' : ''}<span class="badge">${esc(CAT_LABEL[it.category])}</span></span>
    <span class="media-check" aria-hidden="true">${icon('check')}</span>
    <span class="media-hover" aria-hidden="true"><span>${icon('eye')}미리보기</span></span>
  </button>
  <div class="card-body">
    <div class="card-head">
      <div><h3 class="card-title">${esc(it.name)}</h3><div class="card-vendor">${esc(it.vendor)}</div></div>
      <span class="price ${price.cls}">${price.label}</span>
    </div>
    <p class="card-desc">${esc(it.desc)}</p>
    <div class="chips">${chips}</div>
    ${it.licenseNote ? `<p class="note">${icon('alert')}<span>${esc(it.licenseNote)}</span></p>` : ''}
    <div class="card-meta">${meta}</div>
  </div>
  <div class="card-actions">
    <button class="btn btn-sm btn-primary" type="button" data-action="preview">${icon('eye')}미리보기</button>
    <a class="btn btn-sm btn-icon" href="${esc(it.preview)}" target="_blank" rel="noopener noreferrer" title="새 탭에서 데모 열기" aria-label="${esc(it.name)} 데모를 새 탭에서 열기">${icon('external')}</a>
    ${it.source ? `<a class="btn btn-sm btn-icon btn-ghost" href="${esc(it.source)}" target="_blank" rel="noopener noreferrer" title="${esc(it.sourceLabel)}" aria-label="${esc(it.name)} ${esc(it.sourceLabel)}">${icon(it.sourceLabel === 'GitHub' ? 'code' : 'link')}</a>` : ''}
    <button class="btn btn-sm btn-select" type="button" data-action="select" aria-pressed="${sel}">${icon('star')}<span>${sel ? '선택됨' : '선택'}</span></button>
  </div>
</article>`;
  }

  function syncControls() {
    $$('.toggle[data-toggle]').forEach((b) => b.setAttribute('aria-pressed', String(!!state[b.dataset.toggle])));
    el.sort.value = state.sort;
    el.stack.value = state.stack;
  }

  function render() {
    renderTabs();
    current = ITEMS.filter((it) => passes(it, false)).sort(SORTERS[state.sort]);
    el.grid.innerHTML = current.map(cardHTML).join('');
    el.empty.hidden = current.length > 0;
    el.resultCount.innerHTML = `<b>${current.length}</b>개 표시 중`;
    el.resetFilters.hidden = !filtersActive();
    syncControls();
  }

  function resetFilters() {
    Object.assign(state, { free: false, htmlReady: false, embed: false, stack: 'all', q: '' });
    el.q.value = '';
    persist();
    render();
  }

  // ── 선택 ──
  const selectedList = () => Object.entries(state.selected)
    .sort((a, b) => a[1].at - b[1].at)
    .map(([id]) => BY_ID.get(id));

  function renderSelCount() {
    const n = Object.keys(state.selected).length;
    el.selCount.textContent = n;
    el.selCount.classList.toggle('is-zero', n === 0);
  }

  function syncCard(id) {
    const card = el.grid.querySelector(`.card[data-id="${CSS.escape(id)}"]`);
    if (!card) return;
    const sel = !!state.selected[id];
    card.classList.toggle('is-selected', sel);
    const btn = card.querySelector('[data-action="select"]');
    btn.setAttribute('aria-pressed', String(sel));
    btn.querySelector('span').textContent = sel ? '선택됨' : '선택';
  }

  function toggleSelect(id) {
    const it = BY_ID.get(id);
    if (state.selected[id]) delete state.selected[id];
    else state.selected[id] = { memo: '', at: Date.now() };
    const on = !!state.selected[id];
    persist();
    syncCard(id);
    renderSelCount();
    document.dispatchEvent(new CustomEvent('previewer:selection'));
    if (trayIsOpen) renderTray();
    if (!pv.root.hidden) syncPreviewSelect();
    toast(on ? `‘${it.name}’을(를) 담았습니다` : `‘${it.name}’ 선택을 해제했습니다`);
  }

  // ── 미리보기 모달 ──
  const pv = {
    root: $('#pv'), panel: $('#pv .pv-panel'), title: $('#pv-title'), cat: $('#pv-cat'), url: $('#pv-url'),
    counter: $('#pv-counter'), stage: $('#pv-stage'), device: $('#pv-device'), frame: $('#pv-frame'),
    loading: $('#pv-loading'), slow: $('#pv-slow'), slowLink: $('#pv-slow-link'),
    blocked: $('#pv-blocked'), blockedImg: $('#pv-blocked-img'), blockedLink: $('#pv-blocked-link'),
    newtab: $('#pv-newtab'), more: $('#pv-more'), scale: $('#pv-scale'), close: $('#pv-close'),
    prev: $('[data-pv="prev"]'), next: $('[data-pv="next"]'), select: $('[data-pv="select"]'),
  };
  let pvList = [];
  let pvIdx = 0;
  let pvDevice = 'desktop';
  let pvDeviceChosen = false; // 사용자가 직접 화면 크기를 고르면 그 선택을 유지
  let pvLoading = false;
  let slowTimer = 0;
  let lastFocus = null;

  function syncPreviewSelect() {
    const sel = !!state.selected[pvList[pvIdx]];
    pv.select.setAttribute('aria-pressed', String(sel));
    pv.select.querySelector('span').textContent = sel ? '선택됨' : '선택';
  }

  function fitPreview() {
    if (pv.root.hidden || pv.device.hidden) return;
    const d = DEVICES[pvDevice];
    const desk = pvDevice === 'desktop';
    const pad = desk ? 0 : 32;
    const aw = Math.max(200, pv.stage.clientWidth - pad * 2);
    const ah = Math.max(200, pv.stage.clientHeight - pad * 2);
    const w = desk ? Math.max(d.w, aw) : d.w;
    const scale = desk ? Math.min(1, aw / w) : Math.min(1, aw / d.w, ah / d.h);
    const h = desk ? Math.ceil(ah / scale) : d.h;
    pv.frame.style.width = `${w}px`;
    pv.frame.style.height = `${h}px`;
    pv.frame.style.transform = `scale(${scale})`;
    pv.device.style.width = `${Math.floor(w * scale)}px`;
    pv.device.style.height = `${Math.floor(h * scale)}px`;
    pv.stage.dataset.device = pvDevice;
    pv.scale.textContent = `${w}px 폭 · ${Math.round(scale * 100)}% 축소`;
  }

  function showPreview() {
    const it = BY_ID.get(pvList[pvIdx]);
    pv.title.textContent = it.name;
    pv.cat.textContent = CAT_LABEL[it.category];
    pv.url.textContent = it.preview.replace(/^https?:\/\//, '');
    pv.url.href = it.preview;
    pv.newtab.href = it.preview;
    pv.slowLink.href = it.preview;
    pv.blockedLink.href = it.preview;
    pv.counter.textContent = `${pvIdx + 1} / ${pvList.length}`;
    pv.prev.disabled = pv.next.disabled = pvList.length < 2;
    const links = [it.source ? { label: it.sourceLabel, url: it.source } : null, ...(it.more || [])].filter(Boolean);
    pv.more.innerHTML = links.map((m) => `<a href="${esc(m.url)}" target="_blank" rel="noopener noreferrer">${esc(m.label)}${icon('external')}</a>`).join('');
    syncPreviewSelect();
    clearTimeout(slowTimer);
    pv.slow.hidden = true;
    // 캡처만 보여 주는 사이트에서는 화면 크기 전환·새로고침이 의미 없으므로 끈다
    $$('[data-device], [data-pv="reload"]', pv.root).forEach((b) => { b.disabled = !it.embeddable; });
    if (it.embeddable) {
      pv.blocked.hidden = true;
      pv.device.hidden = false;
      pv.loading.hidden = false;
      pvLoading = true;
      pv.frame.src = it.preview;
      // 8초가 지나도 load 이벤트가 없으면 새 탭 안내를 띄우고, 20초 뒤에는 표시를 걷어 화면을 가리지 않게 한다
      slowTimer = setTimeout(() => {
        if (!pvLoading) return;
        pv.slow.hidden = false;
        slowTimer = setTimeout(() => { pv.loading.hidden = true; }, 12000);
      }, 8000);
      fitPreview();
    } else {
      pvLoading = false;
      pv.frame.src = 'about:blank';
      pv.device.hidden = true;
      pv.loading.hidden = true;
      pv.blocked.hidden = false;
      pv.blockedImg.src = it.thumb;
      pv.blockedImg.alt = `${it.name} 데모 첫 화면 캡처`;
      pv.scale.textContent = '캡처 화면';
    }
  }

  function setDevice(device) {
    pvDevice = device;
    $$('[data-device]', pv.root).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.device === device)));
  }

  function openPreview(id) {
    pvList = current.map((it) => it.id);
    pvIdx = pvList.indexOf(id);
    if (pvIdx < 0) { pvList = [id]; pvIdx = 0; }
    // 좁은 화면에서 1440px 데스크톱을 30% 이하로 줄여 보이면 알아보기 어려우므로 모바일 크기로 시작
    if (!pvDeviceChosen) setDevice(window.innerWidth < 760 ? 'mobile' : 'desktop');
    lastFocus = document.activeElement;
    pv.root.hidden = false;
    document.body.classList.add('no-scroll');
    showPreview();
    pv.close.focus();
  }

  function closePreview() {
    pv.root.hidden = true;
    pvLoading = false;
    clearTimeout(slowTimer);
    pv.frame.src = 'about:blank';
    document.body.classList.remove('no-scroll');
    if (lastFocus && document.contains(lastFocus)) lastFocus.focus();
  }

  function stepPreview(delta) {
    if (pvList.length < 2) return;
    pvIdx = (pvIdx + delta + pvList.length) % pvList.length;
    showPreview();
  }

  pv.frame.addEventListener('load', () => {
    if (!pvLoading || pv.frame.getAttribute('src') === 'about:blank') return;
    pvLoading = false;
    clearTimeout(slowTimer);
    pv.loading.hidden = true;
  });

  pv.root.addEventListener('click', (e) => {
    const t = e.target.closest('[data-pv], [data-device]');
    if (!t) return;
    if (t.dataset.device) {
      pvDeviceChosen = true;
      setDevice(t.dataset.device);
      fitPreview();
      return;
    }
    const act = t.dataset.pv;
    if (act === 'close') closePreview();
    else if (act === 'prev') stepPreview(-1);
    else if (act === 'next') stepPreview(1);
    else if (act === 'select') toggleSelect(pvList[pvIdx]);
    else if (act === 'reload' && !pv.device.hidden) showPreview();
    else if (act === 'make') {
      const id = pvList[pvIdx];
      closePreview();
      document.dispatchEvent(new CustomEvent('previewer:make', { detail: { id } }));
    }
  });

  if ('ResizeObserver' in window) new ResizeObserver(() => fitPreview()).observe(pv.stage);
  else window.addEventListener('resize', fitPreview);

  // ── 선택 패널 ──
  let trayIsOpen = false;
  let memoTimer = 0;

  function renderTray() {
    const list = selectedList();
    el.trayCount.textContent = list.length;
    el.trayCount.classList.toggle('is-zero', list.length === 0);
    el.trayEmpty.hidden = list.length > 0;
    el.trayList.innerHTML = list.map((it) => `<li class="tray-item" data-id="${esc(it.id)}">
  <img src="${esc(it.thumb)}" alt="" width="88" height="55">
  <div><div class="tray-item-title">${esc(it.name)}</div><div class="tray-item-sub">${esc(CAT_LABEL[it.category])} · ${esc(it.stack.join(', '))} · ${esc(it.license)}</div></div>
  <button class="btn btn-sm btn-icon btn-ghost" type="button" data-remove="${esc(it.id)}" title="선택 해제" aria-label="${esc(it.name)} 선택 해제">${icon('x')}</button>
  <label class="sr-only" for="memo-${esc(it.id)}">${esc(it.name)} 메모</label>
  <textarea id="memo-${esc(it.id)}" data-memo="${esc(it.id)}" rows="2" placeholder="좋았던 점을 적어 두세요 (예: 카드 밀도, 색감, 표 스타일)">${esc(state.selected[it.id].memo)}</textarea>
</li>`).join('');
    $$('[data-needs]', el.tray).forEach((b) => { b.disabled = list.length === 0; });
  }

  function openTray() {
    trayIsOpen = true;
    lastFocus = document.activeElement;
    renderTray();
    el.tray.classList.add('open');
    el.tray.setAttribute('aria-hidden', 'false');
    el.scrim.classList.add('open');
    document.body.classList.add('no-scroll');
    setTimeout(() => el.trayClose.focus(), 60);
  }

  function closeTray() {
    trayIsOpen = false;
    el.tray.classList.remove('open');
    el.tray.setAttribute('aria-hidden', 'true');
    el.scrim.classList.remove('open');
    document.body.classList.remove('no-scroll');
    if (lastFocus && document.contains(lastFocus)) lastFocus.focus();
  }

  function toMarkdown() {
    const list = selectedList();
    const lines = [
      '# HTML 디자인 레퍼런스 선택',
      '',
      `- 선택일: ${today()}`,
      `- 출처: HTML Previewer (링크·라이선스 확인일 ${DATA.checkedAt})`,
      `- 선택 수: ${list.length}`,
      '',
    ];
    list.forEach((it, i) => {
      const memo = state.selected[it.id].memo.trim();
      lines.push(`## ${i + 1}. ${it.name} — ${CAT_LABEL[it.category]}`);
      lines.push(`- 데모: ${it.preview}`);
      if (it.source) lines.push(`- ${it.sourceLabel}: ${it.source}`);
      lines.push(`- 기술: ${it.stack.join(', ')}${it.htmlReady ? ' (빌드 없이 HTML 바로 사용 가능)' : ''}`);
      lines.push(`- 라이선스: ${it.license} · ${PRICE[it.pricing].label}`);
      if (it.licenseNote) lines.push(`- 주의: ${it.licenseNote}`);
      lines.push(`- 메모: ${memo || '(없음)'}`);
      lines.push('');
    });
    return lines.join('\n');
  }

  function toJSON() {
    return JSON.stringify({
      title: 'HTML 디자인 레퍼런스 선택',
      createdAt: today(),
      checkedAt: DATA.checkedAt,
      items: selectedList().map((it) => ({
        id: it.id,
        name: it.name,
        category: CAT_LABEL[it.category],
        preview: it.preview,
        source: it.source,
        stack: it.stack,
        htmlReady: it.htmlReady,
        license: it.license,
        pricing: PRICE[it.pricing].label,
        licenseNote: it.licenseNote,
        memo: state.selected[it.id].memo.trim(),
      })),
    }, null, 2);
  }

  async function copyText(text, doneMsg) {
    try {
      await navigator.clipboard.writeText(text);
      toast(doneMsg);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
      document.body.appendChild(ta);
      ta.select();
      let ok = false;
      try { ok = document.execCommand('copy'); } catch { ok = false; }
      ta.remove();
      toast(ok ? doneMsg : '복사하지 못했습니다. .md 파일 저장을 이용하세요');
    }
  }

  function download(text, filename, type) {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const a = Object.assign(document.createElement('a'), { href: url, download: filename });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    toast(`${filename} 파일을 저장했습니다`);
  }

  el.tray.addEventListener('click', (e) => {
    const rm = e.target.closest('[data-remove]');
    if (rm) { toggleSelect(rm.dataset.remove); return; }
    const ex = e.target.closest('[data-export]');
    if (!ex || ex.disabled) return;
    const kind = ex.dataset.export;
    if (kind === 'make') {
      closeTray();
      document.dispatchEvent(new CustomEvent('previewer:make'));
      return;
    }
    if (kind === 'md-copy') copyText(toMarkdown(), 'Markdown으로 복사했습니다. Claude Code에 붙여 넣으세요');
    else if (kind === 'json-copy') copyText(toJSON(), 'JSON으로 복사했습니다');
    else if (kind === 'md-file') download(toMarkdown(), `html-design-references-${today()}.md`, 'text/markdown;charset=utf-8');
    else if (kind === 'clear') {
      const n = Object.keys(state.selected).length;
      if (!window.confirm(`담은 디자인 ${n}개와 메모를 모두 지울까요?`)) return;
      const ids = Object.keys(state.selected);
      state.selected = {};
      persist();
      ids.forEach(syncCard);
      renderSelCount();
      renderTray();
      document.dispatchEvent(new CustomEvent('previewer:selection'));
      toast('선택을 모두 비웠습니다');
    }
  });

  el.tray.addEventListener('input', (e) => {
    const id = e.target.dataset && e.target.dataset.memo;
    if (!id || !state.selected[id]) return;
    state.selected[id].memo = e.target.value;
    clearTimeout(memoTimer);
    memoTimer = setTimeout(() => {
      persist();
      document.dispatchEvent(new CustomEvent('previewer:selection'));
    }, 300);
  });

  el.trayBtn.addEventListener('click', openTray);
  el.trayClose.addEventListener('click', closeTray);
  el.scrim.addEventListener('click', closeTray);

  // ── 테마 ──
  let theme = storage.get(THEME_KEY);
  if (!THEMES.includes(theme)) theme = 'system';
  function applyTheme() {
    if (theme === 'system') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', theme);
    el.themeBtn.innerHTML = icon(theme === 'dark' ? 'moon' : theme === 'light' ? 'sun' : 'contrast');
    const label = `테마: ${THEME_LABEL[theme]} (눌러서 변경)`;
    el.themeBtn.title = label;
    el.themeBtn.setAttribute('aria-label', label);
  }
  el.themeBtn.addEventListener('click', () => {
    theme = THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length];
    storage.set(THEME_KEY, theme);
    applyTheme();
    toast(`테마: ${THEME_LABEL[theme]}`);
  });

  // ── 목록 이벤트 ──
  el.tabs.addEventListener('click', (e) => {
    const b = e.target.closest('[data-cat]');
    if (!b || b.dataset.cat === state.cat) return;
    state.cat = b.dataset.cat;
    history.replaceState(null, '', state.cat === 'all' ? location.pathname + location.search : `#${state.cat}`);
    persist();
    render();
  });

  $$('.toggle[data-toggle]').forEach((b) => b.addEventListener('click', () => {
    const key = b.dataset.toggle;
    state[key] = !state[key];
    persist();
    render();
  }));

  el.sort.innerHTML = Object.entries(SORTS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('');
  el.stack.innerHTML = Object.entries(STACKS).map(([k, v]) => `<option value="${k}">${v.label}</option>`).join('');
  el.sort.addEventListener('change', () => { state.sort = el.sort.value; persist(); render(); });
  el.stack.addEventListener('change', () => { state.stack = el.stack.value; persist(); render(); });

  let searchTimer = 0;
  el.q.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => { state.q = norm(el.q.value.trim()); render(); }, 120);
  });

  el.resetFilters.addEventListener('click', resetFilters);
  $$('[data-reset]').forEach((b) => b.addEventListener('click', resetFilters));

  el.grid.addEventListener('click', (e) => {
    const t = e.target.closest('[data-action]');
    if (!t) return;
    const id = t.closest('.card').dataset.id;
    if (t.dataset.action === 'preview') openPreview(id);
    else if (t.dataset.action === 'select') toggleSelect(id);
  });
  el.grid.addEventListener('error', (e) => {
    if (e.target.tagName === 'IMG') e.target.closest('.card-media').classList.add('no-img');
  }, true);

  // ── 키보드 ──
  function trapFocus(e, container) {
    const f = $$('a[href], button:not([disabled]), textarea, input, select, iframe', container)
      .filter((x) => x.getClientRects().length > 0);
    if (!f.length) return;
    const first = f[0];
    const last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  document.addEventListener('keydown', (e) => {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);
    const plain = !e.ctrlKey && !e.metaKey && !e.altKey;
    if (!pv.root.hidden) {
      if (e.key === 'Escape') { e.preventDefault(); closePreview(); }
      else if (e.key === 'Tab') trapFocus(e, pv.panel);
      else if (!typing && plain && e.key === 'ArrowLeft') { e.preventDefault(); stepPreview(-1); }
      else if (!typing && plain && e.key === 'ArrowRight') { e.preventDefault(); stepPreview(1); }
      else if (!typing && plain && e.code === 'KeyS') { e.preventDefault(); toggleSelect(pvList[pvIdx]); }
      return;
    }
    if (trayIsOpen) {
      if (e.key === 'Escape') { e.preventDefault(); closeTray(); }
      else if (e.key === 'Tab') trapFocus(e, el.tray);
      return;
    }
    const picking = !document.getElementById('view-pick').hidden;
    if (picking && !typing && plain && (e.key === '/' || e.code === 'Slash')) { e.preventDefault(); el.q.focus(); }
  });

  // ── 초기화 ──
  $('#stat-total').textContent = ITEMS.length;
  $('#stat-embed').textContent = ITEMS.filter((it) => it.embeddable).length;
  $('#stat-html').textContent = ITEMS.filter((it) => it.htmlReady).length;
  $('#stat-date').textContent = fmtDate(DATA.checkedAt);
  $('#checked-at').textContent = DATA.checkedAt;
  el.sources.innerHTML = (DATA.moreSources || []).map((s) => `<a class="source" href="${esc(s.url)}" target="_blank" rel="noopener noreferrer"><b>${esc(s.label)}${icon('external')}</b><span>${esc(s.note)}</span></a>`).join('');

  // ② HTML 만들기 화면(convertor.js)과 주고받는 창구
  window.PreviewerApp = {
    selected: () => selectedList().map((it) => ({ id: it.id, name: it.name, category: it.category, memo: state.selected[it.id].memo.trim() })),
  };
  document.addEventListener('previewer:toast', (e) => toast(String(e.detail || '')));

  applyTheme();
  renderSelCount();
  render();
})();
