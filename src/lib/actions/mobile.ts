'use server';

import { requireProfile } from '@/lib/actions/_auth';
import { parseActionInput } from '@/lib/actions/_validation';
import {
  MobileDomainSchema,
  ActivityFeedQuerySchema,
} from '@/lib/validations/mobile-schema';
import { formErrors } from '@/lib/validations/form-errors';
import {
  getMobileDashboardData,
  getMobileBudgetData,
  mobileMonthRange,
  type MobileDashboardData,
  type MobileBudgetData,
} from '@/lib/services/mobile-service';
import { getDomainTaskSummary, type DomainTaskSummary } from '@/lib/services/tasks-service';
import { getActivityFeed, type ActivityFeedResult } from '@/lib/services/activity-service';
import { isGiaDomain, type GiaDomain } from '@/lib/constants/domains';
import type { Profile } from '@/lib/types/database';
import type { ActionResult } from '@/lib/types';

/**
 * Mobile Ops room actions (docs/modules/mobile-ops.md). The rooms' swipe
 * refresh path — the RSC pages seed the first domain via the same service
 * fns. Every action: Zod first (Rule 02) → requireProfile (A-18) → manager
 * pinned to their own Gia domain server-side (the effectiveWidgetDomain
 * posture) → service. Scope args are session-derived (Q-13).
 */

const MOBILE_ROLES = ['manager', 'admin', 'founder'] as const;

/** Manager is pinned to their own Gia domain regardless of the requested one. */
function resolveMobileDomain(caller: Profile, requested: GiaDomain): GiaDomain | null {
  if (caller.role === 'manager') {
    return isGiaDomain(caller.domain) && caller.domain === requested ? requested : null;
  }
  return requested;
}

export async function getMobileDashboardAction(
  input: unknown,
): Promise<ActionResult<MobileDashboardData>> {
  const parsed = parseActionInput(MobileDomainSchema, input);
  if (!parsed.ok) return { data: null, error: parsed.error };

  const auth = await requireProfile(MOBILE_ROLES);
  if (!auth.ok) return auth.result;

  const domain = resolveMobileDomain(auth.profile, parsed.data.domain);
  if (!domain) return { data: null, error: formErrors.unauthorized };

  const data = await getMobileDashboardData(auth.profile.role, auth.profile.domain, domain);
  return { data, error: null };
}

export async function getMobileBudgetAction(
  input: unknown,
): Promise<ActionResult<MobileBudgetData>> {
  const parsed = parseActionInput(MobileDomainSchema, input);
  if (!parsed.ok) return { data: null, error: parsed.error };

  const auth = await requireProfile(MOBILE_ROLES);
  if (!auth.ok) return auth.result;

  const domain = resolveMobileDomain(auth.profile, parsed.data.domain);
  if (!domain) return { data: null, error: formErrors.unauthorized };

  const data = await getMobileBudgetData(domain);
  return { data, error: null };
}

export async function getDomainTaskSummaryAction(
  input: unknown,
): Promise<ActionResult<DomainTaskSummary>> {
  const parsed = parseActionInput(MobileDomainSchema, input);
  if (!parsed.ok) return { data: null, error: parsed.error };

  const auth = await requireProfile(MOBILE_ROLES);
  if (!auth.ok) return auth.result;

  const domain = resolveMobileDomain(auth.profile, parsed.data.domain);
  if (!domain) return { data: null, error: formErrors.unauthorized };

  const { from, to } = mobileMonthRange();
  const data = await getDomainTaskSummary(domain, from, to);
  return { data, error: null };
}

export async function getActivityFeedAction(
  input: unknown,
): Promise<ActionResult<ActivityFeedResult>> {
  const parsed = parseActionInput(ActivityFeedQuerySchema, input);
  if (!parsed.ok) return { data: null, error: parsed.error };

  const auth = await requireProfile(MOBILE_ROLES);
  if (!auth.ok) return auth.result;

  const domain = resolveMobileDomain(auth.profile, parsed.data.domain);
  if (!domain) return { data: null, error: formErrors.unauthorized };

  const data = await getActivityFeed(domain, parsed.data.cursor ?? null);
  return { data, error: null };
}
