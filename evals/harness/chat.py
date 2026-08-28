"""Talks to the real Elaya endpoint (POST /api/elaya/chat) exactly like the
browser does: session cookies + SSE stream parse. Transport only, no scoring."""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import Any

import requests


@dataclass
class TurnResult:
    ok: bool
    status_code: int
    reply: str = ""
    sse_tools: list[str] = field(default_factory=list)   # tool names seen in the stream
    rejected: dict[str, Any] | None = None               # non-200 body (cap, auth, zod)
    stream_error: str | None = None                      # mid-stream error frame


def send_message(
    base_url: str,
    cookies: dict[str, str],
    message: str,
    conversation_id: str,
    timeout: int = 200,
) -> TurnResult:
    res = requests.post(
        f"{base_url}/api/elaya/chat",
        cookies=cookies,
        json={"message": message, "conversationId": conversation_id},
        stream=True,
        timeout=timeout,
    )

    if res.status_code != 200:
        try:
            body = res.json()
        except Exception:
            body = {"error": res.text[:200]}
        return TurnResult(ok=False, status_code=res.status_code, rejected=body)

    result = TurnResult(ok=True, status_code=200)
    buffer = b""
    for chunk in res.iter_content(chunk_size=None):
        buffer += chunk
        while b"\n\n" in buffer:
            frame, buffer = buffer.split(b"\n\n", 1)
            if not frame.startswith(b"data: "):
                continue
            try:
                event = json.loads(frame[6:])
            except json.JSONDecodeError:
                continue
            etype = event.get("type")
            if etype == "delta":
                result.reply += event.get("text", "")
            elif etype == "tool":
                result.sse_tools.append(event.get("name", ""))
            elif etype == "error":
                result.stream_error = event.get("message")
    return result


def smoke_auth(base_url: str, cookies: dict[str, str]) -> bool:
    """Free authed-check that burns zero daily-cap messages: an EMPTY message
    returns 400 (Zod reject) when the session is valid, 401 when it is not."""
    res = requests.post(
        f"{base_url}/api/elaya/chat",
        cookies=cookies,
        json={"message": ""},
        timeout=15,
    )
    return res.status_code == 400
