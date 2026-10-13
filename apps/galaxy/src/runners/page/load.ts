import { log } from 'vertuo-omni-plan/kit/lib/log/log.ts';
import { messageOf } from 'vertuo-omni-plan/kit/lib/narrow.ts';
import type { Workspace } from '../../data/workspace';
import type { Board } from '../runners.contract';
import type { Served } from '../runners.service';
import type { Fleet, RunnersPageView } from './model';

// The Runners page's read (PRD 1830 s3): the workspace the person joined first, as every board page
// heads its own; with none, the no-workspace notice. Then the board, through the runners' service (its
// rules: a member only, a lost runner's jobs marked first), and the workspace's fleets for an owner's
// picker, in parallel. The fleets fail soft: an owner then picks only Shared or a runner's own fleet.
// The reads are a port so the loader is tested on fakes; ./live.ts is the page's.

export interface RunnersPageReads {
  /** The workspace the person joined first, or null for none. */
  workspace(): Promise<Workspace | null>;
  /** The board, as the service serves it to the person. */
  board(workspaceId: string): Promise<Served<Board>>;
  /** The workspace's fleets. */
  fleets(workspaceId: string): Promise<Fleet[]>;
}

const failed = (message: string) => { log.error({ event: 'runners-page', outcome: 'failed', message }); };

async function fleetsOf(reads: RunnersPageReads, workspaceId: string): Promise<Fleet[]> {
  try {
    return await reads.fleets(workspaceId);
  } catch (error) {
    failed(`the fleets could not be read (${messageOf(error)})`);
    return [];
  }
}

export async function loadRunnersPage(reads: RunnersPageReads, now: Date): Promise<RunnersPageView> {
  try {
    const workspace = await reads.workspace();
    if (!workspace) return { kind: 'no-workspace' };
    const [served, fleets] = await Promise.all([reads.board(workspace.id), fleetsOf(reads, workspace.id)]);
    if (!served.ok) {
      failed(`the board could not be read (${served.error})`);
      return { kind: 'unreadable' };
    }
    return { kind: 'board', name: workspace.name, board: served.value, fleets, now: now.toISOString() };
  } catch (error) {
    failed(`the page could not be read (${messageOf(error)})`);
    return { kind: 'unreadable' };
  }
}
