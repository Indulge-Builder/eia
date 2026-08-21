// Subscriptions & Bills Tracker row types — hand-declared until `supabase gen
// types typescript --local` is re-run after migrations 0154–0156 are applied.
// Shapes mirror the migrations EXACTLY. Types only — no runtime values.
// The vocabulary (SubscriptionType/SubscriptionCurrency/SubscriptionStatus, labels,
// badge config) lives in constants/subscription-constants.ts.
import type {
  SubscriptionType,
  SubscriptionCurrency,
  SubscriptionStatus,
} from "@/lib/constants/subscription-constants";
import type { AppDomain } from "@/lib/types/database";

/** public.subscriptions row (migration 0154). */
export type SubscriptionRow = {
  id: string;
  name: string;
  departments: AppDomain[];
  type: SubscriptionType;
  currency: SubscriptionCurrency;
  amount: number | null;
  due_day: number | null;   // day-of-month for monthly/other (1–31)
  due_date: string | null;  // 'YYYY-MM-DD' for yearly
  login: string | null;
  password: string | null;
  notes: string | null;
  is_archived: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

/** public.subscription_payments row (migration 0155). Append-only. */
export type SubscriptionPaymentRow = {
  id: string;
  subscription_id: string;
  due_date: string;         // 'YYYY-MM-DD' — the cycle this payment settles
  paid_at: string;          // 'YYYY-MM-DD' — when it was actually paid
  rate: number;             // original-currency amount
  paid_amount_inr: number;  // manually-entered INR
  invoice_path: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
};

/** public.subscription_topups row (migration 0156). Append-only. */
export type SubscriptionTopupRow = {
  id: string;
  subscription_id: string;
  topped_up_at: string;     // 'YYYY-MM-DD'
  amount: number;           // in `currency`
  currency: SubscriptionCurrency;
  paid_amount_inr: number;  // manually-entered INR
  invoice_path: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
};

/** A subscription enriched with its computed status + latest-payment summary for
 *  the list view. `status` is null for top_up subscriptions (no due cycle). */
export type SubscriptionListItem = SubscriptionRow & {
  status: SubscriptionStatus | null;
  daysOverdue: number;              // 0 unless status === 'overdue'
  currentDueDate: string | null;    // 'YYYY-MM-DD' current cycle due date (null for top_up)
  latestPaidInr: number | null;     // INR of the most recent payment/top-up (list column)
  latestPaidAt: string | null;      // 'YYYY-MM-DD' of that latest entry
  paidCycleKeys: string[];          // settled cycles — 'YYYY-MM' (monthly/other) or 'YYYY' (yearly);
                                     // [] for top_up. Lets the Calendar compute a real Paid/Overdue
                                     // status for ANY month, not just the current cycle.
};

/** A payment row + its computed lateness (for Payment History). */
export type SubscriptionPaymentWithLateness = SubscriptionPaymentRow & {
  daysLate: number;   // paid_at − due_date in days; 0 or negative means on time / early
};
