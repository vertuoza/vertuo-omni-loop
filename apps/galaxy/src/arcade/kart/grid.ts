// The grid's rules (PRD 1572), pure: who holds a place, who waits, the starting order and who starts.
import { RULES } from './rules';
import type { GridPlayer } from './net';

/** Players in the order they arrived on the grid; two at the same instant go by id, so every browser agrees. */
export const byArrival = (players: readonly GridPlayer[]): GridPlayer[] =>
  [...players].sort((a, b) => a.arrival - b.arrival || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

/**
 * The places: the first `RULES.places` players by arrival hold them, the rest wait. A waiting player
 * takes the first place that frees, in arrival order, because the places are read afresh each time.
 */
export function placesOf(players: readonly GridPlayer[]): { seated: GridPlayer[]; waiting: GridPlayer[] } {
  const arrived = byArrival(players);
  return { seated: arrived.slice(0, RULES.places), waiting: arrived.slice(RULES.places) };
}

/** The starting order: the fastest best time on pole, then by best time, a player with no time behind every timed one, a tie by arrival. */
export function startingOrder(players: readonly GridPlayer[]): GridPlayer[] {
  return byArrival(players).sort((a, b) => {
    if (a.best === b.best) return 0;
    if (a.best === null) return 1;
    if (b.best === null) return -1;
    return a.best - b.best;
  });
}

/** The player who starts the race: the first to arrive among those holding a place; the next takes over when they leave. */
export const starterOf = (players: readonly GridPlayer[]): GridPlayer | null => placesOf(players).seated[0] ?? null;

/** What the grid lists, in order: those holding a place in their starting order, then those who wait, in arrival order. */
export function rowsOf(players: readonly GridPlayer[]): { player: GridPlayer; seat: boolean }[] {
  const { seated, waiting } = placesOf(players);
  return [
    ...startingOrder(seated).map((player) => ({ player, seat: true })),
    ...waiting.map((player) => ({ player, seat: false })),
  ];
}
