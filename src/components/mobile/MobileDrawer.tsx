'use client';

import { useEffect } from 'react';
import { AnimatePresence, m as motion } from 'framer-motion';
import {
  FileText,
  SlidersVertical,
  MessageCircle,
  LogOut,
  type LucideIcon,
} from 'lucide-react';
import { lockBodyScroll } from '@/lib/utils/scroll';
import { DEMO_PERSONA, DEMO_VERTICALS } from './demo-data';

/**
 * The drawer — everything else, behind the mark (§Navigation).
 * Panel 76% width, r 0 30 30 0, slide-in 380ms soft-out over a
 * blurred scrim; dismissed by scrim tap, row selection, or a
 * swipe left. Content: profile row · ROOMS · THE HOUSE · Sign out
 * in clay. No hamburger anywhere in the app — the company mark
 * (top-left knob) is the only door here.
 */

const SOFT_OUT = [0.22, 1, 0.36, 1] as const;

function TrackedLabel({ children }: { children: string }) {
  return (
    <span
      className="text-[10px] font-semibold text-(--neu-text-tertiary) px-2 pt-2"
      style={{ letterSpacing: '0.16em' }}
    >
      {children}
    </span>
  );
}

function DrawerRow({
  icon: Icon,
  iconToken,
  label,
  count,
  tile = false,
  onSelect,
}: {
  icon: LucideIcon;
  iconToken?: string;
  label: string;
  count?: number;
  tile?: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className="neu-m-touch-quiet flex items-center gap-3 min-h-11 px-2 rounded-[14px] text-left transition-colors active:bg-(--neu-accent-wash)"
    >
      <span
        className={`w-9 h-9 shrink-0 flex items-center justify-center ${
          tile ? 'rounded-xl bg-(--neu-surface-high)' : ''
        }`}
        style={{
          color: iconToken ?? 'var(--neu-text-secondary)',
          ...(tile ? { boxShadow: 'var(--neu-shadow-raised-sm)' } : {}),
        }}
      >
        <Icon size={15} strokeWidth={1.7} />
      </span>
      <span className="text-[13.5px] font-medium text-(--neu-text-primary)">{label}</span>
      {count !== undefined && (
        <span
          className="ml-auto text-xs text-(--neu-text-tertiary)"
          style={{ fontFamily: 'var(--font-serif)', fontWeight: 600 }}
        >
          {count}
        </span>
      )}
    </button>
  );
}

export function MobileDrawer({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    return lockBodyScroll();
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            onClick={onClose}
            className="absolute inset-0"
            style={{ background: 'var(--neu-m-scrim)', backdropFilter: 'blur(2px)' }}
          />
          <motion.div
            initial={{ x: '-105%' }}
            animate={{ x: 0 }}
            exit={{ x: '-105%' }}
            transition={{ duration: 0.38, ease: SOFT_OUT }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={{ left: 0.6, right: 0 }}
            onDragEnd={(_, info) => {
              if (info.offset.x < -60 || info.velocity.x < -400) onClose();
            }}
            className="absolute inset-y-0 left-0 w-[76%] max-w-[340px] bg-(--neu-surface) flex flex-col gap-2 px-3 pb-4"
            style={{
              borderRadius: '0 30px 30px 0',
              borderRight: '1px solid var(--neu-edge-strong)',
              boxShadow: 'var(--neu-m-drawer-shadow)',
              paddingTop: 'max(20px, env(safe-area-inset-top))',
            }}
            role="dialog"
            aria-label="The rest of the house"
          >
            {/* Profile row */}
            <div className="flex items-center gap-3 px-2 pb-2">
              <span
                className="w-[38px] h-[38px] shrink-0 rounded-full bg-(--neu-surface-high) border border-(--neu-edge-strong) flex items-center justify-center text-xs font-semibold text-(--neu-accent-deep)"
                style={{ boxShadow: 'var(--neu-shadow-raised-sm)' }}
              >
                {DEMO_PERSONA.initials}
              </span>
              <span className="flex flex-col">
                <span className="text-[13.5px] font-semibold text-(--neu-text-primary)">
                  {DEMO_PERSONA.name}
                </span>
                <span className="text-[11px] text-(--neu-text-tertiary)">
                  {DEMO_PERSONA.email}
                </span>
              </span>
            </div>

            <div className="h-px bg-(--neu-m-hairline)" />

            <TrackedLabel>ROOMS</TrackedLabel>
            {DEMO_VERTICALS.map((v) => (
              <DrawerRow
                key={v.key}
                icon={v.icon}
                iconToken={v.iconToken}
                label={v.label}
                count={v.drawerCount}
                tile
                onSelect={onClose}
              />
            ))}

            <TrackedLabel>THE HOUSE</TrackedLabel>
            <DrawerRow icon={FileText} label="Documents" onSelect={onClose} />
            <DrawerRow icon={SlidersVertical} label="Preferences" onSelect={onClose} />
            <DrawerRow icon={MessageCircle} label="Reach the house" onSelect={onClose} />

            {/* Footer — sign out in clay, never red; drawer-only */}
            <div className="mt-auto flex flex-col gap-2">
              <div className="h-px bg-(--neu-m-hairline)" />
              <button
                onClick={onClose}
                className="neu-m-touch-quiet flex items-center gap-3 min-h-11 px-2 rounded-[14px] text-left transition-colors active:bg-(--color-danger-light)"
              >
                <span className="w-9 h-9 shrink-0 flex items-center justify-center text-(--neu-danger-deep)">
                  <LogOut size={15} strokeWidth={1.7} />
                </span>
                <span className="text-[13.5px] font-medium text-(--neu-danger-deep)">
                  Sign out
                </span>
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
