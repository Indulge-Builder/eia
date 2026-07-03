import type { CSSProperties, ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

type Props = {
  icon: LucideIcon;
  label: string;
  /** Optional right-hand slot — callers own its layout (e.g. marginLeft: 'auto'). */
  right?: ReactNode;
  /** Merged over the header strip (LeadNotesInput's accent-surface variant). */
  style?: CSSProperties;
  /** Merged over the icon (PersonalDetailsCard's active accent colour). */
  iconStyle?: CSSProperties;
  /** Merged over the micro-label (LeadNotesInput's accent label). */
  labelStyle?: CSSProperties;
};

/**
 * THE dossier card-header strip (DRY extraction, 2026-06-20 audit D3).
 * Flex row: Lucide icon (0.875rem) + uppercase micro-label + optional right
 * slot on the THEMED header wash — --neu-header-wash (22% accent into the
 * surface; the 12% --theme-accent-surface tint read washed-out) closed by
 * the --neu-header-edge hairline. Headers are the theme-coloured zone of a
 * card; tune the intensity in serene-neumorphic-tokens.css ONLY.
 * Never repaint the strip with --theme-paper-subtle (the sunken well tone,
 * inset marks state only — neu Rule 4) or theme-invariant grey text.
 * Display-only (A-06); server-component-safe.
 */
export function CardHeader({ icon: Icon, label, right, style, iconStyle, labelStyle }: Props) {
  return (
    <div
      style={{
        display:      'flex',
        alignItems:   'center',
        gap:          'var(--space-2)',
        padding:      'var(--space-4) var(--space-5)',
        borderBottom: '1px solid var(--neu-header-edge)',
        background:   'var(--neu-header-wash)',
        ...style,
      }}
    >
      <Icon
        style={{
          width:       '0.875rem',
          height:      '0.875rem',
          color:       'var(--theme-accent)',
          strokeWidth: 1.5,
          flexShrink:  0,
          ...iconStyle,
        }}
      />
      <span className="label-micro" style={{ color: 'var(--theme-accent)', ...labelStyle }}>
        {label}
      </span>
      {right}
    </div>
  );
}
