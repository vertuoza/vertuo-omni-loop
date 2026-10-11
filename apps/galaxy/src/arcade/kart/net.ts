// OMNI KART's live messages, as they cross the wire (PRD 1572): pure, so a test reads what was sent
// back with no browser and no Supabase. This slice reads the grid's own message, a player's Presence
// entry; the race's messages (start, state, item, hit, finish, leave) join it in the slices after.
import { z } from 'zod';
import { StoredHero } from '../../data/players';

/**
 * A player on the grid, as they say it themselves: their id, name, hero, fleet and best time at OMNI
 * KART in tenths of a second (null before a first race), and when they arrived on the grid (ms).
 */
const Entry = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(64),
  hero: StoredHero,
  fleet: z.string().nullable(),
  best: z.number().int().positive().nullable(),
  arrival: z.number().finite(),
});
export type GridPlayer = z.infer<typeof Entry>;

/** What a player tracks on the grid: their entry, nothing else. */
export const presenceOf = (player: GridPlayer): Record<string, unknown> => ({
  id: player.id, name: player.name, hero: player.hero, fleet: player.fleet, best: player.best, arrival: player.arrival,
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
