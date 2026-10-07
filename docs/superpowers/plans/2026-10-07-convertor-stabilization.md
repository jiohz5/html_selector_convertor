# HTML 변환기 안정화 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** 잘못된 입력이나 계산으로 그럴듯한 HTML을 만들지 않도록 기존 변환기를 안정화하고, 선택기와 스킬 경로를 일관되게 연결한다.

**Architecture:** 기존 `디자인 선택 → 데이터 해석 → spec.json → HTML 렌더링` 구조를 유지한다. 사용자 우선순위에 따라 HTML 표·내장 spec 입력을 먼저 구현하고, 원문 텍스트 붙여넣기를 같은 입력 경로로 추가한다. HTML은 기본 비실행 읽기를 유지하며 사용자가 선택하는 원본 렌더링·분석과 원본 유지/새 디자인 두 모드를 추가한다. 이후 입력 안정화, 집계·선택 연동·스크립트 개선, Markdown·JSONL 입력 확장을 단계별로 진행한다. 자동 생성 번들과 단일 파일은 원본에서 다시 만든다.

**Tech Stack:** JavaScript, 정적 HTML/CSS, Python, pandas, SheetJS, Node CDP 브라우저 테스트.

**Spec:** 프로젝트 루트의 `docs/STATUS.md` 4~5장과 상위 폴더의 `WORK_CONTINUATION.txt`, 2026-10-07 사용자의 HTML 우선 요청. HTML 첫 업데이트를 구현·검증했으며, 이후 Task 0~8의 처리 정책과 완료 기준은 각 단계 착수 시 검토할 계획이다.

## 목표와 적용 범위

기존 선택 화면, 데이터 변환 화면, Python 스크립트를 계속 사용하는 것이 기본 방향이다. 브라우저 변환에서 데이터는 외부로 전송하지 않는다. CSV·엑셀·JSON의 정상 흐름과 같은 spec을 두 렌더러로 표현했을 때의 일치성을 지킨다.

이번 순서는 HTML 지원을 먼저 추가하면서 관련 입력 실패를 처리하고, 이어서 기존 입력·계산·선택 흐름을 안정화하는 데 맞췄다. 디자인 45종 전체의 재설계, AI API 연결, 완전한 오프라인 패키지, 정기 갱신 자동화는 후속 작업으로 분리한다.

② 화면의 "Claude로 문장 다듬기"는 현재 숨기고 기존 기능 코드는 보존한다. 자동 외부 전송이나 모델 API 연결은 이번 변경에서 구현하지 않는다. 사내 모델 또는 승인된 Claude Enterprise 연계와 화면 재활성화는 아래 후속 항목에서 진행한다.

## Global Constraints

- 디자인 45종과 키트 6종을 보존한다. 디자인 추가는 이 계획의 범위에 포함하지 않는다.
- 기존 spec 필드와 Python·JavaScript 렌더러의 결과 일치성을 유지한다.
- `assets/convertor-bundle.js`와 `dist/html-previewer.html`은 직접 편집하지 않는다.
- Windows에서 폴더의 `index.html`과 단일 HTML 파일 모두 실행할 수 있어야 한다.
- 현재 고정된 CDN 버전은 의도적인 검토 없이 올리지 않는다. 날짜 문제도 구버전 fallback의 동작을 재현한 뒤 해결한다.
- 자동 판단을 적용하면 적용 내용·근거를 표시하고 되돌릴 수 있어야 한다. 의미가 불명확한 데이터는 경고나 선택 요청으로 처리한다.
- 테스트는 각 수정 단계에 포함한다. 마지막 단계에서 처음 테스트를 추가하지 않는다.

## Review Focus

- 정상 파일 뒤 실패한 파일을 넣거나 렌더링이 실패했을 때 이전 HTML을 다운로드할 수 없어야 한다. Task 1에서 검사한다.
- 파일 A의 읽기가 늦게 끝나도 이후 올린 파일 B의 상태가 유지되어야 한다. 일반 업로드와 spec 업로드를 교차해 Task 1에서 검사한다.
- 정상 범주 이름에 `합계`가 포함되어 있어도 자동 삭제하지 않아야 한다. Task 2에서 검사한다.
- 영업일 데이터, 일부 월, 월별 집계 데이터는 기록된 날짜 수만으로 완결성을 단정하지 않아야 한다. Task 3에서 검사한다.
- 선택 내보내기와 메모 안의 디자인 이름을 데이터나 추가 선택으로 오인하지 않아야 한다. Task 5와 Task 6에서 검사한다.

## 작업 순서

2026-10-07 사용자 우선순위 변경을 반영해 **HTML 입력 지원**, **원문 텍스트 입력**을 순서대로 추가한다. 정적 표와 우리 출력의 내장 spec, 자동 감지·수동 형식 선택을 지원하며, 관련 입력 실패 처리와 필요한 브라우저 assertion을 함께 포함한다. 입력 형식 추가 및 원본 종료된 디자인의 유지보수 원칙은 `docs/MAINTENANCE.md`를 따른다. 아래 Task 0~8은 이 입력 업데이트 이후 남은 안정화 순서다.

