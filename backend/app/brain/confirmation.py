"""The confirmation classifier — faithful port of lib/elaya/confirmation.ts.

The pending-action gate's decision function (plan-elaya law 2): a big write
executes only when a LATER human reply classifies as an unambiguous yes.
PURE — no I/O, no model call. Fed ONLY the human's latest message (never tool
results or assistant prose — the prompt-injection defence). Default is
'other' = cancel; the safety bias is structural.

Word sets are copied verbatim from the Node source — the two brains must
agree on every yes, or the eval comparison (and worse, production behavior)
silently diverges. Extending languages (Marathi 'ho kara', Kannada, Urdu —
plan-elaya 3d) happens in BOTH files in one commit until the Node brain
retires.
"""

from __future__ import annotations

import re

AFFIRMATIVE_PHRASES: frozenset[str] = frozenset(
    {
        # English — phrases
        "yes please", "please do", "go ahead", "go for it", "do it", "do that",
        "sounds good", "go on", "yes do it", "yes do that", "please go ahead",
        # Hinglish / Hindi-in-Latin — phrases
        "ji haan", "ji han", "theek hai", "thik hai", "thik h", "theek h",
        "kar do", "kardo", "kar dijiye", "kar dijie", "kar de", "karde",
        "ha kar do", "haan kar do", "ok kar do", "bilkul karo", "ji karo",
    }
)

AFFIRMATIVE_TOKENS: frozenset[str] = frozenset(
    {
        # English
        "yes", "y", "yep", "yeah", "yup", "yes!", "ok", "okay", "k", "kk",
        "confirm", "confirmed", "sure", "correct", "right", "agreed", "approve",
        "approved", "proceed", "please",
        # Hinglish / Hindi-in-Latin
        "haan", "han", "haa", "ha", "hn", "ji", "bilkul", "sahi", "karo", "theek", "thik",
    }
)

FILLER_TOKENS: frozenset[str] = frozenset({"the", "it", "that", "this", "pls", "plz"})


def _normalize(text: str) -> str:
    text = text.lower()
    text = re.sub(r"[^a-z0-9\s]", " ", text)  # punctuation/emoji/non-latin → space
    return re.sub(r"\s+", " ", text).strip()


def classify_confirmation(text: str) -> str:
    """'affirmative' ONLY for an unambiguous yes; everything else 'other'
    (the caller cancels the pending action and processes the message fresh)."""
    normalized = _normalize(text)
    if not normalized:
        return "other"
    if normalized in AFFIRMATIVE_PHRASES:
        return "affirmative"
    tokens = [t for t in normalized.split(" ") if t and t not in FILLER_TOKENS]
    if not tokens:
        return "other"
    return "affirmative" if all(t in AFFIRMATIVE_TOKENS for t in tokens) else "other"
