# -*- coding: utf-8 -*-
"""production.csv (cp949) -> spec.json : 2026년 3분기 생산 현황

사용: python build_spec.py [production.csv 경로]
"""
import json
import sys
from pathlib import Path

import pandas as pd

HERE = Path(__file__).resolve().parent
SRC = Path(sys.argv[1]) if len(sys.argv) > 1 else HERE.parents[1] / "fixtures" / "production.csv"

df = pd.read_csv(SRC, encoding="cp949")
df["일자"] = pd.to_datetime(df["일자"])
df["월"] = df["일자"].dt.month
df["불량수"] = df["생산량"] * df["불량률(%)"] / 100  # 생산량 가중 불량률 계산용


def wdef(g):
    """생산량 가중 불량률(%)"""
    return round(float(g["불량수"].sum() / g["생산량"].sum() * 100), 2)


def pct(a, b):
    return round((a - b) / b * 100, 1)


months = [7, 8, 9]
mlabel = [f"{m}월" for m in months]
lines = sorted(df["라인"].unique())
eqs = sorted(df["설비"].unique())
ndays = int(df["일자"].nunique())

total = int(df["생산량"].sum())
defect = wdef(df)
down = int(df["비가동(분)"].sum())
daily = int(round(total / ndays))
m_prod = [int(df[df["월"] == m]["생산량"].sum()) for m in months]
m_def = [wdef(df[df["월"] == m]) for m in months]
m_down = [int(df[df["월"] == m]["비가동(분)"].sum()) for m in months]

# 라인별 집계
L = []
for ln in lines:
    g = df[df["라인"] == ln]
    L.append({
        "line": ln,
        "qty": int(g["생산량"].sum()),
        "share": round(float(g["생산량"].sum() / total * 100), 1),
        "daily": int(round(g["생산량"].mean())),
        "defect": wdef(g),
        "down": int(g["비가동(분)"].sum()),
        "sep_vs_aug": pct(int(g[g["월"] == 9]["생산량"].sum()), int(g[g["월"] == 8]["생산량"].sum())),
    })
for r in L:
    if r["defect"] > defect + 0.05:
        r["status"] = "주의"
    elif r["defect"] < defect - 0.05:
        r["status"] = "양호"
    else:
        r["status"] = "보통"
Ls = sorted(L, key=lambda r: -r["qty"])
Ld = sorted(L, key=lambda r: -r["down"])

# 설비별 집계
E = []
for e in eqs:
    g = df[df["설비"] == e]
    E.append({
        "eq": e,
        "days": int(len(g)),
        "qty": int(g["생산량"].sum()),
        "avg": int(round(g["생산량"].mean())),
        "defect": wdef(g),
        "downAvg": round(float(g["비가동(분)"].mean()), 1),
    })

# 주별 추이 (92일 × 3라인은 촘촘하므로 주 단위, 월요일 시작)
df["주"] = df["일자"].dt.to_period("W-SUN").dt.start_time
wk = sorted(df["주"].unique())
wx = [max(pd.Timestamp(w), df["일자"].min()).strftime("%m-%d") for w in wk]  # 첫 주는 07-01로 표시
w_line = {ln: [int(round(df[(df["주"] == w) & (df["라인"] == ln)]["생산량"].mean())) for w in wk] for ln in lines}  # 주별 일평균
w_def = {ln: [wdef(df[(df["주"] == w) & (df["라인"] == ln)]) for w in wk] for ln in lines}
w_days = [int(df[df["주"] == w]["일자"].nunique()) for w in wk]

d = df.groupby("일자")["생산량"].sum()
best_day, best_qty = d.idxmax(), int(d.max())
worst_day, worst_qty = d.idxmin(), int(d.min())

top_line, low_line = Ls[0], Ls[-1]
worst_def = max(L, key=lambda r: r["defect"])
best_def = min(L, key=lambda r: r["defect"])
most_down = Ld[0]

