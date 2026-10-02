import 'server-only';
import { messageOf } from 'vertuo-omni-plan/kit/lib/narrow.ts';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import type { Database } from '../../../../../supabase/database.types.ts';
import { demoGalaxy, loadGalaxy } from '../../data/load-galaxy';
import { memberWorkspace, type Workspace } from '../../data/workspace';
import { once, UNREADABLE } from '../part';
import { demoBoard } from './demo';
import { boardOf, loadBoard, supabaseReads, type BoardRequest, type BoardValue } from './load';
import type { Period } from './period';

// /app/workspace's read (PRD 572): the board of the workspace the person joined first, with scope
// *the workspace* for both its activity and its People table, as the signed-in person. The galaxy is
// read once for the People table's points and the fleet ranking. With the workspace itself out of
// reach, nobody is turned away: every part says it could not load, as on /app.

export type WorkspaceBoard = { kind: 'no-workspace' } | { kind: 'board'; name: string; board: BoardValue };

const WHOLE = { scope: { kind: 'workspace' }, people: { kind: 'workspace' } } as const satisfies Pick<BoardRequest, 'scope' | 'people'>;

export async function loadWorkspaceBoard(db: SupabaseClient<Database>, user: Pick<User, 'id'>, period: Period, now: Date): Promise<WorkspaceBoard> {
  let workspace: Workspace | null;
  try {
    workspace = await memberWorkspace(db, user.id);
  } catch (error) {
    console.error(`dashboard: your workspace could not be read (${messageOf(error)})`);
    const none = { roster: UNREADABLE, activity: UNREADABLE, answered: UNREADABLE, galaxy: UNREADABLE } as const;
    return { kind: 'board', name: 'Workspace', board: boardOf(none, { ...WHOLE, viewerId: user.id, period, now }) };
  }
  if (!workspace) return { kind: 'no-workspace' };
  const id = workspace.id;
  const reads = supabaseReads(db, id, once(() => loadGalaxy(db, id, now)));
  return { kind: 'board', name: workspace.name, board: await loadBoard(reads, { ...WHOLE, viewerId: user.id, period, now }) };
}

/** The demo's Workspace: the demo world's board. */
export function demoWorkspaceBoard(period: Period, now: Date): WorkspaceBoard {
  return { kind: 'board', name: 'Demo workspace', board: demoBoard(demoGalaxy(now), { ...WHOLE, period, now }) };
}
