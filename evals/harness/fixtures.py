"""Per-case fixtures. A golden case may carry a `setup:` block that runs BEFORE
its first step, putting shared state (the seeded test lead) into a known shape
so cases stay deterministic run after run.

Learned from run 2: `lead-call-vs-note` auto-advanced Testak new→touched (the
real SLA behavior), so `confirm-propose-waits` found him already touched and
Elaya — correctly — proposed nothing. Fixtures fix the exam, not the model.

Supported setup keys:
  lead_status: { slug: <slug>, status: <status> }
      Resets the lead row AND deletes its Redis row-cache keys
      (lead:row:slug:<slug> + lead:row:id:<id>) so the app cannot serve the
      pre-reset status from cache.
"""

from __future__ import annotations

from typing import Any

import requests

from .config import Config
from .supa import Db


def _redis_del(cfg: Config, key: str) -> None:
    if not cfg.upstash_url or not cfg.upstash_token:
        return  # no Redis configured — cache may serve stale for its TTL
    try:
        requests.get(
            f"{cfg.upstash_url}/del/{key}",
            headers={"Authorization": f"Bearer {cfg.upstash_token}"},
            timeout=10,
        )
    except requests.RequestException:
        pass  # non-fatal: worst case is a stale-cache flake, not a crash


def apply_setup(cfg: Config, db: Db, setup: dict[str, Any]) -> None:
    lead_status = setup.get("lead_status")
    if lead_status:
        slug = lead_status["slug"]
        db.reset_lead_status(slug, lead_status["status"])
        _redis_del(cfg, f"lead:row:slug:{slug}")
        lead_id = db.lead_id_for(slug)
        if lead_id:
            _redis_del(cfg, f"lead:row:id:{lead_id}")
