import { z } from 'zod';
import { GIA_DOMAIN_ENUM } from '@/lib/constants/domains';

/**
 * Mobile Ops action inputs (docs/modules/mobile-ops.md).
 * Human-readable messages only — Zod defaults never reach the UI (Q-04).
 */

export const MobileDomainSchema = z.object({
  domain: z.enum(GIA_DOMAIN_ENUM, { message: 'Please select a valid domain.' }),
});

export const ActivityFeedQuerySchema = z.object({
  domain: z.enum(GIA_DOMAIN_ENUM, { message: 'Please select a valid domain.' }),
  cursor: z
    .object({
      createdAt: z.string().min(1, 'Invalid cursor.'),
      id: z.string().uuid('Invalid cursor.'),
    })
    .nullable()
    .optional(),
});

export const AgentTasksQuerySchema = z.object({
  agentId: z.string().uuid('Invalid team member.'),
});
