// The grid's rules (PRD 1572), pure: who holds a place, who waits, the starting order and who starts.
import { RULES } from './rules';
import { LAPS } from './track';
import { DEFAULT_CIRCUIT } from './circuits';
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

/** How many laps the grid will run (PRD 1762): the first arrival's `laps` when every player holding a place carries `laps`, and 3 otherwise. */
export function gridLapsOf(players: readonly GridPlayer[]): number {
  const { seated } = placesOf(players);
  const first = seated[0]?.laps;
  return first !== undefined && seated.every((p) => p.laps !== undefined) ? first : LAPS;
}

/** The circuit the grid will race (PRD 1923): its first arrival's `track`, and COMET RING when that entry carries none. */
export const gridTrackOf = (players: readonly GridPlayer[]): string => placesOf(players).seated[0]?.track ?? DEFAULT_CIRCUIT.id;
