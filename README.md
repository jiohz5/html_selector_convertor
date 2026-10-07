# HTML Previewer + html-convertor

결과물을 HTML로 표현하기 위한 도구입니다. **페이지 하나**에서 디자인을 고르고, 내 데이터를 그 디자인의 HTML로 만듭니다.

```
① 디자인 고르기   완성도 높은 템플릿·데모 45종을 실제 데모로 비교하고 ☆로 담기
② HTML 만들기     CSV·엑셀·JSON·HTML을 넣으면 KPI·차트·표 구성 → 고른 디자인의 HTML 한 장 다운로드
```

> 현재 상태 · 동작 흐름 · 알려진 문제 · 고칠 계획: [docs/STATUS.md](docs/STATUS.md)
> 입력 형식 추가 · 디자인 유지보수 · 원본 사이트 종료 시 지원 원칙: [docs/MAINTENANCE.md](docs/MAINTENANCE.md)

## 어떻게 동작하나

데이터 → HTML은 두 단계입니다.

| 단계 | 하는 일 | 누가 |
|---|---|---|
| 판단 | 데이터를 보고 KPI·차트·표·요약을 정해 `spec.json`을 만든다 | 페이지(규칙 기반) **또는** Claude(html-convertor 스킬) |
| 렌더링 | `spec.json` + 디자인 → HTML 한 장 | 페이지(`assets/hc-render.js`)와 스킬(`render.py`) — **같은 결과** |

- **페이지에서 바로 (AI 없음)**: ② 화면에 파일을 넣거나 원문 텍스트를 붙여 넣으면 열을 판별하고(날짜·숫자·범주) 합계·평균·최근 월 비교·구분별 비중을 계산해 화면을 구성합니다. 요약은 계산한 사실만 적습니다. **데이터는 브라우저 밖으로 나가지 않습니다.**
- **원문 텍스트 입력**: 파일 업로드가 어려우면 ② 데이터 패널의 **원문 텍스트로 입력**을 펼쳐 내용을 붙여 넣습니다. 형식은 자동 감지 또는 CSV(`.csv`)·TSV(`.tsv`)·TXT(`.txt`)·JSON(`.json`)·HTML(`.html`)·HTM(`.htm`)으로 직접 선택합니다. 자동 감지는 `{`·`[`로 시작하는 JSON, `<`로 시작하는 HTML, 일관된 구분자가 있는 CSV·TSV 표를 판별하며, 애매한 본문은 형식을 선택하라고 안내합니다. 읽기 실패 시 붙여 넣은 본문은 유지하고 이전 결과는 제거합니다.
- **텍스트 입력 범위**: JSON·HTML로 판별한 내용이 깨졌을 때 CSV로 바꾸어 읽지 않습니다. 엑셀 파일의 바이너리는 붙여 넣을 수 없지만 셀을 복사한 TSV 또는 CSV는 넣을 수 있습니다. 파일 입력과 같은 읽기·집계·렌더링 경로를 사용하며 사내·외부 모델 연결은 없습니다.
- **HTML 입력**: `.html`·`.htm`의 정적 `<table>`을 읽습니다. 첫 행 또는 한 행의 `<thead>`를 머리글로 사용하며, 여러 표는 선택할 수 있습니다. `<tfoot>`은 집계에서 제외합니다. 병합 셀·중첩 표·여러 줄 머리글·행마다 열 수가 다른 표는 이유를 표시합니다. 입력 페이지의 스크립트·이벤트·외부 자산을 실행하거나 불러오지 않습니다.
- **저장 HTML 다시 쓰기**: 이 도구가 만든 HTML에 내장된 `hc-spec`이 있으면 표 추출보다 우선하여 전체 데이터를 복원합니다. 현재 선택한 디자인으로 다시 만들 수 있습니다. 일반 웹페이지의 본문·디자인·동작 전체를 복제하는 기능은 포함하지 않습니다.
- **Claude 스킬 경로**: 파생 지표·해석·보고서형 글을 포함하는 spec을 만들 수 있습니다.
  - Claude Code에서 "Previewer에서 고른 걸로 sales.csv 대시보드 만들어줘" → html-convertor 스킬이 처리
  - ② 화면의 **Claude로 문장 다듬기**는 현재 숨겨 두었으며 기존 코드는 보존합니다. 사내 모델 또는 승인된 Claude Enterprise 연계는 [후속 구현 계획](docs/superpowers/plans/2026-10-07-convertor-stabilization.md)의 미구현 항목입니다. 현재 자동 외부 전송이나 모델 API 연결은 없습니다.
  - ② 화면의 **spec.json** 저장·불러오기로 페이지 ↔ 스킬 사이를 오갈 수 있습니다.

