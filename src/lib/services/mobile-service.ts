import 'server-only';

import {
  getLeadStatusSummary,
  getLeadsByCampaign,
  type AgentStatusBreakdown,
  type CampaignStatusMix,
} from '@/lib/services/dashboard-service';
import { getDomainHealthMetrics } from '@/lib/services/performance-service';
import { getDomainTargets } from '@/lib/services/domain-targets-service';
import { getBudgetSummary, filterBudgetRowsByDomain } from '@/lib/services/ad-spend-service';
import { getISTMonthStart, toIst } from '@/lib/utils/ist';
import type { GiaDomain } from '@/lib/constants/domains';
import type { AppDomain, UserRole } from '@/lib/types/database';

/**
 * Mobile Ops orchestration reads (docs/modules/mobile-ops.md §7).
 * ZERO new queries — every number is a Promise.all over existing
 * service functions (R-01). Screens are display-only (A-06): the RSC
 * page seeds the first domain through these, actions/mobile.ts
 * refreshes on swipe. Range = the current IST month (the founder's
 * "this month, in the hand" window).
 */

export function mobileMonthRange(now = new Date()): { from: string; to: string } {
  return { from: getISTMonthStart(now).toISOString(), to: now.toISOString() };
}

export type MobileGreeting = { dateLabel: string; greeting: string; line: string };

/**
 * IST greeting block for the mobile Dashboard room. Computed server-side
 * (the RSC page passes it down) so prerender and hydration agree.
 */
export function buildMobileGreeting(fullName: string, now = new Date()): MobileGreeting {
  const { hour } = toIst(now);
  const firstName = fullName.trim().split(/\s+/)[0] || 'there';
  const part = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
  const dateLabel = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
    .format(now)
    .replace(/,/g, '')
    .toUpperCase();

  return {
    dateLabel,
    greeting: `Good ${part}, ${firstName}`,
    line: 'The house, at a glance.',
  };
}

export type MobileDashboardData = {
  domain: GiaDomain;
  from: string;
  to: string;
  /** leads created this month in the domain */
  newLeads: number;
  wonLeads: number;
  byAgent: AgentStatusBreakdown[];
  campaigns: CampaignStatusMix[];
  /** month ad spend across the domain's campaigns — null when no spend rows */
  budgetSpend: number | null;
  dealsClosed: number;
  dealsTarget: number | null;
};

export async function getMobileDashboardData(
  role: UserRole,
  callerDomain: AppDomain,
  domain: GiaDomain,
): Promise<MobileDashboardData> {
  const { from, to } = mobileMonthRange();
  const dateRange = { from, to };

  const [leadSummary, campaigns, healthCards, targets, budgetRows] = await Promise.all([
    getLeadStatusSummary(role, callerDomain, domain, dateRange),
    getLeadsByCampaign(role, callerDomain, domain, dateRange),
    getDomainHealthMetrics([domain], from, to),
    getDomainTargets(),
    getBudgetSummary(from, to),
  ]);

  const domainSpendRows = filterBudgetRowsByDomain(budgetRows, domain);
  const target = targets.find((t) => t.domain === domain);

  return {
    domain,
    from,
    to,
    newLeads: leadSummary.totals.reduce((sum, t) => sum + t.count, 0),
    wonLeads: leadSummary.totals.find((t) => t.status === 'won')?.count ?? 0,
    byAgent: leadSummary.byAgent,
    campaigns,
    budgetSpend:
      domainSpendRows.length > 0
        ? domainSpendRows.reduce((sum, r) => sum + r.totalSpend, 0)
        : null,
    dealsClosed: healthCards[0]?.totalDeals ?? 0,
    dealsTarget: target && target.target_value > 0 ? target.target_value : null,
  };
}

export type MobileBudgetCampaign = {
  campaignKey: string;
  totalSpend: number;
  leadCount: number;
  dealCount: number;
  dealRevenue: number;
  costPerLead: number | null;
};

export type MobileBudgetData = {
  domain: GiaDomain;
  from: string;
  to: string;
  campaigns: MobileBudgetCampaign[];
  totalSpend: number;
  totalLeads: number;
  totalDeals: number;
  totalRevenue: number;
  dealsClosed: number;
  dealsTarget: number | null;
};

export async function getMobileBudgetData(domain: GiaDomain): Promise<MobileBudgetData> {
  const { from, to } = mobileMonthRange();

  const [budgetRows, healthCards, targets] = await Promise.all([
    getBudgetSummary(from, to),
    getDomainHealthMetrics([domain], from, to),
    getDomainTargets(),
  ]);

  const rows = filterBudgetRowsByDomain(budgetRows, domain).sort(
    (a, b) => b.totalSpend - a.totalSpend,
  );
  const target = targets.find((t) => t.domain === domain);

  return {
    domain,
    from,
    to,
    campaigns: rows.map((r) => ({
      campaignKey: r.campaignKey,
      totalSpend: r.totalSpend,
      leadCount: r.leadCount,
      dealCount: r.dealCount,
      dealRevenue: r.dealRevenue,
      costPerLead: r.costPerLead,
    })),
    totalSpend: rows.reduce((sum, r) => sum + r.totalSpend, 0),
    totalLeads: rows.reduce((sum, r) => sum + r.leadCount, 0),
    totalDeals: rows.reduce((sum, r) => sum + r.dealCount, 0),
    totalRevenue: rows.reduce((sum, r) => sum + r.dealRevenue, 0),
    dealsClosed: healthCards[0]?.totalDeals ?? 0,
    dealsTarget: target && target.target_value > 0 ? target.target_value : null,
  };
}
