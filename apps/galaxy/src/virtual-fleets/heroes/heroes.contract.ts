import { z } from 'zod';
import { HeroRoleSchema } from 'omni-loop/kit/lib/virtual-fleet/roles.ts';

// The Heroes tab's contract (PRD 2842 s6; ADR-0095): what a Virtual Fleet's heroes are as the tab reads
// them, and what its two buttons send, safe for the browser. An owner of the workspace adds a hero of a
// role the fleet lacks, or removes one; every refusal is `{error, field}`: its words, and the field they
// belong to (`role`, `hero`), or `form`.
//
//   POST   /api/virtual-fleets/heroes {workspace, fleet, role}   201 {hero}
//   DELETE /api/virtual-fleets/heroes {workspace, hero}          200 {removed}

/** A hero as public.virtual_heroes holds it. */
export const HeroSchema = z.object({
  id: z.uuid(),
  fleet: z.string().min(1),
  name: z.string().min(1),
  role: HeroRoleSchema,
  skills: z.array(z.string()),
  agent: z.string().min(1),
  model: z.string().min(1),
  limits: z.array(z.string()),
  position: z.number().int().min(0),
});
export type Hero = z.infer<typeof HeroSchema>;

export const AddHeroRequestSchema = z.object({ workspace: z.uuid(), fleet: z.string().min(1).max(60), role: HeroRoleSchema });
export type AddHeroRequest = z.infer<typeof AddHeroRequestSchema>;

export const RemoveHeroRequestSchema = z.object({ workspace: z.uuid(), hero: z.uuid() });
export type RemoveHeroRequest = z.infer<typeof RemoveHeroRequestSchema>;

export const AddedHeroSchema = z.object({ hero: HeroSchema });
export const RemovedHeroSchema = z.object({ removed: z.uuid() });

const REFUSAL_FIELDS = ['role', 'hero', 'form'] as const;
export type HeroRefusalField = (typeof REFUSAL_FIELDS)[number];

export const HeroRefusalSchema = z.object({ error: z.string(), field: z.enum(REFUSAL_FIELDS).optional() });

/** Each refusal's status. */
export const HERO_REFUSALS = {
  malformed: 400,
  'signed-out': 401,
  forbidden: 403,
  invalid: 422,
  database: 500,
  unavailable: 503,
} as const;
export type HeroRefusal = keyof typeof HERO_REFUSALS;
