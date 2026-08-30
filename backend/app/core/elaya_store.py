"""Elaya conversation persistence — the faithful port of elaya-service.ts.

Same tables, same semantics, byte-comparable behavior:
  • ONE active session per user across channels — resolved by the last-message
    recency window (session_expiry_hours, config row), never by channel.
  • Messages are APPEND-ONLY (inserts, ever — A-11).
  • The daily cap counts USER-role messages since IST midnight across all the
    user's conversations, and FAILS CLOSED (a broken count never grants
    unlimited messages).

Plus the elaya_actions reads the confirmation resolver needs (the ledger's
writes happen inside the Node write registry, reached through the bridge —
except `dismissed`, which the resolver stamps directly, mirroring
markActionResolved's admin-client update).
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

from app.core import supa

IST = timezone(timedelta(hours=5, minutes=30))


def _ist_midnight_utc_iso() -> str:
    """UTC instant of today's IST midnight — the Node toISTMidnight contract."""
    now_ist = datetime.now(IST)
    midnight_ist = now_ist.replace(hour=0, minute=0, second=0, microsecond=0)
    return midnight_ist.astimezone(timezone.utc).isoformat()


# ── Conversations ────────────────────────────────────────────────────────


async def get_or_create_active_conversation(
    user_id: str, expiry_hours: int, origin_channel: str = "in_app"
) -> dict[str, Any]:
    cutoff = (datetime.now(timezone.utc) - timedelta(hours=expiry_hours)).isoformat()
    existing = await supa.select_one(
        "elaya_conversations",
        {
            "select": "*",
            "user_id": f"eq.{user_id}",
            "archived_at": "is.null",
            "last_message_at": f"gte.{cutoff}",
            "order": "last_message_at.desc",
        },
    )
    if existing:
        return existing
    created = await supa.insert(
        "elaya_conversations", {"user_id": user_id, "channel": origin_channel}
    )
    if not created:
        raise RuntimeError("could not start an Elaya conversation")
    return created


async def get_owned_conversation(conversation_id: str, user_id: str) -> dict[str, Any] | None:
    """Ownership check for a caller-supplied id (S-06)."""
    return await supa.select_one(
        "elaya_conversations",
        {
            "select": "*",
            "id": f"eq.{conversation_id}",
            "user_id": f"eq.{user_id}",
            "archived_at": "is.null",
        },
    )


async def touch_conversation(conversation_id: str) -> None:
    try:
        await supa.update(
            "elaya_conversations",
            {"last_message_at": datetime.now(timezone.utc).isoformat()},
            {"id": f"eq.{conversation_id}"},
        )
    except Exception as e:  # non-fatal, like the Node twin
        print(f"[elaya-store] touch failed: {e}")


# ── Messages (append-only) ───────────────────────────────────────────────


async def get_model_context_messages(conversation_id: str, limit: int = 10) -> list[dict[str, Any]]:
    rows = await supa.select(
        "elaya_messages",
        {
            "select": "*",
            "conversation_id": f"eq.{conversation_id}",
            "order": "created_at.desc",
            "limit": str(limit),
        },
    )
    return list(reversed(rows))


async def insert_user_message(
    conversation_id: str, sender_id: str, content: str, channel: str = "in_app"
) -> dict[str, Any]:
    row = await supa.insert(
        "elaya_messages",
        {
            "conversation_id": conversation_id,
            "sender_id": sender_id,
            "role": "user",
            "channel": channel,
            "content": content,
        },
    )
    if not row:
        raise RuntimeError("could not save the message")
    return row


async def insert_assistant_message(
    conversation_id: str,
    content: str,
    tool_calls: list[dict[str, Any]],
    meta: dict[str, Any],
    channel: str = "in_app",
) -> dict[str, Any] | None:
    try:
        return await supa.insert(
            "elaya_messages",
            {
                "conversation_id": conversation_id,
                "sender_id": None,
                "role": "assistant",
                "channel": channel,
                "content": content,
                "tool_calls": tool_calls or None,
                "meta": meta,
            },
        )
    except Exception as e:  # the Node twin logs + returns null
        print(f"[elaya-store] assistant insert failed: {e}")
        return None


async def count_user_messages_today(user_id: str) -> int:
    """FAILS CLOSED — a broken count must never grant unlimited messages."""
    try:
        _, total = await supa.select_count(
            "elaya_messages",
            {
                "select": "id",
                "sender_id": f"eq.{user_id}",
                "role": "eq.user",
                "created_at": f"gte.{_ist_midnight_utc_iso()}",
                "limit": "1",
            },
        )
        return total
    except Exception as e:
        print(f"[elaya-store] cap count failed: {e}")
        return 2**53


# ── elaya_actions (the confirmation resolver's reads + dismiss stamp) ────


async def get_latest_proposed_action(
    conversation_id: str, user_id: str
) -> dict[str, Any] | None:
    try:
        return await supa.select_one(
            "elaya_actions",
            {
                "select": "*",
                "conversation_id": f"eq.{conversation_id}",
                "user_id": f"eq.{user_id}",
                "status": "eq.proposed",
                "order": "created_at.desc",
            },
        )
    except Exception as e:
        print(f"[elaya-store] pending read failed: {e}")
        return None


async def mark_action_dismissed(action_id: str, resolved_by: str) -> None:
    """The resolver's own stamp (markActionResolved 'dismissed' twin). Only a
    still-live proposal flips — idempotent under races, like the Node update."""
    try:
        await supa.update(
            "elaya_actions",
            {
                "status": "dismissed",
                "resolved_at": datetime.now(timezone.utc).isoformat(),
                "resolved_by": resolved_by,
            },
            {"id": f"eq.{action_id}", "status": "eq.proposed"},
        )
    except Exception as e:
        print(f"[elaya-store] dismiss failed: {e}")
