import { z } from "zod";
import { sanitizeText } from "@/lib/utils/sanitize";
import { formErrors } from "./form-errors";
import { APP_DOMAIN_ENUM } from "@/lib/constants/domains";
import {
  SUBSCRIPTION_TYPE_ENUM,
  SUBSCRIPTION_CURRENCY_ENUM,
} from "@/lib/constants/subscription-constants";

// ─────────────────────────────────────────────
// Subscriptions & Bills Tracker — Zod schemas.
// The cross-field due/amount shape is enforced in the action via
// resolveSubscriptionShape (constants/subscription-constants.ts) — these schemas
// bound the field TYPES; the resolver enforces "monthly needs due_day" etc. with
// clean copy (the resolveDealShapeForDomain split). Human messages only (Q-04).
// ─────────────────────────────────────────────

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const nameField = z
  .string()
  .min(1, formErrors.subscriptionNameRequired)
  .max(200, "Name must be 200 characters or fewer.")
  .transform((v) => sanitizeText(v));

const departmentsField = z
  .array(z.enum(APP_DOMAIN_ENUM))
  .min(1, formErrors.subscriptionDepartmentRequired)
  .max(APP_DOMAIN_ENUM.length);

const amountField = z
  .number({ message: formErrors.subscriptionAmountInvalid })
  .nonnegative(formErrors.subscriptionAmountInvalid)
  .max(100_000_000, "Amount seems too large.");

const rateField = z
  .number({ message: formErrors.subscriptionRateInvalid })
  .nonnegative(formErrors.subscriptionRateInvalid)
  .max(100_000_000, "Amount seems too large.");

const inrField = z
  .number({ message: formErrors.subscriptionPaidAmountInvalid })
  .nonnegative(formErrors.subscriptionPaidAmountInvalid)
  .max(100_000_000, "Amount seems too large.");

const dateField = (msg: string) => z.string().regex(ISO_DATE, msg);

// Credentials round-trip EXACTLY — never sanitized (sanitizeText would corrupt a
// password's <, >, & or spacing). Length-bounded only.
const credentialField = z
  .string()
  .max(300, "Must be 300 characters or fewer.")
  .nullable()
  .optional()
  .transform((v) => (v && v.length ? v : null));

// Password is TRI-STATE (encrypted at rest, migration 0157). No transform — the
// three states are preserved through to the action: `undefined` = leave the stored
// password unchanged (edit), `null` = clear it, a string = set/replace it (the
// trigger encrypts on write). The modal maps a blank edit field → undefined.
const passwordField = z.string().max(300, "Must be 300 characters or fewer.").nullable().optional();

const notesField = z
  .string()
  .max(2000, "Notes must be 2,000 characters or fewer.")
  .nullable()
  .optional()
  .transform((v) => (v && v.trim() ? sanitizeText(v) : null));

const invoicePathField = z
  .string()
  .max(500)
  .nullable()
  .optional()
  .transform((v) => (v && v.length ? v : null));

// ── Subscription create / edit / archive ──────────────────────────────────────
export const CreateSubscriptionSchema = z.object({
  name: nameField,
  departments: departmentsField,
  type: z.enum(SUBSCRIPTION_TYPE_ENUM, { message: formErrors.subscriptionTypeInvalid }),
  currency: z.enum(SUBSCRIPTION_CURRENCY_ENUM, { message: formErrors.subscriptionCurrencyInvalid }),
  amount: amountField.nullable().optional(),
  due_day: z
    .number()
    .int()
    .min(1, formErrors.subscriptionDueDayInvalid)
    .max(31, formErrors.subscriptionDueDayInvalid)
    .nullable()
    .optional(),
  due_date: dateField(formErrors.subscriptionDueDateInvalid).nullable().optional(),
  login: credentialField,
  password: passwordField,
  notes: notesField,
});
export type CreateSubscriptionInput = z.infer<typeof CreateSubscriptionSchema>;

export const UpdateSubscriptionSchema = CreateSubscriptionSchema.extend({
  id: z.string().uuid(formErrors.subscriptionNotFound),
});
export type UpdateSubscriptionInput = z.infer<typeof UpdateSubscriptionSchema>;

export const ArchiveSubscriptionSchema = z.object({
  id: z.string().uuid(formErrors.subscriptionNotFound),
  isArchived: z.boolean(),
});
export type ArchiveSubscriptionInput = z.infer<typeof ArchiveSubscriptionSchema>;

// ── Record Payment (monthly/yearly/other) ─────────────────────────────────────
export const AddPaymentSchema = z.object({
  subscriptionId: z.string().uuid(formErrors.subscriptionNotFound),
  due_date: dateField(formErrors.subscriptionDueDateInvalid),
  paid_at: dateField("Please select the date it was paid."),
  rate: rateField,
  paid_amount_inr: inrField,
  invoice_path: invoicePathField,
  notes: notesField,
});
export type AddPaymentInput = z.infer<typeof AddPaymentSchema>;

// ── Log Top-up (top_up type) ──────────────────────────────────────────────────
export const AddTopupSchema = z.object({
  subscriptionId: z.string().uuid(formErrors.subscriptionNotFound),
  topped_up_at: dateField("Please select the top-up date."),
  amount: amountField,
  currency: z.enum(SUBSCRIPTION_CURRENCY_ENUM, { message: formErrors.subscriptionCurrencyInvalid }),
  paid_amount_inr: inrField,
  invoice_path: invoicePathField,
  notes: notesField,
});
export type AddTopupInput = z.infer<typeof AddTopupSchema>;

// ── Invoice signing (read path) ───────────────────────────────────────────────
export const SignInvoiceSchema = z.object({
  path: z.string().min(1).max(500),
});
