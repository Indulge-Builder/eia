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
            "stale leads, client/prospect questions, talking points or case studies for pitching, "
            "logging a call on a lead, adding a note to a lead, changing a lead's status, "
            "reassigning a lead, recording/closing a deal, creating a follow-up or reminder for a "
            "lead — including mixed asks like 'note this on the lead and remind me tomorrow'"
        ),
        focus=("Focus for this conversation: LEAD questions and actions — finding leads, their "
               "details and notes, which are going cold, logging calls, notes, status changes, "
               "follow-ups, deals, and the Call Intelligence library for pitching."),
        toolset=[
            "search_leads",
            "get_lead_details",
            "get_cold_leads",
            "get_helpdesk_content",
            "find_teammate",
            "add_lead_note",
            "log_call",
            "create_lead_task",
            "update_lead_status",
            "reassign_lead",
            "log_deal",
        ],
    ),
    "tasks": Specialist(
        id="tasks",
        description=(
            "the user's tasks, to-dos, follow-ups, deadlines, reminders, what's due, "
            "creating/assigning/delegating a task or reminder, marking a task done, updating or "
            "deleting a task, team/group tasks, finding a teammate/colleague by name (BUT a "
            "note/call/reminder ABOUT A LEAD or after talking to a lead/client belongs to the "
            "leads category, even when it also asks for a reminder)"
        ),
        focus=("Focus for this conversation: the user's TASKS and follow-ups — open work, "
               "deadlines, creating and assigning tasks and reminders, updating or completing "
               "them, and resolving teammates by name."),
        toolset=[
            "get_my_tasks",
            "find_teammate",
            "create_personal_task",
            "create_group_task",
            "create_subtask",
            "update_task_status",
            "update_task",
            "delete_task",
        ],
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
        # The safety-net specialist: a mis-routed action message must still find
        # its tool, so general carries the full write surface + the resolvers.
        toolset=[
            "get_my_tasks",
            "find_teammate",
            "get_helpdesk_content",
            "search_leads",
            "add_lead_note",
            "log_call",
            "create_lead_task",
            "update_lead_status",
            "reassign_lead",
            "log_deal",
            "create_personal_task",
            "create_group_task",
            "create_subtask",
            "update_task_status",
            "update_task",
            "delete_task",
        ],
    ),
}

DEFAULT_SPECIALIST = "general"
