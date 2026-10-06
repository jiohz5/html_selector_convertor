"""디자인 레시피(references/designs.json) × 데이터 명세(spec.json) → 단일 HTML 파일.

엔진(assets/engine.js)과 공통 CSS를 파일 안에 인라인하고, 디자인의 원본 CSS·차트 라이브러리는 CDN으로 불러온다.
결과물은 브라우저로 바로 열리는 HTML 한 개다(인터넷 연결 필요: CDN·웹폰트).

사용법:
  python render.py --design tabler --spec spec.json --out report.html
  python render.py --design shadcn-dashboard --kit slides --spec spec.json --out deck.html
  python render.py --design quarto --chart-lib echarts --theme dark --spec spec.json --out out.html
  python render.py --list                     # 디자인·키트 목록

옵션:
  --kit        결과물 형태를 바꾼다(dashboard·report·article·landing·slides·impress). 기본은 디자인의 기본 키트
  --chart-lib  echarts·chartjs·apexcharts·plotly·plot 중 하나로 바꾼다(차트 디자인을 함께 고른 경우)
  --layout     sidebar·topnav (dashboard) / toc-right·docs (report)
  --theme      light·dark·system — 처음 열 때의 테마
  --kpi-style  plain·accent·topline·solid·gradient·divider·tint
  --tokens     토큰 덮어쓰기 JSON (예: '{"primary": "#1428a0"}') — 회사 색 등
"""
import argparse
import html
import json
import re
import sys
from pathlib import Path
from urllib.parse import quote_plus

sys.stdout.reconfigure(encoding="utf-8")
sys.stderr.reconfigure(encoding="utf-8")

SKILL = Path(__file__).resolve().parent.parent
REF = SKILL / "references"
ASSETS = SKILL / "assets"
PRETENDARD = "https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
SANS_FALLBACK = "'Pretendard Variable', Pretendard, system-ui, -apple-system, 'Segoe UI', 'Malgun Gothic', sans-serif"
SERIF_FALLBACK = "'Noto Serif KR', Georgia, 'Times New Roman', serif"
FONT_WEIGHTS = {"Merriweather": "400;700", "Roboto Slab": "400;700", "Lexend": "400;500;600;700"}


def load_json(p: Path) -> dict:
    return json.loads(p.read_text(encoding="utf-8"))


def google_font_url(families: list[str]) -> str | None:
    if not families:
        return None
    parts = [f"family={quote_plus(f)}:wght@{FONT_WEIGHTS.get(f, '400;500;600;700')}" for f in families]
    return "https://fonts.googleapis.com/css2?" + "&".join(parts) + "&display=swap"


def resolve(designs: dict, catalog: dict, design_id: str) -> tuple[str, dict]:
    """designs.json에 없으면 catalog 카테고리로 가까운 디자인을 대신 쓴다."""
    table = designs["designs"]
    if design_id in table:
        return design_id, table[design_id]
    item = next((it for it in catalog.get("items", []) if it["id"] == design_id), None)
    if item:
        fb = designs["fallbackByCategory"].get(item["category"], "tabler")
        print(f"[알림] '{design_id}' 레시피가 없어 같은 유형의 '{fb}'로 대신 렌더링합니다.", file=sys.stderr)
        return fb, table[fb]
    raise SystemExit(f"알 수 없는 디자인: {design_id}  (python render.py --list 로 확인)")


def css_tokens(tokens: dict) -> list[str]:
    out = []
    for k, v in tokens.items():
        if k == "palette":
            out += [f"--hc-c{i + 1}: {c};" for i, c in enumerate(v[:8])]
        else:
            out.append(f"--hc-{k}: {v};")
    return out


def theme_selector(theme: dict) -> str:
    if theme["attr"] == "class":
        return f":root.{theme.get('dark', 'dark')}"
    return f':root[{theme["attr"]}="{theme["dark"]}"]'


def apply_class_map(markup: str, class_map: dict) -> str:
    if not class_map:
        return markup

    def fix(m: re.Match) -> str:
        classes = m.group(2).split()
        extra = []
        for c in classes:
            extra += class_map.get(c, "").split()
        merged = classes + [e for e in extra if e not in classes]
        return f'{m.group(1)}"{" ".join(merged)}"'

    return re.sub(r'(\bclass=)"([^"]*)"', fix, markup)


