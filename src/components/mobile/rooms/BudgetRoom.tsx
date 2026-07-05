'use client';

import { useCallback } from 'react';
import {
  SectionLabel,
  MetricTile,
  ListCard,
  ListRow,
  RowCount,
  PaneLoader,
  PaneError,
  RoomEmpty,
  RoomTitle,
  ComingSoonCard,
} from './room-bits';
import { DomainSwiper } from '../DomainSwiper';
import { ProgressCard } from '../content';
import { useDomainRoomData } from '@/hooks/useDomainRoomData';
import { getMobileBudgetAction } from '@/lib/actions/mobile';
import { formatCount, formatCurrencyCompact } from '@/lib/utils/numbers';
import { DEFAULT_GIA_DOMAIN, type GiaDomain } from '@/lib/constants/domains';
import type { MobileBudgetData } from '@/lib/services/mobile-service';

/**
 * Budget room (/m/budget — mobile-ops §3 room 4): "Where is the money
 * going per domain?" Reuses getBudgetSummary + filterBudgetRowsByDomain +
 * deals-vs-target; the tech-team expense tracker is a Coming Soon
 * placeholder by contract (mobile-ops §7 — no table, no service).
 */

function BudgetPane({
  data,
  error,
  onRetry,
}: {
  data: MobileBudgetData | undefined;
  error: string | undefined;
  onRetry: () => void;
}) {
  if (error) return <PaneError message={error} onRetry={onRetry} />;
  if (!data) return <PaneLoader />;

  const targetPercent =
    data.dealsTarget && data.dealsTarget > 0
      ? Math.min(100, Math.round((data.dealsClosed / data.dealsTarget) * 100))
      : null;

  const topCampaigns = data.campaigns.slice(0, 8);

  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <MetricTile
          label="Ad spend"
          value={data.campaigns.length === 0 ? '—' : formatCurrencyCompact(data.totalSpend)}
          sub="this month"
        />
        <MetricTile label="Leads" value={formatCount(data.totalLeads)} sub="from spend" />
        <MetricTile label="Deals" value={formatCount(data.totalDeals)} tone="sage" sub="from spend" />
        <MetricTile
          label="Revenue"
          value={data.totalRevenue > 0 ? formatCurrencyCompact(data.totalRevenue) : '—'}
          sub="this month"
        />
      </div>

      {targetPercent !== null && (
        <ProgressCard
          title="Deals vs target"
          percent={targetPercent}
          micro={`${data.dealsClosed} of ${data.dealsTarget} closed this month`}
        />
      )}

      <SectionLabel>CAMPAIGN SPEND</SectionLabel>
      {topCampaigns.length === 0 ? (
        <RoomEmpty>No ad spend recorded this month.</RoomEmpty>
      ) : (
        <ListCard>
          {topCampaigns.map((c, i) => (
            <ListRow
              key={c.campaignKey}
              title={c.campaignKey}
              sub={`${formatCount(c.leadCount)} leads · CPL ${
                c.costPerLead === null ? '—' : formatCurrencyCompact(c.costPerLead)
              }`}
              right={<RowCount value={formatCurrencyCompact(c.totalSpend)} />}
              divider={i < topCampaigns.length - 1}
            />
          ))}
        </ListCard>
      )}

      <SectionLabel>TECH EXPENSES</SectionLabel>
      <ComingSoonCard
        title="The expense tracker is on its way."
        line="Team expenses arrive here in a later phase."
      />
    </>
  );
}

export function BudgetRoom({
  domains,
  seed,
}: {
  domains: GiaDomain[];
  seed: MobileBudgetData | null;
}) {
  const fetchDomain = useCallback(
    (domain: GiaDomain) => getMobileBudgetAction({ domain }),
    [],
  );

  const { activeDomain, setActiveDomain, data, errors, retry } = useDomainRoomData({
    initialDomain: domains[0] ?? DEFAULT_GIA_DOMAIN,
    seed,
    fetchDomain,
    enabled: domains.length > 0,
  });

  return (
    <>
      <RoomTitle>Budget</RoomTitle>
      {domains.length === 0 ? (
        <ComingSoonCard
          title="Your rooms are being prepared."
          line="The mobile view for your role arrives in a later phase."
        />
      ) : (
        <DomainSwiper
          domains={domains}
          activeDomain={activeDomain}
          onDomainChange={setActiveDomain}
          renderDomain={(d) => (
            <BudgetPane data={data[d]} error={errors[d]} onRetry={() => retry(d)} />
          )}
        />
      )}
    </>
  );
}
