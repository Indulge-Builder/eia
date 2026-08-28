// Historical media backfill (audit P1-1): 14,516 media rows sat in 'pending'
// forever because downloads were only attempted for live messages. History-sync
// payloads usually DO carry the decryption key — and WhatsApp's links expire
// over weeks, so waiting quietly loses photos and documents.
//
// This worker drips through pending rows while the socket is connected: one
// attempt each (with Baileys' re-upload refresh for expired links), ~1.5s apart
// so it never competes with live traffic. Every row reaches an honest terminal
// state: 'done' (uploaded to the store) or 'expired' (WhatsApp refuses — gone).
// Rows younger than 10 minutes are skipped so the live worker owns them.

import { downloadMediaMessage, type WAMessage, type WASocket } from "baileys";
import pino from "pino";
import { db } from "./db.js";
import { storeMediaBuffer } from "./media.js";

const DRIP_MS = 1500;
const BATCH = 25;
const FRESH_GUARD_MS = 10 * 60 * 1000;

const quietLogger = pino({ level: "silent" });

/** jsonSafe turned Buffers into base64 strings; downloadMediaMessage needs the
 *  binary fields back. Revive the known byte fields anywhere in the tree. */
const BYTE_FIELDS = new Set([
  "mediaKey",
  "fileEncSha256",
  "fileSha256",
  "streamingSidecar",
  "jpegThumbnail",
  "thumbnailEncSha256",
  "thumbnailSha256",
  "waveform",
]);

function reviveBuffers(value: unknown, keyName?: string): unknown {
  if (typeof value === "string" && keyName && BYTE_FIELDS.has(keyName)) {
    return Buffer.from(value, "base64");
  }
  if (Array.isArray(value)) return value.map((v) => reviveBuffers(v));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = reviveBuffers(v, k);
    return out;
  }
  return value;
}

type PendingRow = {
  chat_jid: string;
  wa_message_id: string;
  sender_jid: string;
  media_type: string;
  mime: string | null;
  created_at: string;
};

async function fetchPendingBatch(): Promise<PendingRow[]> {
  const cutoff = new Date(Date.now() - FRESH_GUARD_MS).toISOString();
  const { data, error } = await db
    .from("wag_media")
    .select("chat_jid, wa_message_id, sender_jid, media_type, mime, created_at")
    .eq("download_status", "pending")
    .lt("created_at", cutoff)
    .order("created_at", { ascending: false }) // newest first — freshest links first
    .limit(BATCH);
  if (error) {
    console.error("[backfill] pending fetch failed:", error.message);
    return [];
  }
  return (data ?? []) as PendingRow[];
}

async function fetchRawMessage(row: PendingRow): Promise<WAMessage | null> {
  const { data, error } = await db
    .from("wag_messages")
    .select("raw")
    .eq("chat_jid", row.chat_jid)
    .eq("wa_message_id", row.wa_message_id)
    .eq("sender_jid", row.sender_jid)
    .limit(1);
  if (error || !data?.[0]?.raw) return null;
  return reviveBuffers(data[0].raw) as WAMessage;
}

async function setStatus(row: PendingRow, status: "done" | "expired", extra: Record<string, unknown> = {}) {
  const { error } = await db
    .from("wag_media")
    .update({ download_status: status, last_attempt_at: new Date().toISOString(), ...extra })
    .eq("chat_jid", row.chat_jid)
    .eq("wa_message_id", row.wa_message_id)
    .eq("sender_jid", row.sender_jid);
  if (error) console.error("[backfill] status update failed:", error.message);
}

let running = false;

/** Start the drip. Idempotent per process; dies with the process (crash-only). */
export function startMediaBackfill(sock: WASocket): void {
  if (running) return;
  running = true;

  void (async () => {
    let done = 0;
    let expired = 0;
    console.log("[backfill] historical media drip started");
    for (;;) {
      const batch = await fetchPendingBatch();
      if (batch.length === 0) {
        console.log(`[backfill] drained — ${done} recovered, ${expired} expired`);
        running = false;
        return;
      }
      for (const row of batch) {
        try {
          const msg = await fetchRawMessage(row);
          if (!msg?.message) {
            await setStatus(row, "expired");
            expired++;
          } else {
            const buffer = (await downloadMediaMessage(msg, "buffer", {}, {
              logger: quietLogger,
              reuploadRequest: sock.updateMediaMessage,
            })) as Buffer;
            const path = await storeMediaBuffer(row.chat_jid, row.wa_message_id, row.mime, buffer);
            await setStatus(row, "done", { storage_path: path, size_bytes: buffer.length });
            done++;
          }
        } catch {
          // One honest attempt per row: WhatsApp refused / link gone → expired.
          await setStatus(row, "expired");
          expired++;
        }
        if ((done + expired) % 100 === 0) {
          console.log(`[backfill] progress: ${done} recovered, ${expired} expired`);
        }
        await new Promise((r) => setTimeout(r, DRIP_MS));
      }
    }
  })();
}
