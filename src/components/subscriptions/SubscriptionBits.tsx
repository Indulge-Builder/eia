// Small display-only bits for the Subscriptions tracker (A-06). Server-safe
// (no hooks) — usable in both server and client components.
import type { CSSProperties } from "react";
import type { AppDomain } from "@/lib/types/database";
import { DOMAIN_LABELS } from "@/lib/constants/domains";
import {
  SUBSCRIPTION_STATUS_CONFIG,
  SUBSCRIPTION_TYPE_LABELS,
  CURRENCY_SYMBOLS,
  type SubscriptionStatus,
  type SubscriptionType,
  type SubscriptionCurrency,
} from "@/lib/constants/subscription-constants";
import { formatCurrency } from "@/lib/utils/numbers";

const PILL_BASE: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "var(--space-1)",
  padding: "2px var(--space-2)",
  borderRadius: "var(--radius-full)",
  fontSize: "var(--text-xs)",
  fontWeight: "var(--weight-medium)",
  whiteSpace: "nowrap",
  lineHeight: 1.4,
};

/** Computed status pill. null (top-up) → em dash; overdue shows the day count. */
export function SubscriptionStatusPill({
  status,
  daysOverdue = 0,
}: {
  status: SubscriptionStatus | null;
  daysOverdue?: number;
}) {
  if (!status) {
    return <span style={{ color: "var(--theme-text-tertiary)" }}>—</span>;
  }
  const cfg = SUBSCRIPTION_STATUS_CONFIG[status];
  const label =
    status === "overdue" && daysOverdue > 0 ? `${cfg.label} · ${daysOverdue}d` : cfg.label;
  return (
    <span style={{ ...PILL_BASE, background: cfg.pillBg, color: cfg.pillText }}>
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: "var(--radius-full)",
          background: cfg.dot,
          flexShrink: 0,
        }}
      />
      {label}
    </span>
  );
}

const DEPT_PILL: CSSProperties = {
  ...PILL_BASE,
  background: "var(--theme-paper-subtle)",
  color: "var(--theme-text-secondary)",
  border: "1px solid var(--theme-paper-border)",
};

/** Department chips (capped, with a +N overflow pill). */
export function DepartmentPills({
  departments,
  max = 3,
}: {
  departments: AppDomain[];
  max?: number;
}) {
  const shown = departments.slice(0, max);
  const extra = departments.length - shown.length;
  return (
    <span style={{ display: "inline-flex", flexWrap: "wrap", gap: "var(--space-1)" }}>
      {shown.map((d) => (
        <span key={d} style={DEPT_PILL}>
          {DOMAIN_LABELS[d]}
        </span>
      ))}
      {extra > 0 && <span style={DEPT_PILL}>+{extra}</span>}
    </span>
  );
}

/** A type chip (Monthly / Yearly / Top-up / Other). */
export function TypePill({ type }: { type: SubscriptionType }) {
  return <span style={DEPT_PILL}>{SUBSCRIPTION_TYPE_LABELS[type]}</span>;
}

/** Original-currency amount with symbol, e.g. "$49.00". Uses the shared formatter. */
export function CurrencyAmount({
  amount,
  currency,
}: {
  amount: number | null;
  currency: SubscriptionCurrency;
}) {
  if (amount == null) return <span style={{ color: "var(--theme-text-tertiary)" }}>—</span>;
  return <>{formatCurrency(amount, currency)}</>;
}

export { CURRENCY_SYMBOLS };
