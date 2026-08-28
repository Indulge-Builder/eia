"""Supabase plumbing for the eval harness.

Two jobs:
  1. AUTH — sign the eval user in (GoTrue password grant) and build the exact
     sb-<ref>-auth-token cookie(s) @supabase/ssr expects, so the harness can call
     the app's session-authenticated routes like a real browser.
  2. VERIFY — service-role PostgREST reads/writes: create an isolated eval
     conversation per case, read back the assistant row's persisted tool_calls
     (names + FULL args) and the elaya_actions proposal rows to score against.

The service key never leaves this process and is never logged.
"""

from __future__ import annotations

import base64
import json
from typing import Any

import requests

from .config import Config

# @supabase/ssr chunks cookies above this size (its MAX_CHUNK_SIZE).
_MAX_COOKIE_CHUNK = 3180


# ─────────────────────────────────────────────
# Auth
# ─────────────────────────────────────────────

def sign_in(cfg: Config) -> dict[str, Any]:
    """Password-grant sign-in. Returns the full session object."""
    res = requests.post(
        f"{cfg.supabase_url}/auth/v1/token?grant_type=password",
        headers={"apikey": cfg.supabase_anon_key, "Content-Type": "application/json"},
        json={"email": cfg.eval_email, "password": cfg.eval_password},
        timeout=15,
    )
    if res.status_code != 200:
        raise SystemExit(
            f"Eval user sign-in failed ({res.status_code}). "
            "Check EVAL_USER_EMAIL / EVAL_USER_PASSWORD in evals/.env.eval."
        )
    return res.json()


def _b64url_no_pad(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).decode().rstrip("=")


def auth_cookies(cfg: Config, session: dict[str, Any]) -> dict[str, str]:
    """Build the sb-<ref>-auth-token cookie(s) in @supabase/ssr's format:
    value = "base64-" + base64url(session JSON), chunked as name.0, name.1, ...
    when it exceeds the chunk size (the user object usually pushes it over)."""
    name = f"sb-{cfg.project_ref}-auth-token"
    value = "base64-" + _b64url_no_pad(json.dumps(session, separators=(",", ":")).encode())
    if len(value) <= _MAX_COOKIE_CHUNK:
        return {name: value}
    chunks: dict[str, str] = {}
    for i in range(0, len(value), _MAX_COOKIE_CHUNK):
        chunks[f"{name}.{len(chunks)}"] = value[i : i + _MAX_COOKIE_CHUNK]
    return chunks


# ─────────────────────────────────────────────
# Service-role PostgREST
# ─────────────────────────────────────────────

class Db:
    def __init__(self, cfg: Config):
        self._base = f"{cfg.supabase_url}/rest/v1"
        self._headers = {
            "apikey": cfg.supabase_service_key,
            "Authorization": f"Bearer {cfg.supabase_service_key}",
            "Content-Type": "application/json",
        }

    def _get(self, path: str, params: dict[str, str]) -> list[dict[str, Any]]:
        res = requests.get(f"{self._base}/{path}", headers=self._headers, params=params, timeout=15)
        res.raise_for_status()
        return res.json()

    def create_eval_conversation(self, user_id: str) -> str:
        """A fresh conversation per case = clean isolation (no history bleed
        between cases, and the resolver's proposal lookups stay per-case)."""
        res = requests.post(
            f"{self._base}/elaya_conversations",
            headers={**self._headers, "Prefer": "return=representation"},
            json={"user_id": user_id, "channel": "in_app", "title": "eval"},
            timeout=15,
        )
        res.raise_for_status()
        return res.json()[0]["id"]

    def archive_conversation(self, conversation_id: str) -> None:
        """Archive when the case finishes so eval conversations never become the
        user's active session in the real app."""
        requests.patch(
            f"{self._base}/elaya_conversations",
            headers=self._headers,
            params={"id": f"eq.{conversation_id}"},
            json={"archived_at": "now()"},
            timeout=15,
        )

    def latest_assistant(self, conversation_id: str) -> dict[str, Any] | None:
        rows = self._get(
            "elaya_messages",
            {
                "conversation_id": f"eq.{conversation_id}",
                "role": "eq.assistant",
                "select": "content,tool_calls,meta,created_at",
                "order": "created_at.desc",
                "limit": "1",
            },
        )
        return rows[0] if rows else None

    def reset_lead_status(self, slug: str, status: str) -> None:
        """Case fixture: force a test lead back to a known status (and clear its
        last call outcome so auto-advance behaves like a fresh lead). Direct DB
        write — the caller must also invalidate the lead's Redis row cache or
        the app keeps serving the old status."""
        res = requests.patch(
            f"{self._base}/leads",
            headers={**self._headers, "Prefer": "return=representation"},
            params={"slug": f"eq.{slug}"},
            json={"status": status, "status_changed_at": "now()"},
            timeout=15,
        )
        res.raise_for_status()
        rows = res.json()
        if not rows:
            raise RuntimeError(f"fixture lead '{slug}' not found — seed it (see README)")
        self._fixture_lead_ids = getattr(self, "_fixture_lead_ids", {})
        self._fixture_lead_ids[slug] = rows[0]["id"]

    def lead_id_for(self, slug: str) -> str | None:
        return getattr(self, "_fixture_lead_ids", {}).get(slug)

    def latest_action(self, conversation_id: str) -> dict[str, Any] | None:
        rows = self._get(
            "elaya_actions",
            {
                "conversation_id": f"eq.{conversation_id}",
                "select": "action_type,status,payload,created_at",
                "order": "created_at.desc",
                "limit": "1",
            },
        )
        return rows[0] if rows else None
