// A duration in the board's words (PRD 612), kept apart from ./tally.ts so a page bundled for the browser
// (the PRD page's Timeline, PRD 2370, read on /ask too) can say a duration without pulling in the kit's
// config and board readers, which read files.
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

/** A duration as the board says it: `42 min`, `4.1 h`, `3.0 d`; a dash for none. */
export function durationWords(ms: number | null): string {
  if (ms === null) return '–';
  if (ms < HOUR) return `${Math.round(ms / MINUTE)} min`;
  if (ms < 48 * HOUR) return `${(ms / HOUR).toFixed(1)} h`;
  return `${(ms / (24 * HOUR)).toFixed(1)} d`;
}