| 순서 | 산출물 | 관련 문제 | 다음 단계로 넘어갈 기준 |
|---|---|---|---|
| H | HTML 표·내장 spec 입력 | 사용자 최우선 요청 | 여러 표 선택, spec 보존, 실패 결과 제거, 원본 코드 미실행 회귀 통과 |
| T | 원문 텍스트 입력 | 업로드가 어려운 경우의 대체 입력 | 자동 감지·수동 형식, 본문 유지, 파일과 연속 입력, 폴더판·단일판 회귀 통과 |
| R | HTML 원본 렌더링·분석과 두 출력 모드 | 원본 동작 확인과 새 디자인 선택 | 전용 renderer 검토, 분석·원문 보존·렌더 DOM 재구성·실패 상태 회귀 통과 |
| 0 | 실패를 감지하는 로컬 테스트와 기준 결과 | 기존 검증의 한계 | 의도적인 오류가 종료 코드 1, 정상 흐름은 0 |
| 1 | 입력과 결과 상태 안정화 | P1·P2와 비동기 경쟁 | 실패·빠른 연속 업로드에서 오래된 결과가 남지 않음 |
| 2 | 머리글과 합계 행 처리 | P4 | 합계 중복 없이 KPI·차트·표·요약의 기준 행이 일치 |
| 3 | 날짜·기간·작은 증감 처리 | P4 | 일부 기간의 거짓 하락과 엑셀 날짜 밀림 제거 |
| 4 | 명시적인 디자인 선택 연동 | P3 | 자동·수동 모드, 차트 제거, 새로고침이 일관됨 |
| 5 | Python 입력과 디자인 해석 안정화 | P5 | JSON·BOM·메모·여러 파일 오류 처리 회귀 통과 |
| 6 | 표 입력 확장과 선택 내보내기 가져오기 | A·B·D의 확장 항목 | MD·JSONL 처리와 HTML 회귀 유지, 선택 파일을 데이터로 집계하지 않음 |
| 7 | 실제 사용 버전에 맞는 라이선스 안내 | P6 | 브라우저·스킬·빌드의 안내 기준 일치 |
| 8 | 단일 파일 재생성과 최종 검증 | F와 배포 | 폴더판·단일판 기능 및 렌더러 회귀 통과 |

## 현재 로컬 실행 조건

Python 3.10.9, Node 24.19.0, pandas·openpyxl·Pillow, Edge·Chrome을 확인했다. 기존 브라우저 테스트가 사용하는 Edge 경로와 Node WebSocket도 사용할 수 있다. ZIP 기반 로컬 작업 이력은 `html-input` 브랜치와 기준 커밋 `550133a`에 보존했다. GitHub `jiohz5/html_selector_convertor`의 `main` 기준 커밋 `98b8fa7`에 변경을 연결한 작업 브랜치는 `codex/html-input`이다. 원본 ZIP은 상위 폴더에 보존되어 있다. 테스트 output 폴더는 `.gitignore`로 추적에서 제외한다.

2026-10-07 로컬에서 번들 일치, 렌더러 비교 54건·정적 검사 48건, 기존 make 브라우저 흐름, 폴더판·단일판 HTML 입력 회귀를 새로 실행해 통과했다. Task 0에서는 기존 page·make 흐름의 assertion과 시간 초과 검사를 확장한다. 모든 실행 명령의 작업 폴더는 `html_selector_convertor-main`이다.

## HTML 첫 업데이트

**Files:** Create `assets/input-readers.js`; Modify `assets/convertor.js`, `index.html`, `README.md`; Test 브라우저 `html` 모드와 `tests/convertor/fixtures/html-input/`; Regenerate `dist/html-previewer.html`.

**Interfaces:** reader는 `{id, extensions, label, read}`를 정의하고 표/spec을 반환한다. 동일 등록 목록에서 accept와 화면 안내를 만든다. HTML은 `{kind:'html', name, tables, tableId}` 또는 기존 spec 입력으로 정규화한다. 표 선택은 workbook 시트 선택과 공통 sourceTable 경로를 사용하며 화면에 `표`로 표시한다.

- [x] HTML 표 입력의 실패 테스트와 정확한 열·값·총합 300을 확인한다.
- [x] HTML·HTM을 명시적으로 판별하고 분리된 비활성 영역에서 데이터만 읽는다.
- [x] 여러 표 선택, 정적 표 머리글·빈 셀·줄바꿈과 내장 spec 복원을 구현한다.
- [x] 중첩·병합·잘못된 폭·손상 spec은 처리 범위를 설명하고 오래된 결과를 제거한다.
- [x] 원본 script·이벤트·외부 자산이 입력 과정에서 실행·요청되지 않음을 검사한다.
- [x] 폴더판·단일판 HTML 회귀, 기존 CSV·엑셀 흐름, 렌더러 일치·정적 검사와 화면을 확인한다.

검증 기록: HTML 모드의 27개 기능 그룹이 두 배포 형태에서 통과했다. JSON·spec 전용 업로드와 세 가지 지연 입력 경쟁도 포함한다. 리뷰에서 발견한 문자열 summary·null 영역·meta 전용 spec 호환성 및 null 배열 원소 거부는 실패 회귀를 추가한 뒤 수정했다. 다중 표 선택 화면과 기존 모바일 화면을 확인했다. 기존 make 테스트의 전체 assertion화·CDP 응답 시간 초과 처리는 Task 0에 남긴다.

HTML 첫 업데이트는 표·spec 데이터 읽기에 집중했다. 일반 HTML의 본문 활용과 원본 동작 보존은 아래 원본 렌더링·두 모드 작업에서 추가한다. 우리 저장 HTML의 spec을 읽으면 내용을 유지하며 현재 선택한 디자인으로 다시 렌더링한다.

## 원문 텍스트 업데이트

데이터 패널의 접기 영역에서 원문을 붙여 넣고 자동 감지 또는 CSV·TSV·TXT·JSON·HTML·HTM 형식을 선택한다. 텍스트 지원 정보와 감지 함수는 reader에 등록하고 형식 선택 목록도 같은 목록에서 만든다. 엑셀은 셀을 복사한 TSV·CSV로 입력한다.

파일과 텍스트는 공통 loadSource 경로에서 이전 결과를 제거하고 입력 세대를 확인한다. 애매한 텍스트는 형식 선택을 요청하며 손상 JSON·HTML을 CSV로 다시 읽지 않는다. 실패해도 원문은 남는다. 숫자 집계·렌더링·외부 모델 연계 범위는 바꾸지 않는다.

