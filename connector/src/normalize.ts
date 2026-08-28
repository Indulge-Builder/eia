// The normalizer — one Baileys WAMessage → wag_ rows (normalizer_version 1).
//
// Philosophy (plan-whatsapp §11): an insert must never fail. Anything this file
// does not recognize stores as type 'unknown' with its raw payload kept; a
// smarter normalizer replays it later. Edits become NEW rows chained to the
// original; revokes and reactions are returned as instructions for db.ts.

import { getContentType, jidNormalizedUser, type WAMessage, type WAProto } from "baileys";
import type { WagMessageRow } from "./db.js";

/** JSON-safe deep copy: Buffers/Uint8Arrays → base64 strings (raw stays replayable). */
export function jsonSafe(value: unknown): unknown {
  return JSON.parse(
    JSON.stringify(value, (_k, v) => {
      if (v instanceof Uint8Array) return Buffer.from(v).toString("base64");
      if (typeof v === "bigint") return v.toString();
      return v;
    }),
  );
}

function tsToIso(ts: number | { toString(): string } | bigint | null | undefined): string {
  const n = typeof ts === "object" && ts !== null ? Number(ts.toString()) : Number(ts ?? 0);
  return new Date((n > 0 ? n : Math.floor(Date.now() / 1000)) * 1000).toISOString();
}

/** Groups only — DMs, status, newsletters and broadcast lists are out of scope. */
export function isGroupJid(jid: string | null | undefined): jid is string {
  return !!jid && jid.endsWith("@g.us");
}

export function normalizeJid(jid: string | null | undefined): string {
  if (!jid) return "unknown";
  try {
    return jidNormalizedUser(jid) || jid;
  } catch {
    return jid;
  }
}

/** Unwrap the containers WhatsApp nests real content inside. */
function unwrapContent(message: WAProto.IMessage | null | undefined): WAProto.IMessage | null {
  let m = message ?? null;
  for (let i = 0; i < 5 && m; i++) {
    if (m.ephemeralMessage?.message) m = m.ephemeralMessage.message;
    else if (m.viewOnceMessage?.message) m = m.viewOnceMessage.message;
    else if (m.viewOnceMessageV2?.message) m = m.viewOnceMessageV2.message;
    else if (m.viewOnceMessageV2Extension?.message) m = m.viewOnceMessageV2Extension.message;
    else if (m.documentWithCaptionMessage?.message) m = m.documentWithCaptionMessage.message;
    else if (m.editedMessage?.message) m = m.editedMessage.message;
    else break;
  }
  return m;
}

const TYPE_BY_CONTENT: Record<string, string> = {
  conversation: "text",
  extendedTextMessage: "text",
  imageMessage: "image",
  videoMessage: "video",
  audioMessage: "audio", // refined to 'voice' below when ptt
  documentMessage: "document",
  stickerMessage: "sticker",
  locationMessage: "location",
  liveLocationMessage: "location",
  contactMessage: "contact",
  contactsArrayMessage: "contact",
  pollCreationMessage: "poll",
  pollCreationMessageV2: "poll",
  pollCreationMessageV3: "poll",
};

const MEDIA_CONTENT = new Set([
  "imageMessage",
  "videoMessage",
  "audioMessage",
  "documentMessage",
  "stickerMessage",
]);

function extractText(content: WAProto.IMessage): string | null {
  return (
    content.conversation ??
    content.extendedTextMessage?.text ??
    content.imageMessage?.caption ??
    content.videoMessage?.caption ??
    content.documentMessage?.caption ??
    (content.locationMessage
      ? `${content.locationMessage.degreesLatitude},${content.locationMessage.degreesLongitude}`
      : null) ??
    content.pollCreationMessage?.name ??
    content.pollCreationMessageV2?.name ??
    content.pollCreationMessageV3?.name ??
    content.contactMessage?.displayName ??
    null
  );
}

function contextInfoOf(content: WAProto.IMessage): WAProto.IContextInfo | null {
  const inner = (getContentType(content) && (content as Record<string, unknown>)[getContentType(content)!]) as
    | { contextInfo?: WAProto.IContextInfo }
    | undefined;
  return inner?.contextInfo ?? null;
}

export type Normalized =
  | { kind: "message"; row: WagMessageRow; media: { media_type: string; mime: string | null; size_bytes: number | null; duration_seconds: number | null } | null }
  | { kind: "reaction"; chat_jid: string; wa_message_id: string; target_sender_jid: string; reactor_jid: string; emoji: string }
  | { kind: "revoke"; chat_jid: string; target_wa_message_id: string }
  | { kind: "skip"; reason: string };

/**
 * Normalize one WAMessage. `source` distinguishes live delivery from history
 * sync (locked decision 7). Never throws — an unparseable message becomes a
 * type 'unknown' row (the raw is the recovery path).
 */
