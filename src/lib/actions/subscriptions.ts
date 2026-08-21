"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireProfile } from "@/lib/actions/_auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { formErrors } from "@/lib/validations/form-errors";
import type { ActionResult } from "@/lib/types";
import {
  CreateSubscriptionSchema,
  UpdateSubscriptionSchema,
  ArchiveSubscriptionSchema,
  AddPaymentSchema,
  AddTopupSchema,
  SignInvoiceSchema,
} from "@/lib/validations/subscription-schema";
import {
  resolveSubscriptionShape,
  SUBSCRIPTION_INVOICE_BUCKET,
} from "@/lib/constants/subscription-constants";
import {
  getSubscriptions,
  getSubscriptionDetail,
  getSubscriptionMonthlyReport,
  type MonthlyReportRow,
} from "@/lib/services/subscriptions-service";
import type {
  SubscriptionRow,
  SubscriptionListItem,
  SubscriptionPaymentRow,
  SubscriptionTopupRow,
} from "@/lib/types/subscription";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any;

const INVOICE_SIGNED_URL_TTL = 60 * 60; // 1 hour

/**
 * The subscriptions access gate — mirrors the RLS SELECT policy + route access.
 * Admin/founder (global) or a member of the Finance/Tech departments may manage
 * subscriptions. The route guard is the first boundary; this is the action-layer one.
 */
function canManageSubscriptions(profile: { role: string; domain: string }): boolean {
  return (
    profile.role === "admin" ||
    profile.role === "founder" ||
    profile.domain === "finance" ||
    profile.domain === "tech"
  );
}

/**
 * Insert-if-missing on subscription_tools keyed by name_key = lower(trim(name))
 * (migration 0168), then return the tool's id. Two admin-client queries: an
 * ignore-duplicates upsert (race-safe under the unique name_key constraint)
 * followed by the id read. Null name → null (standalone bill, no tool).
 */
async function resolveToolId(
  admin: AnyClient,
  toolName: string | null | undefined,
  callerId: string,
): Promise<{ ok: true; toolId: string | null } | { ok: false }> {
  if (!toolName) return { ok: true, toolId: null };
  const key = toolName.trim().toLowerCase();
  const { error: upsertErr } = await admin
    .from("subscription_tools")
    .upsert({ name: toolName.trim(), created_by: callerId }, { onConflict: "name_key", ignoreDuplicates: true });
  if (upsertErr) {
    console.error("[subscriptions] tool upsert error:", upsertErr);
    return { ok: false };
  }
  const { data, error } = await admin
    .from("subscription_tools")
    .select("id")
    .eq("name_key", key)
    .maybeSingle();
  if (error || !data) {
    console.error("[subscriptions] tool lookup error:", error);
    return { ok: false };
  }
  return { ok: true, toolId: (data as { id: string }).id };
}

// ── Create ────────────────────────────────────────────────────────────────────
export async function createSubscriptionAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const parsed = CreateSubscriptionSchema.safeParse(input);
  if (!parsed.success) {
    return { data: null, error: parsed.error.issues[0]?.message ?? formErrors.generic };
  }
  const fields = parsed.data;

  const auth = await requireProfile();
  if (!auth.ok) return auth.result;
  const caller = auth.profile;
  if (!canManageSubscriptions(caller)) return { data: null, error: formErrors.unauthorized };

  const shape = resolveSubscriptionShape({
    type: fields.type,
    amount: fields.amount,
    due_day: fields.due_day,
    due_date: fields.due_date,
  });
  if (!shape.ok) return { data: null, error: shape.error };

  const admin = createAdminClient() as AnyClient;
  const tool = await resolveToolId(admin, fields.tool_name, caller.id);
  if (!tool.ok) return { data: null, error: formErrors.subscriptionSaveFailed };

  const { data, error } = await admin
    .from("subscriptions")
    .insert({
      name: fields.name,
      tool_id: tool.toolId,
      departments: fields.departments,
      type: fields.type,
      currency: fields.currency,
      amount: shape.shape.amount,
      due_day: shape.shape.due_day,
      due_date: shape.shape.due_date,
      login: fields.login,
      // Plaintext on write — the encrypt_subscriptions_password trigger (0166)
      // encrypts it at rest. undefined/null → no stored password.
      password: fields.password ?? null,
      notes: fields.notes,
      created_by: caller.id,
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("[subscriptions] create error:", error);
    return { data: null, error: formErrors.subscriptionSaveFailed };
  }
  revalidatePath("/subscriptions");
  return { data: { id: (data as { id: string }).id }, error: null };
}

