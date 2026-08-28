"""Supabase access — one thin PostgREST client, service-role, shared.

The brain reads with the SERVICE key and scopes in code from the verified
principal (the parity rule, plan-elaya law 4): a turn may run sessionless
(WhatsApp, jobs), so RLS-by-session can never be the mechanism. This mirrors
the Node side's admin-client convention (Q-13) exactly.

Deliberately httpx over a heavy SDK: the brain needs GET/POST/PATCH with
headers — nothing more. `schema` switches Accept-Profile for sia.* tables.
"""

from __future__ import annotations

from typing import Any

import httpx

from app.config import settings

_client: httpx.AsyncClient | None = None


def _base_headers(schema: str) -> dict[str, str]:
    return {
        "apikey": settings.supabase_service_role_key,
        "Authorization": f"Bearer {settings.supabase_service_role_key}",
        "Accept-Profile": schema,
        "Content-Profile": schema,
    }


def client() -> httpx.AsyncClient:
    global _client
    if _client is None:
        _client = httpx.AsyncClient(
            base_url=f"{settings.supabase_url}/rest/v1",
            timeout=httpx.Timeout(15.0, connect=5.0),
        )
    return _client


async def select(
    table: str,
    params: dict[str, str],
    *,
    schema: str = "public",
) -> list[dict[str, Any]]:
    """GET rows. `params` are raw PostgREST query params (select, filters, order, limit)."""
    r = await client().get(f"/{table}", params=params, headers=_base_headers(schema))
    r.raise_for_status()
    return r.json()


async def select_count(
    table: str,
    params: dict[str, str],
    *,
    schema: str = "public",
) -> tuple[list[dict[str, Any]], int]:
    """GET rows + the exact total count (Prefer: count=exact / Content-Range)."""
    headers = {**_base_headers(schema), "Prefer": "count=exact"}
    r = await client().get(f"/{table}", params=params, headers=headers)
    r.raise_for_status()
    total = 0
    content_range = r.headers.get("content-range", "")
    if "/" in content_range:
        tail = content_range.rsplit("/", 1)[-1]
        total = int(tail) if tail.isdigit() else 0
    return r.json(), total


async def rpc(fn: str, args: dict[str, Any], *, schema: str = "public") -> Any:
    """Call a Postgres function via PostgREST — the SAME SECURITY DEFINER RPCs
    the Node brain uses (service-role, revoked tier). Parity by construction:
    identical SQL produces identical numbers on both brains."""
    r = await client().post(f"/rpc/{fn}", json=args, headers=_base_headers(schema))
    r.raise_for_status()
    return r.json()


async def select_one(
    table: str,
    params: dict[str, str],
    *,
    schema: str = "public",
) -> dict[str, Any] | None:
    rows = await select(table, {**params, "limit": "1"}, schema=schema)
    return rows[0] if rows else None


# ── Domain reads the brain foundation needs ──────────────────────────────


async def get_profile(user_id: str) -> dict[str, Any] | None:
    """The VERIFIED identity read — authorization only ever derives from
    public.profiles (the Golden Rule / rule 09), never from a request payload."""
    return await select_one(
        "profiles",
        {"select": "id, role, domain, full_name, is_active", "id": f"eq.{user_id}"},
    )


async def get_llm_job_config(job_type: str) -> dict[str, Any] | None:
    """llm_providers row for a tier — read PER REQUEST, never cached at module
    level (the sla_policies pattern): a model switch is a DB edit, no deploy."""
    return await select_one(
        "llm_providers",
        {
            "select": "job_type, provider, model, max_tokens, active",
            "job_type": f"eq.{job_type}",
            "active": "eq.true",
        },
    )


async def get_pii_masking_depth() -> str:
    """elaya_settings pii_masking_depth — 'light' is the shipped default."""
    row = await select_one(
        "elaya_settings", {"select": "value", "key": "eq.pii_masking_depth"}
    )
    value = (row or {}).get("value")
    return value if value in ("off", "light", "strict") else "light"
