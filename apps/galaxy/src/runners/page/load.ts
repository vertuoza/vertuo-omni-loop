import { log } from 'vertuo-omni-plan/kit/lib/log/log.ts';
import { messageOf } from 'vertuo-omni-plan/kit/lib/narrow.ts';
import type { Workspace } from '../../data/workspace';
import type { OutboxStand } from '../../dossier/page/stage';
import { prdOfLine, shouldContinue } from '../continue';
import type { PrdNumber } from 'vertuo-omni-plan/kit/lib/ids.ts';
import type { Board, Job } from '../runners.contract';
import type { Served } from '../runners.service';
import type { Fleet, PrdTitles, RunnersPageView } from './model';

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
  /** Where a PRD's asked questions stand, from its stored GitHub snapshot (PRD 2270); null when unread or none asked. */
  stand(workspaceId: string, repo: string, prd: PrdNumber): Promise<OutboxStand | null>;
  /** The titles of the PRDs the person may read, for the line under a job that builds one (PRD 2251). */
  prds(): Promise<PrdTitles>;
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

/** The ids of the jobs that waited on answers whose PRD now has every asked item answered, with nothing
 * queued or running and no continuation yet (PRD 2270): the continuation's own rules (../continue.ts), the
 * repository's switch aside, so the page reads Answered where a person may press Fix with answers. A stand
 * that cannot be read leaves the job at Waiting on answers. */
export async function answeredJobs(reads: RunnersPageReads, workspaceId: string, jobs: readonly Job[]): Promise<string[]> {
  const seen = jobs.map((job) => ({ id: job.id, line: job.line, status: job.status, outcome: job.outcome, continues: job.continues, queued_at: job.queuedAt, repo: job.repo }));
  const candidates = seen.filter((job) => job.status === 'done' && job.outcome === 'answers' && !seen.some((other) => other.continues === job.id));
  const found = await Promise.all(candidates.map(async (candidate) => {
    const prd = prdOfLine(candidate.line);
    if (prd === null) return [];
    try {
      const stand = await reads.stand(workspaceId, candidate.repo, prd);
      const decision = shouldContinue({ prd, stand, jobs: seen.filter((job) => job.repo === candidate.repo), switchOn: true });
      return decision.continue && decision.job.id === candidate.id ? [candidate.id] : [];
    } catch (error) {
      failed(`the answers of ${candidate.repo} ${String(prd)} could not be read (${messageOf(error)})`);
      return [];
    }
  }));
  return found.flat();
}

async function prdsOf(reads: RunnersPageReads): Promise<PrdTitles> {
  try {
    return await reads.prds();
  } catch (error) {
    failed(`the PRD titles could not be read (${messageOf(error)})`);
    return {};
  }
}

export async function loadRunnersPage(reads: RunnersPageReads, now: Date): Promise<RunnersPageView> {
  try {
    const workspace = await reads.workspace();
    if (!workspace) return { kind: 'no-workspace' };
    const [served, fleets, prds] = await Promise.all([reads.board(workspace.id), fleetsOf(reads, workspace.id), prdsOf(reads)]);
    if (!served.ok) {
      failed(`the board could not be read (${served.error})`);
      return { kind: 'unreadable' };
    }
    return { kind: 'board', name: workspace.name, board: served.value, fleets, prds, now: now.toISOString(), answered: await answeredJobs(reads, workspace.id, served.value.jobs) };
  } catch (error) {
    failed(`the page could not be read (${messageOf(error)})`);
    return { kind: 'unreadable' };
  }
}
