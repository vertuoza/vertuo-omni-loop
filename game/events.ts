import { z } from 'zod';
import type { PrdNumber } from '../kit/lib/ids.ts';

export const EVENT_TYPES = Object.freeze([
  'PLANET_CHARTED', 'REGION_SURVEYED', 'PLANET_LOCKED', 'PLANET_UNLOCKED',
  'ZONE_OPENED', 'ZONE_CLAIMED', 'ZONE_SECURED', 'ZONE_REVERTED',
  'WOUND_OPENED', 'WOUND_CLOSED', 'DISTRESS', 'RESCUE',
  'PLANET_READY', 'PLANET_TERRAFORMED', 'PLANET_LOST', 'PLANET_DECOMMISSIONED',
  // An ask round answered on a PRD (PRD 1180): born closed, it pays its answerer and nothing else.
  'QUESTION_ANSWERED',
  // A region's feature PR merged into its default branch: its merger, and each person who approved it.
  'FEATURE_MERGED', 'FEATURE_REVIEWED',
] as const);

export const WOUND_KINDS = Object.freeze(['transmission', 'unconfirmed-ground', 'beacon', 'fault-line', 'under-fire', 'aftershock'] as const);

// A PRD's home: the repository of its issue, `owner/name` in lower case, as public.repositories
// spells it (PRD 728).
const HOME = /^[a-z0-9-]{1,39}\/[a-z0-9._-]{1,100}$/;

// The planet of an answer no PRD claims: never a planet, so the map and the season's planets leave it out.
export const NO_PLANET = 0;

export const EventSchema = z.object({
  id: z.string().min(1),
  at: z.iso.datetime({ offset: true }),
  type: z.enum(EVENT_TYPES),
  planet: z.number().int().nonnegative(),
  // Absent on the events written before PRD 728.
  home: z.string().regex(HOME).optional(),
  region: z.string().optional(),
  contributor: z.string().optional(),
  team: z.string().optional(),
  data: z.record(z.string(), z.unknown()).default({}),
}).strict().refine((e) => e.planet !== NO_PLANET || e.type === 'QUESTION_ANSWERED', { message: 'only an answer may belong to no planet', path: ['planet'] });

export type EventType = (typeof EVENT_TYPES)[number];
/** One ledger event, as the schema parses it. */
export type GameEvent = z.infer<typeof EventSchema>;

export function eventId(source: string, identity: string | number, state: string | number): string {
  return `${source}:${identity}:${state}`;
}

/** A field of an event's data when it holds text, else undefined. */
export function textOf(data: Readonly<Record<string, unknown>>, key: string): string | undefined {
  const value = data[key];
  return typeof value === 'string' ? value : undefined;
}

export function makeEvent(fields: unknown): GameEvent {
  return EventSchema.parse(fields);
}

// A planet's key: `<home>#<n>` (PRD 728), so two repositories' PRD 88 are two planets. A PRD with no
// home (an event written before PRD 728, a fixture) is keyed by its number alone.
export function planetKey(home: string | null | undefined, prd: PrdNumber): string {
  return keyOf(home, prd);
}

// An event's planet is the number the ledger holds, read by the event's schema: keyed the same way.
export function planetKeyOf(event: { home?: string | null | undefined; planet: number }): string {
  return keyOf(event.home, event.planet);
}

function keyOf(home: string | null | undefined, planet: number): string {
  return home ? `${home}#${planet}` : String(planet);
}
