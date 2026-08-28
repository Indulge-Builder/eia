#!/usr/bin/env python3
"""Eval report — the UI for the exam.

Reads every evals/results/*.json and writes evals/results/report.html:
  • the latest run's headline score (stat tile)
  • the score trend across runs (single-series line, labeled points)
  • a case × run history grid (✓ pass · ✗ fail · ≈ known gap · ★ gap fixed · — not run)
  • the latest run's failed checks, expanded

Self-contained HTML, no dependencies, safe to open from disk.
Run directly (`python3 report.py`) to rebuild + open; run.py also rebuilds it
after every exam.
"""

from __future__ import annotations

import html
import json
import subprocess
import sys
from pathlib import Path

RESULTS_DIR = Path(__file__).resolve().parent / "results"

# Status colors (status palette job: state, never identity) — every cell also
# carries a SYMBOL, so meaning never rides on color alone.
C_PASS, C_FAIL, C_KNOWN, C_FIXED, C_SKIP = "#1a7f37", "#c93c37", "#b26a00", "#6841c7", "#8a8f98"
INK, INK_2, LINE, SURFACE, CARD = "#1f2328", "#59606a", "#e4e7eb", "#f7f8fa", "#ffffff"


def load_runs() -> list[dict]:
    runs = []
    for path in sorted(RESULTS_DIR.glob("*.json")):
        try:
            runs.append(json.loads(path.read_text()))
        except json.JSONDecodeError:
            continue
    return runs


def cell(entry: dict | None) -> tuple[str, str, str]:
    """(symbol, color, tooltip) for one case in one run."""
    if entry is None:
        return "—", C_SKIP, "not in this run"
    if entry.get("known_fail"):
        return ("★", C_FIXED, "known gap: FIXED") if entry["ok"] else ("≈", C_KNOWN, "known gap (tracked)")
    if entry["ok"]:
        return "✓", C_PASS, "pass"
    fails = "; ".join(c["name"] for c in entry.get("checks", []) if not c["ok"]) or (entry.get("error") or "failed")
    return "✗", C_FAIL, fails[:220]


def trend_svg(runs: list[dict]) -> str:
    pts = []
    for r in runs:
        scored = r.get("passed", 0) + r.get("failed", 0)
        pts.append((r["stamp"], (r.get("passed", 0) / scored * 100) if scored else 0, scored))
    w, h, pad = max(320, 64 * len(pts) + 40), 120, 26
    if len(pts) == 1:
        xs = [w / 2]
    else:
        xs = [pad + i * (w - 2 * pad) / (len(pts) - 1) for i in range(len(pts))]
    ys = [h - pad - (p[1] / 100) * (h - 2 * pad) for p in pts]
    line = " ".join(f"{x:.1f},{y:.1f}" for x, y in zip(xs, ys))
    dots = "".join(
        f'<circle cx="{x:.1f}" cy="{y:.1f}" r="4" fill="{C_PASS}">'
        f"<title>{html.escape(p[0])} — {p[1]:.0f}% of {p[2]} scored</title></circle>"
        f'<text x="{x:.1f}" y="{y - 9:.1f}" text-anchor="middle" class="pt">{p[1]:.0f}%</text>'
        f'<text x="{x:.1f}" y="{h - 6}" text-anchor="middle" class="pn">n={p[2]}</text>'
        for x, y, p in zip(xs, ys, pts)
    )
    grid = "".join(
        f'<line x1="{pad}" y1="{h - pad - v / 100 * (h - 2 * pad):.1f}" x2="{w - pad}" '
        f'y2="{h - pad - v / 100 * (h - 2 * pad):.1f}" stroke="{LINE}" stroke-width="1"/>'
        for v in (0, 50, 100)
    )
    return (
        f'<svg viewBox="0 0 {w} {h}" style="width:100%;max-width:{w}px" role="img" '
        f'aria-label="Pass rate per run">{grid}'
        f'<polyline points="{line}" fill="none" stroke="{C_PASS}" stroke-width="2"/>{dots}</svg>'
    )


