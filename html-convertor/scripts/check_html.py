"""생성한 HTML을 검증한다.

1) 정적 검사: 문서 구조, spec JSON 파싱, 남은 자리표시자, 지어낸 듯한 더미 텍스트, 파일 크기
2) --online: CDN·웹폰트 URL이 실제로 열리는지(HTTP 200) 확인
3) --shot: 헤드리스 Edge/Chrome으로 렌더링해 스크린샷(PNG)을 저장 → Read로 열어 눈으로 확인
   --dark 를 함께 주면 다크 테마로도 한 장 더 찍는다

사용법:
  python check_html.py out.html --shot
  python check_html.py out.html --online --shot --dark --width 1440 --height 1600
종료 코드: 오류가 있으면 1
"""
import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import urllib.request
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")

# Chrome 우선: Edge는 이미 실행 중이면 헤드리스 요청을 기존 창에 넘겨 버려 스크린샷이 안 나오는 경우가 있다
BROWSERS = [
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
]
PLACEHOLDER = re.compile(r"%%[A-Z_]+%%|<!--HC:[A-Z_]+-->|\{\{[^}]*\}\}|lorem ipsum|TODO|FIXME|placeholder data|샘플 데이터|예시 데이터", re.I)


def find_browser() -> str | None:
    for b in BROWSERS:
        if Path(b).exists():
            return b
    for name in ("google-chrome", "chromium", "chrome", "msedge"):
        p = shutil.which(name)
        if p:
            return p
    return None


def static_checks(text: str) -> tuple[list[str], list[str], dict]:
    errors, warns = [], []
    if not text.lstrip().lower().startswith("<!doctype html"):
        errors.append("<!doctype html> 로 시작하지 않습니다")
    for tag, msg in [(r'<meta charset="utf-8"', "charset 메타 태그 없음"), (r'name="viewport"', "viewport 메타 태그 없음"), (r"<title>[^<]+</title>", "<title> 이 비어 있음")]:
        if not re.search(tag, text, re.I):
            errors.append(msg)
    spec = {}
    m = re.search(r'<script type="application/json" id="hc-spec">(.*?)</script>', text, re.S)
    if m:
        try:
            spec = json.loads(m.group(1).replace("<\\/", "</"))
        except json.JSONDecodeError as e:
            errors.append(f"hc-spec JSON 파싱 실패: {e}")
    else:
        warns.append("hc-spec 블록이 없습니다(직접 작성한 HTML이면 무시)")
    # 엔진·spec 블록은 제외하고 자리표시자를 찾는다
    visible = re.sub(r"<script\b[^>]*>.*?</script>", "", text, flags=re.S)
    for hit in sorted(set(h.group(0) for h in PLACEHOLDER.finditer(visible))):
        errors.append(f"남은 자리표시자/더미 텍스트: {hit!r}")
    if spec:
        m_ = spec.get("meta", {})
        if not m_.get("title"):
            errors.append("spec.meta.title 이 없습니다")
        if not m_.get("source"):
            warns.append("spec.meta.source(데이터 출처)가 없습니다 — 출처를 적어 두면 신뢰도가 올라갑니다")
        ids = {c.get("id") for c in spec.get("charts", [])} | {t.get("id") for t in spec.get("tables", [])}
        for s in spec.get("sections", []):
            for ref in (s.get("charts") or []) + (s.get("tables") or []):
                if ref not in ids:
                    errors.append(f"섹션 '{s.get('title')}'이 없는 차트/표 id를 참조: {ref}")
        for c in spec.get("charts", []):
            t = c.get("type", "line")
            xs = c.get("x") or c.get("labels") or []
            for s in c.get("series", []):
                data = s.get("data", []) if isinstance(s, dict) else s
                if t != "scatter" and xs and len(data) != len(xs):
                    errors.append(f"차트 '{c.get('id')}' 시리즈 '{s.get('name') if isinstance(s, dict) else '?'}' 길이 {len(data)} ≠ x 길이 {len(xs)}")
                if any(isinstance(v, str) for v in data if t != "scatter"):
                    errors.append(f"차트 '{c.get('id')}'에 숫자가 아닌 값(문자열)이 있습니다")
            if t in ("pie", "donut") and len(xs) > 8:
                warns.append(f"차트 '{c.get('id')}' 원형 항목이 {len(xs)}개 — hbar가 더 읽기 쉽습니다")
        for t in spec.get("tables", []):
            if len(t.get("rows", [])) > 2000:
                warns.append(f"표 '{t.get('id')}' 행이 {len(t['rows'])}개 — 집계하거나 상위 N만 넣으세요")
    size = len(text.encode("utf-8"))
    if size > 3 * 1024 * 1024:
        warns.append(f"파일이 {size / 1024 / 1024:.1f}MB 입니다 — spec 데이터를 줄이세요")
    return errors, warns, spec


