import { loadCrew } from '../../data/load-galaxy';
import type { PartLoader } from '../part';
import { rankingsOf, type RankingsValue } from './rank';

// The rankings (PRD 328, slice s3): every fleet the season knows, ranked by points with yours marked,
// and the individuals around you, each by their display name. Two reads, in parallel, as the
// signed-in person: the season's galaxy (loadGalaxy, which the page reads once for every part that
// asks) and the workspace's players (loadCrew), whose names the individuals wear. Either failing
// throws, and the page reads the part as 'unreadable', its error logged (part.ts's settle): both
// tables then say they could not load. Its value and its tables are rank.ts's; its view is
// Rankings.tsx, its demo demo.ts and its styles rankings.css, this folder's alone.

export type { RankingsValue } from './rank';

/** The rankings' read. */
export const loadRankings: PartLoader<RankingsValue> = async ({ db, workspace, login, team, galaxy }) => {
  const [view, crew] = await Promise.all([galaxy(), loadCrew(db, workspace)]);
  return rankingsOf(view, crew, login, team);
};
