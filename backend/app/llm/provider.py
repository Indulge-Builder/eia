"""The provider-neutral LLM contract — the Python port of lib/elaya/provider.ts.

Every shape here is provider-agnostic. Anthropic (and later Google/OpenAI)
request/response formats are normalized INSIDE each adapter and never leak
past it: the router, the loop, and the tools only ever see these types.
Adding a provider = one adapter module + one llm_providers row.
"""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field
from typing import Any, Literal

StopReason = Literal["end_turn", "tool_use", "max_tokens", "refusal", "other"]


@dataclass
class ToolCall:
    """One normalized tool invocation requested by the model."""

    id: str
    name: str
    input: dict[str, Any]


@dataclass
class ChatMessage:
    """One provider-neutral conversation turn.

    role 'tool' carries a tool RESULT back to the model (tool_call_id set).
    """

    role: Literal["user", "assistant", "tool"]
    content: str
    tool_calls: list[ToolCall] = field(default_factory=list)
    tool_call_id: str | None = None


@dataclass
class ToolDefinition:
    name: str
    description: str
    input_schema: dict[str, Any]


@dataclass
class CompleteRequest:
    model: str
    max_tokens: int
    system: str
    messages: list[ChatMessage]
    tools: list[ToolDefinition] = field(default_factory=list)
    # When True the adapter marks the stable prefix (tools + system) with a
    # provider-native prompt-cache breakpoint: calls 2..n of a multi-tool turn
    # re-read it at ~0.1x. The CALLER keeps the prefix byte-stable across the
    # turn (no timestamps/UUIDs in system or tools) — same contract as the
    # Node provider.ts.
    cache_prefix: bool = False
    # A VOLATILE trailing system block (the per-turn time anchor) delivered
    # AFTER the cache_control breakpoint — it changes every request without
    # busting the cached prefix. None = no tail.
    system_tail: str | None = None
    on_text_delta: Callable[[str], Awaitable[None]] | None = None


@dataclass
class CompleteResult:
    text: str
    tool_calls: list[ToolCall]
    stop_reason: StopReason
    input_tokens: int
    output_tokens: int
