"""Model registry — llm_providers row → adapter + model, read per request.

The multi-model policy lives in the DATABASE, never in code (the founder's
requirement made structural): today routing=Haiku 4.5, reasoning=Sonnet 5,
heavy=Opus 5 — changing any of them is an UPDATE on llm_providers, applied on
the very next message, no deploy. `heavy` falls back to `reasoning` when its
row is missing or inactive, so the tier can be toggled off safely.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

from app.core import supa
from app.llm import anthropic_adapter
from app.llm.provider import CompleteRequest, CompleteResult

JobType = Literal["routing", "reasoning", "heavy"]


@dataclass
class ResolvedLlm:
    provider: str
    model: str
    max_tokens: int

    async def complete(self, req: CompleteRequest) -> CompleteResult:
        req.model = self.model
        if self.provider == "anthropic":
            return await anthropic_adapter.complete(req)
        # Config rows may name google/openai before their adapters exist —
        # fail loud, never silently substitute a different provider.
        raise RuntimeError(f"provider '{self.provider}' has no adapter yet")


async def resolve(job_type: JobType) -> ResolvedLlm:
    row = await supa.get_llm_job_config(job_type)
    if row is None and job_type == "heavy":
        row = await supa.get_llm_job_config("reasoning")
    if row is None:
        raise RuntimeError(f"no active llm_providers row for job '{job_type}'")
    return ResolvedLlm(provider=row["provider"], model=row["model"], max_tokens=row["max_tokens"])
