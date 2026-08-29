// THE WhatsApp-text renderer — human chat text with WhatsApp's own formatting
// conventions: *bold*, _italic_, ~strike~, `inline code`, ```mono blocks```,
// plus bare-URL linkification. React nodes only — never dangerouslySetInnerHTML.
//
// NOT ChatMarkdown: that renders MODEL-authored markdown (**bold**, [text](url));
// this renders what PEOPLE typed into WhatsApp, where *single asterisks* mean
// bold. The two grammars conflict — never merge them.
//
// Display-only (A-06), server-component-safe (no hooks). Consumers:
// sia/SiaMessageBubble, whatsapp/MessageBubble.

import React from "react";

const URL_RE = /((?:https?:\/\/|www\.)[^\s<>()]+[^\s<>().,;:!?'"”’])/g;

/** Bare-URL linkification: http(s) and www. runs become anchors (new tab,
 *  noopener); everything else stays plain text. */
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

// Markers must hug non-space content and sit on word boundaries, so snake_case,
// math asterisks, and ~approximations~ of numbers don't trigger. Never spans a
// newline (WhatsApp's own rule).
const INLINE_MARKERS: {
  re: RegExp;
  wrap: (children: React.ReactNode, key: number) => React.ReactNode;
}[] = [
  {
    re: /(?<![\w*])\*([^\s*](?:[^*\n]*?[^\s*])?)\*(?![\w*])/,
    wrap: (c, k) => (
      <span key={k} style={{ fontWeight: "var(--weight-semibold)" }}>
        {c}
      </span>
    ),
  },
  {
    re: /(?<![\w_])_([^\s_](?:[^_\n]*?[^\s_])?)_(?![\w_])/,
    wrap: (c, k) => <em key={k}>{c}</em>,
  },
  {
    re: /(?<![\w~])~([^\s~](?:[^~\n]*?[^\s~])?)~(?![\w~])/,
    wrap: (c, k) => <s key={k}>{c}</s>,
  },
  {
    re: /`([^`\n]+)`/,
    wrap: (c, k) => (
      <code
        key={k}
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "0.9em",
          background: "var(--neu-well)",
          borderRadius: "4px",
          padding: "0 4px",
        }}
      >
        {c}
      </code>
    ),
  },
];

function renderInline(text: string, depth: number): React.ReactNode {
  if (!text) return null;
  if (depth > 3) return linkifyText(text);

  // Earliest marker wins; recurse into its inner content (WhatsApp nests, e.g.
  // *_bold italic_*) and into whatever follows it.
  let best: { index: number; length: number; inner: string; markerIdx: number } | null = null;
  for (let i = 0; i < INLINE_MARKERS.length; i++) {
    const match = INLINE_MARKERS[i].re.exec(text);
    if (match && (best === null || match.index < best.index)) {
      best = { index: match.index, length: match[0].length, inner: match[1], markerIdx: i };
    }
  }
  if (!best) return linkifyText(text);

  const before = text.slice(0, best.index);
  const after = text.slice(best.index + best.length);
  return (
    <>
      {before && linkifyText(before)}
      {INLINE_MARKERS[best.markerIdx].wrap(renderInline(best.inner, depth + 1), best.index)}
      {after && renderInline(after, depth)}
    </>
  );
}

/** Render one WhatsApp message body: ```mono blocks``` first, then the inline
 *  markers + links inside every other segment. */
export function renderWaText(text: string): React.ReactNode {
  const blocks = text.split(/```([\s\S]+?)```/);
  if (blocks.length === 1) return renderInline(text, 0);
  return blocks.map((seg, i) =>
    i % 2 === 1 ? (
      <code
        key={i}
        style={{
          display: "block",
          fontFamily: "var(--font-mono)",
          fontSize: "0.9em",
          background: "var(--neu-well)",
          borderRadius: "var(--radius-xs)",
          padding: "4px 8px",
          margin: "2px 0",
          whiteSpace: "pre-wrap",
        }}
      >
        {seg}
      </code>
    ) : (
      <React.Fragment key={i}>{renderInline(seg, 0)}</React.Fragment>
    ),
  );
}
