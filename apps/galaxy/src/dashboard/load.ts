import 'server-only';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import type { Player } from '../arcade/types';
import { loadFleets, loadGalaxy, loadMe } from '../data/load-galaxy';
import { memberWorkspace, type Workspace } from '../data/workspace';
import { loadCounts, type CountsValue } from './counts/load';
import { once, settle, UNREADABLE, type PartInput, type Read } from './part';
import { loadRankings, type RankingsValue } from './rankings/load';
import { seasonBounds, type Season } from './season';
import { loadWeek, type WeekValue } from './week/load';
import { loadYou, loginOf, nameOf, type YouValue } from './you';

// The dashboard's read (PRD 328), as the signed-in person: row-level security decides what each read
// returns. First the workspace they joined first (joined by domain once, when they belong to none
// yet: src/data/workspace.ts) and their player row in it, which say who they are to the game: their
// GitHub login and their fleet. Then the hero block and every part, in parallel, each on its own
// (part.ts): a part whose read fails reads 'unreadable', its error logged, and the rest renders. The
// galaxy (the whole ledger, folded) is read once, for whichever parts ask for it.

/** Everything /app shows a member, each part as its value or 'unreadable'. */
export interface Dashboard {
  /** The page's one heading: the player's name, else the account's first name. */
  name: string;
  season: Season;
  you: Read<YouValue>;
  week: Read<WeekValue>;
  counts: Read<CountsValue>;
  rankings: Read<RankingsValue>;
}

/** What /app shows a signed-in person: their dashboard, or the notice for an account in no workspace. */
export type DashboardLoad = { kind: 'no-workspace' } | { kind: 'dashboard'; dashboard: Dashboard };

export async function loadDashboard(db: SupabaseClient, user: User, now: Date): Promise<DashboardLoad> {
  const season = seasonBounds(now);
  let workspace: Workspace | null;
  try {
    workspace = await memberWorkspace(db, user.id);
  } catch (error) {
    // Out of reach: whether they belong to a workspace is unknown, so nobody is turned away; every
    // part says it could not load.
    console.error(`dashboard: your workspace could not be read (${(error as Error).message})`);
    const name = nameOf(null, user);
    return { kind: 'dashboard', dashboard: { name, season, you: UNREADABLE, week: UNREADABLE, counts: UNREADABLE, rankings: UNREADABLE } };
  }
  if (!workspace) return { kind: 'no-workspace' };

  const id = workspace.id;
  const me = await settle<Player | null>('your player', () => loadMe(db, id, user.id));
  const player = me === UNREADABLE ? null : me;
  const input: PartInput = {
    db, workspace: id, userId: user.id, login: loginOf(player, user), team: player?.team ?? null, now, season,
    galaxy: once(() => loadGalaxy(db, id, now)),
  };
  const [you, week, counts, rankings] = await Promise.all([
    settle('your hero', () => loadYou(input, me, () => loadFleets(db, id))),
    settle('the week of merges', () => loadWeek(input)),
    settle('the counts', () => loadCounts(input)),
    settle('the rankings', () => loadRankings(input)),
  ]);
  return { kind: 'dashboard', dashboard: { name: nameOf(player, user), season, you, week, counts, rankings } };
}
