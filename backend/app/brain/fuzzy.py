"""Fuzzy name matching — faithful port of lib/utils/fuzzy.ts.

Voice notes mangle names ("Arapham" for "Arfam"); the teammate lookup's
sound-alike fallback depends on these EXACT primitives. Divergence here means
the two brains resolve different people from the same voice note — port
byte-for-byte in spirit, extend both sides together.
"""

from __future__ import annotations

import re


def soundex(word: str) -> str:
    s = re.sub(r"[^A-Z]", "", word.upper())
    if not s:
        return ""

    def code(c: str) -> str:
        if c in "BFPV":
            return "1"
        if c in "CGJKQSXZ":
            return "2"
        if c in "DT":
            return "3"
        if c == "L":
            return "4"
        if c in "MN":
            return "5"
        if c == "R":
            return "6"
        return ""

    out = s[0]
    prev = code(s[0])
    for c in s[1:]:
        if len(out) >= 4:
            break
        d = code(c)
        if d and d != prev:
            out += d
        if c in "HW":
            continue
        prev = d
    return out.ljust(4, "0")


def levenshtein(a: str, b: str) -> int:
    s, t = a.lower(), b.lower()
    if s == t:
        return 0
    if not s:
        return len(t)
    if not t:
        return len(s)
    prev = list(range(len(t) + 1))
    for i in range(1, len(s) + 1):
        curr = [i]
        for j in range(1, len(t) + 1):
            curr.append(
                min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + (0 if s[i - 1] == t[j - 1] else 1))
            )
        prev = curr
    return prev[len(t)]


def name_matches_fuzzy(full_name: str, query: str) -> bool:
    q = query.strip()
    if len(q) < 2:
        return False
    q_code = soundex(q)
    max_edits = 2 if len(q) >= 5 else 1
    return any(
        soundex(tok) == q_code or levenshtein(tok, q) <= max_edits
        for tok in re.split(r"\s+", full_name)
        if len(tok) >= 2
    )