- [x] 텍스트 입력 실패 회귀를 먼저 확인하고 폼과 자동·수동 형식 처리를 구현한다.
- [x] CSV·TSV·TXT·JSON·HTML·HTM 입력과 원문 유지, 실패 결과 제거를 검증한다.
- [x] 빈 첫 머리글·마지막 빈 TSV 열의 감지 실패를 재현하고 값을 보존하도록 수정한다.
- [x] 따옴표 안 세미콜론·탭·줄바꿈이 있는 CSV 머리글의 실패 7건을 재현하고 파일·텍스트 공통 구분자 감지를 수정한다.
- [x] 파일과 텍스트의 양방향 지연 읽기 경쟁, HTML 내장 spec과 다중 표 선택을 검증한다.
- [x] 데스크톱·모바일 화면과 폴더판을 확인한다.
- [x] 단일 파일을 재생성하고 폴더판·단일판 텍스트 회귀 32개씩과 기존 HTML 입력 27개를 확인한다.
- [x] 코드 검토에서 발견한 문제의 해결을 독립 브라우저에서 확인한다.

원문 텍스트 입력의 초기 발행 대상은 `codex/html-input`이었다. 현재 변경은 사용자 요청에 따라 `main`에 병합하며 이후 작업도 `main`에서 이어간다.

## HTML 내장 JSON 보완

원본 JavaScript가 표를 채우는 HTML은 원문에 데이터 행이 없어 정적 표 추출만으로 읽을 수 없다. 인라인 `application/json`의 객체 경로에서 레코드 배열을 찾아 정적 표와 같은 데이터 선택 목록으로 제공한다. 기본 선택은 기존 spec, 유효한 정적 표, 유효한 JSON 순서다. 레코드 안의 배열·객체는 셀 JSON 문자열로 보존하며 원본 계산·입체 뷰어 동작을 복제하지 않는다.

- [x] 빈 tbody와 내장 레코드의 실패를 재현한 뒤 공통 HTML reader를 보완한다.
- [x] 여러 데이터 선택, 셀 보존, 후보 오류, spec·표 우선순위, 원본 코드 미실행을 검증한다.
- [x] 특수 JSON 키의 열 이름 변경과 누락 칸 오염을 재현하고 원문 키·null을 보존하도록 수정한다.
- [x] 501번째 행에서 처음 등장한 열과 앞 행의 null 보존을 검증한다.
- [x] 실제 첨부의 파일·자동 감지·HTML 지정 입력에서 두 레코드 목록을 확인한다.
- [x] 단일 파일을 재생성하고 기존 HTML·텍스트 회귀를 확인한다.
- [x] 별도 코드 검토에서 발견한 문제의 해결을 확인한다.

내장 JSON 회귀는 폴더판·단일판 16개 그룹씩 통과했다. 단일판의 실제 첨부 파일·자동 감지·HTML 지정 입력 3개 경로도 통과했다. 기존 HTML 27개·텍스트 32개 그룹은 두 배포판에서 통과했고 make의 엑셀·CSV·다운로드·spec·모바일도 확인했다.

## HTML 원본 렌더링·분석과 두 출력 모드 — 완료

기본 HTML 입력은 정적 표·내장 JSON·`hc-spec`을 읽으며 원본 코드를 실행하지 않는다. HTML 입력 패널에서 사용자가 **원본 렌더링·분석**을 선택하면 전용 격리 renderer에서 원본을 렌더링하고 원본 미리보기와 분석을 제공한다. 기존 결과 미리보기 frame은 이 작업에 재사용하지 않는다.

분석은 제목·머리글·본문과 표·SVG·canvas 수를 제공한다. 원문 HTML과 렌더링된 DOM은 별도로 보관한다. **원본 유지**의 파일 다운로드는 원본 File Blob을 사용하여 BOM·문자 인코딩 바이트와 원본의 배치·코드·동작을 보존한다. 붙여 넣은 원문은 UTF-8 BOM을 붙여 저장하여 legacy charset 선언보다 입력한 Unicode 텍스트의 인코딩을 우선한다. **다른 느낌(새 디자인)**은 유효한 렌더 DOM 표를 내장 spec·JSON보다 먼저 읽어 기존 parser·profile·spec·renderer 경로로 재구성한다. 없으면 유효 spec → 내장 JSON → 제목·본문 기반 spec 순서로 사용한다. 표 태그가 있어도 읽을 데이터 표가 없고 본문이 있으면 수치 집계 없이 본문을 사용하고 parser 사유를 표시한다. 기본 비실행 읽기의 `hc-spec` 우선 복원·손상 오류 계약은 유지한다. 새 디자인으로 원본의 임의 SVG·canvas·조작 기능까지 자동 재현하는 것은 이 작업의 범위에 포함하지 않는다.

기본 collector는 `DOMContentLoaded` 후 초기 2초 대기와 본문·표의 800ms 안정화를 확인하며 전체 제한 시간은 8초다. 초기 화면을 읽는 휴리스틱으로, 늦게 추가되는 비동기 데이터의 완결성을 보장하지 않음을 화면에 안내한다.

기본 읽기와 새 디자인 적용은 손상 `hc-spec`에 오류를 표시하며 다른 표·JSON·본문으로 대체하지 않는다. 렌더 DOM 표 우선 선택은 유효 spec이 있거나 spec 표식이 없는 HTML에 적용한다. 원본 유지의 원문 저장은 별도 경로이며 분석 결과를 확인한 뒤 그대로 보존할 수 있다.

원본 외부 통신은 제한한다. 온라인 자산·API·storage에 의존하는 페이지는 분석이나 미리보기에서 일부 기능이 동작하지 않을 수 있음을 알린다. 원문 출력에도 이 의존성이 남으며 외부 자산을 자동 내장하는 보존 패키지를 뜻하지 않는다. 바깥·안쪽 frame 모두 `sandbox="allow-scripts"`를 사용하고 `allow-same-origin`을 허용하지 않으며, 바깥 frame의 CSP에는 `frame-src 'none'`을 포함한다. 외부 통신도 CSP로 제한한다. Chromium 기반 Edge의 `file://`와 HTTP 독립 probe에서 원본 navigation·외부 통신·부모 DOM 접근 차단을 확인했으며 실제 renderer 모듈의 폴더판·단일판 합성 회귀 19개 그룹을 각각 통과했다. 다른 브라우저·실행 환경은 추가 검증이 필요하다. 무한 루프의 강제 중단을 보장하지 않는다. 모델 API 연계를 추가하지 않으며 문장 다듬기는 숨김 상태를 유지한다.

