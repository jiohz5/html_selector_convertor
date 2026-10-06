---
name: html-convertor
description: HTML Previewer에서 고른 디자인(Tabler·shadcn·AdminLTE·Quarto·Tufte·reveal.js 등 45종)을 이어받아, 지금 가진 데이터(CSV·엑셀·JSON·DB 결과·분석 결과·보고서 글)를 그 디자인의 단일 HTML 파일(대시보드·보고서·랜딩·발표)로 만들어 준다. 사용자가 "html-design-references" 내보내기(.md/.json)를 주거나, 템플릿 이름을 말하거나, 결과·데이터를 "HTML로/대시보드로/보고서 페이지로/웹페이지로/슬라이드로 만들어 줘", "고른 디자인으로 뽑아 줘", "Previewer에서 고른 걸로"라고 할 때 반드시 이 스킬을 쓴다. 분석 결과를 브라우저로 볼 수 있게 정리하거나 공유용 HTML이 필요할 때도, 디자인을 따로 말하지 않았더라도 이 스킬을 쓴다.
---

# html-convertor — 고른 디자인 × 현재 데이터 → HTML 한 장

HTML Previewer(1단계 — 이 스킬 원본이 들어 있는 `html` 프로젝트의 `index.html`)에서 사람이 디자인을 고르고 내보내면, 이 스킬(2단계)이 그 디자인을 이어받아
**지금의 데이터**를 그 모양의 HTML 파일로 만든다.

핵심 구조는 둘의 분리다.

- **디자인 = 키트 + 토큰** (`references/designs.json`): 결과물 형태(키트)와 색·글꼴·모서리·사이드바 같은 모양(토큰).
  원본 CSS를 CDN으로 쓸 수 있는 디자인(Tabler·AdminLTE·CoreUI·Bootstrap·daisyUI·Flowbite)은 원본 CSS를 함께 불러오고,
  React·유료 템플릿은 토큰으로 모양만 재현한다.
- **데이터 = spec.json** (`references/spec.md`): KPI·차트·표·본문을 담은 하나의 JSON. 어떤 디자인·키트로도 그대로 렌더링된다.

그래서 디자인을 바꿔 달라는 요청은 spec은 그대로 두고 `--design`만 바꾸면 되고, 데이터가 바뀌면 spec만 다시 만들면 된다.

스크립트는 모두 `scripts/`에 있다(이 SKILL.md가 있는 폴더 기준). Windows에서도 `python`으로 실행된다.

## 작업 순서

### 1. 디자인 정하기

```bash
python scripts/resolve_design.py                      # 현재 폴더·~/Downloads의 최근 html-design-references-*.md|json 자동 탐색
python scripts/resolve_design.py <내보내기 파일 경로>
python scripts/resolve_design.py tabler echarts       # 이름·id로 직접
```

**사용자가 이번 요청에서 말로 지정한 디자인·형태가 내보내기 파일보다 우선한다.** "reveal.js로"라고 했으면 폴더에 다른 내보내기가 있어도
`resolve_design.py revealjs`처럼 이름으로 정한다(내보내기의 차트 라이브러리 선택은 참고해도 좋다).

사용자가 Markdown/JSON을 대화에 붙여 넣었다면 임시 파일로 저장해 경로로 넘긴다.
결과의 `recommend`(design·kit·chartLib)를 기본값으로 쓰고, `picked[].memo`(사용자가 Previewer에 남긴 메모)를 꼭 읽는다.
메모는 사용자가 그 디자인에서 좋아한 점이다 — "차트는 면적형", "카드 밀도", "다크 모드" 같은 말을 spec·옵션에 반영한다.

- 여러 개를 골랐으면: 차트 라이브러리가 아닌 첫 항목이 화면 구조(primary), 함께 고른 차트 라이브러리는 `--chart-lib`로 쓴다.
  나머지(`alternates`)는 사용자가 원하면 같은 spec으로 추가 렌더링해 비교본을 준다.
