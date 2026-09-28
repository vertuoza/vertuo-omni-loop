import type { PartLoader } from '../part';

// A week of merges (PRD 328, slice s4): the 7-day chart of the pull requests you authored that merged
// into their repository's default branch, in Brussels days, read from `contributions`. A stub until
// then: it reads nothing, and shows nothing. Its value, its read, its view (Week.tsx), its demo
// (demo.ts) and its styles (week.css) are this folder's alone; the dashboard's shared files compose
// them (src/dashboard/part.ts).

/** What the week shows. */
export type WeekValue = null;

/** The week's read. */
export const loadWeek: PartLoader<WeekValue> = async () => null;
