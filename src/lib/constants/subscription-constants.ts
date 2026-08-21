import { defineEnum } from "./define-enum";
import { APP_DOMAINS, DOMAIN_LABELS } from "./domains";

// ─────────────────────────────────────────────
// Subscriptions & Bills Tracker — vocabulary (Phase 1).
// The SQL CHECK constraints in migrations 0163–0165 mirror these id lists —
// extending a set = a new migration that DROPs + re-ADDs the named constraint.
// ─────────────────────────────────────────────

// Billing type. top_up subscriptions use the Log Top-up flow (subscription_topups)
// instead of Record Payment; monthly/other carry a day-of-month, yearly a full date.
const SUBSCRIPTION_TYPE_DEF = defineEnum([
  { id: "monthly", label: "Monthly" },
  { id: "yearly",  label: "Yearly"  },
  { id: "top_up",  label: "Top-up"  },
  { id: "other",   label: "Other"   },
]);
export const SUBSCRIPTION_TYPES = SUBSCRIPTION_TYPE_DEF.values;
export type SubscriptionType = (typeof SUBSCRIPTION_TYPES)[number];
export const SUBSCRIPTION_TYPE_LABELS  = SUBSCRIPTION_TYPE_DEF.labels;
export const SUBSCRIPTION_TYPE_OPTIONS = SUBSCRIPTION_TYPE_DEF.options;
export const SUBSCRIPTION_TYPE_ENUM    = SUBSCRIPTION_TYPE_DEF.zodEnum;

/** Types that use the Record Payment flow (everything except top_up). */
export const PAYMENT_TYPES: readonly SubscriptionType[] = ["monthly", "yearly", "other"];
export function isTopUpType(type: SubscriptionType): boolean {
  return type === "top_up";
}

// Currency — ids match formatCurrency()'s accepted codes exactly (INR/USD/EUR).
const SUBSCRIPTION_CURRENCY_DEF = defineEnum([
  { id: "INR", label: "INR (₹)" },
  { id: "USD", label: "USD ($)" },
  { id: "EUR", label: "EUR (€)" },
]);
export const SUBSCRIPTION_CURRENCIES = SUBSCRIPTION_CURRENCY_DEF.values;
export type SubscriptionCurrency = (typeof SUBSCRIPTION_CURRENCIES)[number];
export const SUBSCRIPTION_CURRENCY_LABELS  = SUBSCRIPTION_CURRENCY_DEF.labels;
export const SUBSCRIPTION_CURRENCY_OPTIONS = SUBSCRIPTION_CURRENCY_DEF.options;
export const SUBSCRIPTION_CURRENCY_ENUM    = SUBSCRIPTION_CURRENCY_DEF.zodEnum;

export const CURRENCY_SYMBOLS: Record<SubscriptionCurrency, string> = {
  INR: "₹",
  USD: "$",
  EUR: "€",
};

// ─────────────────────────────────────────────
// Status — COMPUTED, never stored. Derived from the subscription's due date +
// its payment history for the current cycle (see utils/subscription-status.ts).
// A top_up subscription has no due status (null → render "—").
// Hand-written config table (badge tokens are its structure — stays hand-written).
// ─────────────────────────────────────────────
export const SUBSCRIPTION_STATUSES = ["upcoming", "due_today", "overdue", "paid"] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

export const SUBSCRIPTION_STATUS_CONFIG: Record<
  SubscriptionStatus,
  { label: string; pillBg: string; pillText: string; dot: string; order: number }
> = {
  overdue:   { label: "Overdue",   pillBg: "var(--color-danger-light)",  pillText: "var(--color-danger-text)",  dot: "var(--color-danger)",  order: 1 },
  due_today: { label: "Due Today", pillBg: "var(--color-warning-light)", pillText: "var(--color-warning-text)", dot: "var(--color-warning)", order: 2 },
  upcoming:  { label: "Upcoming",  pillBg: "var(--color-info-light)",    pillText: "var(--color-info-text)",    dot: "var(--color-info)",    order: 3 },
  paid:      { label: "Paid",      pillBg: "var(--color-success-light)", pillText: "var(--color-success-text)", dot: "var(--color-success)", order: 4 },
};

/** Status filter items for the FilterBar dropdown. */
export const SUBSCRIPTION_STATUS_OPTIONS = SUBSCRIPTION_STATUSES.map((id) => ({
  id,
  label: SUBSCRIPTION_STATUS_CONFIG[id].label,
}));

// ─────────────────────────────────────────────
// Departments — reuse the app_domain vocabulary (a subscription can belong to
// more than one). NOT a new enum (R-01) — the multi-select and the DB CHECK both
// read APP_DOMAINS. Validity is enforced by APP_DOMAIN_ENUM in the Zod schema.
// ─────────────────────────────────────────────
export const SUBSCRIPTION_DEPARTMENT_OPTIONS = APP_DOMAINS.map((d) => ({
  id: d,
  label: DOMAIN_LABELS[d],
}));

// ─────────────────────────────────────────────
// Invoice upload — client-side file gate (PDF/PNG/JPG only, ≤ 8 MB).
// The private 'subscription-invoices' bucket enforces no MIME/size limit itself
// (Serene convention) — this is the application-layer allowlist.
// ─────────────────────────────────────────────
export const SUBSCRIPTION_INVOICE_BUCKET = "subscription-invoices";
export const INVOICE_MAX_BYTES = 8 * 1024 * 1024; // 8 MB
export const INVOICE_ACCEPT_MIME: readonly string[] = [
  "application/pdf",
  "image/png",
  "image/jpeg",
];
export const INVOICE_ACCEPT_ATTR = ".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg";

// ─────────────────────────────────────────────
// resolveSubscriptionShape — THE type → {amount, due_day, due_date} normaliser.
//
// The due-date/amount shape is DERIVED from the billing type, mirroring the
// migration-0163 CHECK constraints (the resolveDealShapeForDomain pattern):
//   monthly/other → amount + due_day (1–31), due_date null
//   yearly        → amount + due_date, due_day null
//   top_up        → amount/due_day/due_date all null
// Returns the exact triplet to write, or a clean error string instead of a raw
// constraint violation. Lives here (not the action) so create + update both call
// the ONE resolver. Messages are inlined (constants must not import validations).
// ─────────────────────────────────────────────
export type SubscriptionShapeInput = {
  type: SubscriptionType;
  amount?: number | null;
  due_day?: number | null;
  due_date?: string | null;
};
export type SubscriptionShape = {
  amount: number | null;
  due_day: number | null;
  due_date: string | null;
};

export function resolveSubscriptionShape(
  input: SubscriptionShapeInput,
): { ok: true; shape: SubscriptionShape } | { ok: false; error: string } {
  const { type } = input;

  if (type === "top_up") {
    return { ok: true, shape: { amount: null, due_day: null, due_date: null } };
  }

  const amount = input.amount ?? null;
  if (amount == null || amount < 0) {
    return { ok: false, error: "Please enter a valid amount." };
  }

  if (type === "monthly" || type === "other") {
    const day = input.due_day ?? null;
    if (day == null || day < 1 || day > 31) {
      return { ok: false, error: "Please enter a day of the month between 1 and 31." };
    }
    return { ok: true, shape: { amount, due_day: day, due_date: null } };
  }

  // yearly
  const date = input.due_date ?? null;
  if (!date) {
    return { ok: false, error: "Please select a due date." };
  }
  return { ok: true, shape: { amount, due_day: null, due_date: date } };
}