// ── Update (edit) ──────────────────────────────────────────────────────────────
export async function updateSubscriptionAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const parsed = UpdateSubscriptionSchema.safeParse(input);
  if (!parsed.success) {
    return { data: null, error: parsed.error.issues[0]?.message ?? formErrors.generic };
  }
  const fields = parsed.data;

  const auth = await requireProfile();
  if (!auth.ok) return auth.result;
  if (!canManageSubscriptions(auth.profile)) return { data: null, error: formErrors.unauthorized };

  const shape = resolveSubscriptionShape({
    type: fields.type,
    amount: fields.amount,
    due_day: fields.due_day,
    due_date: fields.due_date,
  });
  if (!shape.ok) return { data: null, error: shape.error };

  const admin = createAdminClient() as AnyClient;
  const tool = await resolveToolId(admin, fields.tool_name, auth.profile.id);
  if (!tool.ok) return { data: null, error: formErrors.subscriptionSaveFailed };

  const updatePayload: Record<string, unknown> = {
    name: fields.name,
    tool_id: tool.toolId,
    departments: fields.departments,
    type: fields.type,
    currency: fields.currency,
    amount: shape.shape.amount,
    due_day: shape.shape.due_day,
    due_date: shape.shape.due_date,
    login: fields.login,
    notes: fields.notes,
  };
  // Password is tri-state: undefined = leave the stored (encrypted) value
  // untouched; null = clear; a string = replace (the 0166 trigger encrypts it).
  if (fields.password !== undefined) {
    updatePayload.password = fields.password;
  }

  const { data, error } = await admin
    .from("subscriptions")
    .update(updatePayload)
    .eq("id", fields.id)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("[subscriptions] update error:", error);
    return { data: null, error: formErrors.subscriptionSaveFailed };
  }
  if (!data) return { data: null, error: formErrors.subscriptionNotFound };
  revalidatePath("/subscriptions");
  return { data: { id: (data as { id: string }).id }, error: null };
}

// ── Archive / Unarchive (soft delete) ───────────────────────────────────────────
export async function archiveSubscriptionAction(
  input: unknown,
): Promise<ActionResult<{ id: string; isArchived: boolean }>> {
  const parsed = ArchiveSubscriptionSchema.safeParse(input);
  if (!parsed.success) {
    return { data: null, error: parsed.error.issues[0]?.message ?? formErrors.generic };
  }
  const { id, isArchived } = parsed.data;

  const auth = await requireProfile();
  if (!auth.ok) return auth.result;
  if (!canManageSubscriptions(auth.profile)) return { data: null, error: formErrors.unauthorized };

  const admin = createAdminClient() as AnyClient;
  const { data, error } = await admin
    .from("subscriptions")
    .update({ is_archived: isArchived })
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("[subscriptions] archive error:", error);
    return { data: null, error: formErrors.subscriptionSaveFailed };
  }
  if (!data) return { data: null, error: formErrors.subscriptionNotFound };
  revalidatePath("/subscriptions");
  return { data: { id, isArchived }, error: null };
}

// ── Record Payment ───────────────────────────────────────────────────────────────
export async function addSubscriptionPaymentAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const parsed = AddPaymentSchema.safeParse(input);
  if (!parsed.success) {
    return { data: null, error: parsed.error.issues[0]?.message ?? formErrors.generic };
  }
  const fields = parsed.data;

  const auth = await requireProfile();
  if (!auth.ok) return auth.result;
  const caller = auth.profile;
  if (!canManageSubscriptions(caller)) return { data: null, error: formErrors.unauthorized };

  const admin = createAdminClient() as AnyClient;
  const { data: sub } = await admin
    .from("subscriptions")
    .select("id, type")
    .eq("id", fields.subscriptionId)
    .maybeSingle();
  if (!sub) return { data: null, error: formErrors.subscriptionNotFound };
  if ((sub as { type: string }).type === "top_up") {
    return { data: null, error: "This is a top-up subscription — use Log Top-up instead." };
  }

  const { data, error } = await admin
    .from("subscription_payments")
    .insert({
      subscription_id: fields.subscriptionId,
      due_date: fields.due_date,
      paid_at: fields.paid_at,
      rate: fields.rate,
      paid_amount_inr: fields.paid_amount_inr,
      invoice_path: fields.invoice_path,
      notes: fields.notes,
      created_by: caller.id,
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("[subscriptions] add payment error:", error);
    return { data: null, error: formErrors.subscriptionSaveFailed };
  }
  revalidatePath("/subscriptions");
  return { data: { id: (data as { id: string }).id }, error: null };
}

// ── Log Top-up ────────────────────────────────────────────────────────────────
export async function addSubscriptionTopupAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const parsed = AddTopupSchema.safeParse(input);
  if (!parsed.success) {
    return { data: null, error: parsed.error.issues[0]?.message ?? formErrors.generic };
  }
  const fields = parsed.data;

  const auth = await requireProfile();
  if (!auth.ok) return auth.result;
  const caller = auth.profile;
  if (!canManageSubscriptions(caller)) return { data: null, error: formErrors.unauthorized };

  const admin = createAdminClient() as AnyClient;
  const { data: sub } = await admin
    .from("subscriptions")
    .select("id, type")
    .eq("id", fields.subscriptionId)
    .maybeSingle();
  if (!sub) return { data: null, error: formErrors.subscriptionNotFound };
  if ((sub as { type: string }).type !== "top_up") {
    return { data: null, error: "Top-ups can only be logged on a top-up subscription." };
  }

  const { data, error } = await admin
    .from("subscription_topups")
    .insert({
      subscription_id: fields.subscriptionId,
      topped_up_at: fields.topped_up_at,
      amount: fields.amount,
      currency: fields.currency,
      paid_amount_inr: fields.paid_amount_inr,
      invoice_path: fields.invoice_path,
      notes: fields.notes,
      created_by: caller.id,
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("[subscriptions] add topup error:", error);
    return { data: null, error: formErrors.subscriptionSaveFailed };
  }
  revalidatePath("/subscriptions");
  return { data: { id: (data as { id: string }).id }, error: null };
}

