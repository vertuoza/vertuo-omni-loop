import type { PartLoader } from '../part';

// The four counts (PRD 328, slice s5): questions answered, outbox settled and PRDs created this
// season, and the questions waiting for you now. A stub until then: it reads nothing, and shows
// nothing. Its value, its read, its view (Counts.tsx), its demo (demo.ts) and its styles (counts.css)
// are this folder's alone; the dashboard's shared files compose them (src/dashboard/part.ts).

/** What the counts show. */
export type CountsValue = null;

/** The counts' read. */
export const loadCounts: PartLoader<CountsValue> = async () => null;
