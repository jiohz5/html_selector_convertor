"""html-convertor 회귀 테스트.

견본 spec(fixtures/sample-spec.json)을 디자인 45종(각 디자인의 기본 키트·차트) + Tabler × 차트 라이브러리 3종으로
렌더링하고, 결과마다 check_html.py 정적 검사를 돌린다. 엔진·키트·designs.json을 고친 뒤 영향 범위를 확인할 때 쓴다.

사용 (html/ 폴더에서):
  python tests/convertor/run_regress.py                        # out/regress/ 에 48개 렌더링 + 정적 검사
  python tests/convertor/run_regress.py --compare 이전결과폴더    # 같은 이름 파일과 바이트 단위 비교
  python tests/convertor/run_regress.py --only tabler quarto     # 일부 조합만
  python tests/convertor/run_regress.py --shot tabler revealjs   # 지정한 조합은 스크린샷까지 (out/regress/*.png)

고치기 전 결과를 남겨 두려면: 먼저 --out 으로 다른 폴더에 렌더링해 두고, 고친 뒤 --compare 로 비교한다.
"""
import argparse
import json
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
SKILL = HERE.parents[1] / "html-convertor"
SCRIPTS = SKILL / "scripts"
SPEC = HERE / "fixtures" / "sample-spec.json"
# 기본 차트 라이브러리가 아닌 조합 — 차트 라이브러리별 렌더링을 Tabler 화면으로 확인
EXTRA = [("tabler-chartjs", "tabler", "chartjs"), ("tabler-plot", "tabler", "plot"), ("tabler-plotly", "tabler", "plotly")]


def combos() -> list[tuple[str, str, str | None]]:
    designs = json.loads((SKILL / "references" / "designs.json").read_text(encoding="utf-8"))["designs"]
    return [(d, d, None) for d in designs] + EXTRA


def run(cmd: list) -> subprocess.CompletedProcess:
    return subprocess.run([str(c) for c in cmd], capture_output=True, text=True, encoding="utf-8", errors="replace")


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--out", default=str(HERE / "out" / "regress"), help="렌더링 결과 폴더")
    ap.add_argument("--compare", help="비교할 이전 결과 폴더")
    ap.add_argument("--only", nargs="*", default=[], help="이 이름의 조합만 실행")
    ap.add_argument("--shot", nargs="*", default=[], help="스크린샷까지 찍을 조합")
    args = ap.parse_args()

    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    todo = [c for c in combos() if not args.only or c[0] in args.only]
    failed, warned, same, differ, missing = [], [], 0, [], []

    for name, design, lib in todo:
        html = out / f"{name}.html"
        cmd = [sys.executable, SCRIPTS / "render.py", "--design", design, "--spec", SPEC, "--out", html]
        if lib:
            cmd += ["--chart-lib", lib]
        r = run(cmd)
        if r.returncode != 0:
            failed.append(name)
            print(f"!! {name:<22} 렌더링 실패: {(r.stderr or r.stdout).strip().splitlines()[-1:]}")
            continue
        check = [sys.executable, SCRIPTS / "check_html.py", html] + (["--shot"] if name in args.shot else [])
        c = run(check)
        warns = [ln.strip() for ln in c.stdout.splitlines() if "[주의]" in ln]
        status = "통과" if c.returncode == 0 else "검사 오류"
        if c.returncode != 0:
            failed.append(name)
        elif warns:
            warned.append(name)
        cmp = ""
        if args.compare:
            base = Path(args.compare) / f"{name}.html"
            if not base.exists():
                missing.append(name)
                cmp = " · 비교 대상 없음"
            elif base.read_bytes() == html.read_bytes():
                same += 1
                cmp = " · 이전과 동일"
            else:
                differ.append(name)
                cmp = " · 이전과 다름"
        size = html.stat().st_size // 1024
        print(f"{'OK' if c.returncode == 0 else '!!'} {name:<22} {status}{f' (주의 {len(warns)})' if warns else ''} · {size}KB{cmp}")
        if c.returncode != 0:
            print("   " + "\n   ".join(ln for ln in c.stdout.splitlines() if "[오류]" in ln))

    print(f"\n렌더링 {len(todo)}개 · 실패 {len(failed)} · 주의 {len(warned)} → {out}")
    if args.compare:
        print(f"이전 결과와 비교: 동일 {same} · 다름 {len(differ)} · 비교 대상 없음 {len(missing)}")
        if differ:
            print("  다른 파일:", ", ".join(differ))
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