원본 유지 모드는 새 창 열기를 비활성으로 두고 HTML 다운로드로 저장해 사용한다. 원본이 부모 권한으로 실행되는 경로를 제공하지 않는다.

- [x] 별도 예시 HTML로 원본 script가 표·SVG를 만드는 경우와 표 없는 본문을 준비하고 실패 회귀를 추가한다. 첨부 원문·파일명·실제 수치를 저장소 문서나 fixture에 넣지 않는다.
- [x] 기본 비실행 읽기를 유지하면서 HTML 원문을 보관하고, 원본 렌더링·분석 선택 동작과 전용 renderer를 추가한다.
- [x] 독립 probe로 확인한 중첩 sandbox와 CSP 구성을 실제 모듈에 반영하고 통합 회귀를 검증한다. 페이지 의존성 안내와 렌더링 취소·오류 정리를 구현하며 강제 중단 보장은 표시하지 않는다.
- [x] 원본 미리보기, 제목·머리글·본문, 표·SVG·canvas 수를 제공하고 렌더 DOM을 기존 데이터 parser에 전달한다.
- [x] 원본 유지 모드에서 새 디자인·토큰을 적용하지 않는지 검사한다. 새 창 열기는 비활성으로 유지하고 파일 원본의 BOM·인코딩 바이트 보존과 붙여넣기의 UTF-8 BOM 다운로드를 확인한다.
- [x] 새 디자인 모드에서 유효 렌더 DOM 표 → 유효 spec → 내장 JSON → 본문 순서와 공통 spec·renderer 경로를 검사한다. 읽을 데이터 표가 없으면 수치 집계 없이 본문을 사용하고 parser 사유를 표시한다. 기본 비실행 spec 복원 계약과 기본 읽기·새 디자인 적용의 손상 spec 오류·대체 금지 계약을 유지하고 원본 보존 경로를 구분한다.
- [x] 모드 전환·원문 교체·지연 렌더링·실패 시 오래된 분석과 결과가 남지 않도록 입력 세대와 결과 상태를 검사한다.
- [x] 원문 보존, 독립 기대값의 렌더 표, 본문 spec, 원본 코드 비실행 기본 경로, 외부 통신 제한과 두 모드 다운로드를 검증한다. 초기 지연 표 생성과 2초 대기·800ms 안정화·8초 제한 시간 및 늦은 비동기 작업의 한계 안내를 확인한다.
- [x] 폴더판·단일판을 재생성·검증하고 실제 확인한 결과와 지원 한계만 README·STATUS에 기록한다.

검증: `node tests/previewer/browser_test.mjs render`와 단일판의 합성 19개 그룹, 로컬 첨부의 선택적 3개 경로가 각각 통과했다. 기존 HTML 27개·텍스트 32개·내장 JSON 16개 그룹의 폴더판·단일판과 make 흐름도 통과했다. `python tools/build_single.py`, 번들 원본 일치 검사와 JavaScript 문법 검사를 확인했다. 입력·집계 안정화 Task 0~8의 미완료 항목은 이어서 진행한다.

## Task 0 로컬 테스트를 완료 기준으로 만들기

**Files:** Modify `tests/previewer/browser_test.mjs:241-342,394-405`; Create `tests/convertor/fixtures/stabilization/README.md`; Modify `docs/STATUS.md` 검증 기록.

**Interfaces:** 기존 `evaluate(expression)`와 CDP 파일 업로드를 유지한다. `waitFor(expr, ms)`는 시간 초과 시 예외를 던진다. 테스트용 `regress` 모드를 추가하고, 오류가 있으면 종료 코드 1을 반환한다. 의도적인 assertion 실패를 확인하는 `--assert-failure` 옵션은 브라우저 시작 전 종료한다. 테스트 공통 함수 `uploadText(name, content): Promise<void>`와 `resultState(): Promise<object>`를 추가한다. resultState는 기존 `HC.make.state`·PreviewerApp·DOM에서 `{html, spec, source, design, chartLib, effectiveChartLib, selectionMode, picked, notes, downloadDisabled, openDisabled, previewEmpty}`를 읽는다. chartLib은 상태의 override이고 effectiveChartLib은 override 또는 디자인 기본값으로 정한 실효 라이브러리다. 이후 코드 예시의 `result`는 이 함수의 반환값이고 assertion은 Node `assert/strict`를 사용한다.

- [ ] **Step 1:** 실패 상태 검사부터 추가한다. `--assert-failure` 실행은 return code 1, 정상 `page`·`make` 실행은 0이어야 한다. 카드 수 `45`, 선택 IDs, 샘플의 `result.html.length > 0`과 spec 생성, 다운로드·spec 재불러오기를 로그 대신 assertion으로 확인한다.
- [ ] **Step 2:** 기존의 무조건 `process.exit(0)`과 시간 초과 `-1` 반환이 실패 검사를 통과하지 못하는 것을 확인한다.
- [ ] **Step 3:** 실패 종료 코드, 시간 초과 예외, 정상 흐름 assertion을 구현한다. 테스트마다 독립 브라우저 프로필을 사용하고 테스트가 만든 프로세스만 정리한다.
- [ ] **Step 4:** 아래 기준 명령을 실행하고 실제 출력·실패·외부 CDN 접근 제한을 구분해서 기록한다.

