'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { m as motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Sparkles,
  Plus,
  CheckSquare,
  NotebookPen,
  UserRound,
  Trophy,
  ArrowRight,
  type LucideIcon,
} from 'lucide-react';
import {
  PALETTE_DURATION,
  EASE_SPRING,
  EASE_IN_OUT,
  FAST_DURATION,
} from '@/lib/constants/motion';
import { useDebounce } from '@/hooks/useDebounce';
import { lockBodyScroll } from '@/lib/utils/scroll';
import { canAccessRoute } from '@/lib/utils/route-access';
import { LEAD_STATUS_LABELS } from '@/lib/constants/lead-statuses';
import { TASK_STATUS } from '@/lib/constants/task-constants';
import { formatCurrency } from '@/lib/utils/numbers';
import { paletteSearchAction, type PaletteSearchResult } from '@/lib/actions/search';
import type { UserRole, AppDomain, LeadStatus, TaskStatus } from '@/lib/types/database';

/**
 * CommandPalette — ⌘K (polish handoff §01).
 *
 * 640px neumorphic panel over a charcoal scrim with blur(3px) — the palette
 * is one of the SANCTIONED backdrop-blur surfaces. Rises 320ms spring-out.
 * Groups: Actions · live entity results (leads/deals/tasks via
 * paletteSearchAction, debounced) · Go to (pages the caller can access).
 * Keyboard: ↑↓ move, ↵ runs, esc closes; hover moves the selection. Active
 * row = accent color-mix wash (selection floats, never inset).
 *
 * Mounted once by CommandPaletteProvider (dashboard layout) — never mount a
 * second instance.
 */

export type PaletteProfile = { id: string; role: UserRole; domain: AppDomain };

export interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  profile: PaletteProfile;
}

type PaletteItem = {
  key: string;
  icon: LucideIcon;
  label: string;
  hint: string;
  href: string;
};

const ACTION_ITEMS: (PaletteItem & { requiresRoute: string })[] = [
  { key: 'act-elaya', icon: Sparkles,    label: 'Ask Elaya', hint: 'Action', href: '/elaya', requiresRoute: '/elaya' },
  { key: 'act-lead',  icon: Plus,        label: 'New lead',  hint: 'Action', href: '/leads', requiresRoute: '/leads' },
  { key: 'act-task',  icon: CheckSquare, label: 'New task',  hint: 'Action', href: '/tasks', requiresRoute: '/tasks' },
  { key: 'act-note',  icon: NotebookPen, label: 'New note',  hint: 'Action', href: '/notes', requiresRoute: '/notes' },
];

const GOTO_PAGES: { href: string; label: string; roles?: UserRole[] }[] = [
  { href: '/dashboard',   label: 'Dashboard' },
  { href: '/leads',       label: 'Leads' },
  { href: '/deals',       label: 'Deals' },
  { href: '/campaigns',   label: 'Campaigns' },
  { href: '/tasks',       label: 'Tasks' },
  { href: '/performance', label: 'Performance' },
  { href: '/whatsapp',    label: 'WhatsApp' },
  { href: '/helpdesk',    label: 'Helpdesk' },
  { href: '/escalations', label: 'Escalations', roles: ['manager', 'admin', 'founder'] },
  { href: '/budget',      label: 'Budget',      roles: ['admin', 'founder'] },
  { href: '/elaya',       label: 'Elaya' },
  { href: '/notes',       label: 'Notes' },
  { href: '/settings',    label: 'Settings',    roles: ['admin', 'founder'] },
  { href: '/profile',     label: 'Profile' },
];

const EMPTY_RESULTS: PaletteSearchResult = { leads: [], deals: [], tasks: [] };

// kbd chip recipe (handoff §01) — reused for esc + footer hints.
const kbdChipStyle: React.CSSProperties = {
  fontSize:     '10px',
  fontWeight:   'var(--weight-semibold)' as React.CSSProperties['fontWeight'],
  padding:      '3px 8px',
  borderRadius: '7px',
  background:   'var(--neu-well)',
  boxShadow:
    'inset 1px 1px 3px rgb(var(--neu-dark) / 0.3), inset -1px -1px 3px rgb(var(--neu-light) / 0.7)',
  color:        'var(--theme-text-secondary)',
  lineHeight:   1,
  whiteSpace:   'nowrap',
};

const hairline: React.CSSProperties = {
  height:     '1px',
  background: 'rgb(var(--neu-dark) / 0.18)',
  flexShrink: 0,
};