## 쓰는 법 · 나눠 주는 법

| 방법 | 어떻게 | 언제 |
|---|---|---|
| 폴더째 | `index.html`을 브라우저로 연다 | 개발·수정할 때 |
| **파일 하나** | `python tools/build_single.py` → `dist/html-previewer.html` (약 1.7MB, 썸네일·엔진 내장) | 메일·메신저로 나눠 줄 때 |
| 정적 호스팅 | 폴더를 GitHub Pages·사내 웹서버 등에 올린다 (서버 프로그램 불필요) | 여러 사람이 주소로 들어올 때 |

인터넷이 필요한 것: 웹폰트, ①의 데모 미리보기, ②에서 엑셀 읽기(SheetJS), 결과물의 차트 라이브러리·원본 CSS.
CDN이 막힌 곳에서는 결과물의 차트가 값 표로 대체되고, 엑셀은 CSV로 저장해 넣으면 됩니다.

## 폴더

| 경로 | 내용 |
|---|---|
| `index.html` | 페이지 (① 고르기 · ② 만들기) |
| `assets/app.js` · `style.css` | ① 고르기 화면 · 공통 스타일 |
| `assets/templates.js` | 큐레이션 데이터 45종 (링크·라이선스·스타 수 확인일 2026-10-06) |
| `assets/convertor.js` | ② 만들기: 파일 읽기 · 열 판별 · 규칙 기반 spec 구성 · 미리보기 · 다운로드 |
| `assets/input-readers.js` | 입력 형식·텍스트 지원 등록 · 파일/텍스트 형식 선택 · 자동 감지 · HTML 표/내장 spec 읽기 |
| `assets/hc-render.js` | 브라우저 렌더러 (`render.py`의 `build()`를 그대로 옮긴 것) |
| `assets/convertor-bundle.js` | **자동 생성** — 스킬의 키트·엔진·designs.json 묶음 (`tools/build_bundle.py`) |
| `thumbs/` | 데모 첫 화면 썸네일 45장 |
| `html-convertor/` | Claude Code 스킬 **원본** (설치본: `~/.claude/skills/html-convertor`) |
| `tools/` | `build_bundle.py`(번들 생성) · `build_single.py`(파일 하나로 묶기) |
| `tests/convertor/` | 스킬 테스트: 회귀 렌더링 · 페이지 렌더러 비교 · 평가 시나리오 · 테스트 입력 |
| `tests/previewer/` | 페이지 브라우저 테스트 |
| `dist/` | `build_single.py` 결과 |

## 스킬 원본을 고쳤을 때 (순서대로)

이 폴더(`html/`)에서:

```bash
python tools/build_bundle.py                 # 1. 페이지용 번들 다시 만들기 (키트·엔진·designs.json 변경 반영)
node tests/convertor/parity_test.mjs         # 2. 페이지 렌더러가 render.py와 같은 결과인지 (render.py를 고쳤다면 hc-render.js도 같이)
python tests/convertor/run_regress.py        # 3. 디자인 48개 조합 렌더링·검사
python tools/build_single.py                 # 4. 파일 하나 버전 다시 만들기
# 5. 스킬 다시 설치
rm -rf ~/.claude/skills/html-convertor && cp -r html-convertor ~/.claude/skills/html-convertor          # Git Bash
# Remove-Item -Recurse -Force "$HOME\.claude\skills\html-convertor"; Copy-Item -Recurse html-convertor "$HOME\.claude\skills\html-convertor"   # PowerShell
```

`python tools/build_bundle.py --check`는 번들이 원본과 맞는지만 확인합니다(`build_single.py`도 먼저 이것을 확인합니다).

## Previewer에 템플릿을 추가·수정했을 때

1. `assets/templates.js`와 `thumbs/`를 고친다
2. `python html-convertor/scripts/sync_catalog.py` — 스킬의 목록 사본(`references/catalog.json`)을 맞춘다
3. 새 템플릿의 모양 레시피를 `html-convertor/references/designs.json`에 추가한다 (방법: `references/kits.md` 끝부분). 레시피가 없으면 같은 유형의 기본 디자인으로 대신 렌더링된다
4. 위의 "스킬 원본을 고쳤을 때" 순서를 따른다