- `notes`의 라이선스 안내(유료 → 스타일만 재현, CC BY → 출처 표기, 조건부 유료)는 마지막 보고 때 한 줄로 전한다.
- 내보내기도 이름도 없으면: 데이터의 성격으로 고른다(지표 중심 → `tabler`, 긴 분석 글 → `quarto`, 발표 → `revealjs`, 소개 → `cruip-simple`).
  이때 고른 디자인과 이유를 사용자에게 한 줄로 알려 바꿀 기회를 준다.

전체 목록: `python scripts/render.py --list`

### 2. 데이터 파악하기

"현재의 데이터"는 대화 맥락에 따라 다르다. 무엇을 담을지 먼저 확인한다.

| 데이터 | 하는 일 |
|---|---|
| CSV·TSV·엑셀·JSON·Parquet 파일 | `python scripts/profile_data.py <파일>` → 열 유형·범위·후보 지표 확인 |
| DB(SQLite 등)·스크립트 출력 | 필요한 쿼리를 실행해 결과를 DataFrame/CSV로 받은 뒤 위와 같이 |
| Markdown·텍스트·PDF 보고서 | 읽고 섹션·핵심 수치·표를 뽑는다 |
| 이 대화에서 방금 만든 분석 결과 | 그 결과를 그대로 쓴다(숫자를 새로 지어내지 않는다) |

데이터가 어디 있는지 모호하면 작업 폴더를 훑어 후보(최근 수정된 데이터 파일, output/, data/)를 찾아 제시한다.

### 3. spec.json 만들기

먼저 `references/spec.md`를 읽는다(형식·차트 고르는 법·크기 제한).

**숫자는 반드시 코드로 계산한다.** 출력 폴더에 `build_spec.py`를 만들어 원본 데이터를 읽고 집계해 `spec.json`을 쓰게 한다.
이렇게 하면 숫자가 원본과 일치하고, 데이터가 갱신됐을 때 `python build_spec.py && python render.py ...`로 다시 만들 수 있다.
(원본이 대화 속 결과·문서처럼 코드로 읽을 수 없는 것이면 spec.json을 직접 써도 된다.)

내용 구성 원칙 — 보는 사람이 10초 안에 결론을 알게:

- `summary`: 데이터에서 실제로 확인한 결론 3~5문장. 숫자를 넣어 구체적으로.
- `kpis`: 가장 중요한 지표 4~8개(대시보드에서 4·5개는 한 줄, 6개는 3×2, 7·8개는 4열로 배치된다). 비교 기간이 데이터에 있을 때만 `delta`를 넣는다(없으면 비워 둔다 — 지어내지 않는다).
  불량률·비용·지연처럼 낮을수록 좋은 지표는 `"good": "down"`.
- 값 차이가 작은 비율(달성률 95~100%)은 0부터 그리면 차이가 안 보인다 → 차트에 `min`(예: 90)을 주거나 '목표 대비 차이(%p)'로 바꿔 그린다.
  막대에서 축을 자를 때는 부제에 "축 90%부터"라고 밝힌다.
- `charts`: 질문 하나에 차트 하나. 시간 → line/area, 비교 → bar/hbar(정렬해서), 구성비 → donut(≤6개), 관계 → scatter.
  시계열은 `span: 2`. 제목은 "무엇을 보여 주는지", 부제에 단위.
- `tables`: 원본 전체가 아니라 판단에 필요한 열만, 집계했거나 상위 N행. 상태 열은 `badge`.
- `sections`: 데이터에서 읽은 해석·주의점. 보고서·발표 키트에서는 섹션이 글의 뼈대이므로
  섹션마다 관련 차트·표를 `charts`/`tables`로 끼워 넣어 "주장 → 근거 그림" 흐름을 만든다.
