"""Scores one turn against a step's `expect` block.

Tool evidence comes from the PERSISTED assistant row (tool_calls jsonb carries
full args, which the SSE stream does not), with the SSE tool events as fallback.
Proposal evidence comes from the latest elaya_actions row in the case's own
isolated conversation.

Expectation vocabulary (all keys optional):
  tools:        [name, ...]        every listed tool must have been called
  tools_any_of: [name, ...]        at least one of these must have been called
  tools_none:   [name, ...]        none of these may have been called
  tool_count:   {name: n}          the tool must appear exactly n times
  tool_args:    [{tool, contains: {arg: substring}}]
                                   a call to `tool` must exist whose arg value
                                   (stringified) contains the substring (ci)
  reply_any:    [substr, ...]      at least one appears in the reply (ci)
  reply_all:    [substr, ...]      all appear in the reply (ci)
  reply_none:   [substr, ...]      none appear in the reply (ci)
  action_row:   {action_type?, status?}
                                   the latest elaya_actions row matches
  action_row_not: {status?}        the latest elaya_actions row must NOT match
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass
class Check:
    name: str
    ok: bool
    detail: str = ""


def _calls_from(assistant_row: dict[str, Any] | None, sse_tools: list[str]) -> list[dict[str, Any]]:
    calls = (assistant_row or {}).get("tool_calls") or []
    if calls:
        return calls
    return [{"name": n, "input": {}} for n in sse_tools]


def score_step(
    expect: dict[str, Any],
    reply: str,
    assistant_row: dict[str, Any] | None,
    action_row: dict[str, Any] | None,
    sse_tools: list[str],
) -> list[Check]:
    checks: list[Check] = []
    calls = _calls_from(assistant_row, sse_tools)
    names = [c.get("name", "") for c in calls]
    reply_ci = reply.lower()

    for tool in expect.get("tools", []):
        checks.append(Check(f"called {tool}", tool in names, f"called: {names}"))

    if expect.get("tools_any_of"):
        wanted = expect["tools_any_of"]
        ok = any(t in names for t in wanted)
        checks.append(Check(f"called any of {wanted}", ok, f"called: {names}"))

    for tool in expect.get("tools_none", []):
        checks.append(Check(f"did NOT call {tool}", tool not in names, f"called: {names}"))

    for tool, n in (expect.get("tool_count") or {}).items():
        count = names.count(tool)
        checks.append(Check(f"{tool} called {n}x", count == n, f"was {count}x"))

    for spec in expect.get("tool_args", []):
        tool = spec["tool"]
        contains: dict[str, str] = spec.get("contains", {})
        matched = False
        for call in calls:
            if call.get("name") != tool:
                continue
            args = call.get("input") or {}
            if all(str(v).lower() in str(args.get(k, "")).lower() for k, v in contains.items()):
                matched = True
                break
        checks.append(
            Check(
                f"{tool} args contain {contains}",
                matched,
                f"calls: {[c.get('input') for c in calls if c.get('name') == tool]}",
            )
        )

    # Convention: an all-lowercase expectation matches case-insensitively; an
    # expectation carrying uppercase matches EXACTLY. (Learned from run 2:
    # a ci check for "Rs " matched the tail of "numbers " — false positive.)
    def _contains(sub: str) -> bool:
        return sub in reply if sub != sub.lower() else sub.lower() in reply_ci

    if expect.get("reply_any"):
        subs = expect["reply_any"]
        ok = any(_contains(s) for s in subs)
        checks.append(Check(f"reply contains any of {subs}", ok, reply[:160]))

    for sub in expect.get("reply_all", []):
        checks.append(Check(f"reply contains '{sub}'", _contains(sub), reply[:160]))

    for sub in expect.get("reply_none", []):
        checks.append(Check(f"reply avoids '{sub}'", not _contains(sub), reply[:160]))

    if expect.get("action_row"):
        want = expect["action_row"]
        if action_row is None:
            checks.append(Check(f"action row {want}", False, "no elaya_actions row"))
        else:
            ok = all(str(action_row.get(k)) == str(v) for k, v in want.items())
            checks.append(
                Check(
                    f"action row {want}",
                    ok,
                    f"was {{'action_type': {action_row.get('action_type')!r}, 'status': {action_row.get('status')!r}}}",
                )
            )

    if expect.get("action_row_not"):
        want = expect["action_row_not"]
        if action_row is None:
            checks.append(Check(f"action row NOT {want}", True, "no row"))
        else:
            matched = all(str(action_row.get(k)) == str(v) for k, v in want.items())
            checks.append(
                Check(f"action row NOT {want}", not matched, f"was status={action_row.get('status')!r}")
            )

    return checks
