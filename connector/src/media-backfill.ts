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
import { db, fetchRawMessageByPair } from "./db.js";
import { storeMediaBuffer } from "./media.js";
import { reviveBuffers } from "./normalize.js";

const DRIP_MS = 1500;
const BATCH = 25;
const FRESH_GUARD_MS = 10 * 60 * 1000;

const quietLogger = pino({ level: "silent" });

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
  // 'retrying' is included: the LIVE worker stamps it between its in-memory
  // retries, and a crash mid-cycle strands the row there forever (the live
  // queue is memory-only). The 10-min fresh guard keeps the two workers from
  // ever touching the same row; attempts<5 lets stranded live rows (attempts
  // up to 4) re-enter, and the >=3 rule below still resolves them promptly.
  const { data, error } = await db
    .from("wag_media")
    .select("chat_jid, wa_message_id, sender_jid, media_type, mime, created_at, attempts")
    .in("download_status", ["pending", "retrying"])
    .lt("created_at", cutoff)
    .lt("attempts", "5")
    .order("attempts", { ascending: true })
    // Newest MESSAGE first (0178): recent media recover almost always; the
    // deep tail (dead keys/links) drains to honest verdicts afterwards.
    .order("wa_timestamp", { ascending: false, nullsFirst: false })
    .limit(BATCH);
  if (error) {
    console.error("[backfill] pending fetch failed:", error.message);
    return [];
  }
  return (data ?? []) as PendingRow[];
}

async function fetchRawMessage(row: PendingRow): Promise<WAMessage | null> {
  const raw = await fetchRawMessageByPair(row.chat_jid, row.wa_message_id);
  return raw ? (reviveBuffers(raw) as WAMessage) : null;
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
          let buffer: Buffer;
          try {
            buffer = (await downloadMediaMessage(msg, "buffer", {}, {
              logger: quietLogger,
              reuploadRequest: sock.updateMediaMessage,
            })) as Buffer;
          } catch (firstErr) {
            // Historical URLs die with statuses Baileys does NOT auto-reupload
            // on (it only reacts to 404/410; expired signatures answer 403 —
            // the 2026-08-29 breaker trip). Ask the phone to re-upload
            // EXPLICITLY, then retry the download once with the refreshed url.
            const updated = (await sock.updateMediaMessage(msg)) as WAMessage;
            buffer = (await downloadMediaMessage(updated, "buffer", {}, {
              logger: quietLogger,
              reuploadRequest: sock.updateMediaMessage,
            })) as Buffer;
            void firstErr;
          }
          const path = await storeMediaBuffer(row.chat_jid, row.wa_message_id, row.mime, buffer);
          await setStatus(row, "done", { storage_path: path, size_bytes: buffer.length });
          done++;
          consecutiveFailures = 0;
        } catch (e) {
          const reason = e instanceof Error ? e.message : String(e);
          const attempts = (row.attempts ?? 0) + 1;
          // A verdict needs EVIDENCE: only clearly-permanent refusals expire.
          // 'bad decrypt' is permanent: the phone's re-upload key no longer
          // matches the key the history sync gave us — it never heals (the
          // 2026-08-29 month-old-slab finding).
          const permanent = /404|410|not.?found|empty media key|no url|expired|bad decrypt|failed by device/i.test(reason);
          if (permanent || attempts >= 3) {
            await setStatus(row, "expired", { attempts });
          } else {
            await setStatus(row, "pending", { attempts }); // retried a later pass
          }
          expired++;
          // The breaker guards TRANSPORT sickness (socket/db/network), never a
          // dead slab being correctly buried — a permanent verdict is the drip
          // WORKING, so it doesn't count toward the stop.
          if (!permanent) consecutiveFailures++;
          if (consecutiveFailures <= 3 || consecutiveFailures % 25 === 0) {
            const status =
              (e as { output?: { statusCode?: number }; data?: { statusCode?: number } })?.output?.statusCode ??
              (e as { data?: { statusCode?: number } })?.data?.statusCode;
            console.warn(
              `[backfill] ${row.media_type} ${row.wa_message_id} failed (attempt ${attempts}${status ? `, status ${status}` : ""}): ${reason.slice(0, 240)}`,
            );
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
