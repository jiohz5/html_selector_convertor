"""HTML Previewer에서 고른 디자인을 찾아 render.py에 넘길 값으로 정리한다.

입력(아무거나 하나):
  - Previewer가 내보낸 .md / .json 파일 경로 (Markdown 복사·JSON 복사·.md 파일 저장 결과)
  - 그 내용을 붙여 넣은 텍스트 파일
  - 템플릿 id 또는 이름 (예: tabler, "shadcn/ui Dashboard", Quarto)
  - 아무것도 안 주면: 현재 폴더 → ~/Downloads 에서 가장 최근 html-design-references-*.md|json 을 찾는다

출력(JSON): 고른 순서대로의 항목, 메모, 그리고 추천 조합
  primary   : 화면 구조·스타일을 정할 디자인(차트 라이브러리가 아닌 첫 항목)
  chartLib  : 함께 고른 차트 라이브러리가 있으면 그것, 없으면 primary의 기본값
  alternates: 나머지 디자인(사용자가 여러 개를 골랐을 때 후보)

사용법:
  python resolve_design.py                       # 최근 내보내기 자동 탐색
  python resolve_design.py ~/Downloads/html-design-references-2026-10-06.md
  python resolve_design.py tabler echarts
"""
import json
import re
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")

SKILL = Path(__file__).resolve().parent.parent
REF = SKILL / "references"
CHART_IDS = {"echarts": "echarts", "chartjs": "chartjs", "plotly": "plotly", "observable-plot": "plot", "apexcharts": "apexcharts"}


def load(p: Path) -> dict:
    return json.loads(p.read_text(encoding="utf-8"))


def norm(s: str) -> str:
    return re.sub(r"[^a-z0-9가-힣]+", "", s.lower())


def find_recent_export() -> Path | None:
    cands = []
    for base in (Path.cwd(), Path.home() / "Downloads", Path.home() / "다운로드"):
        if base.exists():
            cands += list(base.glob("html-design-references-*.md")) + list(base.glob("html-design-references-*.json"))
    return max(cands, key=lambda p: p.stat().st_mtime) if cands else None


def parse_export(text: str, catalog: dict) -> list[dict]:
    """JSON 내보내기, Markdown 내보내기, 혹은 그냥 이름이 적힌 글 모두 처리한다."""
    items = catalog["items"]
    by_id = {it["id"]: it for it in items}
    picked: list[dict] = []

    try:
        data = json.loads(text)
        for x in data.get("items", []):
            if x.get("id") in by_id:
                picked.append({"id": x["id"], "memo": x.get("memo", "")})
        if picked:
            return picked
    except (json.JSONDecodeError, AttributeError):
        pass

    # Markdown: "## 1. Tabler — 대시보드" 블록 + "- 데모: URL" + "- 메모: ..."
    blocks = re.split(r"\n(?=##\s)", text)
    for b in blocks:
        head = re.match(r"##\s*\d*\.?\s*(.+?)\s+[—-]\s+", b)
        demo = re.search(r"-\s*데모:\s*(\S+)", b)
        memo = re.search(r"-\s*메모:\s*(.+)", b)
        hit = None
        if demo:
            hit = next((it for it in items if it.get("preview") == demo.group(1).strip()), None)
        if not hit and head:
            hit = next((it for it in items if norm(it["name"]) == norm(head.group(1))), None)
        if hit and all(p["id"] != hit["id"] for p in picked):
            m = memo.group(1).strip() if memo else ""
            picked.append({"id": hit["id"], "memo": "" if m == "(없음)" else m})
    if picked:
        return picked

    # 자유 텍스트: id·이름이 등장하는 순서대로. "tufte"처럼 앞부분만 적어도(4자 이상) 찾는다
    low = norm(text)
    found = []
    for it in items:
        for key in (it["id"], it["name"]):
            pos = low.find(norm(key))
            if pos >= 0:
                found.append((pos, it["id"]))
                break
    ids = {i for _, i in found}
    for tok in re.split(r"[\s,]+", text):
        t = norm(tok)
        if len(t) < 4:
            continue
        hit = next((it for it in items if it["id"] not in ids and (norm(it["id"]).startswith(t) or norm(it["name"]).startswith(t))), None)
        if hit:
            found.append((low.find(t), hit["id"]))
            ids.add(hit["id"])
    return [{"id": i, "memo": ""} for _, i in sorted(found)]


