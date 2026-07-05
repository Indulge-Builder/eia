'use client';

import { createContext, useContext } from 'react';
import type { AppDomain, UserRole } from '@/lib/types/database';

/**
 * Mobile session context (mobile-ops.md §5). The (client)/layout.tsx RSC
 * fetches the profile once for its auth gate and threads the slim
 * identity here so the tab bar (role) and every screen (role + domain
 * scope) can read it without re-fetching. No service import in a client
 * file (A-15) — the RSC does the read.
 */

export type MobileSession = {
  id: string;
  role: UserRole;
  domain: AppDomain;
  fullName: string;
  email: string;
};

const MobileSessionContext = createContext<MobileSession | null>(null);

export function MobileSessionProvider({
  session,
  children,
}: {
  session: MobileSession;
  children: React.ReactNode;
}) {
  return (
    <MobileSessionContext.Provider value={session}>{children}</MobileSessionContext.Provider>
  );
}

export function useMobileSession(): MobileSession {
  const session = useContext(MobileSessionContext);
  if (!session) {
    throw new Error('useMobileSession must be used inside <MobileSessionProvider>');
  }
  return session;
}
