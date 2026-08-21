// subscription-status.ts — pure status/cycle math for the Subscriptions tracker.
//
// Status is COMPUTED (never stored): derived from a subscription's due date plus its
// payment history for the current cycle. Pure functions (no DB) — safe on client and
// server. Date columns arrive as plain 'YYYY-MM-DD' strings (Postgres `date`), so
// comparisons are timezone-independent; "today" is anchored to the IST calendar via
// ist.ts (the business runs on IST) — never re-fork IST math (H-7).
import type { SubscriptionRow, SubscriptionPaymentRow } from "@/lib/types/subscription";
import type { SubscriptionStatus, SubscriptionType } from "@/lib/constants/subscription-constants";
import { toIst } from "@/lib/utils/ist";

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** The IST calendar date of `now` as 'YYYY-MM-DD'. */
export function istTodayISO(now: Date): string {
  const { year, month, day } = toIst(now); // month 0-indexed
  return `${year}-${pad2(month + 1)}-${pad2(day)}`;
}

/** Calendar days between two 'YYYY-MM-DD' strings (a − b). Timezone-independent. */
export function diffDaysISO(aISO: string, bISO: string): number {
  const [ay, am, ad] = aISO.split("-").map(Number);
  const [by, bm, bd] = bISO.split("-").map(Number);
  return Math.round((Date.UTC(ay, am - 1, ad) - Date.UTC(by, bm - 1, bd)) / 86_400_000);
}

/** Clamp a day-of-month to the last valid day of the given year/month (0-indexed). */
function clampDay(year: number, month0: number, day: number): number {
  const lastDay = new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate();
  return Math.min(day, lastDay);
}

/**
 * The current cycle's due date as 'YYYY-MM-DD' (IST), or null for top_up.
 *   monthly / other → the due_day applied to the current IST month (clamped to month length)
 *   yearly          → the occurrence in the current IST year (same month/day as due_date,
 *                     clamped), never earlier than the stored first cycle — so a yearly
 *                     bill rolls over each year instead of matching its first payment forever
 */
export function currentDueDateISO(
  sub: Pick<SubscriptionRow, "type" | "due_day" | "due_date">,
  now: Date,
): string | null {
  if (sub.type === "top_up") return null;
  if (sub.type === "yearly") {
    if (!sub.due_date) return null;
    const { year } = toIst(now);
    const [, dueMonth, dueDay] = sub.due_date.split("-").map(Number);
    const day = clampDay(year, dueMonth - 1, dueDay);
    const thisYears = `${year}-${pad2(dueMonth)}-${pad2(day)}`;
    // A bill created for a future first cycle must not project an earlier year.
    return thisYears >= sub.due_date ? thisYears : sub.due_date;
  }
  if (sub.due_day == null) return null;
  const { year, month } = toIst(now); // month 0-indexed
  const day = clampDay(year, month, sub.due_day);
  return `${year}-${pad2(month + 1)}-${pad2(day)}`;
}

/**
 * The subscription's due date within a specific calendar month (0-indexed), as
 * 'YYYY-MM-DD', or null if it does not fall due in that month. This is the general
 * recurrence projection used by the Calendar view:
 *   monthly / other → due_day applied to (year, month0), clamped to the month length
 *                     (recurs EVERY month on that day)
 *   yearly          → only in due_date's own month, on due_date's day of `year`
 *                     (recurs once a YEAR, same month/day)
 *   top_up          → never (no due cycle)
 */
export function occurrenceInMonthISO(
  sub: Pick<SubscriptionRow, "type" | "due_day" | "due_date">,
  year: number,
  month0: number,
): string | null {
  if (sub.type === "top_up") return null;
  if (sub.type === "yearly") {
    if (!sub.due_date) return null;
    const [, dueMonth, dueDay] = sub.due_date.split("-").map(Number);
    if (dueMonth - 1 !== month0) return null; // only in its own month
    const day = clampDay(year, month0, dueDay);
    return `${year}-${pad2(month0 + 1)}-${pad2(day)}`;
  }
  // monthly / other — recurs every month on due_day
  if (sub.due_day == null) return null;
  const day = clampDay(year, month0, sub.due_day);
  return `${year}-${pad2(month0 + 1)}-${pad2(day)}`;
}

/**
 * Whether a payment settles the given cycle. monthly/other match by IST year-month;
 * yearly matches by year (a once-a-year bill). The Record Payment modal defaults its
 * due_date to the current cycle, so these matches are reliable.
 */
function isCyclePaid(
  payments: Pick<SubscriptionPaymentRow, "due_date">[],
  cycleISO: string,
  type: SubscriptionType,
): boolean {
  if (type === "yearly") {
    const year = cycleISO.slice(0, 4);
    return payments.some((p) => p.due_date.slice(0, 4) === year);
  }
  const yearMonth = cycleISO.slice(0, 7);
  return payments.some((p) => p.due_date.slice(0, 7) === yearMonth);
}

export type ComputedSubscriptionStatus = {
  status: SubscriptionStatus | null; // null for top_up (no due cycle)
  daysOverdue: number;               // 0 unless status === 'overdue'
  currentDueDate: string | null;     // 'YYYY-MM-DD' or null (top_up)
};

/** Compute a subscription's list status from its due date + payment history. */
export function computeSubscriptionStatus(
  sub: Pick<SubscriptionRow, "type" | "due_day" | "due_date">,
  payments: Pick<SubscriptionPaymentRow, "due_date">[],
  now: Date,
): ComputedSubscriptionStatus {
  const currentDueDate = currentDueDateISO(sub, now);
  if (sub.type === "top_up" || currentDueDate == null) {
    return { status: null, daysOverdue: 0, currentDueDate: null };
  }
  if (isCyclePaid(payments, currentDueDate, sub.type)) {
    return { status: "paid", daysOverdue: 0, currentDueDate };
  }
  const delta = diffDaysISO(currentDueDate, istTodayISO(now)); // due − today
  if (delta > 0) return { status: "upcoming", daysOverdue: 0, currentDueDate };
  if (delta === 0) return { status: "due_today", daysOverdue: 0, currentDueDate };
  return { status: "overdue", daysOverdue: -delta, currentDueDate };
}

/**
 * The status of a subscription's occurrence in ANY month, given the set of already-
 * settled cycle keys ('YYYY-MM' for monthly/other, 'YYYY' for yearly). Same rules as
 * computeSubscriptionStatus, generalised off the current cycle so the Calendar view
 * can show a truthful pill on every month:
 *   settled cycle → paid; else future → upcoming, today → due_today, past → overdue.
 */
export function statusForOccurrenceISO(
  type: SubscriptionType,
  paidCycleKeys: string[],
  occISO: string,
  todayISO: string,
): { status: SubscriptionStatus; daysOverdue: number } {
  const key = type === "yearly" ? occISO.slice(0, 4) : occISO.slice(0, 7);
  if (paidCycleKeys.includes(key)) return { status: "paid", daysOverdue: 0 };
  const delta = diffDaysISO(occISO, todayISO); // occurrence − today
  if (delta > 0) return { status: "upcoming", daysOverdue: 0 };
  if (delta === 0) return { status: "due_today", daysOverdue: 0 };
  return { status: "overdue", daysOverdue: -delta };
}

/** paid_at − due_date in calendar days (positive = paid late, ≤ 0 = on time / early). */
export function paymentLateness(
  payment: Pick<SubscriptionPaymentRow, "due_date" | "paid_at">,
): number {
  return diffDaysISO(payment.paid_at, payment.due_date);
}
