// `approved-check`: the `omni/approved` check (PRD 1612), and `approved-rerun`, which runs it again on
// every open pull request of a PRD whose approved label changed.
//
//   approved-check, on the outbox check's event (every handled pull request action) and on
//   `APPROVED_CHECK_EVENT`, debounced per pull request:
//     step "judge"  read the pull request and its base's config (none: post nothing, PRD 359); tell
//                   which PRD it is about (./subject.ts: a feature PR, or a target PR `Part of
//                   <owner/repo>#<n>`, whose PRD is read on that repository's feature PR); read the
//                   PRD's folder at that head through Git trees and blobs; a PRD born in its repository
//                   (◇, its spec without `phase0: server`) gets no check; ask galaxy for the approval
//                   in force (./judge-client.ts) and judge it with the kit's one judge
//     step "post"   post the check, completed, as ./verdict.ts says it
//
//   approved-rerun, on `APPROVED_LABEL_EVENT`, debounced per PRD:
//     step "find"   the PRD's open feature PRs and its target PRs (./github.ts)
//     step "rerun"  one `APPROVED_CHECK_EVENT` each
//
// No poll: webhooks only. Every GitHub call spends the installation's budget through the shared client
// (PRD 902): a step the budget refuses is retried once it allows, never sooner. A galaxy that cannot be
// read holds the check, neutral, never failed.
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { RetryAfterError, type Inngest } from 'inngest';
import { GithubDeferred, GithubPaused } from '@omni/github';
import { checkoutTree, judgeApproval, type ApprovalReading } from 'vertuo-omni-plan/kit/lib/approval/approval.ts';
import { birthplaceOf } from 'vertuo-omni-plan/kit/lib/approval/prd-state.ts';
import { ARTIFACT_KINDS } from 'vertuo-omni-plan/kit/lib/dossier/folder.ts';
import type { PrdNumber } from 'vertuo-omni-plan/kit/lib/ids.ts';
import { foldersLayout } from 'vertuo-omni-plan/kit/lib/layout.ts';
import type { Config } from 'vertuo-omni-plan/kit/lib/types.ts';
import { NOT_ACTIVE_ON_REPO } from '../evaluate/evaluate.ts';
import { OUTBOX_CHECK_EVENT } from '../inngest-client.ts';
import type { OctokitFor } from '../octokit-for.ts';
import { readPull } from '../outbox-check/github.ts';
import type { GitHubClient, Repo } from '../outbox-check/github-schema.ts';
import { SnapshotBoundError, snapshot } from '../snapshot/snapshot.ts';
import {
  APPROVED_CHECK_EVENT,
  APPROVED_LABEL_EVENT,
  ApprovedCheckDataSchema,
  ApprovedLabelDataSchema,
  type ApprovedCheckRequest,
} from './events.ts';
import { configAt, featurePullOf, openPullsOfPrd, postApprovedCheck, prdFolderAt, type PullRef } from './github.ts';
import type { JudgeAnswer } from './judge-client.ts';
import { subjectOf } from './subject.ts';
import { approvedOutput, heldReading, type ApprovedOutput } from './verdict.ts';

export const APPROVED_FUNCTION_ID = 'approved-check';
export const APPROVED_RERUN_FUNCTION_ID = 'approved-rerun';

/** One check per repository and pull request at a time: the latest event wins. */
export const APPROVED_DEBOUNCE = Object.freeze({
  key: 'event.data.repository + "#" + string(event.data.prNumber)',
  period: '5s',
  timeout: '1m',
});

/** One rerun per PRD at a time: a label removed and added again is one rerun. */
export const RERUN_DEBOUNCE = Object.freeze({
  key: 'event.data.repository + "#" + string(event.data.prd)',
  period: '5s',
  timeout: '1m',
});

/** Asks galaxy for PRD `prd` of `repo` (owner/name). */
export type AskJudge = (repo: string, prd: PrdNumber) => Promise<JudgeAnswer>;

/** What the step "judge" decided: post nothing, with why, or the check to post. */
type Judged = { posted: false; reason: string } | { name: string; headSha: string; prd: PrdNumber; output: ApprovedOutput };

/** Where a PRD's folder is read: a repository at a head, with its config. */
type PrdSource = Repo & { ref: string; config: Config; which: (folder: { prd: PrdNumber; topic: string }) => boolean };

const nothing = (reason: string): Judged => ({ posted: false, reason });

export function createApprovedCheck({
  client,
  octokitFor,
  ask,
  log = (line) => { console.error(line); },
}: {
  client: Inngest;
  octokitFor: OctokitFor<GitHubClient>;
  ask: AskJudge;
  log?: (line: string) => void;
}) {
  return client.createFunction(
    {
      id: APPROVED_FUNCTION_ID,
      name: 'omni-loop · approved',
      triggers: [{ event: OUTBOX_CHECK_EVENT }, { event: APPROVED_CHECK_EVENT }],
      debounce: APPROVED_DEBOUNCE,
      retries: 3,
    },
    async ({ event, step }) => {
      const { installationId, owner, repo, prNumber } = ApprovedCheckDataSchema.parse(event.data);
      const where = `${owner}/${repo}#${prNumber}`;
      const judged = await step.run('judge', () => budgeted(where, log, async () =>
        judgePull(await octokitFor(installationId), { owner, repo, prNumber }, ask)));
      if ('posted' in judged) return judged;
      const checkRunId = await step.run('post', () => budgeted(where, log, async () =>
        postApprovedCheck(await octokitFor(installationId), { owner, repo, name: judged.name, headSha: judged.headSha, output: judged.output })));
      return { checkRunId, name: judged.name, conclusion: judged.output.conclusion, title: judged.output.title };
    },
  );
}