def build() -> Path:
    runs = load_runs()
    if not runs:
        sys.exit("no results yet — run the exam first (python3 run.py)")

    latest = runs[-1]
    scored = latest.get("passed", 0) + latest.get("failed", 0)
    case_ids: list[str] = []
    for r in runs:
        for res in r["results"]:
            if res["id"] not in case_ids:
                case_ids.append(res["id"])
    by_run = [{res["id"]: res for res in r["results"]} for r in runs]
    shown = runs[-12:]
    shown_maps = by_run[-12:]

    head = "".join(
        f'<th title="{html.escape(r["stamp"])}">{html.escape(r["stamp"][9:13])}<br>'
        f'<span class="dim">{html.escape(r["stamp"][4:8])}</span></th>'
        for r in shown
    )
    # The real message(s) per case — pulled from the newest run that carries them.
    msgs_by_case: dict[str, list[str]] = {}
    for m in reversed(by_run):
        for cid, res in m.items():
            if cid not in msgs_by_case and res.get("messages"):
                msgs_by_case[cid] = res["messages"]

    rows = ""
    for cid in case_ids:
        cells = ""
        for m in shown_maps:
            sym, color, tip = cell(m.get(cid))
            cells += f'<td><span class="c" style="color:{color}" title="{html.escape(tip)}">{sym}</span></td>'
        msgs = msgs_by_case.get(cid, [])
        msg_html = "".join(
            f'<div class="msg">“{html.escape(t[:110])}{"…" if len(t) > 110 else ""}”</div>' for t in msgs
        )
        rows += (
            f'<tr><td class="cid"><span class="cname">{html.escape(cid)}</span>{msg_html}</td>{cells}</tr>\n'
        )

    fails_html = ""
    for res in latest["results"]:
        if res["ok"] or res.get("known_fail"):
            continue
        checks = "".join(
            f"<li><b>{html.escape(c['name'])}</b><br><span class='dim'>{html.escape(c['detail'][:400])}</span></li>"
            for c in res["checks"]
            if not c["ok"]
        ) or f"<li>{html.escape(res.get('error') or 'failed')}</li>"
        fails_html += f"<details open><summary>✗ {html.escape(res['id'])}</summary><ul>{checks}</ul></details>"
    if not fails_html:
        fails_html = '<p class="allclear">All scored cases passed. ✓</p>'

    known_open = sum(1 for r in latest["results"] if r.get("known_fail") and not r["ok"])

    page = f"""<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Elaya Evals</title><style>
  * {{ box-sizing: border-box; margin: 0; }}
  body {{ font: 14px/1.5 -apple-system, system-ui, sans-serif; color: {INK}; background: {SURFACE}; padding: 28px; }}
  main {{ max-width: 980px; margin: 0 auto; display: grid; gap: 18px; }}
  .card {{ background: {CARD}; border: 1px solid {LINE}; border-radius: 10px; padding: 18px 20px; }}
  h1 {{ font-size: 19px; }} h2 {{ font-size: 13px; text-transform: uppercase; letter-spacing: .06em; color: {INK_2}; margin-bottom: 10px; }}
  .hero {{ display: flex; gap: 34px; align-items: baseline; flex-wrap: wrap; }}
  .hero .n {{ font-size: 44px; font-weight: 650; color: {C_PASS}; }}
  .hero .n.bad {{ color: {C_FAIL}; }}
  .meta {{ color: {INK_2}; font-size: 13px; }}
  table {{ border-collapse: collapse; width: 100%; }}
  th {{ font-size: 11px; color: {INK_2}; font-weight: 500; padding: 4px 6px; text-align: center; }}
  td {{ border-top: 1px solid {LINE}; padding: 3px 6px; text-align: center; }}
  td.cid {{ text-align: left; }}
  .cname {{ font-family: ui-monospace, monospace; font-size: 12.5px; }}
  .msg {{ color: {INK_2}; font-size: 12px; font-style: italic; margin-top: 1px; }}
  .c {{ font-weight: 700; cursor: default; }}
  .dim {{ color: {INK_2}; font-weight: 400; }}
  .pt {{ font-size: 10px; fill: {INK_2}; }} .pn {{ font-size: 9px; fill: {INK_2}; }}
  .legend span {{ margin-right: 16px; font-size: 12.5px; color: {INK_2}; }}
  details {{ border-top: 1px solid {LINE}; padding: 8px 0; }} summary {{ cursor: pointer; font-weight: 600; color: {C_FAIL}; }}
  ul {{ margin: 6px 0 0 22px; }} li {{ margin-bottom: 6px; }}
  .allclear {{ color: {C_PASS}; font-weight: 600; }}
  .scroll {{ overflow-x: auto; }}
</style></head><body><main>
<div class="card hero">
  <div><h1>Elaya Evals<span style="color:{C_PASS}">.</span></h1>
  <div class="meta">latest run {html.escape(latest['stamp'])} · {html.escape(latest.get('base_url', ''))}</div></div>
  <div class="n{' bad' if latest.get('failed') else ''}">{latest.get('passed', 0)}/{scored}</div>
  <div class="meta">{latest.get('skipped', 0)} skipped · {known_open} known gap{'s' if known_open != 1 else ''} open</div>
</div>
<div class="card"><h2>Pass rate per run</h2>{trend_svg(runs)}
  <p class="meta">n = cases scored in that run (filtered runs are small on purpose).</p></div>
<div class="card"><h2>Case history · last {len(shown)} runs (newest right)</h2>
  <div class="legend"><span style="color:{C_PASS}">✓ pass</span><span style="color:{C_FAIL}">✗ fail</span>
  <span style="color:{C_KNOWN}">≈ known gap</span><span style="color:{C_FIXED}">★ gap fixed</span>
  <span style="color:{C_SKIP}">— not run</span></div>
  <div class="scroll"><table><tr><th style="text-align:left">case</th>{head}</tr>{rows}</table></div></div>
<div class="card"><h2>Latest run — failures</h2>{fails_html}</div>
</main></body></html>"""

    out = RESULTS_DIR / "report.html"
    out.write_text(page)
    return out


if __name__ == "__main__":
    path = build()
    print(f"report → {path}")
    if sys.platform == "darwin":
        subprocess.run(["open", str(path)], check=False)
