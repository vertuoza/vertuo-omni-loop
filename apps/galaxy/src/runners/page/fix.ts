import { z } from 'zod';
import type { PrdNumber } from 'vertuo-omni-plan/kit/lib/ids.ts';
import { refuse, reply } from '../../business-api/reply';
import type { OutboxStand } from '../../dossier/page/stage';
import { prdOfLine } from '../continue';
import { RUNNER_REFUSALS, type Job } from '../runners.contract';

// Fix with answers (PRD 2270 s2): the button on a job that waited, once every asked item of its PRD is
// answered while nobody continued it (the repository's switch is off, or the touch could not decide).
// POST /api/runners/jobs/<id>/fix queues `/omni:yolo-fix <n>` to where that job went, in the name of the
// person pressing, linked to it as its continuation, through the same rules as the automatic fix
// (../runners.service.ts continuationsService, with `by`): the answers are read again from the PRD's
// stored snapshot, never taken from the browser, and the database's unique `continues` refuses a second.
// A port, so the route is tested on fakes; ./fix.live.ts is the page's.

export interface FixDeps {
  /** The signed-in person of the page's session, by id, or null. */
  caller(): Promise<string | null>;
  /** The job's workspace, repository and line; null when there is none. */
  job(id: string): Promise<{ workspaceId: string; repo: string; line: string } | null>;
  /** Where the PRD's asked questions stand, from its stored snapshot. */
  stand(workspaceId: string, repo: string, prd: PrdNumber): Promise<OutboxStand | null>;
  /** The continuation's rules, in the person's name. */
  continueAnswered(request: { workspaceId: string; repo: string; prd: PrdNumber; stand: OutboxStand | null; by: string }): Promise<{ queued: Job | null; why: string | null }>;
  log(line: string): void;
}

const FAILED = 'The runners could not answer. Try again.';

export async function fixWithAnswers(id: string, deps: FixDeps): Promise<Response> {
  const caller = await deps.caller();
  if (caller === null) return refuse(RUNNER_REFUSALS['signed-out'], 'Sign in first.');
  if (!z.uuid().safeParse(id).success) return refuse(RUNNER_REFUSALS.missing, 'No such job.');
  try {
    const job = await deps.job(id);
    const prd = job === null ? null : prdOfLine(job.line);
    if (job === null || prd === null) return refuse(RUNNER_REFUSALS.missing, 'No such job.');
    const stand = await deps.stand(job.workspaceId, job.repo, prd);
    const done = await deps.continueAnswered({ workspaceId: job.workspaceId, repo: job.repo, prd, stand, by: caller });
    return done.queued ? reply(200, { job: done.queued }) : refuse(RUNNER_REFUSALS.conflict, `Nothing was queued: ${done.why ?? 'the job cannot be continued'}.`);
  } catch (error) {
    deps.log(`runners: ${error instanceof Error ? error.message : String(error)}`);
    return refuse(RUNNER_REFUSALS.database, FAILED);
  }
}
