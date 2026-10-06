# spec.json — 데이터 명세 형식

모든 디자인 키트는 이 하나의 JSON을 읽어 화면을 그린다. 디자인을 바꿔도 spec은 그대로 재사용된다.
값은 모두 **실제 데이터에서 계산한 값**이어야 한다. 화면을 채우려고 숫자·항목을 지어내지 않는다.

## 목차
1. 전체 구조
2. meta / summary
3. kpis
4. charts
5. tables
6. sections (본문·인사이트)
7. 크기 가이드
8. 최소 예시

## 1. 전체 구조

```json
{
  "meta":     { "title": "...", "subtitle": "...", "source": "...", "generatedAt": "2026-10-06", "author": "..." },
  "summary":  ["핵심 결론 1", "핵심 결론 2"],
  "kpis":     [ ... ],
  "charts":   [ ... ],
  "tables":   [ ... ],
  "sections": [ ... ],
  "nav":      true
}
```

모든 키는 선택 사항이다(meta.title만은 꼭 넣는다). 없는 영역은 화면에서 숨겨진다.

## 2. meta / summary

| 키 | 설명 |
|---|---|
| `meta.title` | 페이지 제목. `<title>`과 헤더에 쓰인다 |
| `meta.subtitle` | 한 줄 설명 (기간·대상 등) |
| `meta.source` | 데이터 출처 (파일명, DB, 시스템명). 푸터에 표시 |
| `meta.generatedAt` | 생성일 `YYYY-MM-DD` |
| `meta.author` | 작성자·팀 (선택) |
| `meta.brand` | 사이드바 로고 칸 글자 1~2자 (선택, 기본은 제목의 첫 글자) |
| `summary` | 문자열 1개(문단) 또는 문자열 배열(글머리표). 3~5개 이내의 결론 문장 |

## 3. kpis

```json
{ "label": "총 매출", "value": 1284000000, "format": "currency", "currency": "KRW",
  "delta": 12.4, "deltaLabel": "전월 대비", "good": "up",
  "hint": "9월 누적", "spark": [12, 15, 14, 18, 21, 24] }
```

| 키 | 설명 |
|---|---|
| `value` | 숫자(권장) 또는 문자열 |
| `format` | `number`(기본) · `compact`(1.2억, 3.4만) · `percent`(값이 이미 % 단위: 12.5 → 12.5%) · `currency` · `decimal` |
| `decimals` | 소수 자릿수. 지정하면 끝자리 0까지 고정(1.60%) — 표의 열 자릿수를 맞출 때 쓴다. 생략하면 number 0, percent/decimal 최대 1자리 |
| `unit` | 값 뒤에 붙일 단위 (`건`, `명`, `ms`) |
| `currency` | `KRW`(기본) · `USD` 등 |
| `delta` | 비교 대비 변화율(%) 숫자. 12.4 → ▲ 12.4% |
| `deltaSuffix` | 기본 `%`. 퍼센트포인트면 `%p` |
| `good` | `up`(기본, 오르면 좋음) · `down`(내려야 좋음: 불량률·지연·비용) |
| `spark` | 작은 추세선용 숫자 배열 (선택) |

4~8개가 적당하다. 가장 중요한 지표를 앞에 둔다.

## 4. charts

```json
{ "id": "monthly", "title": "월별 매출 추이", "subtitle": "단위: 백만 원",
  "type": "line", "x": ["1월","2월","3월"],
  "series": [ { "name": "2025", "data": [120, 132, 101] },
              { "name": "2026", "data": [140, 150, 170], "type": "bar" } ],
  "format": "number", "span": 2, "height": 300, "note": "3월은 잠정치" }
```

| `type` | 데이터 모양 |
|---|---|
| `line` · `area` · `bar` | `x`(범주 배열) + `series[].data`(같은 길이의 숫자 배열) |
| `hbar` | 가로 막대. 순위 비교(Top N)에 적합. `x`가 항목명 |
| `stacked` | 누적 막대. 구성비 추이 |
| `pie` · `donut` | `x`(항목명) + `series[0].data`(값). 항목 6개 이하일 때만 |
| `scatter` | `series[].data`가 `[[x, y], ...]`. `xLabel`, `yLabel`로 축 이름 |

