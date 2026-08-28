# The Master Plan

> **Purpose:** the one map of everything we are building. A dev starts HERE to know what to do and in what order, then opens the module plan for the deep detail of their phase.
> **Audience:** everyone working on Serene. Plain language on purpose.
> **Decided:** 2026-08-25.
> **Status:** live. Update the status board (section 6) as steps complete.

---

## 1. The vision, in one paragraph

Serene becomes Indulge OS: one system, powered by our AI, running the whole company. Elaya is the personal agent for every employee, in any language, by text or voice, doing the manual work herself. Sia watches every client and vendor WhatsApp group, turning years of conversation into live client profiles, concierge tickets, reviews, and staff and vendor intelligence. Everything runs on our Python backend on AWS, and over time the easy work moves onto small models trained on our own data.

---

## 2. The document family, and how to use it

| File | What it holds | Open it when |
| --- | --- | --- |
| `master-plan.md` | THIS file. The locked decisions, the full step order, the status board. | Always start here. |
| `plan-elaya.md` | The AI track in depth: evals, the Python brain port, router and specialists, reports, proactive Elaya, multilingual, voice, our own models. | You are working on anything AI. |
| `plan-whatsapp.md` | The Sia data layer in depth: Baileys, the `wag_` database design, the connector, the Serene UI, privacy, profiling. | You are working on anything WhatsApp-groups / Sia. |
| `elaya-workflow.md` | The complete as-built spec of TODAY'S Elaya: every tool, guardrail, and cap. | You are porting the brain to Python (this is the port manual), or you need to know how current Elaya behaves. |

Rule: this file owns the ORDER and the DECISIONS. The module plans own the DETAIL. If they ever disagree on sequence, this file wins.

---

## 3. The locked decisions

Debated, decided, closed. Full reasoning lives in the module plans.

| # | Decision |
| --- | --- |
| 1 | **Full Python backend (FastAPI), built directly on AWS, starting now.** All new work is born in Python so we never pay a migration tax later. |
| 2 | **Strangler migration, never big bang.** The current system keeps serving users; each piece flips only when its Python replacement proves itself. Always a rollback path. |
| 3 | **Evals gate everything.** The exam (real messages + answer keys) is built first, against the current system. No port flips and no AI change ships without the score to back it. |
| 4 | **React frontend stays on Vercel.** It becomes a pure display layer calling the Python API. The future React Native mobile app calls the SAME API. |
| 5 | **Supabase never moves.** One database, both backends read it during the whole transition. |
| 6 | **Claude via AWS Bedrock** once on AWS. No self-hosting the big model (worse and costlier). Our own models come later by distilling small models on our accumulated data. |
| 7 | **Sia and Gia never mix.** Gia = the onboarding CRM and its Gupshup WhatsApp, frozen as is. Sia = the client-operations half, the Baileys group world, all new. They meet only in the client profile. |
| 8 | **The one Node exception:** the Baileys connector (a dumb 500-line ear). Everything intelligent is Python. |

---

## 4. The steps, in order

Two tracks run in parallel after the foundation. A dev picks a step, reads the pointed section, builds, updates the board.

### Step 0. Freeze and scan

Nothing new lands in the old Node backend from here on. Scan and list what the current backend does (the inventory that Step 3 and Step 5 port). `elaya-workflow.md` already covers the AI side; the remaining server actions and services get a short inventory doc.

### Step 1. The exam, and the first Sia bricks (parallel, starts now)

| Work | Detail lives in |
| --- | --- |
| Build the eval harness in Python + the golden set of 150 to 200 real messages, run it against CURRENT Elaya. Fix the top bugs it reveals. Upgrade the live `reasoning` model row (one DB edit, measured by the evals). | `plan-elaya.md` Phase 0 |
| Write the Sia `wag_` database migrations (schema, partitions, indexes, RLS). Zero dependencies, can ship immediately. | `plan-whatsapp.md` Phase W2 + section 3 |

### Step 2. The AWS foundation (the shared ground)