- 비율 지표(불량률·달성률·전환율)를 여러 행에서 합칠 때는 단순 평균이 아니라 분모 가중으로 다시 계산한다
  (합계 불량 ÷ 합계 생산). 어떤 방식으로 계산했는지 차트 `note`나 섹션에 한 줄 남긴다.
- 기간 경계가 잘린 구간(첫 주 5일, 마지막 주 3일 등)은 합계로 비교하면 왜곡되므로 일평균으로 바꾸거나 표시한다.
- `meta.source`에 데이터 파일명·기간을 적는다(푸터에 출처로 표시됨).
- 사이드바·내비의 로고 칸은 제목에서 숫자가 아닌 첫 글자를 쓴다. 바꾸려면 `meta.brand`(1~2자).

발표(slides·impress) 키트의 슬라이드 순서는 고정이다:
표지 → 요약(summary) → 핵심 지표(KPI 4개씩) → 섹션들 → 어느 섹션에도 속하지 않은 차트(1장씩) → 표(상위 8행) → 끝.
그래서 발표는 **섹션을 이야기 순서대로 쓰고 차트·표를 각 섹션의 `charts`/`tables`에 넣어** "메시지 제목 + 근거 그림" 한 장이 되게 한다.
섹션 제목은 주제가 아니라 결론으로 쓴다("지역별 실적" ✗ → "경기가 미달액의 절반" ✓).

키트별 분량 감각: 대시보드는 한 화면 반~두 화면, 보고서는 섹션 3~6개, 발표는 슬라이드당 메시지 하나(글머리표 ≤5개),
랜딩은 요약 3~5개 + 핵심 차트 2~4개.

### 4. 렌더링

```bash
python scripts/render.py --design <id> --spec spec.json --out output/<이름>.html [옵션]
```

| 옵션 | 쓰는 때 |
|---|---|
| `--kit dashboard·report·article·landing·slides·impress` | 디자인은 그대로, 결과물 형태만 바꿀 때 (예: Tabler 스타일의 발표 자료) |
| `--chart-lib echarts·chartjs·apexcharts·plotly·plot` | 차트 라이브러리를 함께 골랐거나 바꾸고 싶을 때 |
| `--layout sidebar·topnav` / `toc-right·docs` | 대시보드 내비 위치 / 보고서 목차 배치 |
| `--theme light·dark·system` | 처음 열 때 테마 (모든 결과물은 우측 상단 버튼으로 전환 가능) |
| `--kpi-style plain·accent·topline·solid·gradient·divider·tint` | KPI 카드 모양 |
| `--tokens '{"primary":"#1428a0"}'` | 회사·브랜드 색 등 토큰 덮어쓰기 (`{"light":{…},"dark":{…}}`도 가능) |
| `--css 파일.css` | 디자인 고유의 특징을 더 살리고 싶을 때 추가 CSS |

출력 위치는 사용자가 정하지 않았으면 현재 작업 폴더의 `output/`. 파일명은 내용이 드러나게(`2026-09-생산현황.html`).

### 5. 디자인 특징 다듬기 (필요할 때)

`references/designs.json`의 해당 디자인 `signature`를 읽고, 렌더링 결과에 빠진 특징이 눈에 띄면 `--css`로 보탠다.
예: AdminLTE의 small-box '더 보기' 띠, Material의 떠 있는 아이콘 상자, MkDocs의 admonition 아이콘.
키트·엔진 파일을 고치는 대신 디자인별 CSS로 해결하는 편이 다른 디자인에 영향을 주지 않는다.
키트 구조 자체를 바꿔야 할 정도라면 `references/kits.md`를 읽는다.

생성된 HTML을 직접 고쳐도 된다. 단 데이터는 `<script id="hc-spec">` 안의 JSON이 원본이므로
숫자를 바꿀 때는 spec(또는 build_spec.py)을 고쳐 다시 렌더링한다 — 그래야 다시 만들 때 수정이 사라지지 않는다.

### 6. 검증 — 눈으로 확인하기 전에는 끝난 것이 아니다