// ── Invoice signing (read a private-bucket path) ────────────────────────────────
export async function signSubscriptionInvoiceAction(
  input: unknown,
): Promise<ActionResult<{ url: string }>> {
  const parsed = SignInvoiceSchema.safeParse(input);
  if (!parsed.success) return { data: null, error: formErrors.generic };

  const auth = await requireProfile();
  if (!auth.ok) return auth.result;
  if (!canManageSubscriptions(auth.profile)) return { data: null, error: formErrors.unauthorized };

  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from(SUBSCRIPTION_INVOICE_BUCKET)
    .createSignedUrl(parsed.data.path, INVOICE_SIGNED_URL_TTL);
  if (error || !data) return { data: null, error: formErrors.generic };
  return { data: { url: data.signedUrl }, error: null };
}

// ── Detail read (history modal) ─────────────────────────────────────────────────
export async function getSubscriptionDetailAction(id: string): Promise<
  ActionResult<{
    subscription: SubscriptionRow;
    toolName: string | null;
    hasPassword: boolean;
    payments: SubscriptionPaymentRow[];
    topups: SubscriptionTopupRow[];
  }>
> {
  if (!z.string().uuid().safeParse(id).success) {
    return { data: null, error: formErrors.subscriptionNotFound };
  }
  const auth = await requireProfile();
  if (!auth.ok) return auth.result;
  if (!canManageSubscriptions(auth.profile)) return { data: null, error: formErrors.unauthorized };

  const detail = await getSubscriptionDetail(id);
  if (!detail) return { data: null, error: formErrors.subscriptionNotFound };
  return { data: detail, error: null };
}

// ── Active list (Renewal picker) ────────────────────────────────────────────────
// The top-right "Renewal" flow searches all active subscriptions from the page
// header, which sits above the list's Suspense boundary and has no list in scope.
// Thin wrapper over getSubscriptions — same gate as every other subscription action.
export async function listActiveSubscriptionsAction(): Promise<
  ActionResult<SubscriptionListItem[]>
> {
  const auth = await requireProfile();
  if (!auth.ok) return auth.result;
  if (!canManageSubscriptions(auth.profile)) return { data: null, error: formErrors.unauthorized };

  return { data: await getSubscriptions({ archived: false }), error: null };
}

// ── Reveal password (decrypt on demand) ─────────────────────────────────────────
// The ONLY path that produces the plaintext credential — decrypts via the
// service_role-only RPC (0166), called when the user clicks "reveal". Never bundled
// into a list/detail payload.
export async function revealSubscriptionPasswordAction(
  id: string,
): Promise<ActionResult<{ password: string | null }>> {
  if (!z.string().uuid().safeParse(id).success) {
    return { data: null, error: formErrors.subscriptionNotFound };
  }
  const auth = await requireProfile();
  if (!auth.ok) return auth.result;
  if (!canManageSubscriptions(auth.profile)) return { data: null, error: formErrors.unauthorized };

  const admin = createAdminClient() as AnyClient;
  const { data: row, error } = await admin
    .from("subscriptions")
    .select("password")
    .eq("id", id)
    .maybeSingle();
  if (error || !row) return { data: null, error: formErrors.subscriptionNotFound };

  const cipher = (row as { password: string | null }).password;
  if (cipher == null) return { data: { password: null }, error: null };

  // Audit BEFORE the plaintext leaves the server (migration 0167, append-only).
  // Fails CLOSED: no audit row, no reveal.
  const { error: auditErr } = await admin
    .from("subscription_password_reveals")
    .insert({ subscription_id: id, revealed_by: auth.profile.id });
  if (auditErr) {
    console.error("[subscriptions] reveal audit insert failed — reveal denied:", auditErr);
    return { data: null, error: formErrors.generic };
  }

  const { data: decrypted, error: decErr } = await admin.rpc("decrypt_subscription_password", {
    p_ciphertext: cipher,
  });
  if (decErr) {
    console.error("[subscriptions] decrypt error:", decErr);
    return { data: null, error: formErrors.generic };
  }
  return { data: { password: (decrypted as string | null) ?? null }, error: null };
}

// ── Monthly report (export data) ────────────────────────────────────────────────
export async function getSubscriptionMonthlyReportAction(
  month: string,
): Promise<ActionResult<{ rows: MonthlyReportRow[] }>> {
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return { data: null, error: formErrors.generic };
  }
  const auth = await requireProfile();
  if (!auth.ok) return auth.result;
  if (!canManageSubscriptions(auth.profile)) return { data: null, error: formErrors.unauthorized };

  const rows = await getSubscriptionMonthlyReport(month);
  return { data: { rows }, error: null };
}
