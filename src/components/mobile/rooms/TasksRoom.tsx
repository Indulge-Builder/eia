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
import { useDomainRoomData } from '@/hooks/useDomainRoomData';
import { getDomainTaskSummaryAction } from '@/lib/actions/mobile';
import { formatCount } from '@/lib/utils/numbers';
import { DEFAULT_GIA_DOMAIN, type GiaDomain } from '@/lib/constants/domains';
import type { DomainTaskSummary } from '@/lib/services/tasks-service';

/**
 * Tasks room (/m/tasks — mobile-ops §3 room 2): "How is each domain /
 * agent doing on their tasks?" Counts from the get_domain_task_summary
 * RPC (migration 0160); tapping a team member opens /m/tasks/[agentId].
 */

function TasksPane({
  data,
  error,
  onRetry,
}: {
  data: DomainTaskSummary | undefined;
  error: string | undefined;
  onRetry: () => void;
}) {
  if (error) return <PaneError message={error} onRetry={onRetry} />;
  if (!data) return <PaneLoader />;

  const team = data.byAgent.slice(0, 12);

  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <MetricTile label="Created" value={formatCount(data.totals.created)} sub="this month" />
        <MetricTile
          label="Completed"
          value={formatCount(data.totals.completed)}
          tone="sage"
          sub="this month"
        />
        <MetricTile label="Open" value={formatCount(data.totals.open)} sub="right now" />
        <MetricTile
          label="Overdue"
          value={formatCount(data.totals.overdue)}
          tone={data.totals.overdue > 0 ? 'danger' : 'default'}
          sub="right now"
        />
      </div>

      <SectionLabel>THE TEAM</SectionLabel>
      {team.length === 0 ? (
        <RoomEmpty>Quiet — no tasks in motion here.</RoomEmpty>
      ) : (
        <ListCard>
          {team.map((agent, i) => (
            <ListRow
              key={agent.agentId ?? 'unassigned'}
              title={agent.agentName}
              sub={`${agent.completedCount} done · ${agent.overdueCount} overdue`}
              right={
                <RowCount
                  value={formatCount(agent.openCount)}
                  token={
                    agent.overdueCount > 0 ? 'var(--neu-danger-deep)' : undefined
                  }
                />
              }
              divider={i < team.length - 1}
              href={agent.agentId ? `/m/tasks/${agent.agentId}` : undefined}
            />
          ))}
        </ListCard>
      )}
    </>
  );
}

export function TasksRoom({
  domains,
  seed,
}: {
  domains: GiaDomain[];
  seed: DomainTaskSummary | null;
}) {
  const fetchDomain = useCallback(
    (domain: GiaDomain) => getDomainTaskSummaryAction({ domain }),
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
      <RoomTitle>Tasks</RoomTitle>
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
            <TasksPane data={data[d]} error={errors[d]} onRetry={() => retry(d)} />
          )}
        />
      )}
    </>
  );
}