export function createApprovedRerun({
  client,
  octokitFor,
  log = (line) => { console.error(line); },
}: {
  client: Inngest;
  octokitFor: OctokitFor<GitHubClient>;
  log?: (line: string) => void;
}) {
  return client.createFunction(
    {
      id: APPROVED_RERUN_FUNCTION_ID,
      name: 'omni-loop · approved, rerun',
      triggers: [{ event: APPROVED_LABEL_EVENT }],
      debounce: RERUN_DEBOUNCE,
      retries: 3,
    },
    async ({ event, step }) => {
      const { installationId, owner, repo, prd, trigger } = ApprovedLabelDataSchema.parse(event.data);
      const pulls = await step.run('find', () => budgeted(`${owner}/${repo} PRD ${Number(prd)}`, log, async () =>
        openPullsOfPrd(await octokitFor(installationId), { owner, repo, prd })));
      if (pulls.length === 0) return { rerun: [] };
      await step.sendEvent('rerun', pulls.map((pull) => rerunOf(installationId, pull, trigger)));
      return { rerun: pulls.map((pull) => `${pull.owner}/${pull.repo}#${pull.prNumber}`) };
    },
  );
}

/** The event that runs the check again on `pull`. */
function rerunOf(installationId: number, pull: PullRef, trigger: string | undefined): ApprovedCheckRequest {
  const data = { installationId, owner: pull.owner, repo: pull.repo, repository: `${pull.owner}/${pull.repo}`, prNumber: pull.prNumber };
  return { name: APPROVED_CHECK_EVENT, data: trigger === undefined ? data : { ...data, trigger } };
}

/** The step "judge": what the check says on pull request `prNumber`, or why it posts nothing. */
async function judgePull(octokit: GitHubClient, { owner, repo, prNumber }: Pick<PullRef, 'owner' | 'repo' | 'prNumber'>, ask: AskJudge): Promise<Judged> {
  const pr = await readPull(octokit, { owner, repo, prNumber });
  const config = await configAt(octokit, { owner, repo, ref: pr.baseSha });
  if (!config) return nothing(NOT_ACTIVE_ON_REPO);
  const subject = subjectOf(pr, config, `${owner}/${repo}`);
  if ('skip' in subject) return nothing(subject.skip);

  const check = (prd: PrdNumber, reading: ApprovalReading, read: string): Judged =>
    ({ name: config.ci.approvedContext, headSha: pr.headSha, prd, output: approvedOutput(prd, reading, read) });

  let source: PrdSource;
  if (subject.kind === 'feature') {
    source = { owner, repo, ref: pr.headSha, config, which: (folder) => folder.topic === subject.topic };
  } else {
    const feature = await featurePullOf(octokit, { slug: subject.repo, prd: subject.prd });
    if ('held' in feature) return check(subject.prd, heldReading(feature.held), pr.headSha);
    const [planOwner = '', planRepo = ''] = subject.repo.split('/');
    source = { owner: planOwner, repo: planRepo, ref: feature.pull.headSha, config: feature.config, which: (folder) => folder.prd === subject.prd };
  }
  const folder = await prdFolderAt(octokit, source);
  if (!folder) return nothing(`No PRD folder for this pull request at ${source.ref}.`);
  const reading = await readingAt(octokit, source, folder, ask);
  return reading ? check(folder.prd, reading, source.ref) : nothing(`PRD ${Number(folder.prd)} was born in its repository (◇): its phase-0 PR approved it.`);
}

/** The judge's reading of the PRD in `folder` at `source`'s head, or null for a ◇ PRD. The folder (and
 * any pinned file outside it) is read into a temporary folder, removed whatever happens. */
async function readingAt(octokit: GitHubClient, source: PrdSource, folder: { prd: PrdNumber; dir: string }, ask: AskJudge): Promise<ApprovalReading | null> {
  const { owner, repo, ref, config } = source;
  const root = mkdtempSync(join(tmpdir(), 'omni-approved-'));
  try {
    try {
      await snapshot(octokit, { owner, repo, ref, paths: [folder.dir], dest: root });
    } catch (error) {
      if (error instanceof SnapshotBoundError) return heldReading(error.message);
      throw error;
    }
    const ctx = { root, layout: foldersLayout(root, config.paths) };
    if (birthplaceOf(ctx, folder.prd) !== 'server') return null;
    const answer = await ask(`${owner}/${repo}`, folder.prd);
    if ('held' in answer) return heldReading(answer.held);
    const kept = new Set<string>(ARTIFACT_KINDS.map((entry) => entry.kind));
    const elsewhere = (answer.reply.approval?.files ?? []).filter((file) => !kept.has(file.kind)).map((file) => file.path);
    if (elsewhere.length > 0) await snapshot(octokit, { owner, repo, ref, paths: elsewhere, dest: root });
    return judgeApproval(folder.prd, answer.reply, checkoutTree(ctx, folder.prd));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

/** The budget's refusal behind `error`, however deep Octokit wrapped it; null when there is none. */
function refusalOf(error: unknown): GithubPaused | GithubDeferred | null {
  for (let cause = error, depth = 0; cause instanceof Error && depth < 4; cause = cause.cause, depth += 1) {
    if (cause instanceof GithubPaused || cause instanceof GithubDeferred) return cause;
  }
  return null;
}

/** Runs a step: a call the installation's budget refused (PRD 902) logs one line, and the step is
 * retried once the budget allows it. */
async function budgeted<T>(where: string, log: (line: string) => void, work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    const refused = refusalOf(error);
    if (!refused) throw error;
    log(`approved check of ${where} waits for the GitHub budget: ${refused.message}`);
    throw new RetryAfterError(refused.message, new Date(refused.until), { cause: refused });
  }
}
