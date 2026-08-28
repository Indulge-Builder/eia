"""The specialists — the orchestrator vision, right-sized (plan-elaya Phase 1.3).

We deliberately do NOT port the 24-tools-in-one-prompt design (a measured
weakness: more tools per prompt = more wrong picks). Each specialist is a
PROFILE — trimmed toolset + focused prompt + model tier — not a separate
trained model (that comes in Phase 6 by distillation).

The tier is a DB job_type (llm_providers): 'reasoning' (Sonnet 5 today) for
normal work, 'heavy' (Opus 5 today) for deep analytical turns. Swapping any
model is an UPDATE, never a deploy.

A specialist's toolset is intersected with the principal's ROLE-gated toolset
at turn time (loop.py) — a manager routed to analytics never sees get_budget,
because the role gate cuts it even though the specialist lists it.

Persona parity note: these prompts are focused seeds for the pilot spine.
Before the traffic flip, the full persona (persona.ts — language mirroring,
data-firmness, formatting laws, the propose-protocol block) ports verbatim
per specialist, and the eval suite is the judge of sameness.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from app.llm.registry import JobType

@dataclass(frozen=True)
class Specialist:
    id: str
    description: str  # what the router matches on
    focus: str  # the ONE line that varies per specialist inside the shared persona
    toolset: list[str] = field(default_factory=list)
    job: JobType = "reasoning"


SPECIALISTS: dict[str, Specialist] = {
    "leads": Specialist(
        id="leads",
        description=(
            "lead lookups, HOW MANY leads / lead counts, lead status/details/notes, cold or "
            "stale leads, client/prospect questions, talking points or case studies for pitching"
        ),
        focus=("Focus for this conversation: LEAD questions — finding leads, their details and "
               "notes, which are going cold, and the Call Intelligence library for pitching."),
        toolset=["search_leads", "get_lead_details", "get_cold_leads", "get_helpdesk_content"],
    ),
    "tasks": Specialist(
        id="tasks",
        description=(
            "the user's tasks, to-dos, follow-ups, deadlines, reminders, what's due, "
            "finding a teammate/colleague by name"
        ),
        focus=("Focus for this conversation: the user's TASKS and follow-ups — open work, "
               "deadlines, and resolving teammates by name."),
        toolset=["get_my_tasks", "find_teammate"],
    ),
    "analytics": Specialist(
        id="analytics",
        description=(
            "performance numbers, team roster, domain health scorecards, campaign performance, "
            "ad spend and budget, revenue and deals, escalations / SLA breaches / overdue follow-ups "
            "/ what needs attention or is slipping, trends, comparisons, reports (NOT simple "
            "lead lookups or lead counts — those are the leads category)"
        ),
        focus=("Focus for this conversation: ANALYTICAL questions over business data — "
               "performance, escalations, domain health, campaigns, budget, and deals. Ground "
               "every number in a tool call; never estimate."),
        toolset=[
            "get_escalations",
            "get_performance_snapshot",
            "get_domain_health",
            "get_campaigns",
            "get_budget",
            "search_deals",
        ],
        job="heavy",  # the Opus tier — deep reasoning turns (DB-switchable)
    ),
    "general": Specialist(
        id="general",
        description="greetings, small talk, questions about Elaya/Serene itself, anything that fits nowhere else",
        focus=("Focus for this conversation: general — greetings, questions about Serene "
               "itself, and the user's day."),
        toolset=["get_my_tasks", "find_teammate", "get_helpdesk_content"],
    ),
}

DEFAULT_SPECIALIST = "general"