def main() -> None:
    catalog = load(REF / "catalog.json")
    designs = load(REF / "designs.json")
    by_id = {it["id"]: it for it in catalog["items"]}
    args = sys.argv[1:]

    source = None
    if not args:
        p = find_recent_export()
        if not p:
            print(json.dumps({"error": "Previewer 내보내기 파일을 찾지 못했습니다. 파일 경로나 템플릿 이름을 알려 주세요.",
                              "hint": "Previewer 선택함 → '.md 파일 저장' 또는 'Markdown 복사'"}, ensure_ascii=False, indent=2))
            sys.exit(2)
        text, source = p.read_text(encoding="utf-8"), str(p)
    elif len(args) == 1 and Path(args[0]).expanduser().exists():
        p = Path(args[0]).expanduser()
        text, source = p.read_text(encoding="utf-8"), str(p)
    else:
        text = " ".join(args)

    picked = parse_export(text, catalog)
    if not picked:
        print(json.dumps({"error": f"알 수 없는 디자인: {text[:80]}", "available": [it["id"] for it in catalog["items"]]}, ensure_ascii=False, indent=2))
        sys.exit(2)

    rows = []
    for p in picked:
        it = by_id[p["id"]]
        d = designs["designs"].get(p["id"], {})
        rows.append({
            "id": it["id"], "name": it["name"], "category": it["category"], "license": it["license"],
            "pricing": it["pricing"], "licenseNote": it.get("licenseNote"), "memo": p["memo"],
            "kit": d.get("kit"), "chartLib": d.get("chartLib"), "originalCss": bool(d.get("libs")),
            "paid": bool(d.get("paid")), "recipe": bool(d), "signature": d.get("signature", ""),
        })

    layouts = [r for r in rows if r["id"] not in CHART_IDS]
    charts = [r for r in rows if r["id"] in CHART_IDS]
    primary = layouts[0] if layouts else None
    if not primary:
        # 차트 라이브러리만 골랐으면 단정한 기본 레이아웃(Tabler) 위에 그 라이브러리를 쓴다
        primary = {"id": "tabler", "name": "Tabler (기본 레이아웃)", "kit": "dashboard", "memo": ""}
    chart_lib = CHART_IDS[charts[0]["id"]] if charts else (designs["designs"].get(primary["id"], {}).get("chartLib") or "echarts")

    notes = []
    for r in rows:
        if r["paid"]:
            notes.append(f"{r['name']}: 유료 템플릿 — 원본 코드를 가져오지 않고 색·배치·타이포만 재현합니다. 결과물에 '스타일 참고' 표기.")
        if r["pricing"] == "conditional":
            notes.append(f"{r['name']}: {r.get('licenseNote') or '조건부 유료 — 상업적 사용 조건 확인 필요'}")
        if r["license"].startswith("CC BY"):
            notes.append(f"{r['name']}: {r['license']} — 출처 표기가 필요해 푸터에 자동 표기합니다.")
        if not r["recipe"]:
            notes.append(f"{r['name']}: 레시피 없음 — 같은 유형의 기본 디자인으로 대체됩니다.")

    out = {
        "source": source,
        "picked": rows,
        "recommend": {
            "design": primary["id"],
            "kit": primary.get("kit") or "dashboard",
            "chartLib": chart_lib,
            "memo": primary.get("memo", ""),
            "render": f"python render.py --design {primary['id']} --chart-lib {chart_lib} --spec spec.json --out <출력.html>",
        },
        "alternates": [r["id"] for r in layouts[1:]],
        "notes": notes,
    }
    print(json.dumps(out, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