export function normalizeMessage(msg: WAMessage, source: "live" | "history_sync"): Normalized {
  try {
    const chatJid = msg.key?.remoteJid ?? null;
    if (!isGroupJid(chatJid)) return { kind: "skip", reason: "not a group" };
    const waMessageId = msg.key?.id;
    if (!waMessageId) return { kind: "skip", reason: "no message id" };

    const senderJid = normalizeJid(msg.key?.participant ?? msg.participant ?? chatJid);
    const fromMe = !!msg.key?.fromMe;
    const waTimestamp = tsToIso(msg.messageTimestamp as number);

    // System stubs (member added, subject changed, ...) have no content.
    if (msg.messageStubType) {
      return {
        kind: "message",
        row: {
          chat_jid: chatJid,
          wa_message_id: waMessageId,
          sender_jid: senderJid,
          from_me: fromMe,
          type: "system",
          text: `${msg.messageStubType}${msg.messageStubParameters?.length ? ": " + msg.messageStubParameters.join(", ") : ""}`,
          quoted_wa_message_id: null,
          quoted_sender_jid: null,
          wa_timestamp: waTimestamp,
          is_forwarded: false,
          edit_of_wa_message_id: null,
          source,
          raw: jsonSafe(msg),
        },
        media: null,
      };
    }

    const outer = msg.message ?? null;
    if (!outer) return { kind: "skip", reason: "empty message" };

    // Reactions target another message; they are state, not a message row.
    if (outer.reactionMessage) {
      const r = outer.reactionMessage;
      return {
        kind: "reaction",
        chat_jid: chatJid,
        wa_message_id: r.key?.id ?? "unknown",
        target_sender_jid: normalizeJid(r.key?.participant ?? chatJid),
        reactor_jid: senderJid,
        emoji: r.text ?? "",
      };
    }

    // Protocol messages: revoke (delete-for-everyone) and edits.
    if (outer.protocolMessage) {
      const p = outer.protocolMessage;
      const ptype = String(p.type);
      if (ptype === "REVOKE" || ptype === "0") {
        return { kind: "revoke", chat_jid: chatJid, target_wa_message_id: p.key?.id ?? "unknown" };
      }
      if (ptype === "MESSAGE_EDIT" || ptype === "14") {
        const edited = unwrapContent(p.editedMessage);
        return {
          kind: "message",
          row: {
            chat_jid: chatJid,
            wa_message_id: waMessageId, // the edit event's own id — a NEW fact
            sender_jid: senderJid,
            from_me: fromMe,
            type: edited ? (TYPE_BY_CONTENT[getContentType(edited) ?? ""] ?? "unknown") : "unknown",
            text: edited ? extractText(edited) : null,
            quoted_wa_message_id: null,
            quoted_sender_jid: null,
            wa_timestamp: waTimestamp,
            is_forwarded: false,
            edit_of_wa_message_id: p.key?.id ?? null, // chain to the original
            source,
            raw: jsonSafe(msg),
          },
          media: null,
        };
      }
      return { kind: "skip", reason: `protocol:${ptype}` };
    }

    const content = unwrapContent(outer);
    if (!content) return { kind: "skip", reason: "no content after unwrap" };
    const contentType = getContentType(content) ?? "unknown";
    let type = TYPE_BY_CONTENT[contentType] ?? "unknown";
    if (contentType === "audioMessage" && content.audioMessage?.ptt) type = "voice";

    const ctx = contextInfoOf(content);
    const media = MEDIA_CONTENT.has(contentType)
      ? {
          media_type: type,
          mime:
            content.imageMessage?.mimetype ??
            content.videoMessage?.mimetype ??
            content.audioMessage?.mimetype ??
            content.documentMessage?.mimetype ??
            content.stickerMessage?.mimetype ??
            null,
          size_bytes: Number(
            content.imageMessage?.fileLength ??
              content.videoMessage?.fileLength ??
              content.audioMessage?.fileLength ??
              content.documentMessage?.fileLength ??
              content.stickerMessage?.fileLength ??
              0,
          ) || null,
          duration_seconds:
            Number(content.audioMessage?.seconds ?? content.videoMessage?.seconds ?? 0) || null,
        }
      : null;

    return {
      kind: "message",
      row: {
        chat_jid: chatJid,
        wa_message_id: waMessageId,
        sender_jid: senderJid,
        from_me: fromMe,
        type,
        text: extractText(content),
        quoted_wa_message_id: ctx?.stanzaId ?? null, // SOFT reference (decision 2)
        quoted_sender_jid: ctx?.participant ? normalizeJid(ctx.participant) : null,
        wa_timestamp: waTimestamp,
        is_forwarded: !!(ctx?.isForwarded || (ctx?.forwardingScore ?? 0) > 0),
        edit_of_wa_message_id: null,
        source,
        raw: jsonSafe(msg),
      },
      media,
    };
  } catch (e) {
    // Never throw — the raw event already landed; this message just waits for replay.
    console.error("[normalize] failed (raw kept, replayable):", e instanceof Error ? e.message : e);
    return { kind: "skip", reason: "normalizer error" };
  }
}
