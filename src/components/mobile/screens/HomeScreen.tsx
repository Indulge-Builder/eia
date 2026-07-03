'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { HomeAppBar, GreetingBlock } from '../app-bars';
import { SearchPill } from '../fields';
import { RequestRow, VerticalTile } from '../content';
import { MobileDrawer } from '../MobileDrawer';
import { DEMO_PERSONA, DEMO_REQUESTS, DEMO_VERTICALS } from '../demo-data';

/**
 * Home (§06) — greeting, the verticals, what's in motion.
 * The mark (top-left) opens the drawer; the search pill hands the
 * ask to Elaya.
 */
export function HomeScreen() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const router = useRouter();

  return (
    <>
      <HomeAppBar onOpenDrawer={() => setDrawerOpen(true)} />

      <GreetingBlock
        dateLabel={DEMO_PERSONA.dateLabel}
        greeting={DEMO_PERSONA.greeting}
        line={DEMO_PERSONA.motionLine}
      />

      <SearchPill onClick={() => router.push('/m/elaya')} />

      <div className="grid grid-cols-2 gap-3">
        {DEMO_VERTICALS.map((v) => (
          <VerticalTile key={v.key} vertical={v} compact />
        ))}
      </div>

      <div className="flex items-center justify-between px-1 pt-0.5">
        <span
          className="text-[11px] font-semibold text-(--neu-text-secondary)"
          style={{ letterSpacing: '0.14em' }}
        >
          IN MOTION · {DEMO_REQUESTS.length}
        </span>
        <Link
          href="/m/requests"
          className="text-[11px] font-medium text-(--neu-accent-deep)"
        >
          View all
        </Link>
      </div>

      {DEMO_REQUESTS.slice(0, 2).map((r) => (
        <RequestRow key={r.ref} request={r} />
      ))}

      <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </>
  );
}