ECS Fargate cluster, the FastAPI skeleton, Bedrock access, S3 buckets (private for Sia media), CI/CD, health checks and alerts. Two service homes: the Python backend and the Baileys connector.

Detail: `plan-elaya.md` Phase 1 (first half) + `plan-whatsapp.md` Phase W1.

### Step 3. The Python brain (AI track)

Port Elaya's runtime to Python using `elaya-workflow.md` as the spec: principal, tools, PII gateway, confirmation protocol, brain loop. Build the router + specialists in directly (never port the 24-tools-in-one-prompt weakness). Run the SAME evals against old and new. Flip when equal or better. Old path stays one week as rollback.

Detail: `plan-elaya.md` Phase 1.

### Step 4. The Sia ear and eyes (Sia track, overlaps Step 3)

The Baileys connector (thin socket handler, raw-first writes, direct service-role Postgres, media download and decrypt with dead-letter, dual watchers) and the Sia UI in Serene (groups, chat viewer, search, health panel, the mapping tool). Ten pilot groups, two weeks of zero-loss proving.

Detail: `plan-whatsapp.md` Phases W3 + W4, sections 8 and 10.

### Step 5. One write path in Python (AI track)

Port the mutation cores. Next.js server actions become thin callers of the Python API. From here, exactly one place in the company knows how to update a lead or a task, and the mobile app's API already exists.

Detail: `plan-elaya.md` Phase 2.

### Step 6. The serious capabilities (both tracks, parallel)

| Work | Detail lives in |
| --- | --- |
| Reports and long jobs: "send me last week's onboarding report" → real data → PDF on our template → WhatsApp. | `plan-elaya.md` Phase 3a |
| Proactive Elaya: agenda injection ("Advita wali report kal due hai") + scheduled nudges. | `plan-elaya.md` Phase 3b |
| Client profiling, concierge tickets, reviews, vendor profiling, staff monitoring, all fed by the Sia data. | `plan-elaya.md` Phase 3c + `plan-whatsapp.md` Phase W5 |
| Full multilingual: Hindi, Marathi, Kannada, Urdu and more, in text, voice input, and the yes/no confirmation classifier. | `plan-elaya.md` Phase 3d |
| Embeddings over the chat history (pgvector, masked text only). | `plan-whatsapp.md` section 10.5 |

### Step 7. Voice

Voice replies first (TTS on existing chat), then true realtime talk over WebSockets on the Python backend.

Detail: `plan-elaya.md` Phase 4.

### Step 8. The mobile app

React Native, iOS first, consuming the same Python API. Most features exist the day the shell is built, because of Step 5.

Detail: `plan-elaya.md` Phase 5.

### Step 9. Our own models

Distill small, fast, self-hosted models for the easy 70 percent (routing, simple tasks) from the interaction data the ledger has been collecting all along. Frontier model keeps the hard 30 percent. Only shipped when evals prove each one.

Detail: `plan-elaya.md` Phase 6.

---

## 5. The laws that never change

Short form; the full versions live in `plan-elaya.md` section 3 and `plan-whatsapp.md` sections 6 to 10.

1. Permissions live in code, decided before any model runs. Nothing a model reads can widen access.
2. Big writes propose and wait for a human yes. The yes is classified by pure code.
3. One write path. One implementation of every mutation, everything calls it.
4. Raw first, append-only truth. Store before parsing; tag deletes, never remove.
5. Mask identity at every AI border (model calls AND embeddings), never mask intent. Full detail stays inside our fortress.
6. Evals before flips. Score up, ship. Score down, fix.
7. Sia and Gia never mix.

---

## 6. Status board

Update this as work completes. This is the living pulse of the plan.

