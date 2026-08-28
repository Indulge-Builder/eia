"""The tool registry — role-gated reads + the single dispatch gate.

The port of lib/elaya/tools/registry.ts BEGINS here with two tools that prove
the whole spine (dispatch → scoped query → PII gateway → model). The full
24-tool parity port lands tranche by tranche with elaya-workflow.md as the
contract and the eval suite as the gate — the flip never happens on a subset.

Structural laws carried over exactly:
  • Identity args are PRINCIPAL-derived inside each tool — the model supplies
    filter values only, never user_id/role/domain.
  • Dispatch refuses any tool outside the principal's toolset (the Golden
    Rule's enforcement point), with the same calm refusal string shape.
  • Every result is masked by the PII gateway BEFORE the model sees it
    (the loop owns that call, not the tools).
"""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from typing import Any

from app.core import supa


@dataclass(frozen=True)
class Tool:
    name: str
    description: str
    input_schema: dict[str, Any]
    run: Callable[[Any, dict[str, Any]], Awaitable[Any]]  # (principal, args) -> result


# ── get_my_tasks ────────────────────────────────────────────────────


async def _get_my_tasks(principal: Any, _args: dict[str, Any]) -> Any:
    rows = await supa.select(
        "tasks",
        {
            "select": "id, title, status, priority, due_at, task_category",
            "assigned_to": f"eq.{principal.user_id}",  # principal-derived, always
            "status": "in.(to_do,in_progress,in_review)",
            "order": "due_at.asc.nullslast",
            "limit": "15",
        },
    )
    return {"tasks": rows, "count": len(rows)}


# ── search_leads ───────────────────────────────────────────────────────────


async def _search_leads(principal: Any, args: dict[str, Any]) -> Any:
    query = str(args.get("query", "")).strip()
    if len(query) < 2:
        return {"error": "query too short"}
    params: dict[str, str] = {
        "select": "id, slug, first_name, last_name, status, domain, phone, last_activity_at",
        "search_text": f"ilike.*{query}*",
        "order": "last_activity_at.desc.nullslast",
        "limit": "8",
    }
    # Role scoping in CODE — the same shape getLeadsByRole enforces (Q-13):
    # agents see their own leads, managers their domain, admin/founder all.
    if principal.role == "agent":
        params["assigned_to"] = f"eq.{principal.user_id}"
    elif principal.role == "manager":
        params["domain"] = f"eq.{principal.domain}"
    rows = await supa.select("leads", params)
    return {"leads": rows, "count": len(rows)}


# ── Registry + role gates ────────────────────────────────────────────────

TOOLS: dict[str, Tool] = {
    "get_my_tasks": Tool(
        name="get_my_tasks",
        description=(
            "The caller's own open tasks (to do / in progress / in review), "
            "soonest deadline first. No arguments."
        ),
        input_schema={"type": "object", "properties": {}, "additionalProperties": False},
        run=_get_my_tasks,
    ),
    "search_leads": Tool(
        name="search_leads",
        description=(
            "Search leads by name, phone, email or city. Returns the caller's "
            "permitted slice only. Args: query (the search text)."
        ),
        input_schema={
            "type": "object",
            "properties": {"query": {"type": "string", "description": "search text"}},
            "required": ["query"],
            "additionalProperties": False,
        },
        run=_search_leads,
    ),
}

_ALL = frozenset(TOOLS.keys())

TOOLSET_BY_ROLE: dict[str, frozenset[str]] = {
    "agent": _ALL,
    "manager": _ALL,
    "admin": _ALL,
    "founder": _ALL,
    "guest": frozenset(),
}


async def execute_tool(principal: Any, name: str, args: dict[str, Any]) -> Any:
    """THE single dispatch. The toolset check here — not the prompt — is what
    makes access role-gated; a model asking for an ungated tool gets a calm
    refusal result, never an execution."""
    if name not in principal.toolset:
        return {"error": f"tool '{name}' is not available to this user"}
    tool = TOOLS.get(name)
    if tool is None:
        return {"error": f"unknown tool '{name}'"}
    try:
        return await tool.run(principal, args)
    except Exception as e:  # a tool failure is a result, never a crash
        return {"error": f"tool failed: {e}"}


def definitions_for(names: list[str]) -> list[dict[str, Any]]:
    return [
        {
            "name": TOOLS[n].name,
            "description": TOOLS[n].description,
            "input_schema": TOOLS[n].input_schema,
        }
        for n in names
        if n in TOOLS
    ]
