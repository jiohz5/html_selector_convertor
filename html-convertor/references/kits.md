# 키트 계약 — 키트 HTML과 엔진(engine.js)이 주고받는 약속

키트를 고치거나 새로 만들 때만 읽는다. 일반적인 디자인 손질은 `render.py --css`로 충분하다.

## render.py가 바꾸는 자리

| 표시 | 들어가는 것 |
|---|---|
| `%%HTML_ATTRS%%` | 테마 속성(예: `data-bs-theme="light"`) |
| `%%TITLE%%` | spec.meta.title |
| `%%BODY_CLASS%%` | `hc-kit-<키트> hc-design-<id> hc-layout-<배치> hc-kpi-<KPI모양>` |
| `%%BRAND_MARK%%` | 제목 첫 글자 |
| `%%CREDIT%%` | 디자인 출처·라이선스 표기 |
| `<!--HC:HEAD-->` | 메타, Pretendard, 웹폰트, 원본 CSS, 토큰 `:root{--hc-*}`, `_common.css` |
| `<!--HC:STYLE-->` | 디자인 `css` + 사용자 `--css` (키트 스타일 뒤 → 가장 우선) |
| `<!--HC:BODY_END-->` | `#hc-spec`, `#hc-config` JSON, 라이브러리 `<script>`, 엔진 |

designs.json의 `classMap`은 키트 안의 클래스에 원본 프레임워크 클래스를 덧붙인다(예: `hc-table` → `table card-table`).

## 엔진이 찾는 것

- `[data-meta="title|subtitle|source|generatedAt|author|summary"]` — 값이 없으면 `data-optional` 요소는 지워진다
- `[data-region="kpis|charts|tables|sections|nav"]` — 영역. 비어 있는 영역은 `[data-requires="…"]` 조상과 함께 사라진다
  (`data-requires`: kpis·charts·tables·sections·summary·nav)
- `[data-anchor="kpis|charts|tables"]` — 내비게이션이 가리킬 감싼 요소
- 차트 영역의 `data-span1/2/3` — 차트 `span` 값에 따라 붙일 클래스
- 발표 모드(`mode: slides`): `[data-region="slides"]`와 `tpl-slide-title|summary|kpis|section|chart|table|end`

## 템플릿과 슬롯 (`<template id>` 안의 `[data-slot]`)

| 템플릿 | 슬롯 | 템플릿 속성 |
|---|---|---|
| `tpl-kpi` | label, value, delta, delta-label, hint, spark | `data-good/bad/flat`: 증감 요소에 붙일 클래스 |
| `tpl-chart` | title, subtitle, chart, note | — |
| `tpl-figure` | (tpl-chart와 같음) 섹션 안에 끼워 넣는 차트용 | — |
| `tpl-table` | title, subtitle, search, table, count, more | `data-num`: 숫자 칸 클래스, `data-badge-good/warn/bad/info/neutral` |
| `tpl-section` | title, body | — |
| `tpl-callout` | title, text | `data-info/good/warn/bad`: 톤별 클래스 |
| `tpl-nav` | link (또는 루트 `<a>`) | `data-active`: 현재 위치 클래스 |

슬롯 값이 비면 그 슬롯 요소는 지워진다. 버튼 `[data-action="theme"]`(테마 전환), `[data-action="print"]`(인쇄)는 엔진이 연결한다.
키트는 `window.HC_AFTER_RENDER`를 정의해 렌더링 후 처리(목차 복제, reveal 초기화 등)를 할 수 있고,
숨겨진 영역을 보여 줄 때 `window.HC.flush()`를 부르면 지연된 차트가 그려진다.

## 토큰 (`--hc-*`)

색: primary, primary-fg, bg, surface, fg, heading, muted, border, grid, good, bad, warn, c1~c8(palette), link, accent
레이아웃: radius, shadow, gap, container, measure, wide, font, font-heading, font-size
사이드바·헤더: sidebar-bg/fg/muted/border/hover/active-bg/active-fg/active-shadow, nav-radius, nav-indicator-w, header-bg/fg/border/blur/btn-border, brand-bg
KPI·표: kpi-size, kpi-weight, kpi-label-transform, kpi-label-spacing, th-transform, table-head-bg, badge-radius, card-title-size, card-title-weight
랜딩·발표: hero-bg, hero-fg, hero-accent, hero-title, heading-transform, cta-radius, slide-align, slide-h-transform

다크 모드 값은 designs.json의 `dark`에 같은 이름으로 넣는다. 토큰 값에는 `var(--color-primary)` 같은 다른 CSS 변수도 쓸 수 있다
(엔진이 차트용 색으로 바꿀 때 실제 rgb로 변환한다).

## 새 디자인 추가

1. Previewer `templates.js`에 항목을 넣고 `python scripts/sync_catalog.py`
2. `designs.json`의 `designs`에 같은 id로 kit·libs(원본 CDN이 있으면)·chartLib·fonts·tokens·dark·signature 추가
3. `render.py --design <id>` → `check_html.py --shot --dark`로 확인
