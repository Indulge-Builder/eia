'use client';

import { useCallback, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { useMountOnFirstOpen } from '@/hooks/useMountOnFirstOpen';
import type { PaletteProfile } from '@/components/ui/CommandPalette';

/**
 * CommandPaletteProvider — the global ⌘K / Ctrl-K listener (polish §01).
 *
 * Mounted ONCE in the dashboard layout (beside ToastProvider). The palette
 * chunk loads on first open (Heavy-modal rule G-1 via useMountOnFirstOpen —
 * the palette owns its exit animation, so it stays mounted after that).
 * The shortcut is ignored while typing ⌘K would conflict — it isn't: the
 * palette is a global surface, so it opens from anywhere, including inputs
 * (matching every ⌘K product convention).
 */

const CommandPalette = dynamic(
  () => import('@/components/ui/CommandPalette').then((m) => m.CommandPalette),
  { ssr: false },
);

export function CommandPaletteProvider({ profile }: { profile: PaletteProfile }) {
  const [open, setOpen] = useState(false);
  const hasOpened = useMountOnFirstOpen(open);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const close = useCallback(() => setOpen(false), []);

  if (!hasOpened) return null;
  return <CommandPalette open={open} onClose={close} profile={profile} />;
}
