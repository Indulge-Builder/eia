"""The turn loop — the port of brain.ts's tool-calling core.

One turn: specialist prompt + trimmed toolset → model → (tool calls → execute
→ PII-mask → feed back)* → final prose. Laws carried over:

  • ITERATION CEILING (6): a runaway tool spiral ends with a calm handoff,
    never an infinite loop.
  • PII GATEWAY: every tool result is masked BEFORE the model sees it. The
    depth is read once per turn from elaya_settings.
  • CACHE PREFIX: the stable prefix (system + tools) carries a prompt-cache
    breakpoint, so iterations 2..n re-read it at ~0.1x. The prefix is
    byte-stable within a turn by construction (nothing volatile in it).

Deliberately NOT here yet (they stay owned by the Node brain until their port
tranche, per the strangler rule): conversation persistence, the daily cap,
the confirmation RESOLVER pre-step, write tools, the WhatsApp channel.
"""

from __future__ import annotations

import json
from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field

from app.brain.pii import mask_pii
from app.brain.principal import StaffPrincipal
from app.brain.specialists import Specialist
from app.core import supa
from app.llm import registry
from app.llm.provider import ChatMessage, CompleteRequest, ToolDefinition
from app.tools.registry import definitions_for, execute_tool

MAX_ITERATIONS = 6


@dataclass
class TurnResult:
    text: str
    tools_used: list[str] = field(default_factory=list)
    specialist: str = ""
    input_tokens: int = 0
    output_tokens: int = 0


async def run_turn(
    principal: StaffPrincipal,
    specialist: Specialist,
    message: str,
    on_delta: Callable[[str], Awaitable[None]],
    on_tool: Callable[[str], Awaitable[None]],
) -> TurnResult:
    llm = await registry.resolve(specialist.job)
    depth = await supa.get_pii_masking_depth()

    # The specialist's toolset ∩ the principal's role gate — both cuts apply.
    tool_names = [n for n in specialist.toolset if n in principal.toolset]
    tools = [ToolDefinition(**d) for d in definitions_for(tool_names)]

    # The volatile identity line sits OUTSIDE the cached prefix contract only
    # if it changes within a turn — it does not; per-turn stability is enough.
    system = (
        f"{specialist.system}\n\n"
        f"The user is {principal.display_name} ({principal.role}, {principal.domain} domain)."
    )

    messages: list[ChatMessage] = [ChatMessage(role="user", content=message)]
    result_text = ""
    tools_used: list[str] = []
    in_tokens = out_tokens = 0

    for _ in range(MAX_ITERATIONS):
        result = await llm.complete(
            CompleteRequest(
                model=llm.model,
                max_tokens=llm.max_tokens,
                system=system,
                messages=messages,
                tools=tools,
                cache_prefix=True,
                on_text_delta=on_delta,
            )
        )
        in_tokens += result.input_tokens
        out_tokens += result.output_tokens
        result_text = result.text

        if result.stop_reason != "tool_use" or not result.tool_calls:
            break

        messages.append(
            ChatMessage(role="assistant", content=result.text, tool_calls=result.tool_calls)
        )
        for call in result.tool_calls:
            tools_used.append(call.name)
            await on_tool(call.name)
            raw = await execute_tool(principal, call.name, call.input)
            masked = mask_pii(raw, depth)  # THE gateway — nothing skips it
            messages.append(
                ChatMessage(
                    role="tool",
                    content=json.dumps(masked, ensure_ascii=False, default=str),
                    tool_call_id=call.id,
                )
            )
    else:
        # Ceiling hit — same calm posture as the Node brain.
        closing = " I've hit my step limit on this one — try asking a smaller piece."
        await on_delta(closing)
        result_text += closing

    return TurnResult(
        text=result_text,
        tools_used=tools_used,
        specialist=specialist.id,
        input_tokens=in_tokens,
        output_tokens=out_tokens,
    )
