"""The principal resolver — the Golden Rule in code (port of principal.ts).

Every tool execution carries a Principal derived from the VERIFIED profiles
row — never from model output, request payloads, or anything the model reads.
Tools execute AS this principal: identity args (user_id/role/domain) passed to
queries are always principal-derived; the model only ever supplies filter
values. Nothing a model reads can widen access.

Staff only for now — the customer persona ports with the WhatsApp flip.
"""

from __future__ import annotations

from dataclasses import dataclass

from app.core import supa
from app.tools.registry import TOOLSET_BY_ROLE


@dataclass(frozen=True)
class StaffPrincipal:
    user_id: str
    role: str
    domain: str
    display_name: str
    toolset: frozenset[str]


async def resolve_staff_principal(user_id: str) -> StaffPrincipal | None:
    """Verified identity → role-gated toolset. Returns None for unknown or
    deactivated users — the caller refuses the turn entirely."""
    profile = await supa.get_profile(user_id)
    if profile is None or not profile.get("is_active", False):
        return None
    role = profile["role"]
    return StaffPrincipal(
        user_id=profile["id"],
        role=role,
        domain=profile["domain"],
        display_name=profile["full_name"],
        toolset=TOOLSET_BY_ROLE.get(role, frozenset()),
    )
