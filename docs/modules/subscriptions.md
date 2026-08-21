# Subscriptions & Bills Tracker

> **Purpose:** a first-class place for Finance + Tech to track recurring bills, memberships, and
> prepaid (top-up) accounts — renewals, what actually left the account in INR, and where invoices live.
> **Audience:** engineers. · **Source-of-truth scope:** subscriptions architecture + contracts.
> **Status:** Phase 1 (core tracker — **no reminders, no WhatsApp, nothing background**). Built 2026-08-06.

## What it is

A new `/subscriptions` section, three tables, and one private storage bucket. It reuses the existing
platform primitives wholesale (Modal, FilterBar, Calendar, chart wrappers, EmptyState, `useUrlFilters`,
`usePortalAnchor`, `ConfirmDialog`) — **not** a new UI stack. A subscription can belong to more than one
department, carries a billing type (`monthly` / `yearly` / `top_up` / `other`), a currency
(`INR` / `USD` / `EUR`), and an optional stored login/password for the account.

## Access & RLS

- **Route:** `/subscriptions` is granted to the **`finance` + `tech`** domains in `DOMAIN_ROUTE_MAP`
  (`lib/constants/route-permissions.ts`). Admin/founder reach it by bypassing that map in
  `canAccessRoute`. Sidebar entry lives in `MAIN_NAV` and self-filters via `canAccessRoute`.
- **RLS (SELECT):** admin/founder OR a member of the finance/tech domain — the same predicate on all
  three tables (children mirror the parent via `EXISTS`). The `departments` array is metadata/filtering,
  **not** a security boundary — everyone with access sees every subscription.
- **Writes:** no user write RLS on any table (the deals posture). All writes go through the admin client
  in `lib/actions/subscriptions.ts`; the `requireProfile()` gate + `canManageSubscriptions()` (admin/
  founder OR finance/tech domain) + route access are the trust boundary.

## Data model (migrations 0154–0157)

| Object | Migration | Notes |
| --- | --- | --- |
| `subscriptions` | 0154 | Parent. `departments text[]` (`<@` CHECK mirrors `APP_DOMAINS`), `type`/`currency` CHECKs, `amount`, a due-date shape CHECK (monthly/other → `due_day` 1–31; yearly → `due_date`; top_up → neither), `login`/`password`, `notes`, `is_archived` (soft delete), `created_by`, timestamps + `update_updated_at` trigger. |
| `subscription-invoices` bucket | 0154 | **PRIVATE** storage bucket. Client uploads under `{uid}/` prefix (insert-own-prefix RLS); reads mint short-lived signed urls (admin client). Rows store the **path**, never a url. |
| `subscription_payments` | 0155 | Append-only payment history (`due_date`, `paid_at`, `rate` in original currency, `paid_amount_inr` manual, `invoice_path`, `notes`). SELECT-only RLS. |
| `subscription_topups` | 0156 | Append-only top-up history (`topped_up_at`, `amount`+`currency` per event, `paid_amount_inr` manual, `invoice_path`, `notes`). SELECT-only RLS. |
| password encryption | 0157 | See **Password encryption** below. |

The generated `database.ts` does not yet include these tables — the service/actions use `(… as any).from(...)`
casts + the hand-declared row types in `lib/types/subscription.ts` (the revival/elaya interim pattern
until `supabase gen types` is re-run).

## Status (computed, never stored)

`utils/subscription-status.ts` derives each subscription's list status from its due date + payment
history, anchored to the **IST** calendar (`utils/ist.ts` — never re-fork). `computeSubscriptionStatus`
returns one of: **Upcoming** (due date in the future, unpaid) · **Due Today** · **Overdue** (past due,
unpaid — shown red with the day count) · **Paid** (a payment exists for the current cycle). A `top_up`
subscription has **no** due status (renders "—"). Monthly/other cycle = the `due_day` applied to the
current IST month; yearly = the stored `due_date`. A cycle is "paid" when a payment's `due_date` matches
it (year-month for monthly, year for yearly).

## Currency rule (non-negotiable)

**Amounts are NEVER auto-converted.** The original-currency amount (`rate` / `amount`) and the
manually-entered `paid_amount_inr` are stored + shown separately. All spending analytics use the INR
figure only. `formatCurrency` / `formatCurrencyCompact` (`utils/numbers.ts`) were extended to accept
`EUR` alongside INR/USD.

## Password encryption (migration 0157)