def online_checks(text: str) -> list[str]:
    bad = []
    # 실제로 불러오는 스타일시트·스크립트만 검사한다(preconnect 같은 힌트 링크는 제외)
    urls = sorted(set(re.findall(r'<link rel="stylesheet" href="(https://[^"]+)"', text) + re.findall(r'<script src="(https://[^"]+)"', text)))
    for u in urls:
        if "fonts.gstatic.com" in u and "css" not in u:
            continue
        try:
            req = urllib.request.Request(u, method="GET", headers={"User-Agent": "Mozilla/5.0 html-convertor-check"})
            with urllib.request.urlopen(req, timeout=20) as r:
                if r.status != 200:
                    bad.append(f"{r.status} {u}")
        except Exception as e:  # noqa: BLE001 — 네트워크 오류는 모두 보고만 한다
            bad.append(f"열리지 않음 {u} ({e.__class__.__name__}: {e})")
    return bad


def screenshot(browser: str, html_path: Path, png: Path, width: int, height: int, dark: bool, suffix: str = "") -> tuple[bool, str]:
    target = html_path
    if dark:
        # 저장된 테마 대신 다크로 시작하도록 복사본을 만든다
        text = html_path.read_text(encoding="utf-8")
        text = re.sub(r'(<script type="application/json" id="hc-config">.*?)("default":\s*)"(light|system)"',
                      r'\1\2"dark"', text, count=1, flags=re.S)
        tmp = html_path.with_name(html_path.stem + ".__dark__.html")
        tmp.write_text(text, encoding="utf-8")
        target = tmp
    png = png.resolve()
    png.unlink(missing_ok=True)  # 이전 결과가 남아 있으면 성공으로 오판하므로 지운다
    prof = tempfile.mkdtemp(prefix="hc-shot-")
    cmd = [browser, "--headless=new", "--disable-gpu", "--hide-scrollbars", "--no-first-run", "--no-default-browser-check",
           f"--user-data-dir={prof}", f"--window-size={width},{height}", "--virtual-time-budget=12000",
           "--run-all-compositor-stages-before-draw", f"--screenshot={png}", target.resolve().as_uri() + suffix]
    try:
        p = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=90)
        ok = png.exists() and png.stat().st_size > 0
        return ok, (p.stderr or "")[-600:]
    finally:
        shutil.rmtree(prof, ignore_errors=True)
        if dark and target != html_path:
            target.unlink(missing_ok=True)


