# Serene

**An internal operating system for a luxury concierge business.**

_A shareable overview of what has been built, how it is built, and where it is going._ _Last updated: 12 August 2026_

---

## 1. What Serene is

Serene is a custom-built internal platform. It is the single place the team logs into every morning, and everything they need to do their job lives inside it: the sales pipeline, conversations with prospects, daily tasks, performance numbers, advertising spend, and the controls for how work gets distributed.

It replaces the usual pile of spreadsheets, chat threads, and a generic off-the-shelf CRM with one owned system that fits how the business actually runs.

It is built as a base OS with modules on top:

| Layer      | What it is                                                                      | Status  |
| ---------- | ------------------------------------------------------------------------------- | ------- |
| **Serene** | The base OS: login, roles, theming, navigation, dashboard, notifications, tasks | Live    |
| **Gia**    | The CRM module: a lead from first contact to closed deal                        | Live    |
| **Elaya**  | The AI presence inside the OS: answers questions and takes action               | Live    |
| **Sia**    | The concierge module: post-sale client relationships                            | Planned |

The architectural promise is that adding a new module never requires touching the base layer. That has held so far.

**Scale of the build today:** roughly 595 TypeScript/TSX files, about 111,000 lines of application code, 44 database tables, 167 applied database migrations, 23 feature areas, 30 server-action modules, and 43 data-service modules. It has been in daily production use since May 2026.

---

## 2. What the team actually sees

Around 25 routes in the web app, plus a separate mobile layer.

- **Dashboard** — a configurable widget grid: today's tasks, fresh leads, pipeline movement, campaign production, leads going cold. Layout is drag-and-drop and saved per user.
- **Leads** — the working list of every prospect, with server-side search, filters, saved column preferences, and CSV/XLSX export. Behind every name is a full dossier: every call, note, message, status change, and task, in order.
- **Lead dossier** — the deep page for one prospect. Seven composed cards covering identity, activity timeline, tasks, notes, WhatsApp thread, service interests, and matched service knowledge.
- **Deals** — the ledger of closed business with running totals, including walk-in business that never came through an ad.
- **WhatsApp** — a shared team inbox on the company number. A message from an unknown number creates a lead automatically; a known number lands in its existing thread. Media is stored in a private bucket and served through signed URLs.
- **Tasks** — personal to-dos, team project workspaces with sub-tasks, checklists, tags and remarks, plus follow-ups the system books on its own.
- **Campaigns** — which advertisements actually produce leads and wins, campaign by campaign.
- **Budget** — advertising spend per ad account, next to what it returned, with a recharge ledger and monthly targets.
- **Performance** — scoreboards at three altitudes: an agent's own calls, response times and conversions; a manager's team comparison; a founder's per-business-line health.
- **Oversight** — a live control room: a three-tier drill from business lines to teams to individuals, showing what everyone is working on right now, over a live event stream.
- **Helpdesk** — a searchable library of "can we arrange X?" service cases and conversation hooks, with the relevant ones surfaced automatically on each lead's page.
- **Elaya** — the AI chat surface.
- **Notes** — each person's own notepad, which the AI reads as context.
- **Settings, Team, Admin** — routing rota, working hours, SLA policies, revival policies, user accounts, permissions, ad creatives, AI training data, adoption usage, and an error log.
- **Mobile layer** — a separate touch-first shell at its own route, with four role-aware rooms (dashboard, tasks, budget, activity), a swipe-paged business-line carousel, and the full AI chat. It is not a shrunk desktop; it is its own design system.

---

## 3. The lead journey, end to end

This is the spine of the product.

1. A prospect taps an ad and submits their details.
2. Within seconds they exist in Serene. A webhook receives the payload, validates and cleans
   it, normalises the phone number, and creates a permanent record. If they have enquired before, the system recognises them; one phone number never becomes two records.
3. They are assigned automatically. The router works like a fair taxi rank: whoever has waited
   longest gets the next lead, scoped to the right business line. Nobody cherry-picks, nobody is overloaded, and people on leave are skipped with one switch.
4. The assigned agent gets a WhatsApp message and a push notification. Leadership gets a quiet
   copy. Every notification category can be muted per user, except the transactional ones.
5. The agent calls, then logs the call. Voice dictation is available, so a call note can be
   spoken instead of typed, including in Hinglish. Audio is transcribed in the moment and never stored.
6. Serene watches the clock. If a new lead is not contacted inside the response window, the
   agent is nudged; if it slips further, the manager is alerted. These timers run as durable background jobs, not as an in-process interval, so they survive deploys and restarts.
7. Leads that stall get followed up automatically. A daily sweep finds silent leads, has an AI
   gate judge each one against its note history, books a follow-up task for the ones still worth chasing, and sends the borderline ones to a human review queue. It only ever adds a nudge; it never edits the lead.
