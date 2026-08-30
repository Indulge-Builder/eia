"""The confirmation resolver pre-step — the faithful port of brain.ts's
resolvePendingAction. THE ONLY path through which a state-change executes.

Security-critical invariants, carried over verbatim:
  • The verdict comes from the human's latest USER-role message ONLY — never
    assistant prose or tool/lead content (prompt-injection defence).
  • Only a clear affirmative executes; everything else dismisses (safety bias).
  • PROPOSAL_TTL: a proposal older than 15 minutes auto-dismisses without the
    affirmation check — a later unrelated "haan" can never fire a stale change.
  • H3b — the ask must have been RELAYED: the most recent assistant message
    must be non-empty, else a stray affirmative can't execute a proposal the
    user never saw.
  • Execution itself happens in the Node write registry (through the bridge),
    which re-checks access + the before-snapshot — a stale/moved target fails
    rather than firing.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from app.brain.confirmation import classify_confirmation
from app.brain.principal import StaffPrincipal
from app.core import elaya_store
from app.tools import write_bridge

PROPOSAL_TTL_MS = 15 * 60 * 1000


def _parse_ts(value: str) -> datetime | None:
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except (ValueError, AttributeError):
        return None


async def resolve_pending_action(
    principal: StaffPrincipal,
    conversation_id: str,
    history: list[dict[str, Any]],
) -> str | None:
    """Returns a code-generated line to surface when something executed, or
    None when there was nothing to resolve / the proposal was dismissed (the
    model then handles the new message fresh)."""
    pending = await elaya_store.get_latest_proposed_action(conversation_id, principal.user_id)
    if not pending:
        return None

    # TTL guard (H3) — dismiss without ever reaching the affirmation check.
    created = _parse_ts(pending.get("created_at", ""))
    age_ms = (
        (datetime.now(timezone.utc) - created).total_seconds() * 1000
        if created
        else PROPOSAL_TTL_MS + 1
    )
    if age_ms > PROPOSAL_TTL_MS:
        await elaya_store.mark_action_dismissed(pending["id"], principal.user_id)
        return None

    # The human's latest message = the last user-role row (the route inserted it
    # before calling the brain). Anything else → never a confirmation.
    last_user = next((m for m in reversed(history) if m.get("role") == "user"), None)
    verdict = classify_confirmation(last_user["content"]) if last_user else "other"

    # H3b — the confirmation prompt must actually have been relayed.
    last_assistant = next((m for m in reversed(history) if m.get("role") == "assistant"), None)
    ask_was_relayed = bool(last_assistant and (last_assistant.get("content") or "").strip())

    if verdict == "affirmative" and ask_was_relayed:
        _status, line = await write_bridge.execute_proposed(principal.user_id, pending["id"])
        return line

    await elaya_store.mark_action_dismissed(pending["id"], principal.user_id)
    return None
