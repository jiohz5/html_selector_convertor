"""HTML Previewer(html/assets/templates.js)의 큐레이션 목록을 references/catalog.json으로 복사한다.

Previewer에 템플릿을 추가·수정한 뒤 실행하면, 스킬이 같은 id·이름으로 디자인을 찾을 수 있다.

사용법:
  python sync_catalog.py [templates.js 경로]
"""
import json
import re
import sys
from pathlib import Path

SKILL_DIR = Path(__file__).resolve().parent.parent
OUT = SKILL_DIR / "references" / "catalog.json"
DEFAULT_SRC = SKILL_DIR.parent / "assets" / "templates.js"  # 스킬 원본은 html/html-convertor 에 있다


def load_previewer_data(src: Path) -> dict:
    text = src.read_text(encoding="utf-8")
    m = re.search(r"window\.PREVIEWER_DATA\s*=\s*", text)
    if not m:
        raise SystemExit(f"PREVIEWER_DATA를 찾지 못했습니다: {src}")
    body = text[m.end():].strip().rstrip(";").strip()
    return json.loads(body)


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    # 인자가 없으면 지난번에 동기화한 경로 → 스킬 원본의 상위 폴더(html/assets) 순으로 찾는다
    prev = None
    if OUT.exists():
        prev = json.loads(OUT.read_text(encoding="utf-8")).get("sourcePath")
    src = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(prev) if prev and Path(prev).exists() else DEFAULT_SRC
    if not src.exists():
        raise SystemExit(f"templates.js가 없습니다: {src}")
    data = load_previewer_data(src)
    keep = ("id", "name", "vendor", "category", "preview", "source", "stack",
            "htmlReady", "license", "pricing", "licenseNote", "desc", "tags")
    catalog = {
        "checkedAt": data.get("checkedAt"),
        "sourcePath": str(src.resolve()),
        "categories": data.get("categories", []),
        "items": [{k: it.get(k) for k in keep} for it in data.get("items", [])],
    }
    OUT.write_text(json.dumps(catalog, ensure_ascii=False, indent=2), encoding="utf-8")

    designs_path = SKILL_DIR / "references" / "designs.json"
    if designs_path.exists():
        designs = json.loads(designs_path.read_text(encoding="utf-8"))["designs"]
        missing = [it["id"] for it in catalog["items"] if it["id"] not in designs]
        if missing:
            print("designs.json에 레시피가 없는 템플릿(가까운 키트로 대체됨):", ", ".join(missing))
    print(f"{len(catalog['items'])}개 템플릿을 {OUT}에 저장했습니다 (확인일 {catalog['checkedAt']})")


if __name__ == "__main__":
    main()
