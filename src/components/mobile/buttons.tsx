import type { ReactNode, ButtonHTMLAttributes } from 'react';

/**
 * Mobile button set (design_handoff_mobile_system §03 Buttons).
 * Touch scale is law: primary 56 · secondary 52 · quiet 44 · FAB 60 ·
 * icon knob 48/44 (44 is the floor — nothing touchable is smaller).
 * Press behaviour comes from the .neu-m-touch / .neu-m-touch-knob
 * recipe classes (serene-mobile.css).
 */

type MobileButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'quiet';
  children: ReactNode;
};

export function MobileButton({
  variant = 'primary',
  children,
  className = '',
  style,
  ...rest
}: MobileButtonProps) {
  if (variant === 'quiet') {
    return (
      <button
        {...rest}
        className={`neu-m-touch-quiet h-11 rounded-full bg-transparent border-none text-[13.5px] font-medium text-(--neu-text-secondary) ${className}`}
        style={style}
      >
        {children}
      </button>
    );
  }
  const isPrimary = variant === 'primary';
  return (
    <button
      {...rest}
      className={`neu-m-touch rounded-full flex items-center justify-center ${
        isPrimary
          ? 'h-14 border border-(--neu-accent-btn-edge) text-[15px] font-semibold text-(--neu-accent-fg)'
          : 'h-13 bg-(--neu-surface) border border-(--neu-edge) text-sm font-medium text-(--neu-text-primary)'
      } ${className}`}
      style={{
        ...(isPrimary
          ? { background: 'var(--neu-accent-gradient)' }
          : {}),
        boxShadow: 'var(--neu-shadow-raised)',
        ...style,
      }}
    >
      {children}
    </button>
  );
}

/** Circular raised icon knob — 44Ø floor, 48Ø default for standalone use. */
export function IconKnob({
  size = 44,
  children,
  className = '',
  accent = false,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  size?: number;
  accent?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      {...rest}
      className={`neu-m-touch-knob shrink-0 rounded-full bg-(--neu-surface) border border-(--neu-edge) flex items-center justify-center ${
        accent ? 'text-(--neu-accent-deep)' : 'text-(--neu-text-secondary)'
      } ${className}`}
      style={{ width: size, height: size, boxShadow: 'var(--neu-shadow-raised-sm)' }}
    >
      {children}
    </button>
  );
}

/** Accent-gradient FAB — 60Ø, dark ink glyph. */
export function Fab({
  children,
  className = '',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode }) {
  return (
    <button
      {...rest}
      className={`neu-m-touch-knob shrink-0 w-15 h-15 rounded-full border border-(--neu-accent-btn-edge) flex items-center justify-center text-(--neu-accent-fg) ${className}`}
      style={{
        background: 'var(--neu-accent-gradient)',
        boxShadow: '4px 4px 10px rgb(var(--neu-dark) / 0.32), -3px -3px 8px rgb(var(--neu-light) / 0.72)',
      }}
    >
      {children}
    </button>
  );
}

/** Sticky footer pair — quiet flex 1 / primary flex 1.6 (README §Buttons). */
export function StickyButtonPair({
  quietLabel,
  primaryLabel,
  onQuiet,
  onPrimary,
}: {
  quietLabel: string;
  primaryLabel: string;
  onQuiet?: () => void;
  onPrimary?: () => void;
}) {
  return (
    <div className="flex gap-3">
      <button
        onClick={onQuiet}
        className="neu-m-touch flex-1 h-13 rounded-full bg-(--neu-surface) border border-(--neu-edge) text-sm font-medium text-(--neu-text-secondary)"
        style={{ boxShadow: 'var(--neu-shadow-raised)' }}
      >
        {quietLabel}
      </button>
      <button
        onClick={onPrimary}
        className="neu-m-touch flex-[1.6] h-13 rounded-full border border-(--neu-accent-btn-edge) text-sm font-semibold text-(--neu-accent-fg)"
        style={{ background: 'var(--neu-accent-gradient)', boxShadow: 'var(--neu-shadow-raised)' }}
      >
        {primaryLabel}
      </button>
    </div>
  );
}
