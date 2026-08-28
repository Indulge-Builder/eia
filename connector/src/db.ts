// The connector's write seam onto the wag_ family (migration 0169).
// Direct service-role writes (plan-whatsapp §10.2 — no webhook hop). Every write
// is idempotent: messages upsert on WhatsApp's identity triple (+ wa_timestamp,
// the partition column), so dual watchers, redeliveries, and replays all land
// exactly once. All helpers are non-throwing at the call sites that drain the
// queue — a bad row is logged and skipped, never allowed to stall the stream.

import { createClient } from "@supabase/supabase-js";
import { config } from "./config.js";

// All wag_ tables live in the `sia` schema (migration 0172 — kept out of public to
// keep the business-table list clean). Scope the whole client to it so every
// .from("wag_…") resolves to sia.wag_… with no per-query .schema() needed. (Type is
// inferred — the sia-scoped client's type differs from the default public one.)
export const db = createClient(config.supabaseUrl, config.supabaseServiceKey, {
  auth: { persistSession: false },
  db: { schema: "sia" },
});

const NORMALIZER_VERSION = 1;

// ─────────────────────────────────────────────
// Raw events (the black-box recorder — append-only, batched)
// ─────────────────────────────────────────────

// A single jsonb insert over ~1MB hits PostgREST's statement timeout, and on a
// batch insert that failure drops all 50 rows. On connect, the real watcher number
// (in every group) gets a firehose: a huge contacts.upsert and a multi-MB
// messaging-history.set. Those bulk blobs are LOW-VALUE for raw-replay (their
// messages are normalized from memory regardless — the black box still records
// that the event happened, its type, and its size). So: trim oversized payloads to
// a compact marker BEFORE insert, and fall back to per-row inserts if a batch still
// fails, so one bad row never drops the good ones. Live traffic (small) always
// stores whole — raw-first is intact for everything that matters.
const RAW_PAYLOAD_MAX_BYTES = 900_000;

export async function insertRawEvents(
  rows: { event_type: string; payload: unknown; account_jid: string | null }[],
): Promise<void> {
  if (rows.length === 0) return;
  const safe = rows.map((r) => {
    const serialized = JSON.stringify(r.payload);
    if (serialized.length > RAW_PAYLOAD_MAX_BYTES) {
      return {
        ...r,
        payload: {
          _truncated: true,
          reason: "oversized bulk payload (normalized from memory)",
          original_bytes: serialized.length,
          event_type: r.event_type,
        },
      };
    }
    return r;
  });

  const { error } = await db.from("wag_raw_events").insert(safe);
  if (!error) return;

  // Batch failed — salvage per-row so a single transient/oversized row can't drop the rest.
  for (const row of safe) {
    const { error: rowErr } = await db.from("wag_raw_events").insert(row);
    if (rowErr) console.error("[db] raw insert failed (row dropped):", rowErr.message);
  }
}

// ─────────────────────────────────────────────
// Heartbeat (migration 0175) — the watcher's own pulse. Liveness must never
// depend on group traffic (groups sleep at night); the alarm and the /sia dot
// read this one row instead. Non-fatal like every write here.
// ─────────────────────────────────────────────

export type WatcherState = "pairing" | "connecting" | "connected" | "logged_out";

export async function upsertWatcherStatus(row: {
  state: WatcherState;
  state_since: string;
  account_jid: string | null;
}): Promise<void> {
  const { error } = await db.from("wag_watcher_status").upsert(
    {
      id: 1,
      beat_at: new Date().toISOString(),
      state: row.state,
      connected: row.state === "connected",
      state_since: row.state_since,
      account_jid: row.account_jid,
    },
    { onConflict: "id" },
  );
  if (error) console.error("[db] heartbeat failed:", error.message);
}

// ─────────────────────────────────────────────
// Contacts / groups / members
// ─────────────────────────────────────────────

export async function upsertContact(row: {
  jid: string;
  lid?: string | null;
  push_name?: string | null;
  participant_role?: string;
}): Promise<void> {
  const { error } = await db
    .from("wag_contacts")
    .upsert(
      { ...row, last_seen_at: new Date().toISOString() },
      { onConflict: "jid", ignoreDuplicates: false },
    );
  if (error) console.error("[db] contact upsert failed:", error.message);
}

/**
 * Batch contact upsert — the connect-flood path (contacts.upsert can carry
 * thousands of rows for the real watcher number). One statement per chunk instead
 * of thousands of sequential round-trips. Chunked so no single insert goes oversized.
 */
