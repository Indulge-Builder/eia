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
    *,
    target: str = "node",
    brain_secret: str = "",
    user_id: str = "",
) -> TurnResult:
    """target=node hits the Next route as the browser does (cookies).
    target=python hits the Step 3 brain (bearer + verified user id) — the
    SAME SSE frames by contract, so the parse below is shared verbatim."""
    if target == "python":
        res = requests.post(
            f"{base_url}/v1/elaya/chat",
            headers={"Authorization": f"Bearer {brain_secret}"},
            json={"message": message, "user_id": user_id},
            stream=True,
            timeout=timeout,
        )
    else:
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


def smoke_brain(brain_url: str, brain_secret: str) -> bool:
    """Python-brain authed check that burns nothing: a well-shaped request for a
    nonexistent user returns 403 when the bearer is right (the principal lookup
    refused it), 401 when the bearer is wrong. FastAPI body validation runs
    BEFORE the bearer check, so the body must be valid-shaped here."""
    try:
        res = requests.post(
            f"{brain_url}/v1/elaya/chat",
            headers={"Authorization": f"Bearer {brain_secret}"},
            json={"user_id": "00000000-0000-0000-0000-000000000000", "message": "x"},
            timeout=15,
        )
        return res.status_code == 403
    except requests.RequestException:
        return False
