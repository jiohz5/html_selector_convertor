"""데이터 파일의 구조를 빠르게 파악한다 — spec.json을 설계하기 전에 먼저 실행.

지원: .csv .tsv .txt(구분자 자동) .xlsx .xls(시트별) .json(.jsonl) .parquet
한글 CSV 인코딩(utf-8-sig, cp949, euc-kr)을 자동으로 시도한다.

출력(JSON): 행·열 수, 열별 유형(number·date·category·text·bool), 결측, 고유값 수, 수치 요약,
            범주 상위값, 날짜 범위와 간격, 그리고 KPI·시계열·범주 비교 후보(suggestions).

사용법:
  python profile_data.py data/sales.csv
  python profile_data.py report.xlsx --sheet 요약
  python profile_data.py a.csv b.csv --max-cat 15
"""
import argparse
import json
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")

try:
    import pandas as pd
except ImportError:  # pragma: no cover
    print(json.dumps({"error": "pandas가 필요합니다: pip install pandas openpyxl"}, ensure_ascii=False))
    sys.exit(2)

ENCODINGS = ("utf-8-sig", "cp949", "euc-kr", "utf-16")


def read_any(path: Path, sheet: str | None) -> dict[str, "pd.DataFrame"]:
    ext = path.suffix.lower()
    if ext in (".xlsx", ".xlsm", ".xls"):
        frames = pd.read_excel(path, sheet_name=sheet if sheet else None)
        return frames if isinstance(frames, dict) else {sheet: frames}
    if ext == ".parquet":
        return {path.stem: pd.read_parquet(path)}
    if ext in (".json", ".jsonl"):
        try:
            return {path.stem: pd.read_json(path, lines=ext == ".jsonl")}
        except ValueError:
            raw = json.loads(path.read_text(encoding="utf-8"))
            # {"rows": [...]} / {"data": [...]} 같은 감싼 형태
            for k in ("rows", "data", "items", "records", "result"):
                if isinstance(raw, dict) and isinstance(raw.get(k), list):
                    return {f"{path.stem}.{k}": pd.json_normalize(raw[k])}
            return {path.stem: pd.json_normalize(raw)}
    sep = "\t" if ext == ".tsv" else None
    last = None
    for enc in ENCODINGS:
        try:
            return {path.stem: pd.read_csv(path, sep=sep, engine="python", encoding=enc)}
        except (UnicodeDecodeError, UnicodeError) as e:
            last = e
    raise SystemExit(f"인코딩을 알 수 없습니다: {path} ({last})")


def to_num(s: "pd.Series") -> "pd.Series":
    if s.dtype == object:
        cleaned = s.astype(str).str.replace(r"[,\s₩$%원]", "", regex=True).replace({"": None, "nan": None, "-": None})
        return pd.to_numeric(cleaned, errors="coerce")
    return pd.to_numeric(s, errors="coerce")


def kind_of(s: "pd.Series", max_cat: int) -> str:
    nn = s.dropna()
    if nn.empty:
        return "empty"
    if pd.api.types.is_bool_dtype(s):
        return "bool"
    if pd.api.types.is_datetime64_any_dtype(s):
        return "date"
    if pd.api.types.is_numeric_dtype(s):
        return "number"
    num = to_num(nn)
    if num.notna().mean() > 0.9:
        return "number"
    sample = nn.astype(str).head(200)
    if sample.str.match(r"^\d{4}[-./]\d{1,2}([-./]\d{1,2})?").mean() > 0.8:
        return "date"
    uniq = nn.nunique()
    if uniq <= max_cat or uniq / max(len(nn), 1) < 0.05:
        return "category"
    return "text"


def r(v, d=4):
    try:
        f = float(v)
        return int(f) if f.is_integer() else round(f, d)
    except (TypeError, ValueError):
        return str(v)


def profile_frame(name: str, df: "pd.DataFrame", max_cat: int) -> dict:
    cols = []
    numeric, dates, cats = [], [], []
    for c in df.columns:
        s = df[c]
        k = kind_of(s, max_cat)
        info = {"name": str(c), "kind": k, "nulls": int(s.isna().sum()), "unique": int(s.nunique(dropna=True))}
        if k == "number":
            n = to_num(s)
            info.update({"min": r(n.min()), "max": r(n.max()), "mean": r(n.mean()), "sum": r(n.sum()), "median": r(n.median())})
            if n.notna().all() and (n.dropna() % 1 == 0).all():
                info["integer"] = True
            numeric.append(str(c))
        elif k == "date":
            dt = pd.to_datetime(s, errors="coerce")
            ok = dt.dropna().sort_values()
            if not ok.empty:
                diffs = ok.drop_duplicates().diff().dropna()
                step = diffs.median() if not diffs.empty else None
                gran = None
                if step is not None:
                    days = step.days
                    gran = "일" if days <= 1 else "주" if days <= 7 else "월" if days <= 31 else "분기" if days <= 92 else "연"
                info.update({"from": str(ok.iloc[0].date()), "to": str(ok.iloc[-1].date()), "granularity": gran})
            dates.append(str(c))
        elif k in ("category", "bool"):
            vc = s.astype(str).value_counts().head(10)
            info["top"] = {str(i): int(v) for i, v in vc.items()}
            cats.append(str(c))
        else:
            info["sample"] = [str(x)[:60] for x in s.dropna().head(3)]
        cols.append(info)

    sugg = {
        "kpi": [f"{c} 합계/평균" for c in numeric[:6]],
        "timeseries": [f"{d} 기준 {n} 추이 (line/area)" for d in dates[:1] for n in numeric[:3]],
        "breakdown": [f"{c}별 {n} 비교 (bar/hbar, 항목 ≤6이면 donut)" for c in cats[:3] for n in numeric[:2]],
        "table": "핵심 열만 골라 상위 N행(정렬 기준 명시) 또는 범주별 집계표",
    }
    if len(numeric) >= 2:
        sugg["relation"] = f"{numeric[0]} vs {numeric[1]} 산점도(scatter)"
    return {
        "name": name, "rows": int(len(df)), "columns": len(df.columns), "columnsInfo": cols,
        "head": json.loads(df.head(5).to_json(orient="records", force_ascii=False, date_format="iso")),
        "suggestions": sugg,
    }


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("files", nargs="+")
    ap.add_argument("--sheet")
    ap.add_argument("--max-cat", type=int, default=20, help="고유값이 이 수 이하이면 범주로 본다")
    args = ap.parse_args()
    out = []
    for f in args.files:
        p = Path(f).expanduser()
        if not p.exists():
            out.append({"file": f, "error": "파일 없음"})
            continue
        try:
            frames = read_any(p, args.sheet)
        except Exception as e:  # noqa: BLE001
            out.append({"file": f, "error": f"{e.__class__.__name__}: {e}"})
            continue
        for name, df in frames.items():
            out.append({"file": str(p), **profile_frame(str(name), df, args.max_cat)})
    print(json.dumps(out if len(out) > 1 else out[0], ensure_ascii=False, indent=2, default=str))


if __name__ == "__main__":
    main()
