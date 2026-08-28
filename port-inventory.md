# Backend Port Inventory

> **Purpose:** master-plan Step 0. The complete list of what the current Node backend does, and where each piece goes in the Python migration. This is the checklist Steps 3 and 5 port against.
> **Freeze:** as of 2026-08-25, no NEW feature lands in the old Node backend. Bug fixes only. New work waits for, or lands in, Python.
> **Scanned:** 2026-08-25 against the live tree. 30 action files, 44 services, 5 API routes, 5 Trigger.dev tasks.

---

## Destinations, defined

| Destination | Meaning |
| --- | --- |
| **PY-3** | Ports in master-plan Step 3 (the Python brain). Spec: `elaya-workflow.md`. |
| **PY-5** | Ports in Step 5 (the one write path / business API). Next.js actions become thin callers. |
| **PY-6** | Moves during Step 6 era (jobs, pipelines) into Python workers. Keeps running on Trigger.dev until then. |
| **STAYS** | Stays in Next.js forever (frontend concern: auth session plumbing, display reads until their API exists, PWA manifest). |
| **BRIDGE** | Stays in Next.js during transition but its Elaya branch calls the Python service over internal HTTP at the Step 3 flip; fully moves at PY-5. |

---

## 1. The Elaya subsystem — PY-3 (the first port)

Everything under `src/lib/elaya/` plus its services. The full behavioral spec is `elaya-workflow.md`; port to parity, evals gate the flip.

| Piece | Files |
| --- | --- |
| Provider contract + Anthropic adapter (→ Bedrock in Python) | `lib/elaya/provider.ts`, `adapters/anthropic.ts`, `registry.ts` |
| Principal, persona, PII gateway, confirmation classifier, access gate | `principal.ts`, `persona.ts`, `customer-persona.ts`, `pii.ts`, `confirmation.ts`, `access.ts` |
| Brains (staff + customer) + memory | `brain.ts`, `customer-brain.ts`, `memory.ts` |
| Tool registries (12 read + 12 write + 2 customer) + the data seam | `tools/registry.ts`, `tools/write-registry.ts`, `tools/customer-registry.ts`, `elaya-data.ts` |
| Elaya services | `elaya-service.ts`, `elaya-actions-service.ts`, `elaya-notes-service.ts`, `elaya-training-service.ts`, `elaya-whatsapp.ts`, `elaya-customer.ts`, `llm-providers-service.ts` |
| The SSE chat route | `app/api/elaya/chat/route.ts` → a FastAPI streaming endpoint; the Next.js route becomes a thin proxy (or the client points at the new URL) at flip time |

Note for the port: the brain calls mutation cores (lead/task writes). Until PY-5 lands, the Python brain reaches those writes through a minimal internal endpoint in front of the existing cores, OR the write cores port together with the brain — decide at Step 3 kickoff. Never two live implementations of a core.

## 2. Mutation cores + their services — PY-5 (the one write path)

| Area | Files (services) | Actions that become thin callers |
| --- | --- | --- |
| Lead writes | `lead-mutations.ts` (7 cores), `lead-cache.ts`, `lead-assignment-notify.ts`, `sla-service.ts` (arming side) | `actions/leads.ts` (15 fns), `actions/deals.ts` (3), `actions/revival.ts` (3) |
| Task writes | `task-mutations.ts` (7 cores + gates), `task-events.ts` | `actions/tasks.ts` (14 fns) |
| Lead ingestion | `lead-ingestion.ts`, `webhooks/leads/route.ts` | (webhook moves whole) |
| WhatsApp (Gia) sends + ingestion | `whatsapp-api.ts`, `whatsapp-ingestion.ts`, `whatsapp-media.ts`, `whatsapp-service.ts`, `webhooks/whatsapp/route.ts` | `actions/whatsapp.ts` (8) — BRIDGE at Step 3 (its Elaya gate calls Python), fully PY-5 |
| Notifications + push | `notifications-service.ts`, `notification-prefs-service.ts`, `push-service.ts` | `actions/notifications.ts`, `actions/notification-prefs.ts`, `actions/push.ts` |
| Profiles/admin writes | `profiles-service.ts` (write half), `agent-routing-service.ts` | `actions/profiles.ts` (8), `actions/agent-routing.ts` (2) |
| Config writes | `domain-targets-service.ts`, SLA policy writes | `actions/sla-policies.ts`, `actions/sla.ts` |
| Content writes | `intelligence-service.ts`, `ad-creatives-service.ts`, `ad-spend-service.ts`, `subscriptions-service.ts`, `suggestions-service.ts` | `actions/intelligence.ts`, `actions/ad-creatives.ts`, `actions/ad-spend.ts`, `actions/recharge.ts`, `actions/subscriptions.ts` |
| Elaya user-facing writes | (notes/training/persona services already listed in §1) | `actions/elaya-notes.ts`, `actions/elaya-training.ts`, `actions/elaya.ts` |
| Voice input | `transcription-service.ts` | `actions/transcription.ts` |

## 3. Read/display layer — STAYS until its Python API exists, migrates gradually with PY-5+

RSC pages + read actions that only fetch and shape for display: `dashboard-service.ts` + `actions/dashboard.ts` (7), `performance-service.ts` + `actions/performance.ts` (14), `deals-service.ts` / `leads-service.ts` (read halves), `tasks-service.ts` (reads), `oversight-service.ts`, `activity-service.ts`, `mobile-service.ts` + `actions/mobile.ts` (4), `usage-service.ts`, `actions/search.ts`, `cache-helpers.ts`, `rpc-helpers.ts`. These keep reading Supabase directly from Next.js until each domain's Python endpoint exists; no rush, no risk — reads cannot corrupt anything.

## 4. Jobs — PY-6 (keep on Trigger.dev until the Python workers land)

`src/trigger/`: `lead-sla.ts` (SLA timers), `task-reminders.ts`, `lead-revival.ts` (daily sweep + note-AI gate), `usage-rollup.ts`, `usage-snapshot.ts`. Plus `lib/trigger/cancel-runs.ts`. The revival gate's model call moves with the Elaya provider layer (PY-3) behind an internal endpoint if needed.

## 5. STAYS in Next.js forever

`app/api/auth/callback` (Supabase auth redirect), `app/api/manifest` (PWA icons), `proxy.ts` (session refresh for the web app), `lib/supabase/*` clients (the web app still reads), all `validations/` and `constants/` that the UI consumes (Python gets its own Pydantic mirrors where the API needs them), everything under `components/`, `hooks/`, `styles/`.

## 6. New, born in Python (never ported)

The Sia connector's downstream pipeline, client/vendor profiling, tickets, reports + PDF, proactive scheduler, voice service, embeddings — per `plan-whatsapp.md` and `plan-elaya.md` Phase 3+. (The Baileys connector itself: Node, by decision 8.)
