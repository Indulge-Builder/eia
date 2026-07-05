'use client';

import { DetailAppBar } from '../app-bars';
import {
  SectionLabel,
  ListCard,
  ListRow,
  RowCount,
  RoomEmpty,
} from '../rooms/room-bits';
import { TASK_STATUS, TASK_PRIORITY } from '@/lib/constants/task-constants';
import { formatDate } from '@/lib/utils/dates';
import { getInitials } from '@/lib/utils/strings';
import type { PersonalTaskRow } from '@/lib/services/tasks-service';

/**
 * Agent task detail (/m/tasks/[agentId] — mobile-ops §7 Tasks room).
 * Display-only (A-06): the RSC page fetched the agent + their open tasks
 * through the existing getPersonalTasks read. Overdue rows carry the clay
 * date; a lead-linked task shows the lead's name in the sub line.
 */

// Lead follow-ups all share type-label titles ("Call") — the row title must
// carry WHO the task is about or the list reads "Call / Call / Call". The
// lead name rides the title; the sub line keeps status + priority.
function taskTitle(task: PersonalTaskRow): string {
  const leadName = [task.lead_first_name, task.lead_last_name].filter(Boolean).join(' ');
  return leadName ? `${task.title} · ${leadName}` : task.title;
}

function taskSub(task: PersonalTaskRow): string {
  const bits: string[] = [TASK_STATUS[task.status].label];
  if (task.priority !== 'normal') bits.push(TASK_PRIORITY[task.priority].label);
  return bits.join(' · ');
}

export function AgentTasksScreen({
  agentName,
  tasks,
}: {
  agentName: string;
  tasks: PersonalTaskRow[];
}) {
  const now = Date.now();

  return (
    <div
      className="min-h-dvh flex flex-col gap-3.5 px-5 pb-8"
      style={{ paddingTop: 'max(14px, env(safe-area-inset-top))' }}
    >
      <DetailAppBar title={`TASKS · ${agentName.toUpperCase()}`} backHref="/m/tasks" />

      <div className="flex items-center gap-3 px-1">
        <span
          className="w-[42px] h-[42px] shrink-0 rounded-full bg-(--neu-surface-high) border border-(--neu-edge-strong) flex items-center justify-center text-xs font-semibold text-(--neu-accent-deep)"
          style={{ boxShadow: 'var(--neu-shadow-raised-sm)' }}
        >
          {getInitials(agentName)}
        </span>
        <span className="flex flex-col">
          <span
            className="text-[17px] font-semibold text-(--neu-text-primary)"
            style={{ fontFamily: 'var(--font-serif)' }}
          >
            {agentName}
          </span>
          <span className="text-[11.5px] text-(--neu-text-secondary)">
            {tasks.length} open {tasks.length === 1 ? 'task' : 'tasks'}
          </span>
        </span>
      </div>

      <SectionLabel>OPEN TASKS</SectionLabel>
      {tasks.length === 0 ? (
        <RoomEmpty>All settled — nothing open here.</RoomEmpty>
      ) : (
        <ListCard>
          {tasks.map((task, i) => {
            const overdue = task.due_at !== null && new Date(task.due_at).getTime() < now;
            return (
              <ListRow
                key={task.id}
                title={taskTitle(task)}
                sub={taskSub(task)}
                right={
                  task.due_at ? (
                    <RowCount
                      value={formatDate(task.due_at, 'dd MMM')}
                      token={
                        overdue ? 'var(--neu-danger-deep)' : 'var(--neu-text-secondary)'
                      }
                    />
                  ) : undefined
                }
                divider={i < tasks.length - 1}
              />
            );
          })}
        </ListCard>
      )}
    </div>
  );
}
