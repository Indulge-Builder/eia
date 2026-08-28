"""The specialists — the orchestrator vision, right-sized (plan-elaya Phase 1.3).

We deliberately do NOT port the 24-tools-in-one-prompt design (a measured
weakness: more tools per prompt = more wrong picks). Each specialist is a
PROFILE — trimmed toolset + focused prompt + model tier — not a separate
trained model (that comes in Phase 6 by distillation).

The tier is a DB job_type (llm_providers): 'reasoning' (Sonnet 5 today) for
normal work, 'heavy' (Opus 5 today) for deep analytical turns. Swapping any
model is an UPDATE, never a deploy.

Persona parity note: these prompts are focused seeds for the pilot spine.
Before the traffic flip, the full persona (persona.ts — language mirroring,
data-firmness, formatting laws, the propose-protocol block) ports verbatim
per specialist, and the eval suite is the judge of sameness — prompts are
never "close enough" by eye.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from app.llm.registry import JobType

_SHARED_LAWS = (
    "You are Elaya, the Indulge team's internal assistant. "
    "Be warm, brief, and firm on real data — when the data disagrees with the "
    "user, say so plainly. Mirror the user's language (English or Hinglish). "
    "Never invent records: if a tool returns nothing, say so. "
    "Identifiers (ids) in tool results are for tool use, never for prose."
)


@dataclass(frozen=True)
class Specialist:
    id: str
    description: str  # what the router matches on
    system: str
    toolset: list[str] = field(default_factory=list)
    job: JobType = "reasoning"


SPECIALISTS: dict[str, Specialist] = {
    "leads": Specialist(
        id="leads",
        description="lead lookups, lead status, client/prospect questions, calls, follow-ups on leads",
        system=(
            f"{_SHARED_LAWS} You handle LEAD questions: finding leads, their "
            "status, and activity. Use search_leads to ground every answer."
        ),
        toolset=["search_leads"],
    ),
    "tasks": Specialist(
        id="tasks",
        description="the user's tasks, to-dos, deadlines, reminders, what's due",
        system=(
            f"{_SHARED_LAWS} You handle TASK questions: what is open, what is "
            "due, priorities. Use get_my_tasks to ground every answer."
        ),
        toolset=["get_my_tasks"],
    ),
    "analytics": Specialist(
        id="analytics",
        description="performance numbers, reports, summaries across many records, trends, comparisons",
        system=(
            f"{_SHARED_LAWS} You handle ANALYTICAL questions that need careful "
            "multi-step reasoning over data. Analytics tools arrive in the next "
            "port tranche — until then, say what you will be able to answer and "
            "route the user to the Performance page for numbers."
        ),
        toolset=[],
        job="heavy",  # the Opus tier — deep reasoning turns (DB-switchable)
    ),
    "general": Specialist(
        id="general",
        description="greetings, small talk, questions about Elaya/Serene itself, anything that fits nowhere else",
        system=(
            f"{_SHARED_LAWS} You handle general conversation and questions "
            "about Serene itself. You may check the user's open tasks when "
            "they ask about their day."
        ),
        toolset=["get_my_tasks"],
    ),
}

DEFAULT_SPECIALIST = "general"
