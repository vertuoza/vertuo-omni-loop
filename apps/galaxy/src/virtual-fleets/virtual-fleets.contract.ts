import { z } from 'zod';
import { HERO_ROLES, HeroRoleSchema } from 'omni-loop/kit/lib/virtual-fleet/roles.ts';

// The Virtual Fleets' contract (PRD 2842 s1; ADR-0095): what the New virtual fleet drawer and its route
// exchange, safe for the browser. Any member of the workspace makes a Virtual Fleet from the Fleet
// section with its name, its icon (a fleet mascot) and the roles left on, and is answered the fleet as
// made, to land on it. Every refusal is `{error, field}`: its words, and the drawer's field they are
// shown under (`name`, `mascot`, `heroes`), or `form` for the drawer's foot.
//
//   POST /api/virtual-fleets {workspace, name, mascot, roles}   201 {fleet}

/** A fleet's label is at most 12 characters (public.teams' teams_label_length). */
export const FLEET_NAME_MAX = 12;

export const CreateVirtualFleetRequestSchema = z.object({
  workspace: z.uuid(),
  name: z.string().trim().min(1).max(FLEET_NAME_MAX),
  mascot: z.string().min(1).max(40),
  roles: z.array(HeroRoleSchema).min(1).max(HERO_ROLES.length),
});
export type CreateVirtualFleetRequest = z.infer<typeof CreateVirtualFleetRequestSchema>;

/** The fleet just made, as public.teams holds it: its key, label, colour and mascot. */
export const VirtualFleetSchema = z.object({
  name: z.string().min(1),
  label: z.string().min(1),
  color: z.string().regex(/^#[0-9a-f]{6}$/),
  mascot: z.string().min(1),
});
export type VirtualFleet = z.infer<typeof VirtualFleetSchema>;

export const CreatedVirtualFleetSchema = z.object({ fleet: VirtualFleetSchema });
export type CreatedVirtualFleet = z.infer<typeof CreatedVirtualFleetSchema>;

/** Where the drawer shows a refusal: under one of its fields, or in its foot. */
const REFUSAL_FIELDS = ['name', 'mascot', 'heroes', 'form'] as const;
export type RefusalField = (typeof REFUSAL_FIELDS)[number];

export const VirtualFleetRefusalSchema = z.object({ error: z.string(), field: z.enum(REFUSAL_FIELDS).optional() });

/** Each refusal's status. */
export const VIRTUAL_FLEET_REFUSALS = {
  malformed: 400,
  'signed-out': 401,
  forbidden: 403,
  invalid: 422,
  database: 500,
  unavailable: 503,
} as const;
export type VirtualFleetRefusal = keyof typeof VIRTUAL_FLEET_REFUSALS;