8. When the prospect says yes, the deal is recorded and moves into the ledger.
9. Everyone sees exactly what their role allows, live.

---

## 4. Tech stack

Deliberately small. Every choice is fixed and documented; alternatives are not re-litigated per feature.

| Layer                             | Choice                                                    |
| --------------------------------- | --------------------------------------------------------- |
| Framework                         | Next.js 16, App Router, React 19, React Server Components |
| Language                          | TypeScript 5, strict, no `any`                            |
| Styling                           | Tailwind CSS v4 plus a CSS-variable token system          |
| UI                                | shadcn/ui primitives plus a bespoke component library     |
| Database, auth, realtime, storage | Supabase (PostgreSQL 17)                                  |
| Caching                           | Upstash Redis, cache-aside                                |
| Background jobs                   | Trigger.dev v4                                            |
| WhatsApp                          | Gupshup (Business Solution Provider)                      |
| AI                                | Provider-neutral abstraction, Anthropic adapter live      |
| Speech to text                    | Deepgram Nova-2, Hinglish-tuned                           |
| Push                              | Web Push with VAPID, no SaaS layer                        |
| Animation                         | Framer Motion 12                                          |
| Charts                            | Recharts 3                                                |
| Forms and validation              | React Hook Form plus Zod 4                                |
| Icons                             | lucide-react, exclusively                                 |
| Drag and drop                     | dnd-kit, exclusively                                      |
| Hosting                           | Vercel                                                    |
| Package manager                   | pnpm                                                      |

Notably **not** in the stack: React Query, a state-management library, an ORM, a component kit beyond the above, or an error-monitoring SaaS. Data fetching is server-components-first, so most of what those libraries solve does not arise.

---

## 5. How it is built

### The layering rule

Every feature moves through the same four layers, in the same direction:

```
UI component  →  Server Action  →  Service  →  Database
(display only)   (validate,        (all queries    (row-level
                  authorise)        live here)      security)
```

- Components never fetch data and never touch the database. They render what they are given.
- Every server action starts with schema validation, then a single shared session-and-role guard. There is no hand-rolled auth check anywhere.
- Every database query lives in one service directory. No query is written inline in a page or an action.
- Actions return a `{ data, error }` shape rather than throwing, so every caller handles both branches explicitly.

### Authorization at three layers

Role and business-line access is enforced in the database itself through row-level security, in the routing layer, and in the navigation. The database is the real boundary; the UI layers are convenience. Authorization decisions read from the profile table, never from a token claim.

### The append-only rule

Calls, notes, status changes, task events, and AI actions are append-only. Entries can be added; history cannot be quietly edited away. This makes the audit trail structural rather than a policy people are asked to respect.

### Reuse before building

The largest single rule in the codebase is a prohibition on duplication. Before anything new is written, the existing implementation must be searched for by behaviour, not by filename. There is a registry of roughly 60 canonical modules (the one date formatter, the one phone normaliser, the one debounce hook, the one confirm dialog, the one filter bar shell, the one AI transport) and a repeat-offender table of things that have been duplicated before. Copying an existing module as the starting point for a "new" one counts as the same violation.

This is why 111,000 lines still behave like one system rather than 23 loosely related apps.

### The design system

The visual layer is a soft, tactile "neumorphic" material: one warm surface, layered soft shadows, generous radii, no hard borders. Every colour in the product is a CSS variable. There are zero hex values in components, enforced by a token-check script that runs before every build.

Eight themes ship. A theme changes only the accent family; surfaces, shadows, text, and status colours never re-tint. Accents were retuned into a single perceptual lightness band so that every one of the eight passes accessibility contrast on the base surface. Light and dark modes are both supported, and both the theme and the mode are rendered server-side from a cookie so there is no flash on load.

Motion is constrained on purpose: transform and opacity only, never width, height, or padding. Shared duration and easing constants live in one file. The whole app respects the operating system's reduced-motion setting.

### Async work

Anything that takes more than a few seconds, needs a retry, or has to fire later runs as a background job rather than in a request. Response-time timers, task reminders, the daily lead revival sweep, and adoption rollups all run this way. Outbound network sends that must complete are deliberately kept alive past the HTTP response using the framework's post-response hook, a detail that matters on serverless hosting and that silently loses messages if you get it wrong.

### Caching

Redis is a read cache only. PostgreSQL is the single source of truth. Cache invalidation for the hottest entity is centralised into one helper so that no feature can invent its own partially correct invalidation. Cache keys are scoped by business line so a cached response can never leak across boundaries.

### Documentation as infrastructure

The repository carries its own documentation set: one specification per route, one per module, one per external integration, an architecture set, a design constitution, an engineering rule book with a decision log, and a dated changelog that is the single source of truth for what shipped and when. Every meaningful change gets a changelog entry alongside the code.

