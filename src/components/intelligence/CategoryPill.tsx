'use client';

// Call Intelligence — single category filter pill (helpdesk filter row).
// Single-select: the parent owns activeCategory state. Active = accent wash
// float (neumorphic selection grammar — never a solid fill, never inset).
// Press feedback is the CSS .serene-pressable mechanism (never a second Framer
// whileTap); flexShrink: 0 keeps the pill intact in FilterBar's mobile
// scroll row.

type CategoryPillProps = {
  label:   string;
  active:  boolean;
  onClick: () => void;
};

export function CategoryPill({ label, active, onClick }: CategoryPillProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="serene-pressable serene-touch"
      style={{
        padding:       '6px 14px',
        borderRadius:  'var(--radius-full)',
        border:        '1px solid var(--neu-edge)',
        background:    active ? 'color-mix(in srgb, var(--theme-accent) 12%, var(--neu-surface))' : 'var(--neu-surface)',
        boxShadow:     active ? 'var(--neu-shadow-chip)' : 'none',
        color:         active ? 'var(--neu-accent-deep)' : 'var(--theme-text-secondary)',
        fontFamily:    'var(--font-sans)',
        fontSize:      'var(--text-xs)',
        fontWeight:    active ? 'var(--weight-medium)' : 'var(--weight-normal)',
        letterSpacing: 'var(--tracking-wide)',
        whiteSpace:    'nowrap',
        flexShrink:    0,
        cursor:        'pointer',
        transition:
          'background var(--duration-fast) var(--ease-in-out), color var(--duration-fast) var(--ease-in-out), box-shadow var(--duration-fast) var(--ease-in-out)',
      }}
    >
      {label}
    </button>
  );
}