- `series[].type`으로 시리즈별 `line`/`bar`를 섞을 수 있다(콤보: ECharts·Chart.js·ApexCharts·Plotly). Observable Plot(`plot`)은 콤보를 지원하지 않으니 목표선이 필요하면 차트 라이브러리를 바꾸거나 표·note로 보여 준다.
- `span`: 그리드에서 차지하는 폭 1~3 (기본 1, 시계열은 2 권장).
- `format`/`decimals`/`unit`: 툴팁·축 값 표시 형식 (KPI와 같은 규칙).
- `min`/`max`: 값 축 범위(선택). 달성률처럼 차이가 작은 값을 비교할 때. 막대 축을 자르면 부제에 밝힌다.
- 금액(`currency`, 원화)은 표·툴팁에서 전체 자릿수(87,826,116원), KPI에서는 1억 이상이면 자동 축약(12.8억원). 표에서도 축약하려면 열에 `"compact": true` 또는 `format: "compact"` + `unit: "원"`.
- 차트 고르기: 시간 흐름 → line/area, 항목 비교 → bar/hbar, 구성비 → donut(≤6개) 또는 stacked, 관계 → scatter.
- area는 시리즈 1~2개일 때만. 3개 이상을 겹치면 면이 탁해져 읽기 어렵다 → line으로 바꾸거나 stacked(합계가 의미 있을 때).
- 변동이 큰 비율(일·주별 불량률 등)을 여러 시리즈로 겹치면 선이 엉킨다 → 시리즈를 줄이거나 월 단위로 묶고, 세부는 표로.

## 5. tables

```json
{ "id": "top-products", "title": "제품별 실적", "subtitle": "매출 상위 20개",
  "columns": [
    { "key": "name",   "label": "제품" },
    { "key": "sales",  "label": "매출", "type": "number", "format": "compact" },
    { "key": "rate",   "label": "달성률", "type": "number", "format": "percent" },
    { "key": "status", "label": "상태", "type": "badge",
      "tones": { "정상": "good", "주의": "warn", "지연": "bad" } }
  ],
  "rows": [ { "name": "A", "sales": 1200000, "rate": 98.2, "status": "정상" } ],
  "pageSize": 15, "search": true }
```

- `type`: `text`(기본) · `number`(오른쪽 정렬, format 적용) · `date` · `badge`
- `tones`: badge 값 → `good` / `warn` / `bad` / `info` / `neutral`
- 머리글을 누르면 정렬된다. `search: true`면 검색창이 생긴다(행이 10개 넘으면 기본 켜짐).
- `pageSize`를 넘는 행은 "더 보기"로 펼친다. 원본 행이 수천 개면 표에는 집계·상위 N만 넣는다.

## 6. sections (본문·인사이트)

```json
{ "id": "findings", "title": "주요 발견",
  "text": "첫 문단입니다. **굵게** 강조할 수 있습니다.\n\n둘째 문단입니다.",
  "bullets": ["항목 1", "항목 2"],
  "callout": { "tone": "warn", "title": "주의", "text": "3월 데이터는 잠정치입니다." },
  "charts": ["monthly"], "tables": ["top-products"] }
```

- `text`: 빈 줄(`\n\n`)로 문단 구분, `**굵게**`만 지원. HTML은 넣지 않는다(이스케이프됨).
- `charts`/`tables`: 이 섹션 안에 끼워 넣을 차트·표의 id. 어느 섹션에도 속하지 않은 차트·표는 기본 영역(차트 그리드·표 영역)에 표시된다.
- 보고서·발표 디자인에서는 섹션이 글의 뼈대가 되고, 대시보드에서는 하단의 "분석 메모"로 표시된다.
- `callout.tone`: `info` · `good` · `warn` · `bad`

## 7. 크기 가이드

- spec은 HTML 안에 그대로 들어간다. 전체 1MB 이하, 표 행은 표당 2,000행 이하로 유지한다.
- 원본이 크면 Python으로 먼저 집계(월별·부서별·상위 N)한 결과만 넣는다. 원본 전체를 넣지 않는다.
- 같은 숫자를 KPI·차트·표에 중복으로 넣을 때 값이 서로 일치하는지 확인한다.

## 8. 최소 예시

```json
{
  "meta": { "title": "9월 생산 현황", "subtitle": "2026-09-01 ~ 09-30", "source": "production.csv", "generatedAt": "2026-10-06" },
  "summary": ["가동률이 전월 대비 3.1%p 올랐습니다.", "B라인 불량률이 목표(1.5%)를 넘었습니다."],
  "kpis": [
    { "label": "생산량", "value": 48210, "unit": "개", "delta": 4.2 },
    { "label": "불량률", "value": 1.8, "format": "percent", "delta": 0.3, "deltaSuffix": "%p", "good": "down" }
  ],
  "charts": [
    { "id": "daily", "title": "일별 생산량", "type": "area", "span": 2,
      "x": ["09-01", "09-02", "09-03"], "series": [{ "name": "생산량", "data": [1580, 1620, 1710] }] }
  ],
  "tables": [
    { "id": "lines", "title": "라인별 현황",
      "columns": [{ "key": "line", "label": "라인" }, { "key": "qty", "label": "생산량", "type": "number" }],
      "rows": [{ "line": "A", "qty": 25110 }, { "line": "B", "qty": 23100 }] }
  ]
}
```