The stored account `password` is **encrypted at rest** — pgcrypto `pgp_sym_encrypt` (→ base64) with a
256-bit key generated at migration-run time and held in **Supabase Vault** (`subscription_password_key`;
the supported replacement for deprecated pgsodium TCE). The key never appears in the migration file and
never leaves the DB.

- **Write:** a `BEFORE INSERT/UPDATE` trigger (`encrypt_subscriptions_password`) encrypts transparently;
  on UPDATE it re-encrypts **only** when the value changed (`IS DISTINCT FROM OLD`), so an unchanged row
  is never double-encrypted. The app writes plaintext on create/change and **omits** the column when
  unchanged.
- **Read:** the password is **never** selected into list/detail payloads (`password: null`); the detail
  returns a `hasPassword` boolean. The plaintext is produced **only** by `revealSubscriptionPasswordAction`
  (admin client → `decrypt_subscription_password` RPC, both `service_role` only) when the user clicks the
  eye in the history/detail modal.
- **Edit form:** the password field is **tri-state** — blank on edit = keep the stored value ("Leave
  blank to keep the current password"), blank on create = no password, a value = set/replace.

`login` stays plaintext (a username, low sensitivity).

## Views & features

`/subscriptions?view=list|calendar|overview` (default `list`); the list has `?tab=active|archived`.

- **List** (`SubscriptionsTable`) — dense table (md+) / cards (mobile): Name, Departments, Type, Amount,
  INR Paid (latest), Due, Status. Row menu (⋯): Record Payment / Log Top-up, View history, Edit,
  Archive/Unarchive. Filters (`SubscriptionFilters`): Department / Type / Status (URL-driven) + Active/
  Archived tab.
- **Add / Edit** (`AddEditSubscriptionModal`) — conditional fields by type; password reveal toggle.
- **Record Payment** (`RecordPaymentModal`) / **Log Top-up** (`LogTopupModal`) — rate + manual INR (two
  columns, never converted), dates, client-side invoice upload, notes.
- **History** (`SubscriptionHistoryModal`) — summary (with on-demand password reveal) + payment/top-up
  history ("Paid *N* days late" / "On time", invoice view).
- **Calendar** (`SubscriptionCalendar`) — month grid with a due-date dot per day + weekly summary; click
  a due item → history.
- **Overview** (`SpendingOverview`) — INR month/year totals, by-type + by-department donuts, 12-month
  trend bar (code-split Recharts).
- **Export** (`SubscriptionExportButton`) — monthly report as CSV / XLSX (columns: Name, Department, Type,
  Currency, Original Amount, INR Paid, Due Date, Paid Date). Data via a server action; file built
  client-side (`export.ts` `buildCSV` / `buildSingleSheetXLSX`).

## File map

```text
supabase/migrations/2026080600015{4,5,6,7}_*.sql   ← tables + bucket + RLS + password encryption
src/lib/constants/subscription-constants.ts        ← types/currencies/statuses/departments + resolveSubscriptionShape
src/lib/types/subscription.ts                      ← hand-declared row types (interim)
src/lib/utils/subscription-status.ts               ← computed status + cycle/lateness math (IST)
src/lib/validations/subscription-schema.ts         ← Zod (password tri-state)
src/lib/services/subscriptions-service.ts          ← reads: list, detail (+hasPassword), spending overview, monthly report
src/lib/actions/subscriptions.ts                   ← CRUD + payments/topups + archive + invoice signing + reveal password
src/components/subscriptions/*                      ← 14 UI files (table, filters, view tabs, modals, calendar, overview, export, invoice controls, bits)
src/app/(dashboard)/subscriptions/{page,loading}.tsx
```

Shared utils extended (reuse-first): `utils/numbers.ts` (`EUR`), `utils/export.ts` (`buildSingleSheetXLSX`).

## To run it

Phase 1 is code-complete and typechecks clean, but it is **not live until the migrations are applied**:

1. Apply migrations **0154–0157** to the Supabase project. **0157 needs the `pgcrypto` + `supabase_vault`
   extensions** (standard on Supabase; the migration enables them via `create extension if not exists`).
2. (Recommended) regenerate `database.ts` (`supabase gen types typescript --local`) to drop the interim
   `as any` table casts.

## Phase 2 (not built)

Reminders (renewal due-soon / overdue), a "bills due this week" dashboard widget, and — if these fields
will hold high-value secrets — per-user access auditing on password reveals.