```powershell
python tools/build_bundle.py --check
node tests/convertor/parity_test.mjs
python tests/convertor/run_regress.py --out tests/convertor/out/baseline
node tests/previewer/browser_test.mjs page
node tests/previewer/browser_test.mjs make
node tests/previewer/browser_test.mjs --assert-failure
```

**Expected:** 마지막 명령만 의도적으로 종료 코드 1. 나머지는 실패 0이어야 한다. 기존 코드에서 드러난 실패는 원인을 기록한 뒤 수정 대상에 배정한다. 외부 데모 전체를 캡처하는 `embed`는 기본 완료 기준에서 제외한다.

## Task 1 입력 실패와 오래된 결과 제거

**Files:** Modify `assets/convertor.js:107-148,730-756,788-842,901-909`; Modify `index.html:149-160`; Test `tests/previewer/browser_test.mjs`의 `regress` 모드와 `fixtures/stabilization/`.

**Interfaces:** 기존 `window.HC.make.ingest(file)`를 유지한다. 내부 `clearResult(message = '')`를 도입해 source·table·cols·spec·html과 화면 결과를 일관되게 비운다. 일반 파일과 spec 전용 입력이 하나의 요청 번호를 공유한다. 읽기·렌더링 완료 시 현재 번호가 아니면 상태를 변경하지 않는다.

- [ ] **Step 1:** 정상 CSV 이후 깨진 JSON·PDF·DOCX·이미지·일반 문장을 각각 넣는 테스트를 작성한다. 핵심 assertion은 다음과 같다.

```javascript
const result = await resultState();
assert.equal(result.html, '');
assert.equal(result.spec, null);
assert.equal(result.downloadDisabled, true);
assert.equal(result.openDisabled, true);
assert.equal(result.previewEmpty, true);
```

- [ ] **Step 2:** 현재 코드에서 이전 결과가 남는 실패를 확인한다. 느린 A→빠른 B→A 성공/실패, 일반 파일↔spec 파일, 예약된 렌더링→입력 실패, `HC.build` 실패도 재현한다.
- [ ] **Step 3:** 확장자 허용 목록과 파일 내용 검사를 적용한다. `.txt`는 구분자로 구성된 표만 지원한다. HTML은 첫 업데이트의 지원 범위를 유지하고, MD 등 추가 형식은 Task 6까지 처리 안내와 함께 거부한다. UTF BOM이 있는 정상 텍스트를 바이너리로 오인하지 않는다.
- [ ] **Step 4:** spec·선택 내보내기·레코드 데이터를 구분한다. 선택 내보내기는 이 단계에서 데이터로 읽지 않고 가져오기 안내를 표시한다. JSON 오류 문구는 실제 필요한 입력 형태를 설명한다. 모든 데이터·spec 교체 경로에서 예약된 렌더링과 기존 다운로드 상태를 무효화한다. Task 6의 선택 가져오기 전용 분기는 데이터 교체와 분리한다.
- [ ] **Step 5:** `node tests/previewer/browser_test.mjs regress` 실행. 실패 뒤 결과 제거, B의 상태 유지, 기존 정상 CSV·spec 동작을 함께 확인한다.

## Task 2 머리글과 집계 기준 행 바로잡기

**Files:** Modify `assets/convertor.js`의 `tableFromRows`, `sheetTable`, `profile`, `buildSpec`, `useTable`, `regenerate`; Modify `index.html`·`assets/style.css`의 입력 확인 영역; Test 브라우저 `regress`와 CSV·엑셀 fixture.

**Interfaces:** `{columns, rows}` 표 구조와 `buildSpec(model)`을 유지한다. 원본 행과 사용자 입력 보정값을 보존하고, 머리글 선택·제외 행을 적용한 표 하나를 profile과 buildSpec에 전달한다. KPI·차트·표·요약이 같은 표를 사용하도록 한다.

- [ ] **Step 1:** 제목 행+빈 행+머리글+숫자 100·200, 합계 300이 있는 입력을 작성한다. 머리글이 올바르고 총합이 300, 집계 범주에 합계가 없음을 검사한다.

```javascript
assert.equal(result.spec.kpis.find(k => k.label === '총 생산량').value, 300);
assert.equal(JSON.stringify(result.spec.charts).includes('"합계"'), false);
```
- [ ] **Step 2:** 현재 코드의 잘못된 머리글 또는 600 집계를 확인한다. 정상 범주 `합계관리팀`, 빈 값, 평균 열, 부분 소계도 함께 넣는다.
- [ ] **Step 3:** 머리글 후보와 선택한 행을 표시하고 사용자가 바꿀 수 있게 한다. 자동 제외는 별도 행의 정확한 합계 표기와 실제 상세 합계가 일치하는 단순한 경우부터 적용한다. 불명확한 소계는 검토 대상으로 표시하고 명시적인 제외 선택을 받는다. 단어의 부분 일치만으로 행을 삭제하지 않는다.
- [ ] **Step 4:** 포함·제외 행 수와 적용 근거를 화면 및 spec 참고 항목에 남긴다. 합계 행만 있는 데이터는 상세 자료가 있는 것처럼 추정하지 않는다.
- [ ] **Step 5:** `node tests/previewer/browser_test.mjs regress` 실행. 제외를 되돌리면 집계가 다시 바뀌고, 화면·다운로드 spec에 동일한 값이 반영되어야 한다.

## Task 3 날짜와 기간 비교의 의미 맞추기

**Files:** Modify `assets/convertor.js`의 `readFile`, `normalizeCell`, `autoGran`, `buildSpec`; 필요 시 두 렌더러의 표시 코드도 함께 수정; Test `fixtures/stabilization/`와 브라우저 `regress`.

**Interfaces:** 기존 spec의 KPI `delta`, `deltaDecimals`, `deltaSuffix`, `hint`를 사용한다. 내부 비교 정보는 기록 범위·관측 날짜 수·완결 판단을 분리한다. 비교 근거가 부족하면 delta를 생략하고 이유를 표시한다.

