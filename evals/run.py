#!/usr/bin/env python3
"""The Elaya eval runner — the exam.

Runs the golden set against the LIVE app (default http://localhost:3000) as a
real signed-in user, and scores what actually happened: the streamed reply, the
persisted tool calls (with full args), and the elaya_actions proposal rows.

Usage:
    python3 run.py                          # safe cases only (no writes)
    python3 run.py --allow-writes           # include cases that mutate data
    python3 run.py --include-tags needs-seed
    python3 run.py --only task-hinglish     # id substring filter
    python3 run.py --base-url https://staging.example.com

Every message burns one slot of the eval user's shared 200/day Elaya cap.
Each case runs in its own fresh conversation (created via service role,
archived afterwards) so cases never contaminate each other or the user's
real active session.
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import yaml

from harness.chat import send_message, smoke_auth
from harness.config import EVALS_DIR, load_config
from harness.fixtures import apply_setup
from harness.score import score_step
from harness.supa import Db, auth_cookies, sign_in


def load_cases(paths: list[Path]) -> list[dict]:
    cases: list[dict] = []
    for path in paths:
        cases.extend(yaml.safe_load(path.read_text()) or [])
    return cases


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("golden", nargs="*", help="golden set yaml files (default: golden/*.yaml)")
    ap.add_argument("--allow-writes", action="store_true", help="run cases marked mutates: true")
    ap.add_argument("--include-tags", default="", help="comma list of tags to include (default: tagged cases are skipped)")
    ap.add_argument("--only", default="", help="run only cases whose id contains this substring")
    ap.add_argument("--base-url", default="", help="override EVAL_BASE_URL")
    args = ap.parse_args()

    cfg = load_config()
    base_url = args.base_url.rstrip("/") if args.base_url else cfg.base_url
    include_tags = {t.strip() for t in args.include_tags.split(",") if t.strip()}

    golden_paths = [Path(p) for p in args.golden] or sorted((EVALS_DIR / "golden").glob("*.yaml"))
    cases = load_cases(golden_paths)

    session = sign_in(cfg)
    cookies = auth_cookies(cfg, session)
    user_id = session["user"]["id"]
    db = Db(cfg)

    if not smoke_auth(base_url, cookies):
        print("✗ auth smoke check failed — the app did not accept the session cookie.")
        print(f"  (is the app running at {base_url}? is the eval user active?)")
        return 2

    print(f"✓ authed as {cfg.eval_email} against {base_url}")
    print(f"  {len(cases)} cases loaded from {len(golden_paths)} file(s)\n")

    results = []
    passed = failed = skipped = known = 0

    for case in cases:
        cid = case["id"]
        if args.only and args.only not in cid:
            continue
        tags = set(case.get("tags") or [])
        if case.get("mutates") and not args.allow_writes:
            skipped += 1
            print(f"—  SKIP  {cid}  (mutates; use --allow-writes)")
            continue
        if tags and not (tags & include_tags):
            skipped += 1
            print(f"—  SKIP  {cid}  (tags {sorted(tags)}; use --include-tags)")
            continue

        conversation_id = db.create_eval_conversation(user_id)
        case_checks = []
        case_error = None
        try:
            if case.get("setup"):
                apply_setup(cfg, db, case["setup"])
            for step in case["steps"]:
                turn = send_message(base_url, cookies, step["send"], conversation_id)
                if not turn.ok:
                    case_error = f"HTTP {turn.status_code}: {turn.rejected}"
                    break
                assistant = db.latest_assistant(conversation_id)
                action = db.latest_action(conversation_id)
                case_checks.extend(
                    score_step(step.get("expect") or {}, turn.reply, assistant, action, turn.sse_tools)
                )
                time.sleep(0.3)
        finally:
            db.archive_conversation(conversation_id)

        ok = case_error is None and all(c.ok for c in case_checks)
        if case.get("known_fail"):
            known += 1
            marker = "≈  KNOWN" if not ok else "★  FIXED"
            print(f"{marker}  {cid}")
        elif ok:
            passed += 1
            print(f"✓  PASS  {cid}")
        else:
            failed += 1
            print(f"✗  FAIL  {cid}" + (f"  [{case_error}]" if case_error else ""))
            for c in case_checks:
                if not c.ok:
                    print(f"      · {c.name}  →  {c.detail}")

        results.append(
            {
                "id": cid,
                "ok": ok,
                "known_fail": bool(case.get("known_fail")),
                "error": case_error,
                # The REAL dataset — the exact messages sent (Hinglish, typos,
                # voice artifacts). The report shows these beside each case.
                "messages": [step["send"] for step in case["steps"]],
                "checks": [{"name": c.name, "ok": c.ok, "detail": c.detail} for c in case_checks],
            }
        )

    total_scored = passed + failed
    print("\n" + "═" * 52)
    print(f"  SCORE: {passed}/{total_scored} passed"
          + (f"   ({known} known-gap cases tracked separately)" if known else "")
          + (f"   ({skipped} skipped)" if skipped else ""))
    print("═" * 52)

    out_dir = EVALS_DIR / "results"
    out_dir.mkdir(exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    (out_dir / f"{stamp}.json").write_text(json.dumps(
        {"stamp": stamp, "base_url": base_url, "passed": passed, "failed": failed,
         "skipped": skipped, "known": known, "results": results}, indent=2))
    print(f"  results → evals/results/{stamp}.json")

    # Rebuild the HTML report so the UI is always current (evals/results/report.html).
    try:
        import report as _report
        print(f"  report  → {_report.build()}")
    except Exception as e:  # report failure never fails the run
        print(f"  (report rebuild failed: {e})")

    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
