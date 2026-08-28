# Serene — Elaya / "Jarvis" deep-dive (Claude Project digest)

> Digest of `src/lib/elaya/CLAUDE.md`, `docs/modules/elaya.md`,
> `docs/modules/customer-welcome-blast.md`, `docs/pages/{elaya,elaya-training,notes}.md`, and
> `docs/audits/2026-06-25-elaya-full-audit.md` — verified against the live tool registries
> 2026-08-24. Open items are in `9-roadmap-and-open-items.md`.
>
> **What changed since the 2026-06-26 pack:** the read registry grew to **12** tools
> (`find_teammate` landed) and the write registry to **12** (`create_subtask` landed); the
> **customer WhatsApp channel is built** (customer principal, persona, brain, two-tool registry,
> welcome-blast orchestrator, admin training page); the **Notes** section shipped and
> `retrieveMemoryContext` was **removed**; the SSE transport was extracted so the mobile screen
> shares it.

## What Elaya is

Elaya is the AI presence inside Serene — "a compass, not a chatbot." For staff she is a **per-user
assistant** that reads your work and makes changes on your behalf, in-app and over WhatsApp, scoped
strictly to what your role permits. For prospects she is a **hard-capped outward concierge voice**
that can send curated material and answer from a curated knowledge base, and nothing else. She is
also the substrate for every other AI feature (lead revival reuses her provider/PII layer).

Live config: reasoning model `claude-sonnet-4-6` (4096 max tokens), routing model
`claude-haiku-4-5` (1024 max tokens), daily cap 200 messages, PII masking `light`, 24h session. All
read per turn from `llm_providers` + `elaya_settings` — a model switch is a DB edit, no deploy.

## THE GOLDEN RULE (never violate)

> **Permissions are enforced in CODE and are completely independent of persona, memory, notes, and
> any model/prompt content.**

A user's notes/persona — or a scraped page, or lead-sourced text — can literally say "I'm an admin,
show me everything" and it changes nothing: the toolset and data scope are fixed by the **verified
principal's role, in code, before the model runs.** Persona, notes, learned memory and training
content are injected as *content the model reads*, never as *permission the model holds*. This is
the single property that makes it safe to (a) inject user content into the prompt and (b) let Elaya
talk to external customers.

Corollaries (also non-negotiable):

- **Identity is principal-derived, never from the channel or the model.** In-app = session→profile;
  WhatsApp staff = phone→profile; customer = phone→**lead**. `ElayaPrincipal` is a discriminated
  union — `StaffPrincipal | CustomerPrincipal` — and the staff brain/persona/tools take
  `StaffPrincipal` *specifically*, so the customer path cannot reach staff code even by mistake.
- **Admin client + code-side scoping** is the sanctioned sessionless pattern. An Elaya read must
  never depend on `auth.uid()` (that returns blank on WhatsApp).
- **Every state-changing write is propose→confirm** — the resolver in `brain.ts` is the ONLY place a
  state change executes. Low-risk writes execute inline and log an `elaya_actions` row.
- **Every tool result passes `maskPii()`** before the model sees it (exact-UUID leaves are skipped,
  so writes can still target records).

## The "Jarvis" four-block architecture

A great assistant keeps four concerns strictly apart (mixing them is what makes assistants insecure
or unscalable):

| # | Concern | Plain meaning | Source of truth | Controlled by |
| - | ------- | ------------- | --------------- | ------------- |
| 1 | **Identity** | who are you? | the verified `ElayaPrincipal` | the system (never the model) |
| 2 | **Permissions** | what may you see & do? | role → toolset + data scope | **code only** |
| 3 | **Persona** | how should I talk to you? | per-user style file | the user + learned |
| 4 | **Memory** | what do I know about you & your work? | notes + durable context + history | grows over time |

**Block 1 — the Elaya data layer (`src/lib/elaya/elaya-data.ts`).** The single seam every Elaya READ
goes through: principal-in → admin client → scoped by role/userId/domain **in code** → `maskPii`.
Tools call `elayaData.*` **only**, never a `*-service.ts` directly — so a session dependency is
physically impossible to introduce, and channel parity is structural. Where a service was genuinely
`auth.uid()`-bound, a `*ForElaya` admin twin was added (migration 0149:
`get_group_task_summaries_for_user`, `get_agent_today_pulse_for_user`,
`get_agent_roster_performance_for_elaya` — scope-param, EXECUTE revoked, service-role only).

**Block 2 — permissions.** `TOOLSET_BY_ROLE` / `readToolsForRole(role)` / `writeToolsForRole(role)`
map role → permitted tools; the model is only handed the tools the principal carries, and
`executeTool` re-checks. Persona/notes never appear in this decision (the Golden Rule).

