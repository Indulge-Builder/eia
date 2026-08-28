"""POST /v1/elaya/chat — the Python brain's chat endpoint (SSE).

WIRE-COMPATIBLE with the Node route by contract: the exact frame vocabulary
elaya-stream.ts already parses — meta / delta / tool / done / error, each as
`data: {json}\n\n`. The eventual flip is a URL change in ONE transport file,
nothing else.

Trust model (pilot): the caller is our own server (Next.js) or the eval
harness, authenticated by the shared bearer secret; it passes the USER ID it
has already session-verified, and the brain INDEPENDENTLY re-verifies that id
against public.profiles before any model runs (the Golden Rule — the payload
names an identity, the database decides what it may do). Direct end-client
auth (Supabase JWT verification) is the flip-time addition, not a pilot need.

Deliberately still owned by the Node brain until their tranche ports:
persistence, the daily cap, confirmation resolver, write tools.
"""

from __future__ import annotations

import asyncio
import json
from typing import AsyncIterator

from fastapi import APIRouter, Header, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from app.brain import router as brain_router
from app.brain.loop import run_turn
from app.brain.principal import resolve_staff_principal
from app.brain.specialists import SPECIALISTS
from app.config import settings

router = APIRouter(prefix="/v1/elaya")


class ChatRequest(BaseModel):
    user_id: str = Field(min_length=36, max_length=36)
    message: str = Field(min_length=1, max_length=4000)


def _frame(payload: dict) -> str:
    return f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"


@router.post("/chat")
async def chat(body: ChatRequest, authorization: str = Header(default="")) -> StreamingResponse:
    if not settings.brain_api_secret or authorization != f"Bearer {settings.brain_api_secret}":
        raise HTTPException(status_code=401, detail="unauthorized")

    principal = await resolve_staff_principal(body.user_id)
    if principal is None:
        raise HTTPException(status_code=403, detail="unknown or inactive user")

    queue: asyncio.Queue[str | None] = asyncio.Queue()

    async def emit_delta(text: str) -> None:
        await queue.put(_frame({"type": "delta", "text": text}))

    async def emit_tool(name: str) -> None:
        await queue.put(_frame({"type": "tool", "name": name}))

    async def produce() -> None:
        try:
            specialist_id, route_ms = await brain_router.route(body.message)
            # meta mirrors the Node shape; cap enforcement stays with the Node
            # brain until its tranche ports, so remainingToday is a sentinel.
            await queue.put(
                _frame(
                    {
                        "type": "meta",
                        "conversationId": f"py-{specialist_id}",
                        "remainingToday": 999,
                        "routeMs": route_ms,
                    }
                )
            )
            result = await run_turn(
                principal, SPECIALISTS[specialist_id], body.message, emit_delta, emit_tool
            )
            await queue.put(
                _frame(
                    {
                        "type": "done",
                        "messageId": None,
                        "specialist": result.specialist,
                        "toolsUsed": result.tools_used,
                        "usage": {"in": result.input_tokens, "out": result.output_tokens},
                    }
                )
            )
        except Exception as e:
            await queue.put(_frame({"type": "error", "message": f"turn failed: {e}"}))
        finally:
            await queue.put(None)

    async def stream() -> AsyncIterator[str]:
        task = asyncio.create_task(produce())
        try:
            while True:
                item = await queue.get()
                if item is None:
                    break
                yield item
        finally:
            task.cancel()

    return StreamingResponse(stream(), media_type="text/event-stream")
