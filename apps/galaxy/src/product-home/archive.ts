// Archive a product (PRD 2232 s1): the words of the product home's Archive, the browser's confirm it asks
// first, and the banner over an archived product's home. Pure, so the page and its tests share them.

/** When, and by whom, an owner archived the product: `by` is their GitHub login, null when unknown. */
export interface Archived {
  at: string;
  by: string | null;
}

/** What Archive asks first: what archiving does, and the repositories that stop reading the product. */
export function archiveConfirm(name: string, repositories: readonly string[]): string {
  const asked = `Archive ${name}? It leaves every member's list, and its repositories stop reading its Legal entries and glossary.`;
  return repositories.length === 0 ? asked : `${asked}\n\nRepositories: ${repositories.join(', ')}`;
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const count = (n: number, unit: string) => `${String(n)} ${unit}${n === 1 ? '' : 's'} ago`;

/** How long ago `at` was, read at `now`: just now, then minutes, hours, days. */
export function ago(at: string, now: number): string {
  const ms = Math.max(0, now - Date.parse(at));
  if (Number.isNaN(ms) || ms < MINUTE) return 'just now';
  if (ms < HOUR) return count(Math.floor(ms / MINUTE), 'minute');
  if (ms < DAY) return count(Math.floor(ms / HOUR), 'hour');
  return count(Math.floor(ms / DAY), 'day');
}

/** The banner's line: `Archived 2 days ago by pierrederval.`, or with no name when none is known. */
export const archivedLine = (archived: Archived, now: number): string =>
  `Archived ${ago(archived.at, now)}${archived.by === null ? '' : ` by ${archived.by}`}.`;
