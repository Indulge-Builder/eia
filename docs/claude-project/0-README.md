# Serene — Claude Project context pack (index)

> **What this folder is.** A self-contained set of `.md` digests of the Serene codebase, written
> to be pasted into a Claude **Project**'s files section. Attach these (plus the root `CLAUDE.md`)
> and a chat will have full context on what Serene is, how it's built, the rules it obeys, and
> what's built vs. planned — without reading the repo.
>
> **Last regenerated:** 2026-08-24 (against `docs/changelog.md` through 2026-08-22, the migration
> files through `0168`, and the live `src/` tree). The repo docs are the source of truth —
> regenerate these when they drift. The single most authoritative live record of change is
> `docs/changelog.md`.
>
> **What changed since the 2026-06-26 pack** (the whole visual system was replaced and three
> modules shipped): the **neumorphic (soft-UI) restyle** + **dark mode** + the **8-theme lineup**
> (2026-07-03), the **logo / loading / boot motion system**, the **polish layer** (⌘K palette,
> tooltips, undo toasts, celebration petals, living numbers, condensing headers), the **`/m`
> Mobile Ops layer** going functional, the **Elaya customer WhatsApp channel** + **Notes**, the
> **Subscriptions & Bills tracker**, ESLint, the `database.ts` regen, and a full docs restructure.
> Files 4 and 10 (design) were rewritten end to end; file 11 is new.

---

## How to use this pack

1. Create a Claude Project. Upload **every file in this folder** to the Project's files.
2. Also upload the repo's root **`CLAUDE.md`** — it carries the Surface Contract, the 12 Rules,
   the File-Locations registry, and the Never-Do list verbatim. This pack summarises around it;
   it does not duplicate it.
3. Paste **`docs/ai/claude-project-instructions.md`** into the Project's *custom instructions*
   box. That file is the working method (orient → reuse-first search → diagnose → plan at the
   seam → build in layer order → verify → record); this pack is the knowledge it works over.
   (The in-repo twin of that method is `.claude/skills/serene-engineer/SKILL.md`.)
4. For page-level work, additionally attach the matching `docs/pages/<route>.md` spec — those hold
   the full per-route invariant lists this pack only summarises. Same for `docs/modules/<x>.md`.
5. Treat **"BUILT/LIVE"** as fact and **"PLANNED/IN-PROGRESS"** as roadmap. File 9 is the canonical
   built-vs-planned ledger; when a feature's status matters, check there. Migration *applied*
   status is a separate question from migration *written* status — file 7 explains why.

## The files

| File | What it covers |
| ---- | -------------- |
| `0-README.md` | This index. |
| `1-product-and-status.md` | What Serene is, who Indulge is, the modules and their status, the lead journey, trust principles, the sidebar surfaces. Start here. |
| `2-architecture-summary.md` | Tech stack, topology, auth/RBAC, the database at a glance, the three caching layers, the SSR preference cookies, the integrations. The system map. |
| `3-pages-summary.md` | One paragraph per route (every sidebar page + admin + auth + the new `/notes` and `/subscriptions`), describing what it does and its key invariants. |
| `4-design-essentials.md` | The design *laws*: the neumorphic material and its four rules, the 8 themes, dark mode, typography, motion, z-index, the logo/loading system, the polish layer, permanent component decisions, Elaya's design language. The quick reference. |
| `5-elaya-jarvis.md` | The Elaya AI subsystem in depth — the "Jarvis" 4-block architecture, the Golden Rule, the 12 read + 12 write tools, propose→confirm, the staff channels (in-app SSE + WhatsApp), the **customer** channel, notes, voice, persona, memory, PII. |
| `6-engineering-rules.md` | The engineering constitution digest — Reuse-First (R-rules) + the canonical-helper registry, and the A/S/D/P/V/Q rule tables with IDs. The conventions a code change must obey, plus what ESLint and `check:tokens` now enforce by machine. |
| `7-data-model.md` | The Postgres data model — tables grouped by domain, enums, the load-bearing RPCs, RLS posture, storage buckets, the migration numbering reality (including the duplicate `0161`). |
| `8-integrations-and-jobs.md` | The outside world — lead ingestion, WhatsApp/Gupshup (12 templates), Trigger.dev jobs, Web Push, Deepgram voice, the LLM provider layer — and the `after()` / Vercel-freeze rule that governs them. |
| `9-roadmap-and-open-items.md` | Built vs. planned as of 2026-08-24. What's live, what's written but unapplied, what's next (client records, Sia, DPDP phase 2), and the open audit items. |
| `10-design-system.md` | The buildable design *spec*: the neumorphic token values (shadow recipes, Marshmallow radii, the pastel/chip families, the dark block), the legacy-token bridge, component anatomy, the form/data-display/toast/transition/data-viz systems, and the `ui/` component index. Attach this when building UI from the pack. |
| `11-mobile-and-pwa.md` | The `/m` Mobile Ops layer (four rooms + the Elaya knob), the mobile token layer, the room registry, the PWA (manifest, icons, service worker, boot screen), appearance/dark mode wiring, and the responsive dashboard shell. |

## The one-paragraph version

**Serene** is the internal operating system **Indulge Global** (an ultra-luxury, WhatsApp-first
concierge company based in Goa, India) built for its own team. It runs the entire sales operation
— lead capture from ads, fair round-robin assignment, the worked lead dossier, SLA guardrails,
deals, tasks, performance scoreboards, a shared WhatsApp inbox, and now recurring-bill tracking —
behind one login with role/domain access control enforced in the database (RLS) and again in every
server action. **Elaya** is the AI presence layered through it: a per-user assistant that can read
your work and make changes on your behalf (with confirmation for risky ones), in-app, over
WhatsApp, and — in a hard-capped outward persona — to prospects. The surface is a **neumorphic
soft-UI** system on one cream material with eight accent themes and a warm-charcoal dark mode, plus
a separate pocket surface at `/m` for founders and managers on phones. The stack is Next.js 16 +
Supabase (Postgres/RLS) + TypeScript + Trigger.dev + Upstash Redis + Gupshup (WhatsApp) +
Anthropic (Claude) on Vercel. It is held to luxury-product design standards because the team lives
in it 8–12 hours a day.
