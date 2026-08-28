#!/usr/bin/env bash
# ============================================================
# Serene Obsidian vault — graph color switcher
#   ./switch-graph.sh serene     -> color the graph by Serene layers (5 brand hues)
#   ./switch-graph.sh colorful   -> color the graph by community (457 hues, the original)
#   ./switch-graph.sh status     -> show which is live
#
# After switching, reopen the Graph view in Obsidian (or close/reopen the
# graph tab) to see the new colors. This ONLY changes graph coloring; it never
# touches your notes.
# ============================================================
set -euo pipefail
cd "$(dirname "$0")/.obsidian"

live="graph.json"
serene="graph-serene.json"
colorful="graph-colorful.json"

current() {
  if [ -f "$serene" ] && cmp -s "$live" "$serene"; then echo "serene"
  elif [ -f "$colorful" ] && cmp -s "$live" "$colorful"; then echo "colorful"
  else echo "custom/unknown"; fi
}

case "${1:-status}" in
  serene)
    cp "$serene" "$live"
    echo "✓ Graph coloring → SERENE (by architecture layer: services·actions·components·types·utils)"
    echo "  Reopen the Graph view in Obsidian to see it."
    ;;
  colorful)
    cp "$colorful" "$live"
    echo "✓ Graph coloring → COLORFUL (457 community colors, the original)"
    echo "  Reopen the Graph view in Obsidian to see it."
    ;;
  status)
    echo "Live graph coloring: $(current)"
    echo "  available: serene | colorful"
    ;;
  *)
    echo "usage: ./switch-graph.sh [serene|colorful|status]" >&2
    exit 1
    ;;
esac
