import type { PartLoader } from '../part';

// The rankings (PRD 328, slice s3): every fleet the season knows, ranked by points with yours marked,
// and the individuals around you. A stub until then: it reads nothing, and shows nothing. Its value,
// its read, its view (Rankings.tsx), its demo (demo.ts) and its styles (rankings.css) are this
// folder's alone; the dashboard's shared files compose them (src/dashboard/part.ts).

/** What the rankings show. */
export type RankingsValue = null;

/** The rankings' read. */
export const loadRankings: PartLoader<RankingsValue> = async () => null;