export async function upsertContactsBatch(
  rows: { jid: string; lid?: string | null; push_name?: string | null }[],
): Promise<void> {
  if (rows.length === 0) return;
  const now = new Date().toISOString();
  const CHUNK = 500;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK).map((r) => ({ ...r, last_seen_at: now }));
    const { error } = await db
      .from("wag_contacts")
      .upsert(chunk, { onConflict: "jid", ignoreDuplicates: false });
    if (error) console.error("[db] contact batch upsert failed:", error.message);
  }
}

/**
 * Identity bridge — lid ↔ phone-jid pairs harvested from group participant
 * metadata (lid-addressed groups hide numbers behind @lid ids; the participant
 * object still carries `phoneNumber`). One contact row per phone jid, `lid` +
 * `phone` filled so the app can resolve members → names → staff profiles.
 * Rows WITHOUT a display name are upserted separately so they can never
 * overwrite an existing push_name with null.
 */
export async function upsertContactBridges(
  rows: { jid: string; lid: string | null; phone: string | null; push_name: string | null }[],
): Promise<void> {
  if (rows.length === 0) return;
  const now = new Date().toISOString();
  const named = rows.filter((r) => r.push_name);
  const nameless = rows.filter((r) => !r.push_name).map(({ jid, lid, phone }) => ({ jid, lid, phone }));
  const CHUNK = 500;
  for (const batch of [named, nameless]) {
    for (let i = 0; i < batch.length; i += CHUNK) {
      const chunk = batch.slice(i, i + CHUNK).map((r) => ({ ...r, last_seen_at: now }));
      const { error } = await db
        .from("wag_contacts")
        .upsert(chunk, { onConflict: "jid", ignoreDuplicates: false });
      if (error) console.error("[db] contact bridge upsert failed:", error.message);
    }
  }
}

export async function upsertGroup(row: {
  group_jid: string;
  subject?: string | null;
  description?: string | null;
  owner_jid?: string | null;
  member_count?: number | null;
  watcher_joined_at?: string;
}): Promise<void> {
  const { error } = await db
    .from("wag_groups")
    .upsert(row, { onConflict: "group_jid", ignoreDuplicates: false });
  if (error) console.error("[db] group upsert failed:", error.message);
}

/** Membership history: a join inserts a new stint; leave closes the open one. */
export async function memberJoined(groupJid: string, memberJid: string, role = "member") {
  const { data: open } = await db
    .from("wag_group_members")
    .select("joined_at")
    .eq("group_jid", groupJid)
    .eq("member_jid", memberJid)
    .is("left_at", null)
    .limit(1);
  if (open && open.length > 0) return; // already an open stint
  const { error } = await db
    .from("wag_group_members")
    .insert({ group_jid: groupJid, member_jid: memberJid, role });
  if (error && !error.message.includes("duplicate")) {
    console.error("[db] member join failed:", error.message);
  }
}

export async function memberLeft(groupJid: string, memberJid: string) {
  const { error } = await db
    .from("wag_group_members")
    .update({ left_at: new Date().toISOString() })
    .eq("group_jid", groupJid)
    .eq("member_jid", memberJid)
    .is("left_at", null);
  if (error) console.error("[db] member leave failed:", error.message);
}

export async function memberRoleChanged(groupJid: string, memberJid: string, role: string) {
  const { error } = await db
    .from("wag_group_members")
    .update({ role })
    .eq("group_jid", groupJid)
    .eq("member_jid", memberJid)
    .is("left_at", null);
  if (error) console.error("[db] member role change failed:", error.message);
}

// ─────────────────────────────────────────────
// Messages (upsert on the WhatsApp identity triple — the dedup wall)
// ─────────────────────────────────────────────

export type WagMessageRow = {
  chat_jid: string;
  wa_message_id: string;
  sender_jid: string;
  from_me: boolean;
  type: string;
  text: string | null;
  quoted_wa_message_id: string | null;
  quoted_sender_jid: string | null;
  wa_timestamp: string;
  is_forwarded: boolean;
  edit_of_wa_message_id: string | null;
  source: "live" | "history_sync" | "backfill";
  raw: unknown;
};