def count_slides(spec: dict) -> int:
    """발표 키트의 슬라이드 수: 표지·요약·KPI(4개씩)·섹션·섹션 밖 차트·표·끝"""
    emb_c = {i for s in spec.get("sections", []) for i in (s.get("charts") or [])}
    emb_t = {i for s in spec.get("sections", []) for i in (s.get("tables") or [])}
    n = 1 + (1 if spec.get("summary") else 0) + -(-len(spec.get("kpis", [])) // 4) + len(spec.get("sections", []))
    n += sum(1 for c in spec.get("charts", []) if c.get("id") not in emb_c)
    n += sum(1 for t in spec.get("tables", []) if t.get("id") not in emb_t)
    return n + 1


def dom_dump(browser: str, html_path: Path) -> str:
    prof = tempfile.mkdtemp(prefix="hc-dom-")
    cmd = [browser, "--headless=new", "--disable-gpu", "--no-first-run", f"--user-data-dir={prof}",
           "--virtual-time-budget=12000", "--dump-dom", html_path.resolve().as_uri()]
    try:
        p = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=90)
        return p.stdout
    finally:
        shutil.rmtree(prof, ignore_errors=True)


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("html")
    ap.add_argument("--online", action="store_true", help="CDN URL 열림 확인")
    ap.add_argument("--shot", action="store_true", help="헤드리스 브라우저 스크린샷")
    ap.add_argument("--dark", action="store_true", help="다크 테마 스크린샷도 저장")
    ap.add_argument("--width", type=int, default=1440)
    ap.add_argument("--height", type=int, default=1800)
    ap.add_argument("--slides", action="store_true", help="발표(reveal) 결과물을 슬라이드마다 1280x720으로 찍는다(글머리표 모두 펼친 상태). --dark와 함께 쓰면 다크도")
    args = ap.parse_args()

    path = Path(args.html)
    text = path.read_text(encoding="utf-8")
    errors, warns, spec = static_checks(text)

    if args.online:
        errors += [f"CDN 오류: {b}" for b in online_checks(text)]

    shots = []
    if args.slides:
        browser = find_browser()
        if not browser:
            warns.append("Edge/Chrome을 찾지 못해 스크린샷을 건너뜁니다")
        elif '"kit": "slides"' not in text:
            warns.append("--slides 는 reveal.js 발표(slides 키트) 결과물에만 씁니다")
        else:
            out_dir = path.with_name(path.stem + ".slides")
            out_dir.mkdir(exist_ok=True)
            for i in range(count_slides(spec)):
                for dark in ([False, True] if args.dark else [False]):
                    png = out_dir / f"{'dark-' if dark else ''}slide-{i:02d}.png"
                    ok, err = screenshot(browser, path, png, 1280, 720, dark, f"?static#/{i}")
                    (shots.append(str(png)) if ok else errors.append(f"슬라이드 {i} 스크린샷 실패: {err[-200:]}"))

    if args.shot:
        browser = find_browser()
        if not browser:
            warns.append("Edge/Chrome을 찾지 못해 스크린샷을 건너뜁니다")
        else:
            png = path.with_suffix(".png")
            ok, err = screenshot(browser, path, png, args.width, args.height, False)
            (shots.append(str(png)) if ok else errors.append(f"스크린샷 실패: {err}"))
            if args.dark:
                png2 = path.with_name(path.stem + ".dark.png")
                ok, err = screenshot(browser, path, png2, args.width, args.height, True)
                (shots.append(str(png2)) if ok else errors.append(f"다크 스크린샷 실패: {err}"))
            dom = dom_dump(browser, path)
            if dom:
                # 스크립트·템플릿 원문은 빼고 실제로 그려진 DOM만 본다
                body = re.sub(r"<(script|template)\b[^>]*>.*?</\1>", "", dom, flags=re.S)
                n_fallback = body.count('class="hc-fallback-note"')
                if n_fallback:
                    errors.append(f"차트 {n_fallback}개가 그려지지 않고 대체 표로 표시됨(라이브러리 로드 실패 또는 데이터 오류)")
                if spec.get("kpis") and 'data-slot="value"' not in body:
                    errors.append("KPI가 렌더링되지 않았습니다(엔진 오류 가능)")
                n_drawn = len(re.findall(r'data-slot="chart"[^>]*>\s*<(?!/div)', body))
                is_slides = '"mode": "slides"' in text  # 발표는 슬라이드가 보일 때 차트를 그리므로 첫 화면 기준 검사에서 뺀다
                if spec.get("charts") and n_drawn == 0 and not is_slides:
                    errors.append("차트가 하나도 그려지지 않았습니다(라이브러리 로드 실패 가능)")

    print(f"검사: {path}")
    if spec:
        print(f"  spec: KPI {len(spec.get('kpis', []))} · 차트 {len(spec.get('charts', []))} · 표 {len(spec.get('tables', []))} · 섹션 {len(spec.get('sections', []))}")
    for w in warns:
        print(f"  [주의] {w}")
    for e in errors:
        print(f"  [오류] {e}")
    for s in shots:
        print(f"  스크린샷: {s}")
    print("  결과:", "통과" if not errors else f"오류 {len(errors)}건")
    sys.exit(1 if errors else 0)


if __name__ == "__main__":
    main()
