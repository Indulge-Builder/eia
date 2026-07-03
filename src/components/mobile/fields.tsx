import type { InputHTMLAttributes, TextareaHTMLAttributes, ReactNode } from 'react';
import { Search, ChevronDown } from 'lucide-react';

/**
 * Mobile floating fields (§03 Fields). Every field FLOATS — the
 * gradient sheen + inner top highlight (--neu-input-bg +
 * --neu-shadow-input), never a sunken well, never a tinted surface.
 * Search pill 48 · text field 52 r18 · select row 52. Labels are
 * tracked caps 11/600 above the field.
 */

const FIELD_CHROME = {
  background: 'var(--neu-input-bg)',
  border: '1px solid var(--neu-input-edge)',
  boxShadow: 'var(--neu-shadow-input)',
} as const;

export function FieldLabel({ children }: { children: string }) {
  return (
    <label
      className="text-[11px] font-semibold text-(--neu-text-secondary) pl-1"
      style={{ letterSpacing: '0.12em' }}
    >
      {children}
    </label>
  );
}

/**
 * The search pill — cream surface, never tinted; accent lives only
 * on the search glyph (accent-deep) and the trailing ✦ (accent).
 */
export function SearchPill({
  placeholder = 'Ask for anything…',
  onClick,
}: {
  placeholder?: string;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="neu-m-touch flex items-center gap-2.5 h-12 px-4 rounded-full w-full text-left"
      style={FIELD_CHROME}
    >
      <Search size={15} strokeWidth={1.7} className="shrink-0 text-(--neu-accent-deep)" />
      <span className="flex-1 text-[13.5px] text-(--neu-text-tertiary)">{placeholder}</span>
      <span className="shrink-0 text-sm text-(--neu-accent)">✦</span>
    </button>
  );
}

export function MobileTextField({
  label,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { label?: string }) {
  return (
    <div className="flex flex-col gap-[7px]">
      {label && <FieldLabel>{label}</FieldLabel>}
      <input
        {...rest}
        className="neu-input h-13 px-4 rounded-[18px] w-full text-sm text-(--neu-text-primary) outline-none placeholder:text-(--neu-text-tertiary)"
        style={FIELD_CHROME}
      />
    </div>
  );
}

export function MobileTextArea({
  label,
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string }) {
  return (
    <div className="flex flex-col gap-[7px]">
      {label && <FieldLabel>{label}</FieldLabel>}
      <textarea
        {...rest}
        className="neu-input px-4 py-3.5 rounded-[18px] w-full text-[13.5px] leading-normal text-(--neu-text-primary) resize-none outline-none placeholder:text-(--neu-text-tertiary)"
        style={FIELD_CHROME}
      />
    </div>
  );
}

/** Floating select-style row — 52 high, value + chevron. */
export function SelectRow({
  label,
  children,
  onClick,
}: {
  label?: string;
  children: ReactNode;
  onClick?: () => void;
}) {
  return (
    <div className="flex flex-col gap-[7px]">
      {label && <FieldLabel>{label}</FieldLabel>}
      <button
        onClick={onClick}
        className="neu-m-touch flex items-center justify-between h-13 px-4 rounded-[18px] w-full text-sm text-(--neu-text-primary) text-left"
        style={FIELD_CHROME}
      >
        {children}
        <ChevronDown size={14} strokeWidth={2} className="shrink-0 text-(--neu-text-secondary)" />
      </button>
    </div>
  );
}