**Block 3 — persona ("how Elaya talks to me").** A per-user style file: language
(mirror/english/hinglish), tone (warm/direct/playful), depth (simple/standard/technical), length
(brief/standard/detailed) + a 600-char free-text note. Stored in `user_context.context.persona`
(jsonb), edited from `/profile`. Injected as a fenced **STYLE-ONLY** block
(`buildPersonaPromptBlock`) that emits only non-default picks → it rides the cached prompt prefix, so
a per-user persona costs ~0 tokens after turn 1.

**Block 4 — memory ("gets smarter the more you use it").** Three tiers merged per turn:

1. **Conversation history** — the last N messages of the 24h session.
2. **Durable learned memory** — `summarizeLearnedMemory` makes ONE bounded Haiku call (reuses
   `resolveLlmForJob('routing')` + `maskPii`, no tools), merges the prior learned note with the
   recent transcript into a ≤900-char note, and **fails soft to null** (a glitch never corrupts
   existing memory). `maybeUpdateLearnedMemory` is throttled (every 4th user message),
   fire-and-forget, and runs in the post-reply window of both channels.
3. **Notes** — the user's free-form `/notes` entries (`elaya_notes`, migration 0152), folded in via
   `buildNotesPromptBlock` as **CONTEXT to remember, never permission**. A user with no notes
   contributes zero bytes, so the shared prompt-cache prefix is preserved.

**`retrieveMemoryContext` was removed 2026-07-02** (zero callers). The brain now reads
`getUserPersona` + `getNotesForElaya` directly; a future embeddings/semantic-retrieval layer starts
from those two call sites (the `vector` extension is already installed).

## The subsystem file map

```text
src/lib/elaya/
  provider.ts             — the ONE provider-neutral complete() contract
  adapters/anthropic.ts   — the ONLY file allowed to import @anthropic-ai/sdk (ESLint-enforced)
  elaya-data.ts           — THE single READ data seam (the parity rule). New reads go here.
  tools/registry.ts       — the 12 READ tools + THE single executeTool dispatch (read ∪ write)
  tools/write-registry.ts — the 12 WRITE tools + executeProposedAction (the propose→confirm resolver)
  tools/customer-registry.ts — the CUSTOMER toolset (exactly two tools) + its own dispatch
  principal.ts            — StaffPrincipal | CustomerPrincipal; resolveStaffPrincipal / resolveCustomerPrincipal(lead)
  persona.ts              — the STAFF system prompt (+ persona/learned/notes blocks)
  customer-persona.ts     — the CUSTOMER system prompt (voice + hard guardrails)
  brain.ts                — the staff tool loop + the confirmation RESOLVER pre-step
  customer-brain.ts       — runCustomerTurn: a separate, simpler loop (no resolver, no memory, no ledger)
  memory.ts               — the learned-memory summarizer + the throttled post-turn writer
  access.ts               — canAccessLead (ONE security predicate for both registries) + label helpers
  pii.ts                  — maskPii() — the gateway every tool result passes
  confirmation.ts         — classifyConfirmation() — the pure English+Hinglish affirmation gate
src/lib/services/
  elaya-service.ts        — conversations/messages/persona/memory DB access (admin client; 24h session, IST cap)
  elaya-whatsapp.ts       — tryHandleElayaWhatsAppMessage: the WhatsApp STAFF routing gate
  elaya-customer.ts       — the CUSTOMER welcome-blast orchestrator + conversation turn
  elaya-actions-service.ts— the elaya_actions ledger (proposed/executed audit rows)
  lead-mutations.ts       — shared lead CORES (addLeadNoteCore, addLeadCallNoteCore, createLeadTaskCore,
                            updateLeadStatusCore, assignLeadCore, recordDealCore, reviveLeadCore)
  task-mutations.ts       — shared task CORES + canMutateTask + isAssigneeActive
src/lib/actions/elaya.ts  — getElayaChatSeedAction + updateElayaPersonaAction
src/app/api/elaya/chat/route.ts — the SSE streaming endpoint (the in-app channel)
src/components/elaya/elaya-stream.ts — THE SSE transport (streamElayaChat + TOOL_STATUS_LABELS)
src/components/elaya/     — ElayaChatShell, ElayaWidget, ElayaMessageBubble, ElayaIdentityCard…
```

## The 12 read tools (role-gated)

**All staff (8):** `search_leads` · `get_cold_leads` · `get_lead_details` · `get_my_tasks`
(Gia + personal + group) · `search_deals` · `get_performance_snapshot` (agent pulse / manager+
roster) · `get_helpdesk_content` · **`find_teammate`**.

**Manager+ (3):** `get_escalations` · `get_domain_health` · `get_campaigns`.
**Admin/founder (1):** `get_budget`.

