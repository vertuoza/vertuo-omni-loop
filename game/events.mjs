import { z } from 'zod';

export const EVENT_TYPES = Object.freeze([
  'PLANET_CHARTED', 'REGION_SURVEYED', 'PLANET_LOCKED', 'PLANET_UNLOCKED',
  'ZONE_OPENED', 'ZONE_CLAIMED', 'ZONE_SECURED', 'ZONE_REVERTED',
  'WOUND_OPENED', 'WOUND_CLOSED', 'DISTRESS', 'RESCUE',
  'PLANET_READY', 'PLANET_TERRAFORMED', 'PLANET_LOST', 'PLANET_DECOMMISSIONED',
]);

export const WOUND_KINDS = Object.freeze(['transmission', 'unconfirmed-ground', 'beacon', 'fault-line', 'under-fire', 'aftershock']);

export const EventSchema = z.object({
  id: z.string().min(1),
  at: z.string().datetime({ offset: true }),
  type: z.enum(EVENT_TYPES),
  planet: z.number().int().positive(),
  region: z.string().optional(),
  contributor: z.string().optional(),
  team: z.string().optional(),
  data: z.record(z.unknown()).default({}),
}).strict();

export function eventId(source, identity, state) {
  return `${source}:${identity}:${state}`;
}

export function makeEvent(fields) {
  return EventSchema.parse(fields);
}
