// How a game's best is compared and written (PRD 1440): `points`, the highest wins, shown in digits
// grouped by three (`9 210`); `time`, the lowest wins, shown as the race clock (`1:42.3`). Pure: every
// shared reader of a score goes through here, so none writes the direction itself.
import { GAMES, type Measure } from './games/index.ts';
import { raceTime } from './scenes/kart.ts';

/** Whether `a` beats `b` in this measure; equal values beat nothing. */
export const betterThan = (measure: Measure, a: number, b: number): boolean => (measure === 'time' ? a < b : a > b);

/** The better of two values. */
export const bestOf = (measure: Measure, a: number, b: number): number => (betterThan(measure, b, a) ? b : a);

/** The comparator a table sorts in, best first. */
export const orderOf = (measure: Measure) => (a: number, b: number): number => (measure === 'time' ? a - b : b - a);

/** A best as a table shows it: `9 210` for points, `1:42.3` for a time. */
export function textOf(measure: Measure, best: number): string {
  if (measure === 'time') return raceTime(best);
  return String(Math.max(0, Math.floor(best))).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/** A game's measure from its id: `points` for an id the registry does not hold. */
export const measureOf = (id: string): Measure => GAMES.find((g) => g.id === id)?.measure ?? 'points';