| Step | Work | Status |
| --- | --- | --- |
| 0 | Freeze old backend, inventory scan | **done 2026-08-25** (`port-inventory.md`; freeze active) |
| 1a | Eval harness + golden set + top bug fixes | **live 2026-08-27**: 30 cases, baseline ALL GREEN after the propose-protocol persona fix (first real bug caught + fixed); 2 known gaps tracked |
| 1b | Model row upgrade (measured) | **done 2026-08-27**: reasoning → Sonnet 5 (28/28 vs 27/28 baseline, ~33% cheaper per turn); fuzzy-gate hardened structurally along the way |
| 1c | Sia `wag_` migrations | **live 2026-08-27** (migration 0169): 9 tables, monthly partitions + DEFAULT nets, dedup wall + soft references smoke-verified in prod; contract in `plan-whatsapp.md` §11 |
| 2 | AWS foundation (Fargate, FastAPI skeleton, Bedrock, S3, CI/CD) | **core live 2026-08-27**: Copilot app `serene`, env `prod` (ap-south-1) — service `api` (FastAPI skeleton, `/healthz` green, behind an ALB) and service `watcher` (Sia, below). S3 done with W1 (the sia-media bucket + a scoped `serene-sia-media-reader` IAM identity). Deploys = `cd backend && copilot svc deploy --name <svc> --env prod`. Remaining: Bedrock enablement (with Step 3), CI/CD pipeline |
| 3 | Python brain + router/specialists, eval-gated flip | **foundation live 2026-08-28**: FastAPI brain on the Fargate `api` service — router (Haiku classifies → specialist profile, code-validated) + 4 specialists (leads/tasks/analytics/general; analytics rides the new `heavy` tier), **three DB-driven model tiers** (migration 0176: routing=Haiku 4.5, reasoning=Sonnet 5, heavy=Opus 5 — switching = an UPDATE, no deploy), faithful ports of the PII gateway / confirmation classifier / principal resolver / single-dispatch tool gate, prompt-cached turn loop, `POST /v1/elaya/chat` SSE **wire-compatible with elaya-stream.ts** (the flip = a URL change). First 2 tools ported and proven live end-to-end. Remaining before the flip: the other 22 tools + writes + resolver, persona parity, persistence + caps, evals vs Python, WhatsApp channel |
| 4a | Baileys connector, pilot groups proving | **built + deployed + audit-hardened 2026-08-27**: `connector/` (Baileys 7.0, read-only, thin-handler, raw-first) proved on the real number (79k+ messages, 466 groups), moved to **AWS Fargate** with **media on S3**, then hardened per the full-pipeline audit ("Sia Watcher Audit" artifact): session identity in **Postgres** (`sia.wag_auth_state`, no EFS — Baileys' own prod guidance), crash-only lifecycle, loggedOut self-recovery, the **heartbeat alarm** (the watcher beats its own pulse every 60s — migration 0175; Trigger.dev classifies down / session-lost / unreachable / quiet-6h so night-time group silence never false-alarms), historical-media backfill (14.5k pending rows → done/expired), `connector/RUNBOOK.md` (ONE-RUNNER law, pairing, session SQL). Remaining: the ONE clean pairing (founder links when ready) + `npx trigger.dev deploy` for the alarm |
| 4b | Sia UI (groups, viewer, search, health, mapping) | **done 2026-08-27, polish shipped same day**: `/sia` is the WhatsApp-Web reading in Serene material — preview rail (migration 0173), live 4s tail with new-message pill, inline media (images, stickers, voice-note player, tap-to-load video, document download), reactions + quoted replies in-bubble, and the Sia console (gear with live status dot → health + full mapping manager). Sia lives in its own `sia` schema (0170–0173). Push transport + S3 media swap arrive with W1 |
| 5 | Mutation cores in Python, one write path | not started |
| 6a | Reports + PDF + long jobs | not started |
| 6b | Proactive Elaya | not started |
| 6c | Profiling, tickets, reviews, vendor + staff intelligence | not started |
| 6d | Full multilingual | not started |
| 6e | Embeddings (pgvector) | not started |
| 7 | Voice (TTS, then realtime) | not started |
| 8 | Mobile app (React Native) | not started |
| 9 | Distilled own models | not started |