```bash
python scripts/check_html.py output/<이름>.html --shot --dark --height 2600   # 라이트·다크 전체 스크린샷 + 정적 검사
                                                                            # (--height는 페이지 길이에 맞게. 기본 1800이면 아래가 잘린다)
python scripts/check_html.py output/<이름>.html --online            # CDN·웹폰트 주소가 열리는지
python scripts/check_html.py output/<이름>.html --slides --dark     # 발표: 슬라이드별 스크린샷
```

스크린샷 PNG를 Read로 열어 직접 본다: 차트가 비었거나 잘리지 않았는지, 숫자 형식(억·만·%)이 맞는지,
축이 날짜를 엉뚱하게 해석하지 않았는지, 다크 모드에서 글자가 보이는지, 한글이 깨지지 않았는지.
발표(reveal) 결과물은 `--slides`로 슬라이드마다 1280×720으로 찍는다(`<이름>.slides/slide-NN.png`, 글머리표는 모두 펼친 상태,
`--dark`를 더하면 다크도). 브라우저에서 `…html?static`으로 열어도 같은 정적 모드가 된다.
문제를 찾으면 spec·옵션을 고쳐 다시 렌더링하고 다시 확인한다.

### 7. 결과 전달

짧게 보고한다:
- 만든 파일 경로(HTML·spec.json·build_spec.py)와 어떤 디자인·키트·차트 라이브러리를 썼는지
- 원본 CSS 사용인지 토큰 재현인지, 라이선스 안내(있으면)
- 데이터를 갱신하는 방법(`python build_spec.py && python …/render.py …`)
- 결과물은 CDN·웹폰트를 쓰므로 인터넷이 되는 환경에서 열어야 제 모양이 나온다는 점
  (인터넷이 없으면 차트는 자동으로 값 표로 대체되어 데이터는 보인다)

공유 페이지(Artifact)로 올리고 싶어 하면 그 요청 때 올린다. 파일로 받는 것이 기본이다.

## 판단 기준

- **데이터 정직성이 디자인보다 우선이다.** 빈칸을 채우려고 KPI·추이·비교값을 만들지 않는다. 데이터에 없는 것은 빼고,
  필요하면 "전월 데이터가 없어 증감은 표시하지 않았습니다"처럼 알린다.
- **사용자가 고른 디자인을 존중한다.** 데이터와 어울리지 않아 보여도(예: 랜딩 디자인에 표 위주 데이터) 먼저 그대로 만들고,
  더 맞는 키트를 한 줄로 제안한다(`--kit`만 바꾸면 되므로 비용이 작다).
- **유료 템플릿(Catalyst·Metronic·Salient·Radiant)** 은 원본 코드·에셋을 내려받거나 베끼지 않는다. 토큰 재현만 하고 푸터에 '스타일 참고'로 표기된다.
- 한글 글꼴은 Pretendard가 항상 대체 글꼴로 들어가 있어 영문 전용 디자인 글꼴(Inter 등)을 써도 한글이 깨지지 않는다.

## 파일 안내

| 파일 | 내용 | 언제 읽나 |
|---|---|---|
| `references/spec.md` | spec.json 형식, 차트 선택, 크기 제한 | spec을 만들 때 항상 |
| `references/designs.json` | 45개 디자인 레시피(키트·CDN·토큰·signature) | 디자인 특징을 다듬거나 새 디자인을 추가할 때 |
| `references/catalog.json` | Previewer 목록 사본(`scripts/sync_catalog.py`로 갱신) | 라이선스·설명 확인 |
| `references/kits.md` | 키트 HTML 계약(영역·슬롯·템플릿)과 새 키트 만드는 법 | 키트 구조를 바꿀 때만 |
| `assets/kits/*.html`, `assets/engine.js` | 키트 뼈대와 렌더링 엔진(결과 HTML에 인라인됨) | 직접 읽을 일은 거의 없음 |
