#!/usr/bin/env bash
# ============================================================
# Serene Obsidian vault — post-export beautifier
#
# Run this AFTER regenerating the vault with:
#   graphify export obsidian . --dir /Users/alam/Desktop/serene-obsidian
#
# Does three things, all idempotent (safe to run repeatedly):
#   1. Renames dot-prefixed notes (.__init__().md, .score().md …) so Obsidian
#      shows them — Obsidian hides any file starting with ".".
#   2. Repairs wikilinks that pointed at the old dotted names.
#   3. Organizes every note into layered folders by its source_file
#      (Code/Services, Code/Components, Docs, 00 Communities, …) and keeps
#      "🏠 Home.md" in the vault root so it's always the first thing you see.
# ============================================================
set -euo pipefail
cd "$(dirname "$0")"

# ---- 1. un-hide dot-prefixed notes (only in root; re-export writes flat) ----
echo "→ Renaming dot-prefixed notes so Obsidian shows them…"
renamed=0
for f in .*.md; do
  [ -e "$f" ] || continue
  new="${f#.}"
  [ -z "$new" ] || [ "$new" = ".md" ] && continue
  if [ -e "$new" ]; then new="${new%.md}_dot.md"; fi
  mv -- "$f" "$new"
  renamed=$((renamed+1))
done
echo "  renamed: $renamed"

# ---- 2. repair [[.Something]] -> [[Something]] across the whole vault ----
echo "→ Repairing wikilinks that point at the old dotted names…"
fixed=0
while IFS= read -r file; do
  perl -i -pe 's/\[\[\.([^\]\|]+)/[[$1/g' "$file"
  fixed=$((fixed+1))
done < <(grep -rlF "[[." . --include="*.md" 2>/dev/null || true)
echo "  files with links repaired: $fixed"

# ---- 3. organize notes into layered folders by source_file ----
echo "→ Organizing notes into folders by layer…"
python3 - <<'PY'
import re, glob, os, shutil

def layer_for(fname):
    if os.path.basename(fname).startswith("_COMMUNITY_"):
        return "00 Communities"
    head = open(fname, encoding="utf-8", errors="ignore").read(400)
    m = re.search(r'^source_file:\s*"([^"]*)"', head, re.M)
    sf = m.group(1) if m else ""
    rules = [
        ("src/lib/services",    "Code/Services"),
        ("src/lib/actions",     "Code/Actions"),
        ("src/lib/elaya",       "Code/Elaya"),
        ("src/lib/types",       "Code/Types"),
        ("src/lib/constants",   "Code/Constants"),
        ("src/lib/validations", "Code/Validations"),
        ("src/lib/utils",       "Code/Utils"),
        ("src/components",      "Code/Components"),
        ("src/hooks",           "Code/Hooks"),
        ("src/app",             "Code/App Routes"),
        ("src/trigger",         "Code/Triggers"),
        ("src/styles",          "Code/Styles"),
        ("src/lib",             "Code/Lib (other)"),
        ("src/",                "Code/Src (other)"),
        ("supabase",            "Database"),
        # doc heading-STUBS go to a throwaway bucket — we delete them and copy
        # the real, full-content docs from the repo instead (see step 4).
        ("docs",                "_DocStubs"),
    ]
    for prefix, folder in rules:
        if sf.startswith(prefix):
            return folder
    return "Project & Config"

moved = 0
# Only files currently in root get sorted; already-foldered notes are left alone.
for f in glob.glob("*.md"):
    if f == "🏠 Home.md":
        continue
    dest = layer_for(f)
    os.makedirs(dest, exist_ok=True)
    shutil.move(f, os.path.join(dest, f))
    moved += 1
print(f"  moved {moved} notes into folders")
PY

# ---- 4. replace exploded doc-stubs with the REAL readable docs from the repo ----
echo "→ Replacing doc heading-stubs with real readable docs…"
REPO_DOCS="/Users/alam/Desktop/serene/docs"
rm -rf "_DocStubs" Docs
mkdir -p Docs
if [ -d "$REPO_DOCS" ]; then
  # copy every live .md (full content), preserving subfolders, skipping _archive
  ( cd "$REPO_DOCS" && find . -name '*.md' -not -path './_archive/*' -print0 ) \
    | ( cd "$REPO_DOCS" && tar --null -cf - --files-from=- ) \
    | ( cd Docs && tar -xf - )
  echo "  copied $(find Docs -name '*.md' | wc -l | tr -d ' ') real docs into Docs/ (archive excluded)"
else
  echo "  ⚠ repo docs not found at $REPO_DOCS — skipped (Docs/ left empty)"
fi

echo "→ Done. Root holds only 🏠 Home.md; code is foldered; Docs/ is the real, readable docs."