On top of that, the codebase is indexed as a knowledge graph so that navigation questions ("what touches this concept?") are answered by a scoped query rather than by grepping.

---

## 6. The AI layer

Elaya is the AI presence inside Serene. The framing matters: she is not a chatbot bolted on the side, she is a participant in the operating system.

**Provider-neutral by design.** Exactly one file in the codebase is allowed to import an AI vendor SDK. Everything else talks to a neutral interface. Which model handles which job is a database configuration row read per turn, so swapping or adding a provider is a config change, not a deploy and not a rewrite.

**Role-gated tools.** She works through a registry of tools rather than free-form database access. Around 12 read tools and 12 write tools, each gated by the caller's role. Every tool wraps an existing service function; none of them writes a raw query, and none of them accepts an identity argument from the model. Who you are is resolved from your verified session, never from what the model says.

**A privacy gateway.** Every tool result passes through a masking layer before it reaches a model. Raw client personal details do not leave the system. Even internal notification logs keep only the last four digits of a phone number.

**Propose and confirm for consequential writes.** Small writes (a note, a call log, a task) execute inline. Bigger ones (a status change, a reassignment, recording a won deal, deleting a task) are only ever proposed. A human replies to approve, and a deterministic confirmation parser that understands both English and Hinglish decides whether that reply was a yes. It defaults to "no" on anything ambiguous, and it never asks the model to judge its own approval.

**A trust ledger.** Every action she takes, proposed or executed, is written to an audit table with before-and-after snapshots.

**Two channels, one brain.** The same brain serves the in-app streaming chat and the WhatsApp staff channel. There is one transport implementation, not two.

**Memory and voice.** She holds a per-user persona and durable learned memory, reads each user's private notes as context (never as permission), and accepts spoken input on four different surfaces through one shared dictation component.

The same AI layer is reused, deliberately, for non-chat jobs: the lead revival gate is a single structured model call through the same provider abstraction and the same privacy layer, with no new vendor dependency and no tools attached. It fails closed, meaning a bad response can never cause an automatic action in either direction.

---

## 7. Engineering discipline

A few practices explain the consistency more than any individual choice:

- **A written constitution.** Twelve non-negotiable rules plus a longer rule book, organised by category, each rule with an ID that gets cited in code review and in the code comments themselves.
- **A never-do list.** Explicit, specific, and enforced. No hardcoded colours. No animating layout properties. No hand-rolled confirm dialogs. No fetching inside a display component.
- **Machine enforcement where possible.** A lint configuration deliberately kept small, holding only rules that prevent real bugs, plus a pre-build token check.
- **A decision log.** Reversals are recorded with their reasoning, so the same debate does not get re-run in six months.
- **Documentation-first for the seams.** Every module ships with a written contract before the code settles.
- **Regular audits.** Dated design and security audit cycles, with the resulting rules folded back into the codebase's own instruction files so they cannot regress.

---

## 8. Vision

The arc has always been the same, and each stage is a foundation for the next:

**Run the operation → add the intelligence layer → own the relationship → extend outward.**

**Stage one, run the operation. Done.** The full sales motion lives in owned software, from ad click to closed deal, with fair distribution, enforced response times, and role-correct reporting at every altitude.

**Stage two, add the intelligence layer. Live and deepening.** The AI is no longer a demo surface. It answers, it acts under supervision, it remembers, it speaks the team's actual mixed-language register, and it works over WhatsApp as well as in the app. What is next here:

- Semantic retrieval, so she can reason over the whole body of notes, cases, and history rather than what a query happens to return.
- Broader autonomy under the same propose-and-confirm safety model, expanding what she can handle end to end without a human keystroke.
- Outward-facing conversation: a capped assistant that greets and qualifies new enquiries before a person picks them up. Built, gated behind final messaging approval.

**Stage three, own the relationship. In progress now.** Today the story ends at "deal won". Client records extend it: a won deal opens a permanent client record, and the relationship history continues past the sale rather than falling off the edge of the CRM.

**Stage four, the concierge floor.** Sia is the module that runs post-sale client work the same way the sales floor runs today: its own surface, its own workflows, sitting on client records, built on the same base OS without modifying it.

**Beyond that,** the direction is a system that does more of the routine work itself and asks a human only where judgment is genuinely required. The pieces already point there: response timers that escalate on their own, a revival sweep that decides what deserves a second attempt, a service knowledge base that surfaces the right answer before anyone searches for it, and an assistant that proposes the next step rather than waiting to be asked. The goal is not to replace the people who use it, but to remove everything from their day that is not the conversation itself.

The honest summary: a company's core operation runs on software it owns outright, built to luxury-product standards, with privacy and record-keeping discipline that most internal tools never have, and an AI layer on top that both answers and acts.

---

_This document is a public-facing overview. It intentionally omits credentials, infrastructure identifiers, schema detail, security implementation specifics, commercial figures, and client information._