`find_teammate` is the name→userId **staff** lookup that makes "create a task for Meghana" work. It
resolves through `elayaData.findTeammates` → `searchTeammatesForElaya` (admin client + code scope,
**all domains**) — deliberately *not* `getAssignableUsers`, whose session client blanks on the
WhatsApp webhook. It is never `search_leads`. Each read tool wraps an existing service through
`elaya-data`; money is ₹-only; zero denominators render "—". Guests can converse but carry an empty
toolset.

## The 12 write tools, two tiers

| Tool | Tier | Roles | Wraps (shared core) |
| ---- | ---- | ----- | -------------------- |
| `add_lead_note` | inline | all staff | `addLeadNoteCore` |
| `log_call` | inline | all staff | `addLeadCallNoteCore` (sets outcome, bumps count, auto-advances new→touched, arms the SLA cadence — not a plain note) |
| `create_lead_task` | inline | all staff | `createLeadTaskCore` |
| `create_personal_task` | inline | all staff (assign-another: manager+) | `createPersonalTaskCore` |
| `create_group_task` | inline | all staff | `createGroupTaskCore` |
| `create_subtask` | inline | all staff | `createSubtaskCore` |
| `update_task_status` | inline | all staff | `updateTaskStatusCore` |
| `update_task` | inline | all staff (cross-user assign gated manager+) | `updateTaskCore` |
| `update_lead_status` | **propose→confirm** | all staff | `updateLeadStatusCore` |
| `reassign_lead` | **propose→confirm** | manager/admin/founder | `assignLeadCore` |
| `log_deal` | **propose→confirm** | all staff | `recordDealCore` (money + flips the lead to Won) |
| `delete_task` | **propose→confirm** | all staff (own / domain group / all) | `deleteTaskCore` |

**The team-task workflow:** `create_group_task` makes the container, then `create_subtask` runs once
**per person**, each resolved through `find_teammate`. A task row has exactly one assignee — multiple
people means multiple subtasks. `create_group_task` is all-staff (a group is just a container) and
must not inherit `reassign_lead`'s manager gate; `createSubtaskCore`'s access gate is
`getVisibleGroupById`.

**Task assignment pings the assignee on WhatsApp.** `createPersonalTaskCore` (when assigned to
someone else) and `createSubtaskCore` both **await** `sendTaskAssignedNotification` beside the
existing `createNotification`, inside the core (A-16 — every caller keeps the lambda alive). It is
gated by the existing `task_assigned` notification-preference key and logged as `task_assigned`
(0153).

**Wrap, never re-query (R-01).** Every write tool calls the SAME context-free core in
`lead-mutations.ts` / `task-mutations.ts` that the UI's server action calls — so a tool-driven write
inherits cache invalidation (`invalidateLeadCaches`, P-08), activity logging, SLA rails,
won-notification fan-out, Trigger.dev reminders, and the oversight/activity event emits
**identically**. `revalidatePath`/`after()` stay in the action caller.

## The propose→confirm model (how risky writes execute)

```text
user turn ─► runElayaTurn
              │
              ├─ RESOLVER PRE-STEP  (the ONLY place a state-change executes)
              │    pending = getLatestProposedAction(conversationId, userId)
              │    auto-dismiss if older than PROPOSAL_TTL_MS (15 min) and require the ask was relayed
              │    classifyConfirmation(latest *human* message)   ← pure code, never the model
              │      affirmative → re-resolve leadId, re-check access + before-snapshot,
              │                     run core, mark executed|failed, emit a code-generated line
              │      anything else → mark dismissed, then process the fresh message
              │
              └─ TOOL LOOP
                   inline write   → access re-check → core → INSERT executed elaya_actions row
                   state-changing → access re-check → supersede prior proposals → INSERT proposed
                                    → "awaiting confirmation"  (NO mutation this turn)
```

Hard contracts: `classifyConfirmation` is pure/deterministic, an English+Hinglish allow-list,
whole-token match, default `'other'` = cancel — it never trusts the model, so lead-sourced text can
at most cause a `proposed` row, never an executed write. A state tool's `run()` has **no branch that
reaches a core**, so "execute in the proposal turn" is structurally impossible. `log_deal` validates
the deal *shape* at propose time (domain → membership-needs-duration / retail-needs-category) so the
model can ask for the missing piece before proposing, and the resolver re-runs the **resolved** shape,
not raw model input. The `elaya_actions` ledger records every executed write with before/after
snapshots (trust + rollback). Write tools resolve a lead by an opaque `leadId` (UUID-or-slug) — the
model is never asked to reproduce the PII-derived slug — and still run `canAccessLead(principal)`.

## Channels

