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
  attempts: number | null;
};

async function fetchPendingBatch(): Promise<PendingRow[]> {
  const cutoff = new Date(Date.now() - FRESH_GUARD_MS).toISOString();
  const { data, error } = await db
    .from("wag_media")
    .select("chat_jid, wa_message_id, sender_jid, media_type, mime, created_at, attempts")
    .eq("download_status", "pending")
    .lt("created_at", cutoff)
    .lt("attempts", "3")
    .order("attempts", { ascending: true })
    .order("created_at", { ascending: false }) // newest first — freshest links first
    .limit(BATCH);
  if (error) {
    console.error("[backfill] pending fetch failed:", error.message);
    return [];
  }
  return (data ?? []) as PendingRow[];
}

async function fetchRawMessage(row: PendingRow): Promise<WAMessage | null> {
  // Lookup by PAIR, not triple: sender_jid is the unstable leg (lid vs phone
  // forms across sync eras), and a message id is unique within its chat.
  const { data, error } = await db
    .from("wag_messages")
    .select("raw")
    .eq("chat_jid", row.chat_jid)
    .eq("wa_message_id", row.wa_message_id)
    .limit(1);
  if (error || !data?.[0]?.raw) return null;
  return reviveBuffers(data[0].raw) as WAMessage;
}

async function setStatus(
  row: PendingRow,
  status: "done" | "expired" | "dead_letter" | "pending",
  extra: Record<string, unknown> = {},
) {
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
      let consecutiveFailures = 0;
      for (const row of batch) {
        try {
          const msg = await fetchRawMessage(row);
          if (!msg?.message) {
            // ORPHAN: no message row holds this media's keys (its message
            // insert was lost in a flood batch) — undownloadable forever.
            // dead_letter is the honest verdict; never "expired".
            await setStatus(row, "dead_letter");
            expired++;
            consecutiveFailures = 0;
            continue;
          }
          const buffer = (await downloadMediaMessage(msg, "buffer", {}, {
            logger: quietLogger,
            reuploadRequest: sock.updateMediaMessage,
          })) as Buffer;
          const path = await storeMediaBuffer(row.chat_jid, row.wa_message_id, row.mime, buffer);
          await setStatus(row, "done", { storage_path: path, size_bytes: buffer.length });
          done++;
          consecutiveFailures = 0;
        } catch (e) {
          const reason = e instanceof Error ? e.message : String(e);
          const attempts = (row.attempts ?? 0) + 1;
          // A verdict needs EVIDENCE: only clearly-permanent refusals expire.
          const permanent = /404|410|not.?found|empty media key|no url|expired/i.test(reason);
          if (permanent || attempts >= 3) {
            await setStatus(row, "expired", { attempts });
          } else {
            await setStatus(row, "pending", { attempts }); // retried a later pass
          }
          expired++;
          consecutiveFailures++;
          if (consecutiveFailures <= 3 || consecutiveFailures % 25 === 0) {
            console.warn(`[backfill] ${row.media_type} ${row.wa_message_id} failed (attempt ${attempts}): ${reason.slice(0, 140)}`);
          }
          if (consecutiveFailures >= 15) {
            console.error("[backfill] 15 consecutive failures — stopping the drip (systemic issue, investigate before grinding on)");
            running = false;
            return;
          }
        }
        if ((done + expired) % 100 === 0) {
          console.log(`[backfill] progress: ${done} recovered, ${expired} failed/deferred`);
        }
        await new Promise((r) => setTimeout(r, DRIP_MS));
      }
    }
  })();
}
