import 'server-only';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import type { Player } from '../arcade/types';
import { loadFleets, loadGalaxy, loadMe } from '../data/load-galaxy';
import { memberWorkspace, type Workspace } from '../data/workspace';
import { boardOf, loadBoard, supabaseReads, type BoardValue } from './board/load';
import type { Period } from './board/period';
import type { Waiting } from './counts/counts';
import { loadWaiting } from './counts/load';
import { homeRequest } from './home/team';
import { once, settle, UNREADABLE, type PartInput, type Read } from './part';
import { seasonBounds, type Season } from './season';
import { loadYou, loginOf, nameOf, type YouValue } from './you';

// Home's read (PRD 328, reshaped by PRD 572), as the signed-in person: row-level security decides
// what each read returns. First the workspace they joined first (joined by GitHub org at sign-in, PRD
// 359: src/data/sign-in.ts) and their player row in it, which say who they are to the game: their
// GitHub login and their fleet. Then, in parallel and each on its own, the hero block, Waiting for
// you, and the board with scope *you* whose People table is their team (home/team.ts): a read that
// fails reads 'unreadable', its error logged, and the rest renders. The galaxy (the whole ledger,
// folded) is read once, for the hero block and the board.

/** Everything /app shows a member, each part as its value or 'unreadable'. */
export interface DashboardData {
  /** The page's one heading: the player's name, else the account's first name. */
  name: string;
  season: Season;
  you: Read<YouValue>;
  waiting: Read<Waiting>;
  /** The board with scope *you*; its People table is your team. */
  board: BoardValue;
  /** No team to show (solo, or no player row): your row alone, and a link to Fleet. */
  solo: boolean;
}

/** What /app shows a signed-in person: their dashboard, or the notice for an account in no workspace. */
export type DashboardLoad = { kind: 'no-workspace' } | { kind: 'dashboard'; dashboard: DashboardData };

const NONE = { roster: UNREADABLE, activity: UNREADABLE, answered: UNREADABLE, galaxy: UNREADABLE } as const;

export async function loadDashboard(db: SupabaseClient, user: User, period: Period, now: Date): Promise<DashboardLoad> {
  const season = seasonBounds(now);
  let workspace: Workspace | null;
  try {
    workspace = await memberWorkspace(db, user.id);
  } catch (error) {
    // Out of reach: whether they belong to a workspace is unknown, so nobody is turned away; every
    // part says it could not load.
    console.error(`dashboard: your workspace could not be read (${(error as Error).message})`);
    const home = homeRequest({ userId: user.id, login: loginOf(null, user), team: null });
    const board = boardOf(NONE, { scope: home.scope, people: home.people, viewerId: user.id, period, now });
    return { kind: 'dashboard', dashboard: { name: nameOf(null, user), season, you: UNREADABLE, waiting: UNREADABLE, board, solo: home.solo } };
  }
  if (!workspace) return { kind: 'no-workspace' };

  const id = workspace.id;
  const me = await settle<Player | null>('your player', () => loadMe(db, id, user.id));
  const player = me === UNREADABLE ? null : me;
  const input: PartInput = {
    db, workspace: id, userId: user.id, login: loginOf(player, user), team: player?.team ?? null, now, season,
    galaxy: once(() => loadGalaxy(db, id, now)),
  };
  const home = homeRequest({ userId: user.id, login: input.login, team: input.team });
  const [you, waiting, board] = await Promise.all([
    settle('your hero', () => loadYou(input, me, () => loadFleets(db, id))),
    settle('the questions waiting for you', () => loadWaiting(input)),
    loadBoard(supabaseReads(db, id, input.galaxy), { scope: home.scope, people: home.people, viewerId: user.id, period, now }),
  ]);
  return { kind: 'dashboard', dashboard: { name: nameOf(player, user), season, you, waiting, board, solo: home.solo } };
}
