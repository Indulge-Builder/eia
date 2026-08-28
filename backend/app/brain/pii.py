"""The PII gateway — faithful port of lib/elaya/pii.ts (D-01 posture).

Every tool result passes through mask_pii() before serialization into a model
request. Depth comes from elaya_settings pii_masking_depth:
  off    — passthrough (debugging only; never the shipped default)
  light  — DEFAULT. Phones keep last 4 digits; emails keep first char + domain.
  strict — light + emails fully masked.

The UUID guard is load-bearing: a canonical UUID is an opaque id, never PII,
but its digit/dash runs match the phone regex and would be corrupted into
bullets — breaking any tool that surfaces an id for the model to target.
Ported byte-for-byte in spirit; divergence here would silently change what
the model sees vs the Node brain and poison the eval comparison.
"""

from __future__ import annotations

import re
from typing import Any

PHONE_RE = re.compile(r"(?:\+?\d[\s-]?){8,15}\d")
EMAIL_RE = re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b")
UUID_RE = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", re.IGNORECASE
)


def _mask_phone(raw: str) -> str:
    digits = re.sub(r"\D", "", raw)
    if len(digits) < 8:
        return raw
    return "•" * max(0, len(digits) - 4) + digits[-4:]


def _mask_email(raw: str, depth: str) -> str:
    if depth == "strict":
        return "•••@•••"
    local, domain = raw.split("@", 1)
    return f"{local[:1]}•••@{domain}"


def _mask_string(value: str, depth: str) -> str:
    value = EMAIL_RE.sub(lambda m: _mask_email(m.group(0), depth), value)
    return PHONE_RE.sub(lambda m: _mask_phone(m.group(0)), value)


def mask_pii(value: Any, depth: str) -> Any:
    """Deep-walk any JSON-serializable value, masking every string leaf.
    Object keys are never masked (schema, not data)."""
    if depth == "off":
        return value
    if isinstance(value, str):
        if UUID_RE.match(value):
            return value
        return _mask_string(value, depth)
    if isinstance(value, list):
        return [mask_pii(v, depth) for v in value]
    if isinstance(value, dict):
        return {k: mask_pii(v, depth) for k, v in value.items()}
    return value