## 테스트

```bash
node tests/convertor/parity_test.mjs                    # 페이지 렌더러 = render.py (54개 조합)
python tests/convertor/run_regress.py                   # 48개 조합 렌더링 + 정적 검사 → tests/convertor/out/regress/
python tests/convertor/run_regress.py --compare 이전결과폴더
node tests/previewer/browser_test.mjs page              # ① 고르기 화면
node tests/previewer/browser_test.mjs make              # ② 만들기 화면 (실제 엑셀·CSV 올리기 포함)
node tests/previewer/browser_test.mjs html              # HTML 입력·다중 표·spec 복원·실패 처리 (assert)
node tests/previewer/browser_test.mjs text              # 원문 텍스트·형식 감지/수동 선택·실패·연속 입력 (assert)
node tests/previewer/browser_test.mjs text dist/html-previewer.html  # 단일 파일판의 텍스트 입력
node tests/previewer/browser_test.mjs html dist/html-previewer.html  # 단일 파일판의 HTML 입력
node tests/previewer/browser_test.mjs page dist/html-previewer.html   # 파일 하나 버전
```

`tests/convertor/examples/`에는 Claude(스킬)가 만든 평가 결과(`build_spec.py`·`spec.json`·HTML)가 있습니다.
② 화면의 규칙 기반 결과와 비교해 볼 수 있습니다 — 같은 production.csv에서 총생산량 220,540·9월 -1.7%·B라인 35.4% 등 계산값이 일치합니다.

## 스크립트를 직접 쓸 때 (스킬)

```bash
S=html-convertor/scripts
python $S/resolve_design.py                                  # 최근 내보내기 파일에서 디자인 결정
python $S/profile_data.py data.csv                           # 데이터 구조 파악
python $S/render.py --design tabler --spec spec.json --out out.html
python $S/render.py --design tabler --kit slides --spec spec.json --out deck.html   # 같은 디자인, 발표 형태
python $S/check_html.py out.html --shot --dark               # 검사 + 스크린샷
python $S/render.py --list                                   # 디자인 45종·키트 6종 목록
```

## 알아두실 점

- **② 화면이 지원하는 입력**은 CSV·TSV·TXT·엑셀·JSON(레코드 배열, 한 겹 감싼 형태, spec)·HTML입니다. 등록되지 않은 확장자는 오류를 표시합니다. MD·PDF 등의 입력은 후속 작업입니다. HTML 본문이나 자바스크립트로 생성되는 표는 정적 표로 저장하거나 CSV로 내보내 주세요.
- **원본 사이트 종료**: 저장된 레시피·키트·엔진으로 계속 생성할 수 있으므로 데모 종료만으로 디자인 ID를 삭제하지 않습니다. 차트·일부 CSS·폰트의 CDN 의존성은 별도로 관리해야 합니다([유지보수 방안](docs/MAINTENANCE.md)).
- **규칙 기반 구성의 한계**: 열 사이 계산(달성률 = 매출/목표 등)은 하지 않고, 평균 지표는 행 단순 평균입니다. 합계 행·제목 행이 있는 표, 일부 기간만 있는 달은 숫자가 틀릴 수 있습니다(docs/STATUS.md P4). 열 역할이 틀리면 ② 화면의 "열 역할"에서 고치면 바로 다시 그려집니다.
- **ApexCharts**: 결과물은 MIT 라이선스인 **4.7.0으로 고정**되어 있습니다. 5.3.0 이후 버전은 연매출·예산 200만 달러 이상 조직에 상용 라이선스가 필요한 듀얼 라이선스이므로, `html-convertor/references/designs.json`의 CDN 버전을 올릴 때 확인하세요. ② 화면의 ApexCharts 경고는 아직 이 구분 없이 표시됩니다(docs/STATUS.md P6).
- Observable Plot은 막대+선 콤보 차트를 지원하지 않습니다(`html-convertor/references/spec.md`).
- 유료 템플릿(Catalyst·Metronic·Salient·Radiant)은 원본 코드 없이 모양만 재현하고 푸터에 '스타일 참고'로 표기됩니다.
- 사내 데이터로 만든 결과 HTML은 공개 호스팅에 올리지 마세요. 페이지 자체는 공개 정보(템플릿 링크)만 담고 있어 공개해도 됩니다.
