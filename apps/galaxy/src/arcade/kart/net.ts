// OMNI KART's live messages, as they cross the wire (PRD 1572): pure, so a test reads what was sent
// back with no browser and no Supabase. This slice reads the grid's own message, a player's Presence
// entry; the race's messages (start, state, item, hit, finish, leave) join it in the slices after.
import { z } from 'zod';
import { StoredHero } from '../../data/players';
import { RULES } from './rules';
import { readLook, type KartLook } from './look';
import { isCircuitId } from './circuits';

/**
 * A player on the grid, as they say it themselves: their id, name, hero, fleet and best time at OMNI
 * KART in tenths of a second (null before a first race), and when they arrived on the grid (ms).
 */
/** The most laps a race runs (PRD 1762). */
const MAX_LAPS = 7;

const Entry = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(64),
  hero: StoredHero,
  fleet: z.string().nullable(),
  best: z.number().int().positive().nullable(),
  arrival: z.number(),
  /** The player's kart's colour and design (PRD 1762); an entry without one is drawn as today. A field that does not read is none. */
  look: z.object({ color: z.string().max(32), design: z.string().max(32) }).transform((l): KartLook => readLook(l)).optional().catch(undefined),
  /** The laps the player chose (PRD 1762); an entry without them, or with a count that is not one, counts as a tab without `laps`. */
  laps: z.number().int().min(1).max(MAX_LAPS).optional().catch(undefined),
  /** The circuit the player chose (PRD 1923); an entry without one, or naming no circuit, counts as a tab without `track`. */
  track: z.string().refine(isCircuitId).optional().catch(undefined),
});
export type GridPlayer = z.infer<typeof Entry>;

/** What a player tracks on the grid: their entry, nothing else. */
export const presenceOf = (player: GridPlayer): Record<string, unknown> => ({
  id: player.id, name: player.name, hero: player.hero, fleet: player.fleet, best: player.best, arrival: player.arrival,
  ...(player.look ? { look: player.look } : {}), ...(player.laps !== undefined ? { laps: player.laps } : {}),
  ...(player.track !== undefined ? { track: player.track } : {}),
});

/** A Presence entry read back: the player it says, or null when a field is missing or wrong. */
export function readPresence(raw: unknown): GridPlayer | null {
  const read = Entry.safeParse(raw);
  return read.success ? read.data : null;
}

/**
 * Everyone Presence holds, by the key they joined under (their id): an entry that does not read, or
 * that names a player other than its key, is left out.
 */
export function readGrid(entries: Readonly<Record<string, unknown>>): GridPlayer[] {
  const players: GridPlayer[] = [];
  for (const [key, raw] of Object.entries(entries)) {
    const player = readPresence(raw);
    if (player && player.id === key) players.push(player);
  }
  return players;
}

// ── The race's messages (PRD 1572): start, state, leave (slice 4), finish (slice 5), and item and hit (slice 6).

const RaceId = z.string().min(1).max(64);

/** START: the race's id, its seed and the players in their starting order, each as they said it on the grid, so everyone starts from the same grid. */
const Start = z.object({
  kind: z.literal('start'),
  race: RaceId,
  seed: z.number().int().nonnegative(),
  /** How many laps every player races (PRD 1762); a start without it races 3. */
  laps: z.number().int().min(1).max(MAX_LAPS).optional(),
  /** The circuit every player races (PRD 1923); a start without it races COMET RING, and one naming no circuit does not read. */
  track: z.string().refine(isCircuitId).optional(),
  order: z.array(Entry).min(2).max(RULES.places),
});

/** A kart's state: where it is, the way it faces, its speed and steering, its laps and waypoints passed, the seconds of spin-out and of fall it has left. */
const State = z.object({
  kind: z.literal('state'),
  race: RaceId,
  x: z.number(),
  y: z.number(),
  angle: z.number(),
  speed: z.number(),
  steer: z.union([z.literal(-1), z.literal(0), z.literal(1)]),
  laps: z.number().int().min(0).max(MAX_LAPS),
  passed: z.number().int().min(0).max(1000),
  spin: z.number().min(0),
  fall: z.number().min(0),
  /** Its height over the ground (PRD 1775); optional so a player on the previous build does not break the race, and read as 0 when missing. */
  height: z.number().min(0).optional(),
});

/** A player leaves the race. */
const Leave = z.object({ kind: z.literal('leave'), race: RaceId });

/** A player crossed the line at the end of the last lap: their race time in tenths of a second, the one that is sent to the score. */
const Finish = z.object({ kind: z.literal('finish'), race: RaceId, tenths: z.number().int().positive() });

/** A BLOB dropped or an ORB fired: its id (the sender's id and a count), where it starts and, for an ORB, the way it flies. Never a BOOST, which stays the sender's own. */
const Item = z.object({
  kind: z.literal('item'),
  race: RaceId,
  id: z.string().min(1).max(96),
  item: z.enum(['blob', 'orb']),
  x: z.number(),
  y: z.number(),
  angle: z.number(),
});

/** The player hit by an item says so: the item's id, which takes it off every circuit. */
const Hit = z.object({ kind: z.literal('hit'), race: RaceId, id: z.string().min(1).max(96) });

const Message = z.discriminatedUnion('kind', [Start, State, Leave, Finish, Item, Hit]);
export type RaceMessage = z.infer<typeof Message>;
export type StateMessage = z.infer<typeof State>;
export type ItemMessage = z.infer<typeof Item>;

/**
 * What a message says, read back from what crossed the wire: null when it does not read, when its
 * players are the same twice, or (given the race's id) when it belongs to another race. A `start`
 * is a new race's, so it is never held to an id.
 */
export function readMessage(raw: unknown, race?: string): RaceMessage | null {
  const read = Message.safeParse(raw);
  if (!read.success) return null;
  const message = read.data;
  if (message.kind === 'start') return new Set(message.order.map((p) => p.id)).size === message.order.length ? message : null;
  return race === undefined || message.race === race ? message : null;
}

/** The messages a second one player sends in a race of `n` players: every message is sent once and delivered to the `n - 1` others, so a race costs `n² × rate`, and the rate keeps it inside the budget. */
export const rateFor = (n: number): number => Math.min(RULES.sendMax, Math.floor(RULES.messageBudget / Math.max(1, n * n)));

/** A kart read from its last state and carried forward along its speed and heading for `age` seconds, never more than `RULES.carry`. */
export function carried<K extends { x: number; y: number; angle: number; speed: number }>(kart: K, age: number): K {
  const t = Math.min(Math.max(age, 0), RULES.carry);
  return { ...kart, x: kart.x + Math.cos(kart.angle) * kart.speed * t, y: kart.y + Math.sin(kart.angle) * kart.speed * t };
}
