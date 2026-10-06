"""html-convertor 스킬 원본(키트·엔진·designs.json)을 브라우저용 assets/convertor-bundle.js로 묶는다.

Previewer의 '② HTML 만들기' 화면(assets/hc-render.js)이 이 번들로 render.py와 같은 HTML을 만든다.
원본은 html-convertor/ 한 곳이다. 원본을 고쳤으면 이 스크립트를 다시 실행한다.

사용 (html/ 폴더에서):
  python tools/build_bundle.py           # 번들 다시 만들기
  python tools/build_bundle.py --check   # 번들이 원본과 맞는지 확인만 (다르면 종료 코드 1)
"""
import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SKILL = ROOT / "html-convertor"
OUT = ROOT / "assets" / "convertor-bundle.js"


def read(p: Path) -> str:
    # render.py와 같은 방식(텍스트 모드 = 줄바꿈을 LF로 통일)으로 읽어야 결과가 같아진다
    return p.read_text(encoding="utf-8")


def build() -> str:
    designs = json.loads(read(SKILL / "references" / "designs.json"))
    kits = {k["file"]: read(SKILL / "assets" / k["file"]) for k in designs["kits"].values()}
    bundle = {
        "designs": designs,
        "kits": kits,
        "commonCss": read(SKILL / "assets" / "kits" / "_common.css"),
        "engine": read(SKILL / "assets" / "engine.js"),
    }
    body = json.dumps(bundle, ensure_ascii=False, separators=(",", ":"))
    digest = hashlib.sha256(body.encode("utf-8")).hexdigest()[:16]
    # "</"를 "<\/"로 바꿔 두면 이 파일을 <script> 안에 그대로 넣어도 안전하다(JSON 문자열 안에서 같은 뜻)
    body = body.replace("</", "<\\/")
    return ("/* 자동 생성 파일 — 직접 고치지 마세요.\n"
            " * 원본: html-convertor/ (references/designs.json, assets/kits/*, assets/engine.js)\n"
            " * 다시 만들기: python tools/build_bundle.py */\n"
            f'window.HC_BUNDLE = {{"hash":"{digest}",' + body[1:] + ";\n")


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8")
    text = build()
    if "--check" in sys.argv:
        current = OUT.read_text(encoding="utf-8") if OUT.exists() else ""
        if current != text:
            print(f"번들이 원본과 다릅니다 → python tools/build_bundle.py 를 실행하세요 ({OUT})")
            return 1
        print("번들이 원본과 일치합니다")
        return 0
    OUT.write_text(text, encoding="utf-8", newline="\n")
    print(f"저장: {OUT}  ({len(text.encode('utf-8')) / 1024:.0f} KB)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