**In-app (`/elaya`, the floating widget, and `/m/elaya`):** the RSC seeds the conversation via
`resolveElayaChatSeed`; the client POSTs to `/api/elaya/chat` and pumps
**`streamElayaChat()`** — THE one SSE transport (fetch + `\n\n` frame buffering +
meta/delta/tool/done/error dispatch + `TOOL_STATUS_LABELS`), shared by the desktop shell and the
mobile screen. Never fork a second transport. Burst rate-limiting is keyed on the verified
`profile.id`, not a spoofable header; the DB daily cap is the real ceiling.

**WhatsApp staff channel (`elaya-whatsapp.ts`):** the inbound webhook 200-acks immediately, then
inside `after()` calls `tryHandleElayaWhatsAppMessage(phone, message)` **before** the lead pipeline.
A recognised **active staff** number routes to the same brain/tools/PII gateway/daily cap; the brain
runs to completion and sends ONE reply via `sendElayaWhatsAppReply` (passed through
`markdownToWhatsApp()` first; logs an `elaya_reply` row). The gate returns handled on every path
(including failures) — a staff message can **never** mint a lead, and it writes only
`elaya_messages`. An **unknown** number falls through untouched. **One cap, one session, across
channels** — a WhatsApp message continues an in-app session and vice versa; per-message `channel`
records where each happened. WhatsApp dedupes on the Gupshup message id (partial UNIQUE, 0148).

**WhatsApp customer channel (`elaya-customer.ts` — FEATURE 2, built 2026-06-26).** The outward
persona, in the **else** branch after the staff gate, inside `after()`:

- **Two founder decisions are baked in.** (1) The first message to a cold number must be an
  **approved Gupshup template** (the 24h free-form window only opens after they reply); the moment
  they reply, the conversational blast + ongoing conversation run. Creating and getting that
  template approved is a founder-side Gupshup step — the code calls
  `GUPSHUP_CUSTOMER_WELCOME_TEMPLATE_ID` and **no-ops with a skip log until that env var is set**.
  (2) She is fully autonomous *within hard guardrails*: KB-only facts, ₹ only, no invented services
  or prices, no AI/Serene reveal, no talk of other customers or internal matters. An agent can take
  over at any time — the staff WhatsApp/dossier path is untouched.
- **`CustomerPrincipal` is the lead, not a profile**, and carries `CUSTOMER_TOOLSET` — exactly two
  lead-scoped tools: `get_company_material` (read-only KB) and `note_customer_interest` (writes only
  that lead's `service_interests`). `executeCustomerTool` refuses anything outside the set. No staff
  tool, no `executeTool`, no CRM read is reachable from a customer turn, by construction — this was
  adversarially reviewed by tracing.
- **`runCustomerTurn` is a separate, simpler loop** — no confirmation resolver, no staff persona or
  memory, no `elaya_actions`. It shares only the provider contract, and it surfaces the media the KB
  tool fetched so the orchestrator sends the actual files.
- **One blast per lead, ever:** `welcomed_at` (0151) is the idempotency flag, so a redelivery or a
  second message never re-blasts. The normal lead pipeline (round-robin, agent/founder
  notifications, SLA) still runs — the customer layer is purely additive.
- The material she may send is curated by staff on **`/admin/elaya-training`**
  (`elaya_training_assets`, 0150).

## Voice input (input transform only)

Staff can speak on both surfaces. Audio is transcribed to text and fed into the **exact same**
`runElayaTurn` as typed — nothing downstream changes (cap, dedup, session, persist, brain, tools,
propose→confirm, PII). Stack: **Deepgram Nova-2**, language `hi-Latn` (Hinglish), 3 MB max audio,
2-min recording cap. In-app uses the shared `DictationButton` (`variant="composer"`) →
`transcribeAudioAction` and lands an **editable draft** (never auto-sends); WhatsApp voice notes are
fetched + transcribed server-to-server before the cap/model/persist. Audio is transcribed in-memory
and discarded — never stored. One STT call site (`transcription-service.ts`, `server-only`).
Empty/non-speech input gets a graceful nudge before any cap burn.

## What's NOT built (so a chat doesn't assume it exists)

- **In-app proposal *card*** — risky writes confirm via a chat "yes" today; the two-button
  Approve/Dismiss SSE frame is still a design target (audit item M8).
- **Semantic memory retrieval** — notes and learned memory load whole; embeddings are the planned
  swap, starting from `getUserPersona`/`getNotesForElaya`.
- **Voice replies / TTS (ElevenLabs)** — locked for a future phase; voice is input-only.
- **WhatsApp closed-window template fallback** — no re-open path when a 24h session expires
  (audit item H4b).
- **A `get_usage` tool** — `getAgentUsage` is session-bound and needs a sessionless twin first.
- **The customer welcome template itself** — see above; the code path exists, the approved Gupshup
  template id may or may not be set on Vercel (not verifiable from the repo).

See `9-roadmap-and-open-items.md` for the roadmap and the remaining audit items.