spec = {
    "meta": {
        "title": "생산 현황 · 2026년 3분기",
        "subtitle": "2026-07-01 ~ 2026-09-30 · A/B/C 라인",
        "source": f"production.csv (일자·라인별 {len(df)}행, {ndays}일, 2026-07-01~09-30)",
        "generatedAt": "2026-10-06",
    },
    "summary": [
        f"3분기 총생산량은 {total:,}개, 일평균 {daily:,}개(3개 라인 합계)입니다.",
        f"월별 생산량은 7월 {m_prod[0]:,}개 → 8월 {m_prod[1]:,}개 → 9월 {m_prod[2]:,}개로, 9월은 8월 대비 {pct(m_prod[2], m_prod[1]):+.1f}%입니다.",
        f"라인별로는 {top_line['line']}이 {top_line['qty']:,}개({top_line['share']}%)로 가장 많고, {low_line['line']}이 {low_line['qty']:,}개({low_line['share']}%)로 가장 적습니다.",
        f"생산량 가중 불량률은 분기 {defect}%로, 9월에 {m_def[2]}%(8월 {m_def[1]}%)로 낮아졌습니다. 라인 간 차이는 {worst_def['line']} {worst_def['defect']}% ~ {best_def['line']} {best_def['defect']}%로 작습니다.",
        f"비가동은 분기 합계 {down:,}분(약 {down / 60:,.0f}시간)이며 {most_down['line']}이 {most_down['down']:,}분으로 가장 깁니다.",
    ],
    "kpis": [
        {"label": "3분기 총생산량", "value": total, "unit": "개", "hint": "7~9월 3개 라인 합계", "spark": m_prod},
        {"label": "9월 생산량", "value": m_prod[2], "unit": "개", "delta": pct(m_prod[2], m_prod[1]),
         "deltaLabel": "8월 대비", "good": "up"},
        {"label": "불량률(가중)", "value": defect, "format": "percent", "decimals": 2, "good": "down",
         "hint": "3분기 생산량 가중 평균", "spark": m_def},
        {"label": "9월 불량률", "value": m_def[2], "format": "percent", "decimals": 2,
         "delta": round(m_def[2] - m_def[1], 2), "deltaSuffix": "%p", "deltaLabel": "8월 대비", "good": "down"},
        {"label": "비가동 합계", "value": down, "unit": "분", "good": "down",
         "hint": f"약 {down / 60:,.0f}시간", "spark": m_down},
    ],
    "charts": [
        {"id": "weekly", "title": "주별 일평균 생산량 추이 (라인별)", "subtitle": "단위: 개/일 · 주 시작일(월) 기준",
         "type": "area", "span": 2, "x": wx,
         "series": [{"name": ln, "data": w_line[ln]} for ln in lines], "unit": "개"},
        {"id": "line-share", "title": "라인별 생산 비중", "subtitle": "3분기 생산량 기준",
         "type": "donut", "x": [r["line"] for r in Ls],
         "series": [{"name": "생산량", "data": [r["qty"] for r in Ls]}], "unit": "개"},
        {"id": "weekly-defect", "title": "주별 불량률 추이 (라인별)", "subtitle": "단위: % · 생산량 가중",
         "type": "line", "span": 2, "x": wx,
         "series": [{"name": ln, "data": w_def[ln]} for ln in lines],
         "format": "decimal", "decimals": 2, "unit": "%"},
        {"id": "line-down", "title": "라인별 비가동 시간", "subtitle": "3분기 합계, 단위: 분",
         "type": "hbar", "x": [r["line"] for r in Ld],
         "series": [{"name": "비가동(분)", "data": [r["down"] for r in Ld]}], "unit": "분"},
        {"id": "monthly-line", "title": "월별·라인별 생산량", "subtitle": "단위: 개",
         "type": "bar", "span": 3, "x": mlabel, "height": 260,
         "series": [{"name": ln, "data": [int(df[(df["월"] == m) & (df["라인"] == ln)]["생산량"].sum()) for m in months]}
                    for ln in lines],
         "unit": "개"},
    ],
    "tables": [
        {"id": "lines", "title": "라인별 3분기 실적",
         "subtitle": f"불량 상태: 분기 가중 불량률 {defect}% 대비 ±0.05%p 기준",
         "columns": [
             {"key": "line", "label": "라인"},
             {"key": "qty", "label": "생산량(개)", "type": "number"},
             {"key": "share", "label": "비중", "type": "number", "format": "percent"},
             {"key": "daily", "label": "일평균(개)", "type": "number"},
             {"key": "sep_vs_aug", "label": "9월 증감(8월 대비)", "type": "number", "format": "percent"},
             {"key": "defect", "label": "불량률", "type": "number", "format": "percent", "decimals": 2},
             {"key": "down", "label": "비가동(분)", "type": "number"},
             {"key": "status", "label": "불량 상태", "type": "badge",
              "tones": {"양호": "good", "보통": "neutral", "주의": "warn"}},
         ],
         "rows": Ls, "search": False},
        {"id": "equipment", "title": "설비별 실적", "subtitle": "설비는 일자마다 라인에 배정됨(라인·일 단위 집계)",
         "columns": [
             {"key": "eq", "label": "설비"},
             {"key": "days", "label": "가동 라인·일", "type": "number"},
             {"key": "qty", "label": "생산량(개)", "type": "number"},
             {"key": "avg", "label": "라인·일당 평균(개)", "type": "number"},
             {"key": "defect", "label": "불량률", "type": "number", "format": "percent", "decimals": 2},
             {"key": "downAvg", "label": "평균 비가동(분)", "type": "number", "format": "decimal"},
         ],
         "rows": sorted(E, key=lambda r: -r["qty"]), "search": False},
    ],
    "sections": [
        {"id": "notes", "title": "분석 메모",
         "bullets": [
             f"일별 합계 최대는 {best_day:%m-%d} {best_qty:,}개, 최소는 {worst_day:%m-%d} {worst_qty:,}개입니다.",
             "불량률은 행별 불량률을 생산량으로 가중해 계산했습니다(단순 평균이 아님).",
             f"주별 차트는 주마다 일수가 달라(첫 주 {w_days[0]}일, 마지막 주 {w_days[-1]}일) 합계 대신 일평균으로 표시했습니다.",
             "데이터가 3분기뿐이라 분기 KPI의 전분기 대비 증감은 표시하지 않았고, 9월 KPI만 8월 대비 증감을 표시했습니다.",
         ]},
    ],
}

out = HERE / "spec.json"
out.write_text(json.dumps(spec, ensure_ascii=False, indent=2), encoding="utf-8")
print("wrote", out)
print(json.dumps({"total": total, "daily": daily, "defect": defect, "down": down,
                  "months": m_prod, "m_def": m_def, "m_down": m_down, "lines": L, "eq": E,
                  "week_days": w_days}, ensure_ascii=False))
