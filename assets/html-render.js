/* 원본 HTML의 선택적 렌더링 분석. 파일판에서도 서버나 브라우저 도우미 없이 실행한다. */
(() => {
  'use strict';

  const POLICY = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; frame-src 'none'; base-uri 'none'; form-action 'none'";
  const MAX_INPUT = 8_000_000;
  const MAX_RESULT = 16_000_000;
  const running = new WeakMap();
  const inlineScript = (code) => `<script>${code.replace(/<\/script/gi, '<\\/script')}</script>`;
  const meta = `<meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${POLICY}">`;

  // 이 함수는 원본의 모든 스크립트보다 먼저 실행된다. DOM에 남는 토큰은 제거하고
  // 필요한 native API를 먼저 보관한다. 수집 결과의 최종 정제는 converter 문서에서 한다.
  function collectSource(config) {
    const sendMessage = parent.postMessage.bind(parent);
    const schedule = window.setTimeout.bind(window);
    const unschedule = window.clearTimeout.bind(window);
    const listen = window.addEventListener.bind(window);
    const unlisten = window.removeEventListener.bind(window);
    const query = document.querySelectorAll.bind(document);
    const getHTML = Object.getOwnPropertyDescriptor(Element.prototype, 'outerHTML').get;
    const getText = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'innerText').get;
    const getRects = Element.prototype.getClientRects;
    const setHTML = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML').set;
    const getContent = Object.getOwnPropertyDescriptor(Node.prototype, 'textContent').get;
    const fragmentQuery = DocumentFragment.prototype.querySelectorAll;
    const remove = Element.prototype.remove;
    const replace = Element.prototype.replaceWith;
    const append = Node.prototype.appendChild;
    const makeElement = document.createElement.bind(document);
    const makeText = document.createTextNode.bind(document);
    const now = Date.now.bind(Date);
    const warnings = [];
    let omittedWarnings = 0;
    let done = false;
    let ready = false;
    let tickTimer;
    let timeoutTimer;
    let lastFingerprint;
    let lastChanged = now();
    let lastProgress = 0;
    let readyAt = 0;
    const post = (type, payload) => sendMessage({ session: config.session, type, payload }, '*');
    const warn = (message) => {
      const value = String(message);
      if (warnings.includes(value)) return;
      if (warnings.length >= 100) { omittedWarnings++; return; }
      warnings.push(value.length > 2000 ? value.slice(0, 2000) + ' [오류 설명 길이 한도 초과]' : value);
    };
    const onError = (event) => warn(`원본 실행 오류: ${event.message || '알 수 없는 오류'}`);
    const onRejection = (event) => {
      const reason = event.reason;
      warn(`원본 비동기 오류: ${typeof reason === 'string' ? reason : reason?.message || '처리되지 않은 Promise 오류'}`);
    };
    const onPolicy = (event) => warn(`원본 리소스 차단: ${event.effectiveDirective} · ${event.blockedURI || 'inline'}`);
    const textOf = (element) => {
      if (!element) return '';
      if (getRects.call(element).length) return getText.call(element);
      // 숨겨진 원본 pane에서는 innerText가 textContent로 바뀌어 script/style까지
      // 포함한다. 원본 DOM은 유지하고 inert 조각에서 비본문 노드를 제거한다.
      const copy = makeElement('template');
      setHTML.call(copy, getHTML.call(element));
      const content = copy.content;
      for (const node of fragmentQuery.call(content, 'script,style,template,noscript,iframe,object,embed')) remove.call(node);
      for (const node of fragmentQuery.call(content, 'br')) replace.call(node, makeText('\n'));
      for (const node of fragmentQuery.call(content, 'p,div,section,article,header,footer,li,pre,tr,h1,h2,h3,h4,h5,h6')) append.call(node, makeText('\n'));
      return getContent.call(content);
    };
    const analysis = (partial) => {
      const headings = [];
      for (const element of query('h1,h2,h3,h4,h5,h6')) {
        const text = textOf(element).trim();
        if (text) headings.push(text);
      }
      return {
        title: document.title,
        headings,
        bodyText: textOf(document.body),
        tableCount: query('table').length,
        svgCount: query('svg').length,
        canvasCount: query('canvas').length,
        warnings: omittedWarnings ? [...warnings, `추가 경고 ${omittedWarnings}건은 경고 개수 한도로 생략했습니다.`] : [...warnings],
        partial: partial || warnings.length > 0
      };
    };
    const capture = (partial) => ({ snapshot: getHTML.call(document.documentElement), analysis: analysis(partial) });
    const stop = () => {
      done = true;
      unschedule(tickTimer);
      unschedule(timeoutTimer);
      unlisten('DOMContentLoaded', onReady);
      unlisten('error', onError);
      unlisten('unhandledrejection', onRejection);
      document.removeEventListener('securitypolicyviolation', onPolicy);
    };
    const finish = (partial) => {
      if (done) return;
      try {
        if (partial) warn(ready ? '제한 시간 안에 본문과 표가 안정되지 않아 현재 상태를 분석했습니다.' : '문서 준비가 끝나기 전에 제한 시간이 도달해 현재 상태를 분석했습니다.');
        const result = capture(partial);
        stop();
        post('result', result);
      } catch (error) {
        stop();
        post('error', `원본 내용을 읽지 못했습니다: ${error?.message || 'DOM 수집 오류'}`);
      }
    };
    const tick = () => {
      if (done) return;
      try {
        const state = analysis(false);
        const tables = [];
        for (const table of query('table')) tables.push(textOf(table));
        // SVG의 좌표·회전 애니메이션은 대기 시간을 계속 초기화하지 않는다.
        const fingerprint = [state.bodyText, ...tables, state.svgCount, state.canvasCount].join('\u0000');
        const time = now();
        if (fingerprint !== lastFingerprint) { lastFingerprint = fingerprint; lastChanged = Math.max(time, readyAt + 2000); }
        // 이동 차단으로 inner 문서가 사라져도 부모가 유용한 부분 결과를 반환할 수 있다.
        if (!lastProgress || time - lastProgress >= 1000) {
          post('progress', { snapshot: getHTML.call(document.documentElement), analysis: state });
          lastProgress = time;
        }
        if (time - lastChanged >= 800) { finish(false); return; }
        tickTimer = schedule(tick, 100);
      } catch (error) {
        warn(`원본 분석 오류: ${error?.message || 'DOM 수집 오류'}`);
        finish(true);
      }
    };
    function onReady() {
      ready = true;
      readyAt = now();
      // 원본 DOMContentLoaded 리스너 다음 작업부터 수집하며 최초 2초는 기다린다.
      // 그 뒤 본문·표의 800ms 안정화를 확인한다. 미래 작업 완료를 보장하는 기준은 아니다.
      tickTimer = schedule(tick, 0);
    }
    listen('error', onError);
    listen('unhandledrejection', onRejection);
    document.addEventListener('securitypolicyviolation', onPolicy);
    listen('DOMContentLoaded', onReady);
    timeoutTimer = schedule(() => finish(true), Math.max(0, config.deadline - now() - 100));
    document.currentScript.remove();
  }

  function mountSource(source, session) {
    const inner = document.createElement('iframe');
    inner.setAttribute('sandbox', 'allow-scripts');
    inner.setAttribute('referrerpolicy', 'no-referrer');
    inner.style.cssText = 'width:100%;height:100%;border:0;display:block';
    const post = (type, payload) => parent.postMessage({ session, type, payload }, '*');
    const receive = (event) => {
      if (event.source !== inner.contentWindow || event.origin !== 'null' || event.data?.session !== session) return;
      if (!['progress', 'result', 'error'].includes(event.data.type)) return;
      post(event.data.type, event.data.payload);
      if (event.data.type !== 'progress') window.removeEventListener('message', receive);
    };
    window.addEventListener('message', receive);
    document.addEventListener('securitypolicyviolation', (event) => {
      post('warning', `원본 이동·리소스 차단: ${event.effectiveDirective} · ${event.blockedURI || 'inline'}`);
    });
    inner.srcdoc = source;
    document.body.append(inner);
  }

  function validateResult(result) {
    if (!result || typeof result.snapshot !== 'string' || result.snapshot.length > MAX_RESULT) throw new Error('원본 분석 결과가 처리 한도를 초과했거나 올바르지 않습니다.');
    const data = result.analysis;
    const strings = (value, maximum) => Array.isArray(value) && value.length <= maximum && value.every((item) => typeof item === 'string');
    if (!data || typeof data.title !== 'string' || typeof data.bodyText !== 'string' ||
        !strings(data.headings, 10_000) || !strings(data.warnings, 101) || typeof data.partial !== 'boolean' ||
        ['tableCount', 'svgCount', 'canvasCount'].some((key) => !Number.isSafeInteger(data[key]) || data[key] < 0)) {
      throw new Error('원본 분석 결과 형식이 올바르지 않습니다.');
    }
    const clean = { snapshot: result.snapshot, analysis: {
      title: data.title, headings: [...data.headings], bodyText: data.bodyText,
      tableCount: data.tableCount, svgCount: data.svgCount, canvasCount: data.canvasCount,
      warnings: [...data.warnings], partial: data.partial
    } };
    if (JSON.stringify(clean).length > MAX_RESULT) throw new Error('원본 분석 결과가 처리 한도를 초과했습니다. 본문을 잘라서 반환하지 않았습니다.');
    return clean;
  }

  function safeSnapshot(snapshot) {
    const template = document.createElement('template');
    template.innerHTML = snapshot;
    const fragments = [template.content];
    while (fragments.length) {
      const root = fragments.pop();
      root.querySelectorAll('iframe,object,embed').forEach((element) => element.remove());
      root.querySelectorAll('script').forEach((element) => {
        if (element.type.trim().toLowerCase() !== 'application/json' || element.hasAttribute('src')) element.remove();
      });
      root.querySelectorAll('*').forEach((element) => {
        for (const attribute of Array.from(element.attributes)) {
          if (attribute.name.toLowerCase().startsWith('on')) element.removeAttributeNode(attribute);
        }
      });
      // querySelectorAll은 template.content 경계를 넘지 않으므로 내부 조각도 정제한다.
      root.querySelectorAll('template').forEach((element) => fragments.push(element.content));
    }
    return template.innerHTML;
  }

  function start(hostFrame, html, { timeoutMs = 8000 } = {}) {
    let resolvePromise, rejectPromise;
    const promise = new Promise((resolve, reject) => { resolvePromise = resolve; rejectPromise = reject; });
    let settled = false;
    let timer;
    let receive;
    let record;
    let latest;
    const outerWarnings = [];
    const cleanup = (clearFrame) => {
      clearTimeout(timer);
      if (receive) window.removeEventListener('message', receive);
      if (clearFrame && record && hostFrame && running.get(hostFrame) === record) {
        hostFrame.srcdoc = '';
        running.delete(hostFrame);
      }
    };
    const fail = (error) => {
      if (settled) return;
      settled = true;
      cleanup(true);
      rejectPromise(error);
    };
    const cancel = () => {
      cleanup(true);
      if (!settled) { settled = true; rejectPromise(new DOMException('원본 렌더링 분석을 취소했습니다.', 'AbortError')); }
    };
    const handle = { promise, cancel };
    if (!hostFrame || hostFrame.localName !== 'iframe') { fail(new Error('원본 미리보기 프레임이 필요합니다.')); return handle; }
    running.get(hostFrame)?.cancel();
    record = handle;
    running.set(hostFrame, record);
    if (typeof html !== 'string' || !html.trim()) { fail(new Error('원본 HTML이 비어 있습니다.')); return handle; }
    if (html.length > MAX_INPUT) { fail(new Error('원본 HTML이 처리 한도(800만 글자)를 초과했습니다.')); return handle; }
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0 || timeoutMs > 60_000) { fail(new Error('분석 제한 시간은 0초 초과, 60초 이하여야 합니다.')); return handle; }
    // getRandomValues는 HTTPS 외의 사내 HTTP 주소에서도 사용할 수 있다.
    let session;
    try {
      session = Array.from(crypto.getRandomValues(new Uint32Array(4)), (value) => value.toString(16).padStart(8, '0')).join('');
    } catch (error) { fail(new Error('이 브라우저에서 원본 분석 세션을 만들지 못했습니다.')); return handle; }
    const deadline = Date.now() + timeoutMs;
    const finish = (raw, partial = false) => {
      if (settled) return;
      try {
        const result = validateResult(raw);
        const combinedWarnings = [...new Set([...result.analysis.warnings, ...outerWarnings])];
        result.analysis.warnings = combinedWarnings.length > 100
          ? [...combinedWarnings.slice(0, 100), `경고 목록 한도로 ${combinedWarnings.length - 100}개 추가 항목을 생략했습니다.`]
          : combinedWarnings;
        result.analysis.partial ||= partial || outerWarnings.length > 0;
        result.snapshot = safeSnapshot(result.snapshot);
        validateResult(result);
        settled = true;
        cleanup(false); // 원본의 선택·회전 등은 분석이 끝난 뒤에도 계속 사용할 수 있다.
        resolvePromise(result);
      } catch (error) { fail(error); }
    };
    receive = (event) => {
      if (settled || event.source !== hostFrame.contentWindow || event.origin !== 'null' || event.data?.session !== session) return;
      const { type, payload } = event.data;
      if (type === 'warning' && typeof payload === 'string' && payload.length <= 2500) {
        if (outerWarnings.length < 100 && !outerWarnings.includes(payload)) outerWarnings.push(payload);
      } else if (type === 'progress' || type === 'result') {
        try { latest = validateResult(payload); } catch (error) { fail(error); return; }
        if (type === 'result') finish(latest);
      } else if (type === 'error' && typeof payload === 'string' && payload.length <= 2500) fail(new Error(payload));
    };
    window.addEventListener('message', receive);
    // 이 타이머는 무한 JavaScript 실행을 강제로 중단하는 보장이 아니다.
    timer = setTimeout(() => {
      if (latest && (latest.analysis.bodyText.trim() || latest.analysis.title || latest.analysis.tableCount || latest.analysis.svgCount || latest.analysis.canvasCount)) {
        outerWarnings.push('제한 시간 안에 원본 분석이 끝나지 않아 마지막으로 읽은 상태를 반환했습니다.');
        finish(latest, true);
      } else fail(new Error(`원본 렌더링 응답이 제한 시간(${timeoutMs / 1000}초) 안에 도착하지 않았습니다.${outerWarnings.length ? '\n' + outerWarnings.join('\n') : ''}`));
    }, timeoutMs);
    try {
      const doctype = html.match(/^\uFEFF?\s*(?:<!--[\s\S]*?-->\s*)*(<!doctype[^>]*>)/i)?.[1] || '';
      const collector = inlineScript(`(${collectSource.toString()})(${JSON.stringify({ session, deadline })});`);
      // 선행 head 안에서 정책·수집기가 먼저 처리되고 원본 head/CSP·본문이 그대로 이어진다.
      const inner = `${doctype}<html><head>${meta}${collector}${html}`;
      // Edge의 file:/HTTP 실험: frame-src 'none'은 srcdoc 초기 실행을 허용하면서
      // inner 자기 HTTP(S) 이동·meta refresh를 차단한다. 'self'는 같은 HTTP 호스트를 허용한다.
      const outer = `<!doctype html><html><head>${meta}<style>html,body{margin:0;width:100%;height:100%;overflow:hidden}</style></head><body>${inlineScript(`(${mountSource.toString()})(${JSON.stringify(inner)},${JSON.stringify(session)});`)}</body></html>`;
      hostFrame.setAttribute('sandbox', 'allow-scripts');
      hostFrame.setAttribute('referrerpolicy', 'no-referrer');
      hostFrame.srcdoc = outer;
    } catch (error) { fail(error); }
    return handle;
  }

  window.HC_HTML_RENDER = Object.freeze({ start });
})();
