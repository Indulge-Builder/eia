'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { AnimatePresence, m as motion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
import { lockBodyScroll } from '@/lib/utils/scroll';
import { FilterChip } from './controls';
import { MobileTextArea } from './fields';
import { DEMO_VERTICALS } from './demo-data';

/**
 * Mobile overlays (§05). Bottom sheet rises 420ms soft-out over the
 * blurred scrim, top radius 30, grabber 44×5 inside a 44 touch zone.
 * Action sheet: tracked context title, 54 rows with accent-wash
 * press, destructive in clay (never red), cancel as its own raised
 * pill below. Drawer + sheet + action sheet are mutually exclusive —
 * callers hold one open flag at a time.
 */

const SOFT_OUT = [0.22, 1, 0.36, 1] as const;

function Scrim({ onClose }: { onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.22 }}
      onClick={onClose}
      className="absolute inset-0"
      style={{ background: 'var(--neu-m-scrim)', backdropFilter: 'blur(2px)' }}
    />
  );
}

export function MobileBottomSheet({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    return lockBodyScroll();
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50">
          <Scrim onClose={onClose} />
          <motion.div
            initial={{ y: '105%' }}
            animate={{ y: 0 }}
            exit={{ y: '105%' }}
            transition={{ duration: 0.42, ease: SOFT_OUT }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 60 || info.velocity.y > 400) onClose();
            }}
            className="absolute inset-x-0 bottom-0 mx-auto max-w-[430px] bg-(--neu-surface) flex flex-col gap-3 px-5"
            style={{
              borderRadius: '30px 30px 0 0',
              borderTop: '1px solid var(--neu-input-edge)',
              boxShadow: 'var(--neu-m-sheet-shadow)',
              paddingBottom: 'max(20px, env(safe-area-inset-bottom))',
            }}
            role="dialog"
          >
            {/* Grabber — 44×5 pill inside a 44px touch zone */}
            <button
              onClick={onClose}
              aria-label="Dismiss"
              className="self-center px-[30px] py-2.5 cursor-pointer"
            >
              <span className="block w-11 h-[5px] rounded-full bg-(--neu-m-grabber)" />
            </button>
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

/** The NEW REQUEST sheet — one sheet for every ask. */
export function NewRequestSheet({
  open,
  onClose,
  onPlace,
}: {
  open: boolean;
  onClose: () => void;
  onPlace: () => void;
}) {
  const [vertical, setVertical] = useState(0);
  return (
    <MobileBottomSheet open={open} onClose={onClose}>
      <div className="flex flex-col gap-0.5">
        <span
          className="text-[10px] font-semibold text-(--neu-accent-deep)"
          style={{ letterSpacing: '0.16em' }}
        >
          NEW REQUEST
        </span>
        <span
          className="text-[19px] font-semibold text-(--neu-text-primary)"
          style={{ fontFamily: 'var(--font-serif)' }}
        >
          How may we help?
        </span>
      </div>
      <div className="flex gap-1.5 overflow-x-auto">
        {DEMO_VERTICALS.map((v, i) => (
          <FilterChip
            key={v.key}
            label={v.label}
            selected={i === vertical}
            onToggle={() => setVertical(i)}
          />
        ))}
      </div>
      <MobileTextArea
        rows={2}
        placeholder="Describe it in a line — we'll take it from there…"
      />
      <button
        onClick={onPlace}
        className="neu-m-touch h-13 rounded-full border border-(--neu-accent-btn-edge) text-sm font-semibold text-(--neu-accent-fg)"
        style={{ background: 'var(--neu-accent-gradient)', boxShadow: 'var(--neu-shadow-raised)' }}
      >
        Place request
      </button>
    </MobileBottomSheet>
  );
}

export type ActionSheetItem = {
  label: string;
  icon: LucideIcon;
  destructive?: boolean;
  onSelect?: () => void;
};

export function MobileActionSheet({
  open,
  onClose,
  title,
  items,
  cancelLabel = 'Not now',
}: {
  open: boolean;
  onClose: () => void;
  /** tracked-caps context title, e.g. "GULFSTREAM — NICE → RIYADH" */
  title: string;
  items: ActionSheetItem[];
  cancelLabel?: string;
}) {
  useEffect(() => {
    if (!open) return;
    return lockBodyScroll();
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50">
          <Scrim onClose={onClose} />
          <motion.div
            initial={{ y: '105%' }}
            animate={{ y: 0 }}
            exit={{ y: '105%' }}
            transition={{ duration: 0.42, ease: SOFT_OUT }}
            className="absolute inset-x-0 bottom-0 mx-auto max-w-[430px] flex flex-col gap-2.5 px-4"
            style={{ paddingBottom: 'max(20px, env(safe-area-inset-bottom))' }}
            role="dialog"
          >
            <div
              className="rounded-3xl bg-(--neu-surface) border border-(--neu-edge-strong) overflow-hidden"
              style={{ boxShadow: 'var(--neu-shadow-raised-lg)' }}
            >
              <div className="px-5 pt-3.5 pb-2.5 text-center">
                <span
                  className="text-[11px] font-semibold text-(--neu-text-tertiary)"
                  style={{ letterSpacing: '0.12em' }}
                >
                  {title}
                </span>
              </div>
              <div className="h-px bg-(--neu-m-hairline)" />
              {items.map((item, i) => {
                const Icon = item.icon;
                return (
                  <div key={item.label}>
                    {i > 0 && <div className="h-px mx-5 bg-(--neu-m-hairline) opacity-60" />}
                    <button
                      onClick={() => {
                        item.onSelect?.();
                        onClose();
                      }}
                      className="neu-m-touch-quiet flex items-center gap-3 h-[54px] px-5 w-full text-left transition-colors active:bg-(--neu-accent-wash)"
                    >
                      <Icon
                        size={15}
                        strokeWidth={1.7}
                        className={
                          item.destructive
                            ? 'text-(--neu-danger-deep)'
                            : 'text-(--neu-text-secondary)'
                        }
                      />
                      <span
                        className={`text-sm font-medium ${
                          item.destructive
                            ? 'text-(--neu-danger-deep)'
                            : 'text-(--neu-text-primary)'
                        }`}
                      >
                        {item.label}
                      </span>
                    </button>
                  </div>
                );
              })}
            </div>
            <button
              onClick={onClose}
              className="neu-m-touch h-[54px] rounded-full bg-(--neu-surface) border border-(--neu-edge-strong) text-sm font-semibold text-(--neu-text-primary)"
              style={{ boxShadow: 'var(--neu-shadow-raised-lg)' }}
            >
              {cancelLabel}
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