- [ ] **Step 1:** 같은 일 생산량의 8월 전체·9월 22일까지, 완결된 두 달, 영업일만 있는 자료, 월별 한 행, 주별 자료를 검사한다. 일부 월에 전체 월과 비교한 약 −29%가 나타나지 않아야 한다.
- [ ] **Step 2:** 100000→100032 비교를 추가한다. 원래 계산 변화율 0.032%를 보존하고 화면은 소수 2자리의 0.03%로 표시한다. 퍼센트 지표의 차이는 기존 `%p`를 유지한다.

```javascript
const change = result.spec.kpis.find(k => k.deltaLabel);
assert.ok(Math.abs(change.delta - 0.032) < 1e-9);
assert.equal(change.deltaDecimals, 2);
```
- [ ] **Step 3:** 70% 날짜 수 규칙을 제거한다. 달력상 기간 경계·입력 간격·누락을 확인하고, 영업일이나 불명확한 표는 완결된 기간으로 단정하지 않는다. 필요할 때 관측 날짜 기준 일평균을 보조 정보로 표시한다. 주별 차트와 KPI의 단위도 맞춘다. `2026-02-31`이 다른 달의 날짜로 조용히 변환되지 않도록 연·월·일 왕복 검증과 잘못된 날짜 안내를 추가한다. 값 0~1이라는 이유만으로 비율을 임의로 100배 하지 않고 입력 단위를 확인한다.
- [ ] **Step 4:** SheetJS 공식 경로와 fallback 경로를 각각 강제로 사용해 Asia/Seoul 날짜 fixture를 재현한다. 날짜 셀의 달력 날짜를 serial 값 등 검증 가능한 기준으로 보존하고 두 경로에서 `2026-09-01`이 같음을 검사한다. 검증되지 않은 고정 시간 덧셈으로 보정하지 않는다.
- [ ] **Step 5:** `node tests/previewer/browser_test.mjs regress` 실행. 라이브러리 차단 시에도 날짜가 잘못된 성공 결과 대신 명확한 실패나 검증된 대안을 제공해야 한다.

## Task 4 선택기와 변환기의 자동 연동 복구

**Files:** Modify `assets/convertor.js:609-617,654-680,935-997`; Modify `assets/app.js:388-392,652-655`; Modify `index.html`·`assets/style.css`; Test 브라우저 `page`·`regress`.

**Interfaces:** 자동 모드를 켜고 끄는 내부 `setSelectionMode(mode)`를 추가한다. mode는 `auto` 또는 `manual`이고 상태·저장의 기준은 `st.selectionMode`다. 기존 저장된 `designChosen` 값은 모드로 변환한다. `PreviewerApp.ensureSelected(id)`는 이미 선택된 항목과 메모를 유지하며 없을 때만 추가한다.

- [ ] **Step 1:** ② 직접 디자인 선택→① 선택 변경→자동 모드 복귀, 차트 선택→차트 제거, 선택 전체 비우기, 선택 패널 만들기→새로고침을 검사한다.

```javascript
assert.equal(result.selectionMode, 'auto');
assert.equal(result.design, 'tabler');       // 선택 전체를 비운 뒤
assert.equal(result.chartLib, '');           // 기본 차트로 복귀
assert.deepEqual(result.picked, []);
```
- [ ] **Step 2:** 자동 모드로 복귀할 수 없고 차트 값이 남는 현재 실패를 확인한다. 모달 만들기를 이미 선택된 항목에 눌러도 메모와 선택 1개가 유지되어야 한다.
- [ ] **Step 3:** 화면에 `① 선택 자동 적용` 상태와 복귀 동작을 제공한다. 수동 디자인·차트 변경은 manual로 처리한다. 자동 모드는 현재 선택에서 매번 디자인과 차트를 계산하며, 선택이 없으면 Tabler+기본 차트로 돌아간다. 제거된 차트 override를 지운다.
- [ ] **Step 4:** 선택 패널 만들기는 auto를 켜고 저장한다. 모달 만들기는 항목을 선택함에 보장한 뒤 적용한다. 메모 수정으로 수동 설정을 덮어쓰지 않는다. 메모는 `자동 변환에서는 참고 표시, Claude 경로에서는 요청에 반영`이라고 안내한다.
- [ ] **Step 5:** `node tests/previewer/browser_test.mjs page`와 `regress` 실행. 새로고침 전후 모드·디자인·차트·메모가 일치해야 한다.

## Task 5 Python 입력과 디자인 해석 안정화

**Files:** Modify `html-convertor/scripts/profile_data.py:30-54,142-165`; Modify `html-convertor/scripts/resolve_design.py:46-93,105-120`; Modify `html-convertor/SKILL.md`; Create `tests/convertor/test_inputs.py`; Add JSON·BOM·메모 fixture.

**Interfaces:** `read_any(path, sheet)`와 `profile_frame(name, df, max_cat)`의 기존 반환 계약을 유지한다. CLI는 기존 단일 결과 객체·복수 결과 배열 형태를 유지하며, 실패 항목에는 `file`과 `error`를 담는다. 일부 파일 실패는 정상 파일 출력까지 중단하지 않고 전체 종료 코드는 1로 한다.

- [ ] **Step 1:** Python unittest로 레코드 배열, `{rows:[...]}`, `{data:{items:[...]}}`, 객체 칸·배열 칸, spec, 정상+실패 파일 동시 입력을 작성한다. 공통 기대값은 아래와 같다.

```python
self.assertEqual(valid_profile['rows'], 2)
self.assertIn('error', failed_profile)
self.assertNotIn('Traceback', completed.stderr)
self.assertEqual(completed.returncode, 1)  # 일부 입력 실패
```