export function CommandPalette({ open, onClose, profile }: CommandPaletteProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [mounted, setMounted] = useState(false);
  const [query, setQuery] = useState('');
  const [sel, setSel] = useState(0);
  const [results, setResults] = useState<PaletteSearchResult>(EMPTY_RESULTS);
  const [searching, setSearching] = useState(false);
  const debounced = useDebounce(query, 250);

  useEffect(() => setMounted(true), []);

  // Reset + focus + scroll lock per open
  useEffect(() => {
    if (!open) return;
    setQuery('');
    setSel(0);
    setResults(EMPTY_RESULTS);
    const unlock = lockBodyScroll();
    const t = setTimeout(() => inputRef.current?.focus(), 30);
    return () => {
      unlock();
      clearTimeout(t);
    };
  }, [open]);

  // Debounced entity search — stale responses discarded by query echo.
  useEffect(() => {
    if (!open) return;
    const q = debounced.trim();
    if (q.length < 2) {
      setResults(EMPTY_RESULTS);
      setSearching(false);
      return;
    }
    let cancelled = false;
    setSearching(true);
    paletteSearchAction({ query: q })
      .then((res) => {
        if (cancelled) return;
        setResults(res.data ?? EMPTY_RESULTS);
        setSearching(false);
      })
      .catch(() => {
        if (cancelled) return;
        setResults(EMPTY_RESULTS);
        setSearching(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debounced, open]);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();

    const actions = ACTION_ITEMS.filter(
      (a) =>
        canAccessRoute(profile, a.requiresRoute) &&
        (!q || a.label.toLowerCase().includes(q)),
    );

    const leads: PaletteItem[] = results.leads.map((l) => ({
      key: `lead-${l.id}`,
      icon: UserRound,
      label: l.name,
      hint: LEAD_STATUS_LABELS[l.status as LeadStatus] ?? l.status,
      href: `/leads/${l.slug ?? l.id}`,
    }));

    const deals: PaletteItem[] = results.deals.map((d) => ({
      key: `deal-${d.id}`,
      icon: Trophy,
      label: d.name,
      hint: formatCurrency(d.amount),
      href: d.leadSlug || d.leadId ? `/leads/${d.leadSlug ?? d.leadId}` : '/deals',
    }));

    const tasks: PaletteItem[] = results.tasks.map((t) => ({
      key: `task-${t.id}`,
      icon: CheckSquare,
      label: t.title,
      hint: TASK_STATUS[t.status as TaskStatus]?.label ?? t.status,
      href: '/tasks?tab=personal',
    }));

    const goto: PaletteItem[] = GOTO_PAGES.filter(
      (p) =>
        (!p.roles || p.roles.includes(profile.role)) &&
        canAccessRoute(profile, p.href) &&
        (!q || p.label.toLowerCase().includes(q)),
    ).map((p) => ({
      key: `goto-${p.href}`,
      icon: ArrowRight,
      label: p.label,
      hint: 'Page',
      href: p.href,
    }));

    return [
      { name: 'Actions', items: actions as PaletteItem[] },
      { name: 'Leads', items: leads },
      { name: 'Deals', items: deals },
      { name: 'Tasks', items: tasks },
      { name: 'Go to', items: goto },
    ].filter((g) => g.items.length > 0);
  }, [query, results, profile]);

  const flat = useMemo(() => groups.flatMap((g) => g.items), [groups]);

  // Typing filters and resets the selection to the top.
  useEffect(() => setSel(0), [query, results]);

  const runItem = useCallback(
    (item: PaletteItem) => {
      onClose();
      router.push(item.href);
    },
    [onClose, router],
  );

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSel((s) => Math.min(flat.length - 1, s + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSel((s) => Math.max(0, s - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const item = flat[sel];
      if (item) runItem(item);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  }

  if (!mounted || typeof document === 'undefined') return null;

  let flatIndex = -1;

  return createPortal(
    <AnimatePresence>
      {open && (
        <div
          key="serene-command-palette"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 'var(--z-modal)' as React.CSSProperties['zIndex'],
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'flex-start',
          }}
        >
          {/* Scrim — charcoal wash + blur(3px); the palette is a SANCTIONED
              backdrop-blur surface (CLAUDE.md Never-Do list carve-out). */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: FAST_DURATION, ease: EASE_IN_OUT }}
            onClick={onClose}
            style={{
              position: 'absolute',
              inset: 0,
              background: 'var(--neu-palette-scrim)',
              backdropFilter: 'blur(3px)',
              WebkitBackdropFilter: 'blur(3px)',
            }}
          />

          {/* Panel — 640px, radius 28, floating shadow, 320ms spring rise */}
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Command palette"
            initial={{ opacity: 0, y: 10, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.99, transition: { duration: FAST_DURATION, ease: EASE_IN_OUT } }}
            transition={{ duration: PALETTE_DURATION, ease: EASE_SPRING }}
            style={{
              position: 'relative',
              marginTop: 'clamp(48px, 12dvh, 96px)',
              width: '640px',
              maxWidth: 'calc(100% - var(--space-6) * 2)',
              borderRadius: 'var(--neu-radius-panel)',
              // Mode-aware: surface + floating shadow in light; surface-high +
              // modal-class shadow in dark (design_handoff_dark_mode §palette).
              background: 'var(--neu-palette-bg)',
              border: '1px solid var(--neu-edge)',
              boxShadow: 'var(--neu-palette-shadow)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* Input row */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-3)',
                padding: '18px 22px',
              }}
            >
              <Search
                style={{ width: 16, height: 16, strokeWidth: 1.5, color: 'var(--theme-text-tertiary)', flexShrink: 0 }}
              />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Search leads, actions, pages…"
                aria-label="Search leads, actions, pages"
                className="serene-input-bare"
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  fontFamily: 'var(--font-sans)',
                  fontSize: '15px',
                  color: 'var(--theme-text-primary)',
                  caretColor: 'var(--theme-accent)',
                }}
              />
              <span style={kbdChipStyle}>esc</span>
            </div>

            <div style={hairline} />

            {/* Results */}
            <div
              style={{
                maxHeight: '300px',
                overflowY: 'auto',
                padding: '10px',
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--space-2)',
              }}
            >
              {groups.map((g) => (
                <div key={g.name} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <div
                    style={{
                      fontSize: '10px',
                      fontWeight: 'var(--weight-semibold)' as React.CSSProperties['fontWeight'],
                      letterSpacing: '0.16em',
                      textTransform: 'uppercase',
                      color: 'var(--theme-text-tertiary)',
                      padding: '6px 12px 4px',
                    }}
                  >
                    {g.name}
                  </div>
                  {g.items.map((item) => {
                    flatIndex += 1;
                    const idx = flatIndex;
                    const active = idx === sel;
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => runItem(item)}
                        onMouseEnter={() => setSel(idx)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 'var(--space-3)',
                          padding: '9px 12px',
                          borderRadius: 'var(--neu-radius-chip)',
                          border: 'none',
                          cursor: 'pointer',
                          textAlign: 'left',
                          width: '100%',
                          // Selection FLOATS via the accent wash — never inset.
                          background: active
                            ? 'color-mix(in srgb, var(--neu-accent) 16%, transparent)'
                            : 'transparent',
                          transition: 'background 160ms var(--ease-in-out)',
                        }}
                      >
                        <span
                          aria-hidden="true"
                          style={{
                            width: '26px',
                            height: '26px',
                            borderRadius: '9px',
                            background: 'var(--neu-canvas)',
                            boxShadow:
                              'inset 1px 1px 3px rgb(var(--neu-dark) / 0.25), inset -1px -1px 3px rgb(var(--neu-light) / 0.65)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'var(--neu-accent-deep)',
                            flexShrink: 0,
                          }}
                        >
                          <Icon style={{ width: 13, height: 13, strokeWidth: 1.5 }} />
                        </span>
                        <span
                          style={{
                            flex: 1,
                            fontFamily: 'var(--font-sans)',
                            fontSize: 'var(--text-sm)',
                            color: 'var(--theme-text-primary)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {item.label}
                        </span>
                        <span
                          style={{
                            fontSize: '11px',
                            color: 'var(--theme-text-tertiary)',
                            flexShrink: 0,
                          }}
                        >
                          {item.hint}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ))}

              {flat.length === 0 && (
                <div
                  style={{
                    padding: '22px 12px',
                    textAlign: 'center',
                    fontFamily: 'var(--font-serif)',
                    fontStyle: 'italic',
                    fontSize: 'var(--text-sm)',
                    color: 'var(--theme-text-tertiary)',
                  }}
                >
                  {searching ? 'Looking…' : 'Nothing matches — Elaya can look wider.'}
                </div>
              )}
            </div>

            <div style={hairline} />

            {/* Footer hints */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-4)',
                padding: '11px 20px',
                fontFamily: 'var(--font-sans)',
                fontSize: '11px',
                color: 'var(--theme-text-tertiary)',
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <span style={kbdChipStyle}>↑↓</span> navigate
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <span style={kbdChipStyle}>↵</span> open
              </span>
              <span style={{ flex: 1 }} />
              <span style={{ color: 'var(--neu-accent-deep)', fontWeight: 'var(--weight-medium)' as React.CSSProperties['fontWeight'] }}>
                {searching ? 'Searching…' : ''}
              </span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
