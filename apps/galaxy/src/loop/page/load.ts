// The Loop page's read (PRD 1139 s5), as the signed-in person, so row-level security decides what each
// read returns: a member reads their workspace's loops, ticks and plans (s2's migration). First the
// workspace the person joined first, as /app/engineering heads its board; with none, the no-workspace
// notice, and when it cannot be read, a line saying so. Then the list, or one loop with its ledger and
// its plans in parallel; a loop of another workspace, or none, is not found. Who runs each loop is read
// from the workspace's roster, which fails soft: its error logged, every runner reads "A member". The
// reads are a port (LoopPageReads) so the loader is tested on fakes; supabaseLoopPageReads is the page's.
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { messageOf } from 'vertuo-omni-plan/kit/lib/narrow.ts';
import type { Database } from '../../../../../supabase/database.types.ts';
import { RosterRow as RosterRowSchema } from '../../business/constituents-rows';
import { memberWorkspace, type Workspace } from '../../data/workspace';
import type { RosterRow } from '../../people/load';
import { loopReader } from '../store';
import { detailOf, runnersOf, summaryOf, type LoopPageView } from './model';
import type { LoopRow, PlanRow, TickRow } from './rows';

export interface LoopPageReads {
  /** The workspace the person joined first, or null for none. */
  workspace(): Promise<Workspace | null>;
  /** Every loop the person may read, the most recently pushed first. */
  loops(): Promise<LoopRow[]>;
  /** One loop, or null when it does not exist or is another workspace's. */
  loop(id: string): Promise<LoopRow | null>;
  ticks(id: string): Promise<TickRow[]>;
  plans(id: string): Promise<PlanRow[]>;
  /** The workspace's members. */
  roster(workspace: string): Promise<RosterRow[]>;
}

async function rosterOf(reads: LoopPageReads, workspace: string): Promise<RosterRow[]> {
  try {
    return await reads.roster(workspace);
  } catch (error) {
    console.error(`loop: the workspace's members could not be read (${messageOf(error)})`);
    return [];
  }
}

/** The list (`id` null) or one loop; `not-found` for a loop the workspace does not hold. */
export async function loadLoopPage(reads: LoopPageReads, id: string | null, now: Date): Promise<LoopPageView | { kind: 'not-found' }> {
  let workspace: Workspace | null;
  try {
    workspace = await reads.workspace();
  } catch (error) {
    console.error(`loop: your workspace could not be read (${messageOf(error)})`);
    return { kind: 'unreadable' };
  }
  if (!workspace) return { kind: 'no-workspace' };
  if (id === null) {
    const [loops, roster] = await Promise.all([reads.loops(), rosterOf(reads, workspace.id)]);
    const runners = runnersOf(roster);
    const ours = loops.filter((l) => l.workspace_id === workspace.id);
    return { kind: 'list', name: workspace.name, loops: ours.map((l) => summaryOf(l, runners, now.getTime())) };
  }
  const row = await reads.loop(id);
  if (!row || row.workspace_id !== workspace.id) return { kind: 'not-found' };
  const [ticks, plans, roster] = await Promise.all([reads.ticks(id), reads.plans(id), rosterOf(reads, workspace.id)]);
  return { kind: 'loop', name: workspace.name, loop: detailOf(row, ticks, plans, runnersOf(roster), now.getTime()) };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A loop's id as a path names it, or null when it cannot name one. */
export const loopIdOf = (part: string): string | null => (UUID.test(part) ? part.toLowerCase() : null);

/** The page's reads, from Supabase, as the signed-in person. */
export function supabaseLoopPageReads(db: SupabaseClient<Database>, user: Pick<User, 'id'>): LoopPageReads {
  const loops = loopReader(db);
  return {
    workspace: () => memberWorkspace(db, user.id),
    loops: () => loops.list(),
    loop: (id) => loops.loop(id),
    ticks: (id) => loops.ticks(id),
    plans: (id) => loops.plans(id),
    async roster(workspace) {
      const { data, error } = await db.rpc('workspace_roster', { workspace });
      if (error) throw new Error(error.message);
      return RosterRowSchema.array().parse(data);
    },
  };
}