- [ ] **Step 2:** BOM JSON에서 선택이 Tabler 하나이고 `echarts로 변경하지 말기\n두 번째 메모`가 온전히 남아야 한다. Markdown 여러 줄 메모도 다음 항목 전까지 보존한다. 현재 오인식·메모 유실을 확인한다.
- [ ] **Step 3:** read_any에 명시적인 지원 형식 분기를 넣어 미지원 파일이 CSV fallback으로 들어가지 않게 한다. JSON을 분류한 뒤 정규화한다. 단일 레코드 배열을 가진 wrapper는 해석하고 객체 칸은 열로 펼친다. 배열 칸을 임의로 여러 데이터 행으로 늘리지 않는다. 서로 다른 배열이 있어 경로가 모호하면 설명 가능한 오류를 반환한다. 빈 배열·혼합 원소도 분명한 오류로 처리한다. spec은 render 경로로 안내한다. cardinality 계산과 파일별 profile 처리까지 예외 범위에 포함하고, `read_any`의 `SystemExit`를 파일별로 처리할 수 있는 일반 입력 예외로 바꾼다. 추가 엔진이 필요한 XLS·Parquet 입력은 엔진 누락을 파일별 오류와 설치 안내로 처리한다.
- [ ] **Step 4:** BOM을 제거한 구조화 입력을 먼저 처리하며 유효한 JSON을 자유 텍스트로 재탐색하지 않는다. 최근 선택 파일 자동 탐색은 사용 경로를 사용자용 stderr에도 표시하고 명시 경로가 항상 우선한다.
- [ ] **Step 5:** `python -m unittest discover -s tests/convertor -p "test_inputs.py" -v` 실행. JSON만 읽는 소비자를 위해 안내는 stdout JSON에 섞지 않는다.

## Task 6 표 입력과 선택 내보내기 가져오기

**Files:** Modify `assets/convertor.js`의 분류·표 읽기; Modify `assets/app.js`의 내보내기와 `PreviewerApp`; Modify `html-convertor/scripts/profile_data.py`, `resolve_design.py`, `html-convertor/SKILL.md`; Modify `index.html`·README 입력 안내; Test 브라우저 `regress`·Python `test_inputs.py`.

**Interfaces:** 브라우저 `readFile(file)`에 `{kind:'selection', name, items}` 분류를 추가한다. `PreviewerApp.importSelection(items)`는 검증한 `{id, memo}` 배열의 순서를 보존해 선택 목록을 교체하고 저장·선택 이벤트를 발생시킨다. JSON 내보내기는 식별용 format/version을 추가하되 기존 파일도 읽는다. Markdown에 명시 ID를 추가하고 기존 데모 URL·이름 기반 형식과 호환한다.

- [ ] **Step 1:** `table.md`, `report.md`, `table.html`, `multiple-tables.html`, `records.jsonl`, `nested.json`, 새·기존 선택 내보내기를 작성한다. 표 fixture의 두 숫자 100·200은 총합 300이어야 한다. 보고서 글은 KPI를 만들지 않아야 한다.

```javascript
assert.deepEqual(result.picked.map(item => item.id), ['tabler']);
assert.equal(result.picked[0].memo, 'echarts로 변경하지 말기\n두 번째 메모');
assert.deepEqual(result.spec, specBeforeSelectionImport);
```
- [ ] **Step 2:** Task 1의 명시적인 미지원 상태에서 MD·JSONL 지원 추가 테스트가 실패함을 확인한다. 첫 업데이트에서 추가한 HTML 입력 회귀는 계속 통과해야 한다. 선택 파일은 reference metadata를 데이터 행으로 읽지 않아야 한다.
- [ ] **Step 3:** MD 표는 구분선과 escaped pipe를 처리한다. HTML 첫 업데이트의 표·내장 spec 경로를 유지하고 Python 입력 확장을 같은 fixture로 검증한다. HTML 원본 script·스타일을 실행하거나 결과에 복사하지 않으며, 여러 표 선택과 복잡한 병합 셀의 명확한 거부 안내를 유지한다.
- [ ] **Step 4:** JSONL과 단일 레코드 배열의 wrapper를 브라우저에서 지원한다. Python과 동일한 fixture·열 이름 규칙을 사용한다. 중첩 객체는 점 경로로 펼치되 기존 키와 충돌하면 오류로 처리하며, 다수 레코드 배열 중 하나를 임의로 고르지 않는다.
- [ ] **Step 5:** 선택 가져오기는 일반 데이터 입력과 구분한다. 성공하면 데이터·기존 spec을 비우지 않고 선택 목록·메모·디자인만 갱신하고 auto 모드를 켠다. 없는 ID·빈 목록·잘못된 형식은 기존 선택을 유지하고 오류를 알린다. 정상 항목을 일부만 조용히 적용하지 않는다. 위 `specBeforeSelectionImport`는 가져오기 전 resultState로 읽은 spec이다.
- [ ] **Step 6:** 브라우저 `regress`와 Python `test_inputs.py` 실행. CSV·엑셀·기존 spec, 기존 선택 내보내기, BOM·메모 보존을 함께 확인한다.

## Task 7 차트 라이선스 안내를 버전 기준으로 정리

**Files:** Modify `assets/hc-render.js:200-214`; Modify `assets/convertor.js:739-741`; Modify `assets/templates.js`, `html-convertor/references/catalog.json`의 관련 설명; Modify `html-convertor/scripts/resolve_design.py`, `tools/build_bundle.py`; Test `tests/convertor/test_inputs.py`·브라우저 `regress`.

**Interfaces:** 실제 chartLib와 `references/designs.json`의 고정 버전을 기준으로 안내한다. 직접 선택한 차트와 디자인 기본 차트에 같은 검사를 적용한다. 빌드는 검토된 버전에서 달라졌을 때 명확한 검토 안내를 내보낸다.

- [ ] **Step 1:** 현재 배포에 고정된 `apexcharts@4.7.0`과 다른 버전 fixture, 직접 선택·디자인 기본 선택을 검사한다. 브라우저와 Python의 실효 차트·버전 안내가 일치해야 한다.

