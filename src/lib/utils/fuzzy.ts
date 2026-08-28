// THE fuzzy name-matching utility — voice-transcription artifact resolution.
//
// Voice notes mangle names: Deepgram hears "Arapham" for "Arfam", "Evun" for
// "Evan" (real transcripts, 2026-08). A substring lookup finds nothing for
// these, so name resolution needs a SOUND-ALIKE fallback. Two pure primitives:
//
//   soundex()      — the classic phonetic code. "Arfam" and "Arapham" both
//                    encode A615, "Evan" and "Evun" both E150 — exactly the
//                    consonant-skeleton class of error STT produces.
//   levenshtein()  — edit distance, catches short typo-class drift the
//                    phonetic code misses ("Pawani" / "Pavani").
//
// nameMatchesFuzzy() combines them per name TOKEN (first/last name separately)
// so "Arapham" matches "Arfam Khan" via its first token.
//
// Pure functions, no I/O — usable in any layer. Consumers: the staff teammate
// lookup fallback (profiles-service searchTeammatesForElaya). R-01: never
// re-implement phonetic or edit-distance matching elsewhere — extend here.

/** American Soundex. Returns e.g. "A615". Empty input → "". */
export function soundex(word: string): string {
  const s = word.toUpperCase().replace(/[^A-Z]/g, "");
  if (s.length === 0) return "";
  const code = (c: string): string =>
    "BFPV".includes(c) ? "1"
    : "CGJKQSXZ".includes(c) ? "2"
    : "DT".includes(c) ? "3"
    : c === "L" ? "4"
    : "MN".includes(c) ? "5"
    : c === "R" ? "6"
    : ""; // vowels + H/W/Y drop
  let out = s[0];
  let prev = code(s[0]);
  for (let i = 1; i < s.length && out.length < 4; i++) {
    const c = s[i];
    const d = code(c);
    // H/W do not separate same-coded consonants; vowels do.
    if (d !== "" && d !== prev) out += d;
    if (c === "H" || c === "W") continue;
    prev = d;
  }
  return out.padEnd(4, "0");
}

/** Classic Levenshtein edit distance (iterative two-row). */
export function levenshtein(a: string, b: string): number {
  const s = a.toLowerCase();
  const t = b.toLowerCase();
  if (s === t) return 0;
  if (s.length === 0) return t.length;
  if (t.length === 0) return s.length;
  let prev = Array.from({ length: t.length + 1 }, (_, i) => i);
  for (let i = 1; i <= s.length; i++) {
    const curr = [i];
    for (let j = 1; j <= t.length; j++) {
      curr[j] = Math.min(
        prev[j] + 1,
        curr[j - 1] + 1,
        prev[j - 1] + (s[i - 1] === t[j - 1] ? 0 : 1),
      );
    }
    prev = curr;
  }
  return prev[t.length];
}

/**
 * Does `query` (one spoken/typed name, possibly mangled) plausibly refer to
 * `fullName`? True when ANY name token matches phonetically (same Soundex) or
 * within a small edit distance (≤1 for short tokens, ≤2 for 5+ chars).
 */
export function nameMatchesFuzzy(fullName: string, query: string): boolean {
  const q = query.trim();
  if (q.length < 2) return false;
  const qCode = soundex(q);
  const maxEdits = q.length >= 5 ? 2 : 1;
  return fullName
    .split(/\s+/)
    .filter((t) => t.length >= 2)
    .some((token) => soundex(token) === qCode || levenshtein(token, q) <= maxEdits);
}
