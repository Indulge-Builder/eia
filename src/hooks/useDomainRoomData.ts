'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { GiaDomain } from '@/lib/constants/domains';

/**
 * useDomainRoomData — THE mobile-room per-domain data lifecycle
 * (mobile-ops.md §7): the RSC seeds the first domain, swiping to an
 * unloaded domain fetches it once through the room's server action,
 * results are kept per domain so swiping back is instant.
 *
 * `fetchDomain` must be referentially stable (wrap in useCallback at the
 * call site) — it is an effect dependency.
 */

export type DomainFetchResult<T> = { data: T | null; error: string | null };

export function useDomainRoomData<T>({
  initialDomain,
  seed,
  fetchDomain,
  enabled = true,
}: {
  initialDomain: GiaDomain;
  seed: T | null;
  fetchDomain: (domain: GiaDomain) => Promise<DomainFetchResult<T>>;
  /** false when the caller has no swipeable domains (stubbed role) — no fetches fire */
  enabled?: boolean;
}) {
  const [activeDomain, setActiveDomain] = useState<GiaDomain>(initialDomain);
  const [data, setData] = useState<Partial<Record<GiaDomain, T>>>(() =>
    seed !== null ? ({ [initialDomain]: seed } as Partial<Record<GiaDomain, T>>) : {},
  );
  const [errors, setErrors] = useState<Partial<Record<GiaDomain, string>>>({});
  const inFlight = useRef<Set<GiaDomain>>(new Set());

  const load = useCallback(
    async (domain: GiaDomain) => {
      if (inFlight.current.has(domain)) return;
      inFlight.current.add(domain);
      setErrors((prev) => {
        const next = { ...prev };
        delete next[domain];
        return next;
      });
      try {
        const res = await fetchDomain(domain);
        if (res.data !== null) {
          const value = res.data;
          setData((prev) => ({ ...prev, [domain]: value }));
        } else {
          setErrors((prev) => ({
            ...prev,
            [domain]: res.error ?? 'The house could not fetch this just now.',
          }));
        }
      } catch {
        setErrors((prev) => ({
          ...prev,
          [domain]: 'The house could not fetch this just now.',
        }));
      } finally {
        inFlight.current.delete(domain);
      }
    },
    [fetchDomain],
  );

  useEffect(() => {
    if (enabled && data[activeDomain] === undefined && !errors[activeDomain]) {
      void load(activeDomain);
    }
  }, [enabled, activeDomain, data, errors, load]);

  const retry = useCallback((domain: GiaDomain) => void load(domain), [load]);

  return { activeDomain, setActiveDomain, data, errors, retry };
}
