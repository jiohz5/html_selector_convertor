"""Previewer 전체(① 고르기 + ② HTML 만들기)를 HTML 파일 하나로 묶는다 → dist/html-previewer.html

스타일·스크립트·디자인 데이터·스킬 번들(키트·엔진)·썸네일 45장을 모두 파일 안에 넣는다.
메일·메신저로 파일 하나만 보내면 받는 사람이 브라우저로 바로 열어 쓸 수 있다.
(웹폰트·데모 미리보기·결과물의 차트 라이브러리는 여전히 인터넷에서 불러온다)

사용 (html/ 폴더에서):
  python tools/build_single.py
"""
import base64
import io
import re
import subprocess
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "dist" / "html-previewer.html"
THUMB_SIZE = (640, 400)  # 카드에는 이 정도면 충분하고, 파일 크기를 절반 아래로 줄인다


def inline_safe(js: str) -> str:
    # <script> 안에 넣을 때 문자열 속 </script 가 태그를 닫지 않도록
    return re.sub(r"</(script)", r"<\\/\1", js, flags=re.I)


def thumb_data_uri(path: Path) -> str:
    with Image.open(path) as im:
        im = im.convert("RGB").resize(THUMB_SIZE, Image.LANCZOS)
        buf = io.BytesIO()
        im.save(buf, "JPEG", quality=72, optimize=True, progressive=True)
    return "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode("ascii")


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8")
    # 번들이 스킬 원본과 맞는지 먼저 확인
    check = subprocess.run([sys.executable, str(ROOT / "tools" / "build_bundle.py"), "--check"], capture_output=True, text=True, encoding="utf-8")
    if check.returncode != 0:
        print(check.stdout.strip() or check.stderr.strip())
        return 1

    html = (ROOT / "index.html").read_text(encoding="utf-8")
    css = (ROOT / "assets" / "style.css").read_text(encoding="utf-8")
    html = html.replace('<link rel="stylesheet" href="assets/style.css">', f"<style>\n{css}\n</style>")

    def script(m: re.Match) -> str:
        name = m.group(1)
        js = (ROOT / "assets" / name).read_text(encoding="utf-8")
        if name == "templates.js":
            used = 0

            def thumb(t: re.Match) -> str:
                nonlocal used
                used += 1
                return f'"{thumb_data_uri(ROOT / "thumbs" / (t.group(1) + ".jpg"))}"'

            js = re.sub(r'"thumbs/([\w-]+)\.jpg"', thumb, js)
            print(f"  썸네일 {used}장 내장")
        return f"<script>\n/* assets/{name} */\n{inline_safe(js)}\n</script>"

    html, n = re.subn(r'<script src="assets/([\w.-]+\.js)"></script>', script, html)
    left = re.findall(r'(?:src|href)="(assets/[^"]+|thumbs/[^"]+)"', html)
    if left:
        print("아직 외부 파일을 가리키는 곳:", left)
        return 1
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(html, encoding="utf-8", newline="\n")
    print(f"스크립트 {n}개 내장 → {OUT}  ({OUT.stat().st_size / 1024 / 1024:.2f} MB)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
