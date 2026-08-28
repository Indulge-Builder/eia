// The media worker — downloads and DECRYPTS WhatsApp media into our own store.
//
// WhatsApp media references EXPIRE (plan-whatsapp §10.3): the worker retries hard
// inside the window (with Baileys' reuploadRequest refresh for 404/410), then
// marks dead_letter — we always KNOW what we lost. Pilot storage is local disk
// (connector/media/); the S3 swap lands with Sia W1 and is one function change.
//
// Downloads run OFF the socket handler (plan-whatsapp §10.1) with small
// concurrency, from the live in-memory message objects. A crash between receive
// and download leaves a pending row that the dead-letter sweep will mark.

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { downloadMediaMessage, type WAMessage, type WASocket } from "baileys";
import pino from "pino";
import { config } from "./config.js";
import { markMediaAttempt, markMediaDone } from "./db.js";

// S3 mode (Sia W1 — the Fargate deployment): lazily constructed only when the
// bucket env is set; local dev keeps writing to connector/media/ untouched.
const s3 = config.mediaBucket ? new S3Client({ region: config.awsRegion }) : null;

const MAX_ATTEMPTS = 5;
const CONCURRENCY = 2;
const RETRY_DELAY_MS = 20_000;

const quietLogger = pino({ level: "silent" });

type Job = {
  msg: WAMessage;
  chat_jid: string;
  wa_message_id: string;
  sender_jid: string;
  mime: string | null;
  attempts: number;
};

const queue: Job[] = [];
let active = 0;
let socketRef: WASocket | null = null;

export function setMediaSocket(sock: WASocket): void {
  socketRef = sock;
}

export function enqueueMediaDownload(job: Omit<Job, "attempts">): void {
  queue.push({ ...job, attempts: 0 });
  drain();
}

function extFor(mime: string | null): string {
  if (!mime) return "bin";
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "video/mp4": "mp4",
    "audio/ogg; codecs=opus": "ogg",
    "audio/ogg": "ogg",
    "audio/mpeg": "mp3",
    "audio/mp4": "m4a",
    "application/pdf": "pdf",
  };
  return map[mime] ?? mime.split("/")[1]?.split(";")[0] ?? "bin";
}

function drain(): void {
  while (active < CONCURRENCY && queue.length > 0) {
    const job = queue.shift()!;
    active++;
    run(job).finally(() => {
      active--;
      drain();
    });
  }
}

/**
 * THE media store write — S3 when the bucket env is set (Fargate), local disk
 * otherwise (dev). Returns the storage_path to record. Shared by the live
 * download worker AND the historical backfill (one implementation, ever).
 */
export async function storeMediaBuffer(
  chatJid: string,
  waMessageId: string,
  mime: string | null,
  buffer: Buffer,
): Promise<string> {
  const chatPart = chatJid.replace(/[^A-Za-z0-9@.-]/g, "_");
  const filePart = `${waMessageId.replace(/[^A-Za-z0-9_-]/g, "_")}.${extFor(mime)}`;
  if (s3 && config.mediaBucket) {
    const key = `${chatPart}/${filePart}`;
    await s3.send(
      new PutObjectCommand({
        Bucket: config.mediaBucket,
        Key: key,
        Body: buffer,
        ContentType: mime?.split(";")[0] ?? "application/octet-stream",
      }),
    );
    return `s3://${config.mediaBucket}/${key}`;
  }
  const dir = join(config.mediaDir, chatPart);
  mkdirSync(dir, { recursive: true });
  const path = join(dir, filePart);
  writeFileSync(path, buffer);
  return path;
}

async function run(job: Job): Promise<void> {
  try {
    const buffer = (await downloadMediaMessage(
      job.msg,
      "buffer",
      {},
      {
        logger: quietLogger,
        // Refreshes expired references (404/410) by asking WhatsApp to re-upload.
        reuploadRequest: socketRef
          ? socketRef.updateMediaMessage
          : (m) => Promise.resolve(m),
      },
    )) as Buffer;

    const storagePath = await storeMediaBuffer(job.chat_jid, job.wa_message_id, job.mime, buffer);
    await markMediaDone(job.chat_jid, job.wa_message_id, job.sender_jid, storagePath, buffer.length);
  } catch (e) {
    job.attempts++;
    const dead = job.attempts >= MAX_ATTEMPTS;
    await markMediaAttempt(job.chat_jid, job.wa_message_id, job.sender_jid, job.attempts, dead);
    if (!dead) {
      setTimeout(() => {
        queue.push(job);
        drain();
      }, RETRY_DELAY_MS * job.attempts);
    } else {
      console.error(
        `[media] dead_letter ${job.wa_message_id} (${job.mime}):`,
        e instanceof Error ? e.message : e,
      );
    }
  }
}
