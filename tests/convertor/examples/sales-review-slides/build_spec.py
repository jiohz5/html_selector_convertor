# -*- coding: utf-8 -*-
"""sales_2026.xlsx -> spec.json (영업회의 발표용, reveal.js)

사용: python build_spec.py [엑셀 경로]
"""
import json
import sys
from pathlib import Path

import pandas as pd

HERE = Path(__file__).resolve().parent
SRC = Path(sys.argv[1]) if len(sys.argv) > 1 else (
    HERE.parents[1] / "fixtures" / "sales_2026.xlsx")

d = pd.read_excel(SRC, sheet_name="판매내역")
d["월"] = d["월"].astype(str).str[:7]

# 월별요약 시트와 상세 합계가 맞는지 확인
s = pd.read_excel(SRC, sheet_name="월별요약")
s["월"] = s["월"].astype(str).str[:7]
chk = d.groupby("월")[["매출액", "목표매출"]].sum().reset_index().merge(s, on="월", suffixes=("", "_요약"))
assert (chk["매출액"] == chk["매출액_요약"]).all() and (chk["목표매출"] == chk["목표매출_요약"]).all(), "월별요약 불일치"


def agg(key):
    g = d.groupby(key)[["수량", "매출액", "목표매출"]].sum()
    g["달성률"] = g["매출액"] / g["목표매출"] * 100
    g["미달액"] = g["목표매출"] - g["매출액"]
    return g


def r1(x):
    return round(float(x), 1)


def mm(x):
    return round(float(x) / 1e6, 1)


def eok(x):
    return f"{x / 1e8:.2f}억 원"


tot_sales, tot_tgt, tot_qty = int(d["매출액"].sum()), int(d["목표매출"].sum()), int(d["수량"].sum())
tot_rate = tot_sales / tot_tgt * 100
gap = tot_tgt - tot_sales

mon = agg("월").sort_index()
reg = agg("지역")
prd = agg("제품")
months = list(mon.index)
mlabel = [f"{int(m[5:7])}월" for m in months]

# 분기
d["분기"] = d["월"].str[5:7].astype(int).map(lambda m: f"Q{(m - 1) // 3 + 1}")
q = agg("분기")
h1 = d[d["월"] <= "2026-06"]
h1_rate = h1["매출액"].sum() / h1["목표매출"].sum() * 100
q3_rate = q.loc["Q3", "달성률"]

reg_s = reg.sort_values("매출액", ascending=False)
reg_r = reg.sort_values("달성률")
prd_s = prd.sort_values("매출액", ascending=False)
prd_r = prd.sort_values("달성률")
worst_reg, best_reg = reg_r.index[0], reg_r.index[-1]
worst_prd, best_prd = prd_r.index[0], prd_r.index[-1]
gg_share_sales = reg.loc["경기", "매출액"] / tot_sales * 100
worst_gap_share = reg.loc[worst_reg, "미달액"] / gap * 100

# 지역 x 제품 셀
cell = d.groupby(["지역", "제품"])[["매출액", "목표매출"]].sum()
cell["달성률"] = cell["매출액"] / cell["목표매출"] * 100
cell["미달액"] = cell["목표매출"] - cell["매출액"]
over = cell[cell["달성률"] >= 100].sort_values("달성률", ascending=False)
under = cell.sort_values("미달액", ascending=False)


def status(rate):
    return "달성" if rate >= 100 else ("근접" if rate >= 97 else "미달")


tones = {"달성": "good", "근접": "warn", "미달": "bad"}

best_m, worst_m = mon["달성률"].idxmax(), mon["달성률"].idxmin()