def build(args) -> str:
    designs = load_json(REF / "designs.json")
    catalog = load_json(REF / "catalog.json") if (REF / "catalog.json").exists() else {}
    used_id, d = resolve(designs, catalog, args.design)
    defaults = designs["defaults"]

    kit_name = args.kit or d.get("kit", "dashboard")
    if kit_name not in designs["kits"]:
        raise SystemExit(f"알 수 없는 키트: {kit_name}  (가능: {', '.join(designs['kits'])})")
    kit = designs["kits"][kit_name]
    markup = (ASSETS / kit["file"]).read_text(encoding="utf-8")

    spec_text = Path(args.spec).read_text(encoding="utf-8")
    spec = json.loads(spec_text)
    meta = spec.get("meta", {})
    title = meta.get("title") or "결과 보고"

    # ── 토큰: 기본값 ← 디자인 ← 사용자 덮어쓰기 ──
    tokens = {**defaults["tokens"], **d.get("tokens", {})}
    dark = {**defaults["dark"], **d.get("dark", {})}
    if args.tokens:
        override = json.loads(args.tokens)
        tokens.update(override.get("light", override) if isinstance(override, dict) else {})
        if isinstance(override, dict) and "dark" in override:
            dark.update(override["dark"])
        elif isinstance(override, dict) and "primary" in override and "primary" not in d.get("dark", {}):
            dark["primary"] = override["primary"]
    fonts = list(d.get("fonts", []))
    serif = d.get("fontKind") == "serif"
    if "font" not in tokens:
        stack = ", ".join(f"'{f}'" for f in fonts[:1])
        tokens["font"] = f"{stack + ', ' if stack else ''}{SERIF_FALLBACK if serif else SANS_FALLBACK}"
    if serif:
        fonts.append("Noto Serif KR")

    theme = {**defaults["theme"], **d.get("theme", {})}
    if args.theme:
        theme["default"] = args.theme
    # 키트가 다크 모드에서 바꿀 토큰만 다시 선언한다(팔레트가 없으면 라이트 팔레트 유지)
    root_css = ":root {\n  " + "\n  ".join(css_tokens(tokens)) + "\n}\n"
    root_css += f"{theme_selector(theme)} {{\n  " + "\n  ".join(css_tokens(dark)) + "\n}\n"

    # ── <head>: 폰트 → 원본 CSS → 키트 공통 CSS(키트 스타일이 뒤에서 덮음) ──
    head = [f'<meta name="description" content="{html.escape(meta.get("subtitle") or title)}">',
            '<meta name="color-scheme" content="light dark">',
            f'<meta name="generator" content="html-convertor · design={used_id} · kit={kit_name}">']
    head.append(f'<link rel="stylesheet" href="{PRETENDARD}">')
    gf = google_font_url(fonts)
    if gf:
        head.append('<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>')
        head.append(f'<link rel="stylesheet" href="{gf}">')
    lib_js = []
    for lib in d.get("libs", []):
        if lib in ("reveal", "reveal-white", "impress") and kit["mode"] != "slides":
            continue
        L = designs["libs"][lib]
        head += [f'<link rel="stylesheet" href="{u}">' for u in L.get("css", [])]
        lib_js += L.get("js", [])
    if kit_name == "slides" and "reveal" not in d.get("libs", []):
        L = designs["libs"]["reveal"]
        head += [f'<link rel="stylesheet" href="{u}">' for u in L["css"]]
        lib_js += L["js"]
    if kit_name == "impress" and "impress" not in d.get("libs", []):
        lib_js += designs["libs"]["impress"]["js"]

    chart_lib = args.chart_lib or d.get("chartLib", "echarts")
    if chart_lib not in designs["chartLibs"]:
        raise SystemExit(f"알 수 없는 차트 라이브러리: {chart_lib}")
    if spec.get("charts"):
        lib_js += designs["chartLibs"][chart_lib]["js"]

    common_css = (ASSETS / "kits" / "_common.css").read_text(encoding="utf-8")
    head.append(f"<style>\n/* 디자인 토큰: {used_id} */\n{root_css}</style>")
    head.append(f"<style>\n{common_css}</style>")
    # 디자인 고유의 손질(designs.json의 css) → 사용자가 준 --css 순서로 키트 스타일 뒤에 붙는다
    extra_css = "\n".join(filter(None, [d.get("css"), args.css]))
    style_extra = f"<style>\n{extra_css}\n</style>" if extra_css else ""

    # ── <body> 끝: spec·설정·라이브러리·엔진 ──
    config = {
        "mode": kit["mode"], "chartLib": chart_lib, "theme": theme,
        "design": used_id, "kit": kit_name,
    }
    safe = lambda obj: json.dumps(obj, ensure_ascii=False, indent=1).replace("</", "<\\/")
    engine = (ASSETS / "engine.js").read_text(encoding="utf-8")
    body_end = [
        f'<script type="application/json" id="hc-spec">{safe(spec)}</script>',
        f'<script type="application/json" id="hc-config">{safe(config)}</script>',
        *[f'<script src="{u}"></script>' for u in lib_js],
        f"<script>\n{engine}\n</script>",
    ]

    layout = args.layout or d.get("layout") or ("sidebar" if kit_name == "dashboard" else "")
    kpi_style = args.kpi_style or d.get("kpiStyle", "plain")
    body_class = " ".join(filter(None, [f"hc-kit-{kit_name}", f"hc-design-{used_id}", f"hc-layout-{layout}" if layout else "", f"hc-kpi-{kpi_style}"]))

    theme_attr = ""
    if theme["attr"] != "class":
        start = theme["light"] if theme.get("default") != "dark" else theme["dark"]
        theme_attr = f'{theme["attr"]}="{start}"'
    elif theme.get("default") == "dark":
        theme_attr = f'class="{theme.get("dark", "dark")}"'

    credit = d.get("credit")
    item = next((it for it in catalog.get("items", []) if it["id"] == used_id), None)
    if not credit and item and not d.get("chartOnly"):
        verb = "디자인 스타일 참고(원본 코드 미사용)" if d.get("paid") else "디자인 참고"
        credit = f"{verb}: {item['name']} ({item['license']})"
    credit_html = f'<span class="hc-credit">{html.escape(credit)}</span>' if credit else ""

    # 로고 칸 글자: meta.brand가 있으면 그것, 없으면 제목에서 숫자·기호가 아닌 첫 글자
    m_brand = re.search(r"[^\W\d_]", title)
    brand = str(meta.get("brand") or (m_brand.group(0) if m_brand else "R"))[:2].upper()
    out = markup
    replacements = {
        "%%HTML_ATTRS%%": theme_attr,
        "%%TITLE%%": html.escape(title),
        "%%BODY_CLASS%%": body_class,
        "%%BRAND_MARK%%": html.escape(brand),
        "%%CREDIT%%": credit_html,
        "<!--HC:HEAD-->": "\n  ".join(head),
        "<!--HC:STYLE-->": style_extra,
        "<!--HC:BODY_END-->": "\n  ".join(body_end),
    }
    # 엔진·spec 안의 문자열이 치환되지 않도록 마커는 키트 원문에서만 바꾼다
    for k, v in replacements.items():
        if k.startswith("%%"):
            out = out.replace(k, v)
    out = apply_class_map(out, d.get("classMap", {}))
    for k in ("<!--HC:HEAD-->", "<!--HC:STYLE-->", "<!--HC:BODY_END-->"):
        out = out.replace(k, replacements[k], 1)
    return out


