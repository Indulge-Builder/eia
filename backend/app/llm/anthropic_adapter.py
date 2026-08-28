"""The Anthropic adapter — THE ONLY module allowed to import the anthropic SDK
(the same law as lib/elaya/adapters/anthropic.ts). Streams internally, emits
prose deltas through on_text_delta, resolves the normalized CompleteResult.

Prompt caching: with cache_prefix=True the system block and the last tool
definition carry cache_control breakpoints, so iterations 2..n of a tool loop
re-read the stable prefix at ~0.1x input rate. Correctness is identical with
or without — caching changes billing/latency, never what the model sees.

No extended thinking here on purpose: the flip is eval-gated against the Node
brain, which runs without it. Thinking is a post-flip experiment measured by
the same exam, not a silent difference between the two brains.
"""

from __future__ import annotations

from typing import Any

from anthropic import AsyncAnthropic

from app.config import settings
from app.llm.provider import (
    ChatMessage,
    CompleteRequest,
    CompleteResult,
    StopReason,
    ToolCall,
)

_client: AsyncAnthropic | None = None


def _sdk() -> AsyncAnthropic:
    global _client
    if _client is None:
        _client = AsyncAnthropic(api_key=settings.anthropic_api_key)
    return _client


def _to_anthropic_messages(messages: list[ChatMessage]) -> list[dict[str, Any]]:
    """Normalize provider-neutral turns into Anthropic's content-block shape.
    Consecutive tool results collapse into one user turn (API requirement)."""
    out: list[dict[str, Any]] = []
    for m in messages:
        if m.role == "user":
            out.append({"role": "user", "content": m.content})
        elif m.role == "assistant":
            blocks: list[dict[str, Any]] = []
            if m.content:
                blocks.append({"type": "text", "text": m.content})
            for tc in m.tool_calls:
                blocks.append(
                    {"type": "tool_use", "id": tc.id, "name": tc.name, "input": tc.input}
                )
            out.append({"role": "assistant", "content": blocks or [{"type": "text", "text": ""}]})
        else:  # tool result
            block = {
                "type": "tool_result",
                "tool_use_id": m.tool_call_id,
                "content": m.content,
            }
            if out and out[-1]["role"] == "user" and isinstance(out[-1]["content"], list):
                out[-1]["content"].append(block)
            else:
                out.append({"role": "user", "content": [block]})
    return out


def _map_stop(reason: str | None) -> StopReason:
    if reason in ("end_turn", "stop_sequence"):
        return "end_turn"
    if reason == "tool_use":
        return "tool_use"
    if reason == "max_tokens":
        return "max_tokens"
    if reason == "refusal":
        return "refusal"
    return "other"


async def complete(req: CompleteRequest) -> CompleteResult:
    system: Any = req.system
    tools: list[dict[str, Any]] = [
        {"name": t.name, "description": t.description, "input_schema": t.input_schema}
        for t in req.tools
    ]
    if req.cache_prefix:
        system = [{"type": "text", "text": req.system, "cache_control": {"type": "ephemeral"}}]
        if tools:
            tools[-1]["cache_control"] = {"type": "ephemeral"}

    kwargs: dict[str, Any] = {
        "model": req.model,
        "max_tokens": req.max_tokens,
        "system": system,
        "messages": _to_anthropic_messages(req.messages),
    }
    if tools:
        kwargs["tools"] = tools

    text_parts: list[str] = []
    async with _sdk().messages.stream(**kwargs) as stream:
        async for event in stream:
            if event.type == "content_block_delta" and event.delta.type == "text_delta":
                text_parts.append(event.delta.text)
                if req.on_text_delta:
                    await req.on_text_delta(event.delta.text)
        final = await stream.get_final_message()

    tool_calls = [
        ToolCall(id=block.id, name=block.name, input=dict(block.input or {}))
        for block in final.content
        if block.type == "tool_use"
    ]

    return CompleteResult(
        text="".join(text_parts),
        tool_calls=tool_calls,
        stop_reason=_map_stop(final.stop_reason),
        input_tokens=final.usage.input_tokens,
        output_tokens=final.usage.output_tokens,
    )