spec = {
    "meta": {
        "title": "2026년 1~9월 영업 실적 리뷰",
        "subtitle": "지역별·제품별 실적과 목표 대비 달성률",
        "source": f"{SRC.name} (판매내역 225행, 2026-01 ~ 2026-09)",
        "generatedAt": "2026-10-06",
        "author": "영업회의",
    },
    "summary": [
        f"1~9월 누적 매출 **{eok(tot_sales)}**, 목표 {eok(tot_tgt)} 대비 달성률 **{tot_rate:.1f}%** — {eok(gap)} 미달",
        f"9개월 모두 목표 미달. 상반기 {h1_rate:.1f}% → 3분기 {q3_rate:.1f}%로 하락, 9월이 {mon.loc[worst_m, '달성률']:.1f}%로 최저",
        f"**{worst_reg}**가 매출 비중 {gg_share_sales:.0f}%의 최대 지역이지만 달성률 {reg.loc[worst_reg, '달성률']:.1f}%로 최하위 — 전체 미달액의 {worst_gap_share:.0f}%",
        f"제품은 **{worst_prd}** {prd.loc[worst_prd, '달성률']:.1f}%가 가장 낮고, 매출 1위 SSD 2TB도 {prd.loc['SSD 2TB', '달성률']:.1f}%",
        f"지역×제품 25개 조합 중 목표 달성은 {len(over)}개뿐",
    ],
    "kpis": [
        {"label": "누적 매출 (1~9월)", "value": tot_sales, "format": "currency", "currency": "KRW", "decimals": 2,
         "hint": "판매내역 합계", "spark": [int(v) for v in mon["매출액"]]},
        {"label": "목표 달성률", "value": r1(tot_rate), "format": "percent",
         "hint": f"목표 {eok(tot_tgt)} 대비", "spark": [r1(v) for v in mon["달성률"]]},
        {"label": "목표 미달액", "value": gap, "format": "currency", "currency": "KRW", "decimals": 2,
         "good": "down", "hint": "목표매출 − 매출액"},
        {"label": "판매 수량", "value": tot_qty, "unit": "개", "hint": "1~9월 누적",
         "spark": [int(v) for v in mon["수량"]]},
    ],
    "charts": [
        {"id": "monthly", "title": "월별 매출 vs 목표", "subtitle": "막대: 매출액 · 선: 목표매출 (원)",
         "type": "bar", "x": mlabel, "format": "currency", "span": 2, "height": 330,
         "series": [
             {"name": "매출액", "data": [int(v) for v in mon["매출액"]]},
             {"name": "목표매출", "data": [int(v) for v in mon["목표매출"]], "type": "line"},
         ]},
        {"id": "monthly-rate", "title": "월별 달성률", "subtitle": "단위: %",
         "type": "line", "x": mlabel, "format": "percent", "span": 2, "height": 330,
         "series": [{"name": "달성률", "data": [r1(v) for v in mon["달성률"]]}],
         "note": "목표선 100%"},
        {"id": "region-sales", "title": "지역별 매출 vs 목표", "subtitle": "1~9월 누적, 매출액 순 (원)",
         "type": "bar", "x": list(reg_s.index), "format": "currency", "height": 330,
         "series": [
             {"name": "매출액", "data": [int(v) for v in reg_s["매출액"]]},
             {"name": "목표매출", "data": [int(v) for v in reg_s["목표매출"]]},
         ]},
        {"id": "region-rate", "title": "지역별 목표 대비 차이", "subtitle": "달성률 − 100, 단위: %p (0 = 목표 달성)",
         "type": "hbar", "x": list(reg_r.index), "format": "decimal", "decimals": 1, "unit": "%p", "height": 330,
         "series": [{"name": "목표 대비", "data": [r1(v - 100) for v in reg_r["달성률"]]}]},
        {"id": "product-sales", "title": "제품별 매출 vs 목표", "subtitle": "1~9월 누적, 매출액 순 (원)",
         "type": "bar", "x": list(prd_s.index), "format": "currency", "height": 330,
         "series": [
             {"name": "매출액", "data": [int(v) for v in prd_s["매출액"]]},
             {"name": "목표매출", "data": [int(v) for v in prd_s["목표매출"]]},
         ]},
        {"id": "product-rate", "title": "제품별 목표 대비 차이", "subtitle": "달성률 − 100, 단위: %p (0 = 목표 달성)",
         "type": "hbar", "x": list(prd_r.index), "format": "decimal", "decimals": 1, "unit": "%p", "height": 330,
         "series": [{"name": "목표 대비", "data": [r1(v - 100) for v in prd_r["달성률"]]}]},
    ],
    "tables": [
        {"id": "region-table", "title": "지역별 실적 요약",
         "columns": [
             {"key": "name", "label": "지역"},
             {"key": "sales", "label": "매출액(백만 원)", "type": "number", "format": "decimal", "decimals": 1},
             {"key": "target", "label": "목표매출(백만 원)", "type": "number", "format": "decimal", "decimals": 1},
             {"key": "gap", "label": "미달액(백만 원)", "type": "number", "format": "decimal", "decimals": 1},
             {"key": "rate", "label": "달성률", "type": "number", "format": "percent", "decimals": 1},
             {"key": "status", "label": "상태", "type": "badge", "tones": tones},
         ],
         "rows": [{"name": k, "sales": mm(v["매출액"]), "target": mm(v["목표매출"]), "gap": mm(v["미달액"]),
                   "rate": r1(v["달성률"]), "status": status(v["달성률"])} for k, v in reg_s.iterrows()]},
        {"id": "product-table", "title": "제품별 실적 요약",
         "columns": [
             {"key": "name", "label": "제품"},
             {"key": "sales", "label": "매출액(백만 원)", "type": "number", "format": "decimal", "decimals": 1},
             {"key": "target", "label": "목표매출(백만 원)", "type": "number", "format": "decimal", "decimals": 1},
             {"key": "gap", "label": "미달액(백만 원)", "type": "number", "format": "decimal", "decimals": 1},
             {"key": "rate", "label": "달성률", "type": "number", "format": "percent", "decimals": 1},
             {"key": "status", "label": "상태", "type": "badge", "tones": tones},
         ],
         "rows": [{"name": k, "sales": mm(v["매출액"]), "target": mm(v["목표매출"]), "gap": mm(v["미달액"]),
                   "rate": r1(v["달성률"]), "status": status(v["달성률"])} for k, v in prd_s.iterrows()]},
        {"id": "gap-top", "title": "미달액 상위 지역×제품", "subtitle": "미달액 큰 순 상위 6개 (25개 조합 중)",
         "columns": [
             {"key": "region", "label": "지역"},
             {"key": "product", "label": "제품"},
             {"key": "gap", "label": "미달액(백만 원)", "type": "number", "format": "decimal", "decimals": 1},
             {"key": "rate", "label": "달성률", "type": "number", "format": "percent", "decimals": 1},
             {"key": "status", "label": "상태", "type": "badge", "tones": tones},
         ],
         "rows": [{"region": r, "product": p, "gap": mm(v["미달액"]), "rate": r1(v["달성률"]),
                   "status": status(v["달성률"])} for (r, p), v in under.head(6).iterrows()]},
    ],
    "sections": [
        {"id": "trend", "title": "월별 추이: 9개월 연속 목표 미달",
         "bullets": [
             f"최고 {int(best_m[5:7])}월 {mon.loc[best_m, '달성률']:.1f}%, 최저 {int(worst_m[5:7])}월 {mon.loc[worst_m, '달성률']:.1f}%",
             f"분기 달성률 Q1 {q.loc['Q1', '달성률']:.1f}% · Q2 {q.loc['Q2', '달성률']:.1f}% · Q3 {q.loc['Q3', '달성률']:.1f}%",
         ],
         "charts": ["monthly"]},
        {"id": "trend-rate", "title": "3분기 들어 달성률 하락",
         "bullets": [f"상반기 {h1_rate:.1f}% → 3분기 {q3_rate:.1f}% ({q3_rate - h1_rate:+.1f}%p)"],
         "charts": ["monthly-rate"]},
        {"id": "region", "title": f"지역: {worst_reg}가 최대 시장이자 최대 미달",
         "bullets": [
             f"{worst_reg} 매출 {eok(reg.loc[worst_reg, '매출액'])} (비중 {gg_share_sales:.0f}%), 달성률 {reg.loc[worst_reg, '달성률']:.1f}%",
             f"{worst_reg} 미달액 {eok(reg.loc[worst_reg, '미달액'])} = 전체 미달액의 {worst_gap_share:.0f}%",
         ],
         "charts": ["region-sales"]},
        {"id": "region-r", "title": "지역별 달성률: 모두 목표 미달",
         "bullets": [f"{best_reg} {reg.loc[best_reg, '달성률']:.1f}%로 최고, 모든 지역 100% 미만"],
         "charts": ["region-rate"]},
        {"id": "region-t", "title": "지역별 실적 요약", "tables": ["region-table"]},
        {"id": "product", "title": "제품: SSD 2TB가 매출 1위, 미달액도 1위",
         "bullets": [
             f"SSD 2TB 매출 {eok(prd.loc['SSD 2TB', '매출액'])} (비중 {prd.loc['SSD 2TB', '매출액'] / tot_sales * 100:.0f}%), 미달액 {eok(prd.loc['SSD 2TB', '미달액'])}",
         ],
         "charts": ["product-sales"]},
        {"id": "product-r", "title": "제품별 달성률: 5개 제품 모두 미달",
         "bullets": [f"{worst_prd} {prd.loc[worst_prd, '달성률']:.1f}% 최저 · {best_prd} {prd.loc[best_prd, '달성률']:.1f}% 최고"],
         "charts": ["product-rate"]},
        {"id": "product-t", "title": "제품별 실적 요약", "tables": ["product-table"]},
        {"id": "cells", "title": "어디를 메워야 하나: 미달액 상위 조합",
         "bullets": [
             "달성 조합: " + ", ".join(f"{r} {p} {v['달성률']:.1f}%" for (r, p), v in over.iterrows()),
         ],
         "tables": ["gap-top"]},
    ],
}

out = HERE / "spec.json"
out.write_text(json.dumps(spec, ensure_ascii=False, indent=2), encoding="utf-8")
print(f"wrote {out}  total={tot_sales} target={tot_tgt} rate={tot_rate:.2f}% gap={gap}")
