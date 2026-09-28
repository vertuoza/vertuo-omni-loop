// The season (PRD 328): the calendar month in UTC, the one the game's economy scores (buildGalaxy
// scores `now.toISOString().slice(0, 7)`). The dashboard's points, both rankings and its three season
// counts read within the same bounds, so they reset together. The week of merges alone counts
// Brussels days: a person reads "today" in their own time.

export interface Season {
  /** Its first instant: the 1st of the month, 00:00 UTC. */
  from: Date;
  /** The next season's first instant: the season holds every instant before it. */
  to: Date;
  /** The month's name, as the page says it: `September`. */
  name: string;
  /** The economy's key for it: `2026-09`. */
  key: string;
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export function seasonBounds(now: Date): Season {
  const year = now.getUTCFullYear(), month = now.getUTCMonth();
  const from = new Date(Date.UTC(year, month, 1));
  const to = new Date(Date.UTC(year, month + 1, 1));
  return { from, to, name: MONTHS[month], key: from.toISOString().slice(0, 7) };
}

/** Whether an instant (a Date, or an ISO string as a row holds it) falls in the season. */
export function inSeason({ from, to }: Season, at: Date | string): boolean {
  const t = typeof at === 'string' ? Date.parse(at) : at.getTime();
  return t >= from.getTime() && t < to.getTime();
}