def list_all() -> None:
    designs = load_json(REF / "designs.json")
    catalog = load_json(REF / "catalog.json")
    names = {it["id"]: it for it in catalog["items"]}
    print("키트:")
    for k, v in designs["kits"].items():
        print(f"  {k:10} {v['use']}")
    print("\n디자인 (id · 기본 키트 · 차트 · 원본CSS):")
    for k, v in designs["designs"].items():
        it = names.get(k, {})
        libs = ",".join(v.get("libs", [])) or "-(토큰 재현)"
        paid = " [유료·스타일만 재현]" if v.get("paid") else ""
        print(f"  {k:22} {v.get('kit', 'dashboard'):9} {v.get('chartLib', 'echarts'):10} {libs:22} {it.get('name', '')}{paid}")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--design")
    ap.add_argument("--spec")
    ap.add_argument("--out")
    ap.add_argument("--kit")
    ap.add_argument("--chart-lib", dest="chart_lib")
    ap.add_argument("--layout")
    ap.add_argument("--theme", choices=["light", "dark", "system"])
    ap.add_argument("--kpi-style", dest="kpi_style")
    ap.add_argument("--tokens", help="토큰 덮어쓰기 JSON 문자열 또는 .json 파일 경로")
    ap.add_argument("--css", help="추가 CSS(문자열 또는 .css 파일 경로). 디자인 특징을 다듬을 때")
    ap.add_argument("--list", action="store_true")
    args = ap.parse_args()
    if args.list:
        list_all()
        return
    if not (args.design and args.spec and args.out):
        ap.error("--design, --spec, --out 이 필요합니다 (목록은 --list)")
    if args.tokens and Path(args.tokens).suffix == ".json" and Path(args.tokens).exists():
        args.tokens = Path(args.tokens).read_text(encoding="utf-8")
    if args.css and Path(args.css).suffix == ".css" and Path(args.css).exists():
        args.css = Path(args.css).read_text(encoding="utf-8")
    result = build(args)
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(result, encoding="utf-8")
    print(f"저장: {out.resolve()}  ({len(result.encode('utf-8')) / 1024:.0f} KB)")


if __name__ == "__main__":
    main()
