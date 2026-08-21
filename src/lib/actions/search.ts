'use server';

/**
 * Command-palette entity search (polish handoff §01).
 *
 * ONE action, three existing reads — getLeadsByRole / getDealsByRole /
 * getPersonalTasks (R-01: no new service queries; the role/domain scoping
 * those functions already enforce is the security boundary). Results are
 * slimmed to display rows; each branch is best-effort (a failed read
 * yields an empty group, never a failed palette).
 */

import { requireProfile } from './_auth';
import { parseActionInput } from './_validation';
import { PaletteSearchSchema } from '@/lib/validations/search-schema';
import { getLeadsByRole } from '@/lib/services/leads-service';
import { getDealsByRole } from '@/lib/services/deals-service';
import { getPersonalTasks } from '@/lib/services/tasks-service';
import type { ActionResult } from '@/lib/types';

export type PaletteLeadHit = {
  id: string;
  slug: string | null;
  name: string;
  status: string;
};

export type PaletteDealHit = {
  id: string;
  name: string;
  amount: number;
  leadSlug: string | null;
  leadId: string | null;
};

export type PaletteTaskHit = {
  id: string;
  title: string;
  status: string;
};

export type PaletteSearchResult = {
  leads: PaletteLeadHit[];
  deals: PaletteDealHit[];
  tasks: PaletteTaskHit[];
};

const EMPTY: PaletteSearchResult = { leads: [], deals: [], tasks: [] };
const GROUP_LIMIT = 5;

export async function paletteSearchAction(
  input: unknown,
): Promise<ActionResult<PaletteSearchResult>> {
  const parsed = parseActionInput(PaletteSearchSchema, input);
  if (!parsed.ok) return { data: null, error: parsed.error };

  const query = parsed.data.query;
  if (query.length < 2) return { data: EMPTY, error: null };

  const auth = await requireProfile();
  if (!auth.ok) return auth.result;
  const profile = auth.profile;

  const [leadsRes, dealsRes, tasksRes] = await Promise.allSettled([
    getLeadsByRole(profile.role, profile.id, profile.domain, {
      status: null,
      last_call_outcome: null,
      domain: null,
      agent_id: null,
      source: null,
      campaign: null,
      date_from: null,
      date_to: null,
      search: query,
      page: 1,
      pageSize: GROUP_LIMIT,
    }),
    getDealsByRole(profile.role, profile.id, profile.domain, {
      search: query,
      domain: null,
      deal_type: null,
      deal_category: null,
      agent_id: null,
      date_from: null,
      date_to: null,
      page: 1,
      pageSize: GROUP_LIMIT * 4, // client-side title match narrows further
    }),
    // get_personal_tasks has no server search — page 1 filtered by title here.
    getPersonalTasks(profile.id, {}),
  ]);

  const leads: PaletteLeadHit[] =
    leadsRes.status === 'fulfilled'
      ? leadsRes.value.leads.slice(0, GROUP_LIMIT).map((l) => ({
          id: l.id,
          slug: l.slug,
          name: [l.first_name, l.last_name].filter(Boolean).join(' ') || l.phone || 'Lead',
          status: l.status,
        }))
      : [];

  const q = query.toLowerCase();

  const deals: PaletteDealHit[] =
    dealsRes.status === 'fulfilled'
      ? dealsRes.value.deals
          .filter((d) => (d.contact_name ?? '').toLowerCase().includes(q))
          .slice(0, GROUP_LIMIT)
          .map((d) => ({
            id: d.id,
            name: d.contact_name || 'Deal',
            amount: d.deal_amount,
            leadSlug: d.lead?.slug ?? null,
            leadId: d.lead_id,
          }))
      : [];

  const tasks: PaletteTaskHit[] =
    tasksRes.status === 'fulfilled'
      ? tasksRes.value.tasks
          .filter((t) => t.title.toLowerCase().includes(q))
          .slice(0, GROUP_LIMIT)
          .map((t) => ({ id: t.id, title: t.title, status: t.status }))
      : [];

  return { data: { leads, deals, tasks }, error: null };
}
