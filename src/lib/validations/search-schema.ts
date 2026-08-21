import { z } from 'zod';

/**
 * Command-palette entity search (polish handoff §01).
 * Internal-code messages — mapped in the action, never shown raw (Q-04).
 */
export const PaletteSearchSchema = z.object({
  query: z
    .string({ message: 'invalid_query' })
    .trim()
    .max(80, { message: 'query_too_long' }),
});