export async function upsertMessages(rows: WagMessageRow[]): Promise<void> {
  if (rows.length === 0) return;
  // Chunked — a history_sync batch can carry thousands of messages; one giant
  // upsert would hit the statement timeout. 500/statement keeps each insert small.
  const CHUNK = 500;
  const stamped = rows.map((r) => ({ ...r, normalizer_version: NORMALIZER_VERSION }));
  for (let i = 0; i < stamped.length; i += CHUNK) {
    const { error } = await db.from("wag_messages").upsert(stamped.slice(i, i + CHUNK), {
      onConflict: "chat_jid,wa_message_id,sender_jid,wa_timestamp",
      ignoreDuplicates: true, // dual watcher / redelivery → silent bounce
    });
    if (error) console.error("[db] message upsert failed:", error.message);
  }
}

/** Delete-for-everyone: flip the tag, keep everything (locked decision 4). */
export async function markRevoked(chatJid: string, targetWaMessageId: string): Promise<void> {
  const { error } = await db
    .from("wag_messages")
    .update({ is_revoked: true })
    .eq("chat_jid", chatJid)
    .eq("wa_message_id", targetWaMessageId);
  if (error) console.error("[db] revoke flag failed:", error.message);
}

// ─────────────────────────────────────────────
// Reactions (current state; history lives in raw — locked decision 3)
// ─────────────────────────────────────────────

export async function upsertReaction(row: {
  chat_jid: string;
  wa_message_id: string;
  target_sender_jid: string;
  reactor_jid: string;
  emoji: string;
}): Promise<void> {
  if (row.emoji === "") {
    const { error } = await db
      .from("wag_reactions")
      .delete()
      .eq("chat_jid", row.chat_jid)
      .eq("wa_message_id", row.wa_message_id)
      .eq("reactor_jid", row.reactor_jid);
    if (error) console.error("[db] reaction delete failed:", error.message);
    return;
  }
  const { error } = await db
    .from("wag_reactions")
    .upsert(
      { ...row, reacted_at: new Date().toISOString() },
      { onConflict: "chat_jid,wa_message_id,reactor_jid" },
    );
  if (error) console.error("[db] reaction upsert failed:", error.message);
}

// ─────────────────────────────────────────────
// Receipts (pilot: all non-watcher receipts; the client-only gate arrives with
// group mapping — plan-whatsapp §11 decision 5)
// ─────────────────────────────────────────────

export async function upsertReceipt(row: {
  chat_jid: string;
  wa_message_id: string;
  participant_jid: string;
  delivered_at?: string | null;
  read_at?: string | null;
  played_at?: string | null;
}): Promise<void> {
  const patch: Record<string, unknown> = {
    chat_jid: row.chat_jid,
    wa_message_id: row.wa_message_id,
    participant_jid: row.participant_jid,
  };
  if (row.delivered_at) patch.delivered_at = row.delivered_at;
  if (row.read_at) patch.read_at = row.read_at;
  if (row.played_at) patch.played_at = row.played_at;
  const { error } = await db
    .from("wag_receipts")
    .upsert(patch, { onConflict: "chat_jid,wa_message_id,participant_jid" });
  if (error) console.error("[db] receipt upsert failed:", error.message);
}

// ─────────────────────────────────────────────
// Media rows (the fetch queue; the worker lives in media.ts)
// ─────────────────────────────────────────────

export async function insertMediaRow(row: {
  chat_jid: string;
  wa_message_id: string;
  sender_jid: string;
  media_type: string;
  mime: string | null;
  size_bytes: number | null;
  duration_seconds: number | null;
}): Promise<void> {
  const { error } = await db
    .from("wag_media")
    .upsert(row, { onConflict: "chat_jid,wa_message_id,sender_jid", ignoreDuplicates: true });
  if (error) console.error("[db] media row insert failed:", error.message);
}

export async function markMediaDone(
  chatJid: string,
  waMessageId: string,
  senderJid: string,
  storagePath: string,
  sizeBytes: number,
): Promise<void> {
  const { error } = await db
    .from("wag_media")
    .update({ download_status: "done", storage_path: storagePath, size_bytes: sizeBytes })
    .eq("chat_jid", chatJid)
    .eq("wa_message_id", waMessageId)
    .eq("sender_jid", senderJid);
  if (error) console.error("[db] media done failed:", error.message);
}

export async function markMediaAttempt(
  chatJid: string,
  waMessageId: string,
  senderJid: string,
  attempts: number,
  dead: boolean,
): Promise<void> {
  const { error } = await db
    .from("wag_media")
    .update({
      download_status: dead ? "dead_letter" : "retrying",
      attempts,
      last_attempt_at: new Date().toISOString(),
    })
    .eq("chat_jid", chatJid)
    .eq("wa_message_id", waMessageId)
    .eq("sender_jid", senderJid);
  if (error) console.error("[db] media attempt failed:", error.message);
}
