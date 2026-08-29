"use client";

// Shared Sia vocabulary — labels, sender identity, preview lines, and the kind
// pill. One home so the rail, the chat header, and the console modal can never
// drift (R-01). Display-only (A-06).

import { FileText, ImageIcon, Images, IndianRupee, Mic, ShoppingBag, Smile, Video } from "lucide-react";
import { AVATAR_COLOUR_PAIRS } from "@/components/ui/Avatar";
import { hashString } from "@/lib/utils/strings";
import type { SiaGroupKind, SiaGroupRow, SiaMessageRow } from "@/lib/services/sia-service";

export const KIND_LABEL: Record<SiaGroupKind, string> = {
  client: "Client",
  vendor: "Vendor",
  internal: "Internal",
  unmapped: "Unmapped",
};
export const KIND_ORDER: SiaGroupKind[] = ["client", "vendor", "internal", "unmapped"];

export function groupTitle(g: Pick<SiaGroupRow, "subject" | "group_jid">): string {
  return g.subject ?? g.group_jid.split("@")[0];
}

export function senderLabel(m: Pick<SiaMessageRow, "from_me" | "sender_name" | "sender_jid">): string {
  return m.from_me ? "Watcher" : (m.sender_name ?? m.sender_jid.split("@")[0]);
}

/** Sender ink — the SAME hash + token pair the Avatar fallback uses, so a
 *  sender's name colour always matches their avatar tint (WhatsApp-style
 *  per-sender colouring without inventing a palette). */
export function senderInk(label: string): string {
  return AVATAR_COLOUR_PAIRS[hashString(label) % AVATAR_COLOUR_PAIRS.length][1];
}

/** Media/preview label per message type — the rail + quote strips share it. */
export const TYPE_PREVIEW: Record<string, { label: string; icon: typeof ImageIcon }> = {
  image: { label: "Photo", icon: ImageIcon },
  sticker: { label: "Sticker", icon: Smile },
  video: { label: "Video", icon: Video },
  voice: { label: "Voice note", icon: Mic },
  audio: { label: "Audio", icon: Mic },
  document: { label: "Document", icon: FileText },
  album: { label: "Photo album", icon: Images },
  payment: { label: "Payment", icon: IndianRupee },
  product: { label: "Product", icon: ShoppingBag },
};

/** Bare-URL linkification for chat text (the WhatsApp reading): http(s) and
 *  www. runs become real anchors (new tab, noopener), everything else stays
 *  plain text. React nodes only — never dangerouslySetInnerHTML. ChatMarkdown
 *  is for model-authored markdown; this is for human plain text. */
const URL_RE = /((?:https?:\/\/|www\.)[^\s<>()]+[^\s<>().,;:!?'"”’])/g;

export function linkifyText(text: string): React.ReactNode {
  const parts = text.split(URL_RE);
  if (parts.length === 1) return text;
  return parts.map((part, i) => {
    if (i % 2 === 1) {
      const href = part.startsWith("www.") ? `https://${part}` : part;
      return (
        <a
          key={i}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: "var(--neu-accent-deep)", textDecoration: "underline", wordBreak: "break-all" }}
        >
          {part}
        </a>
      );
    }
    return part;
  });
}

export function formatBytes(bytes: number | null | undefined): string {
  if (!bytes || bytes <= 0) return "";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** THE classify control — the row of kind pills the console rows AND the group
 *  info panel both compose (one expression, R-01). Picking the active kind is
 *  a no-op. */
export function KindPillRow({
  value,
  disabled = false,
  onPick,
}: {
  value: SiaGroupKind;
  disabled?: boolean;
  onPick: (kind: SiaGroupKind) => void;
}) {
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {KIND_ORDER.map((k) => {
        const active = value === k;
        return (
          <button
            key={k}
            type="button"
            disabled={disabled}
            onClick={() => !active && onPick(k)}
            className="serene-pressable type-caption rounded-full border-0"
            style={{
              padding: "3px 10px",
              background: active ? "var(--theme-accent)" : "var(--theme-paper-subtle)",
              color: active ? "var(--theme-accent-fg)" : "var(--theme-text-secondary)",
              fontWeight: active ? "var(--weight-medium)" : "var(--weight-normal)",
              cursor: disabled || active ? "default" : "pointer",
              transition:
                "background var(--duration-fast) var(--ease-in-out), color var(--duration-fast) var(--ease-in-out)",
            }}
          >
            {KIND_LABEL[k]}
          </button>
        );
      })}
    </div>
  );
}

/** The static kind pill (chat header + console rows). Unmapped reads as a
 *  gentle warning; mapped kinds take the accent surface. */
export function SiaKindPill({ kind }: { kind: SiaGroupKind }) {
  const unmapped = kind === "unmapped";
  return (
    <span
      className="shrink-0 rounded-full type-caption"
      style={{
        padding: "1px 10px",
        background: unmapped ? "var(--color-warning-light)" : "var(--theme-accent-surface)",
        color: unmapped ? "var(--color-warning-text)" : "var(--neu-accent-deep)",
        fontWeight: "var(--weight-medium)",
      }}
    >
      {KIND_LABEL[kind]}
    </span>
  );
}