```javascript
assert.equal(result.effectiveChartLib, 'apexcharts');
assert.match(result.notes, /4\.7\.0/);
```
- [ ] **Step 2:** 현재 과도한 경고와 Python 기본 차트 검사 누락을 확인한다. 구현 시 배포 파일의 라이선스·공식 문서로 정확한 버전 조건을 확인한다.
- [ ] **Step 3:** 카드가 설명하는 최신 제품과 실제 결과물에 포함되는 버전을 구분해 안내한다. 안내 메시지 문자열에 `ApexCharts`가 있다는 이유만으로 변경 버튼을 붙이는 방식도 수정한다. 라이브러리 기본값을 이 작업만으로 바꾸지 않는다.
- [ ] **Step 4:** 해당 fixture 검사, `python tools/build_bundle.py`, `node tests/convertor/parity_test.mjs` 실행. 변경 버전의 안내와 실제 번들이 일치해야 한다.

## Task 8 배포본 재생성과 전체 회귀

**Files:** Regenerate `assets/convertor-bundle.js`, `dist/html-previewer.html`; Modify `README.md`, `docs/STATUS.md`; Test 모든 변경 단계의 fixture와 기존 테스트.

**Interfaces:** 원본→번들→단일 HTML 빌드 순서를 지킨다. 브라우저 테스트 `regress`도 기존 pagePath 인자를 받아 폴더판·단일판에 같은 assertion을 적용한다.

- [ ] **Step 1:** 새 테스트가 지원 형식·실패 입력·계산·선택·스크립트 문제를 각각 검사하는지 확인한다. README의 지원 형식과 실제 동작이 같아야 한다. 단일판에도 Task 1의 실패 상태와 Task 2의 `총 생산량 === 300` assertion을 먼저 실행해 배포본 누락을 발견한 뒤 재생성한다.
- [ ] **Step 2:** 아래 명령을 실행한다. 렌더러 비교와 정적 검사는 현재 카탈로그 기준 모든 조합이 통과하고 브라우저 검사는 assertion·콘솔 예외가 0이어야 한다.

```powershell
python tools/build_bundle.py
python tools/build_bundle.py --check
python -m unittest discover -s tests/convertor -p "test_inputs.py" -v
node tests/convertor/parity_test.mjs
python tests/convertor/run_regress.py
node tests/previewer/browser_test.mjs page
node tests/previewer/browser_test.mjs make
node tests/previewer/browser_test.mjs regress
python tools/build_single.py
node tests/previewer/browser_test.mjs page dist/html-previewer.html
node tests/previewer/browser_test.mjs make dist/html-previewer.html
node tests/previewer/browser_test.mjs regress dist/html-previewer.html
```

- [ ] **Step 3:** 단일 파일을 별도 빈 폴더로 복사해 열고, 폴더의 외부 assets가 없어도 정상 입력·오류 처리가 같은지 확인한다. 모바일·다크 화면에서 새 안내와 입력 보정 UI를 시각적으로 검사한다.
- [ ] **Step 4:** 수정 과제와 실제 통과한 명령을 `docs/STATUS.md`에 갱신한다. 기존 과제의 완료 표시는 실제 완료 항목에만 한다. 아직 CDN이 필요한 기능과 처리하지 않는 입력은 구체적으로 남긴다.

## 변경 기록과 진행 방법

각 Task는 실패 재현→최소 수정→해당 회귀 통과→변경 기록 순서로 완료한다. 원본과 계획의 로컬 기준점은 `550133a`, GitHub 연동 기준점은 `98b8fa7`이다. 테스트 output 폴더는 추적에서 제외한다. 이후 각 Task의 변경과 검증을 따로 커밋해 되돌릴 수 있게 한다. HTML 우선 업데이트와 원본 렌더링·두 모드는 구현·검증했으며, 2026-10-07 사용자 요청에 따라 현재 작업을 `main`에 병합한다. 다음 안정화 작업은 별도 작업 브랜치를 만들지 않고 `main`에서 이어간다. 완료 체크는 해당 검증 결과를 확인한 뒤 기록한다.

이 프로젝트는 같은 변환기 파일과 상태를 여러 단계가 함께 바꾸므로, 구현은 한 단계씩 직접 진행하고 독립 검토를 받는 실행 방식이 적합하다. 입력 fixture 조사나 디자인별 비교는 병렬로 할 수 있지만 같은 `convertor.js`를 동시에 수정하지 않는다.

## 안정화 이후 순서

1. **디자인 재현 수준:** 대표 대시보드·보고서·발표 디자인을 먼저 골라 동일 spec의 생성 결과와 사용자가 기대한 모습을 비교한다. 레이아웃·색·타이포·차트·상호작용 기준을 정한 뒤 디자인별 개선 계획을 별도로 작성한다.
2. **사내 오프라인 사용:** CDN 차단을 재현하고 엑셀·차트·폰트·원본 CSS 중 내장할 범위를 정한다. 파일 크기와 재배포 조건을 확인한 뒤 별도 패키지로 구현한다.
3. **카탈로그 유지 관리:** 링크 점검·썸네일·메타데이터 갱신 도구를 만든다. 정기 실행은 필요할 때 따로 결정한다.
4. **문장 다듬기 연계:** 현재 숨긴 기능은 다음 미구현 항목을 처리한 후 활성화한다.

- [ ] 공급자 중립적인 문장 다듬기 흐름을 설계한다.
- [ ] 사내 모델 어댑터 또는 승인된 Claude Enterprise 연계 방법을 선정한다.
- [ ] 숫자·차트·표 원본 보존 검사와 변경 미리보기·적용을 구현한다.
- [ ] 실제 사용 가능한 계정과 연결 경로를 확인한 후 화면을 활성화한다.

확장 단계보다 먼저 Task 0~5를 끝내면 기존 입력과 작업 흐름을 신뢰할 수 있는 첫 안정화 지점이 된다.
