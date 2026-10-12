// `approved-check`: the Inngest function posting **omni/approved** (`ci.approvedContext`) on a pull
// request whose PRD was approved on the server, saying whether what it builds is what was approved:
// a target feature PR of a product PRD (PRD 1548 s3), and a ◆ PRD's feature PR or a target PR that is
// `Part of <owner/repo>#<n>` (PRD 1612, folded into PRD 1548's design). Beside it, `approved-rerun`
// runs it again on every open pull request of a PRD whose approved label changed (PRD 1612).
//
//   step "target"   read the pull request and its base branch's config: a base without the loop's config,
//                   or a config whose `ci.approvedContext` is null, gets nothing at all, not even
//                   `skipped`. A body naming a product PRD (`Part of mobile-12`) is that product PRD's.
//                   Otherwise the pull request is a ◆ PRD's when ./subject.ts says it is a feature PR, or
//                   a target PR naming another repository's PRD, and that PRD's folder is found at the
//                   head it is read at (./github.ts); anything else gets nothing
//   step "record"   a product PRD: read its record, as the service role (./record.ts). A ◆ PRD: read its
//                   folder at that head through Git trees and blobs, ask galaxy's judge for the approval
//                   in force (./judge-client.ts) and judge it with the kit's one judge; a PRD born in its
//                   repository (◇) gets nothing. A read that fails is `held`, never failed
//   step "publish"  post the check run completed, with the conclusion and line ./state.ts gives
//                   (`approvedVerdict`, and ./repo-verdict.ts `repoApprovedVerdict`: one set of states), and its Details on the
//                   PRD page: a product PRD's attestation (`#attestation`), a ◆ PRD's approval (`#approval`)
//
//   approved-rerun, on APPROVED_LABEL_EVENT, debounced per PRD:
//     step "find"   the PRD's open feature PRs and its target PRs (./github.ts), each with its head
//     step "rerun"  one APPROVED_CHECK_EVENT each
//
// It listens to the outbox check's event, so every pull request action that re-evaluates the outbox
// check re-evaluates this one, and to its own, which the webhook sends for a re-run of an approved check
// run (its `external_id` is APPROVED_EXTERNAL_ID) and the rerun sends. Debounced per repository and pull
// request, 3 retries, like the outbox check. It posts on events only, never polls: a run held on an
// unreachable server is posted again by the next event, or a re-run.
//
// The installation's GitHub budget is shared with galaxy (PRD 902): a call the budget refuses, paused or
// deferred, is never sent; the step logs one line and is retried once the pause or the window ends.
import { RetryAfterError, type Inngest } from 'inngest';
import { GithubDeferred, GithubPaused } from '@omni/github';
import type { PrNumber, PrdNumber } from 'vertuo-omni-plan/kit/lib/ids.ts';
import type { Config } from 'vertuo-omni-plan/kit/lib/types.ts';
import {
  APPROVED_CHECK_EVENT,
  APPROVED_EXTERNAL_ID,
  APPROVED_LABEL_EVENT,
  ApprovedLabelDataSchema,
  CheckRequestDataSchema,
  OUTBOX_CHECK_EVENT,
  type CheckRequest,
} from '../inngest-client.ts';
import type { OctokitFor } from '../octokit-for.ts';
import { readPull, type GitHubClient } from '../outbox-check/github.ts';
import { CreatedSchema } from '../outbox-check/github-schema.ts';
import { MAX_SUMMARY } from '../publish/publish.ts';
import { configAt, featurePullOf, openPullsOfPrd, prdFolderAt, type PullRef } from './github.ts';
import type { RecordReader } from './record.ts';
import { heldReading, readingAt, type AskJudge, type RepoSource } from './repo-reading.ts';
import { repoApprovedVerdict } from './repo-verdict.ts';
import { approvedVerdict, productPrdOf, type ApprovedVerdict, type ProductPrdRef, type RecordReading } from './state.ts';
import { subjectOf } from './subject.ts';

export const APPROVED_FUNCTION_ID = 'approved-check';
export const APPROVED_RERUN_FUNCTION_ID = 'approved-rerun';

/** What a run returns when it posted nothing: no PRD approved on the server named, no loop here, or the check turned off. */
const SILENT = Object.freeze({ posted: false, reason: 'not a pull request of a PRD approved on the server, with the approved check on' });

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

/**
 * The check's target: its name and the PRD the pull request is about, a product PRD by its id, or a ◆
 * PRD of a repository with its folder at the head it is read at (or why that head could not be found).
 */
type Target =
  | { kind: 'product'; name: string; prd: ProductPrdRef }
  | { kind: 'repo'; name: string; prd: PrdNumber; source: RepoSource; dir: string }
  | { kind: 'repo'; name: string; prd: PrdNumber; held: string; head: string };

/** The galaxy that holds no judge here: every ◆ PRD's check is held. */
const NO_JUDGE: AskJudge = () => Promise.resolve({ held: 'the App cannot ask galaxy\'s judge here' });

export function createApprovedCheck({
  client,
  octokitFor,
  readRecord,
  galaxyUrl,
  ask = NO_JUDGE,
  now = () => new Date(),
  log = (line) => { console.error(line); },
}: {
  client: Inngest;
  octokitFor: OctokitFor<GitHubClient>;
  /** The record's reader; null when the App cannot read the server here, which holds every product PRD's check. */
  readRecord: RecordReader | null;
  galaxyUrl: string;
  /** Galaxy's judge, for a ◆ PRD (PRD 1612); none given, every ◆ PRD's check is held. */
  ask?: AskJudge;
  now?: () => Date;
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
      const { installationId, owner, repo, repository, prNumber, headSha } = CheckRequestDataSchema.parse(event.data);
      const budgeted = <T>(work: () => Promise<T>) => onBudget(`${owner}/${repo}#${prNumber}`, log, work);

      const target = await step.run('target', () => budgeted(async () => targetOf(await octokitFor(installationId), { owner, repo, prNumber })));
      if (!target) return { ...SILENT };

      let verdict: ApprovedVerdict;
      let named: string;
      if (target.kind === 'product') {
        const reading = await step.run('record', () => readingOf(readRecord, repository, target.prd, now, log));
        verdict = approvedVerdict(target.prd, reading);
        named = target.prd.id;
      } else {
        const judged = await step.run('record', () => budgeted(async () => judgedAt(await octokitFor(installationId), target, ask)));
        if (!judged) return { posted: false, reason: `PRD ${Number(target.prd)} was born in its repository (◇): its phase-0 PR approved it.` };
        verdict = repoApprovedVerdict(target.prd, judged.reading, judged.head);
        named = `${Number(target.prd)}`;
      }

      const anchor = target.kind === 'product' ? 'attestation' : 'approval';
      const checkRunId = await step.run('publish', () => budgeted(async () =>
        postApproved(await octokitFor(installationId), { owner, repo, headSha, name: target.name, verdict, galaxyUrl, anchor })));

      return { checkRunId, name: target.name, prd: named, state: verdict.state, conclusion: verdict.conclusion };
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
      const pulls = await step.run('find', () => onBudget(`${owner}/${repo} PRD ${Number(prd)}`, log, async () => {
        const octokit = await octokitFor(installationId);
        const found = await openPullsOfPrd(octokit, { owner, repo, prd });
        return Promise.all(found.map(async (pull) => ({ ...pull, headSha: (await readPull(octokit, pull)).headSha })));
      }));
      if (pulls.length === 0) return { rerun: [] };
      await step.sendEvent('rerun', pulls.map((pull) => rerunOf(installationId, pull, trigger)));
      return { rerun: pulls.map((pull) => `${pull.owner}/${pull.repo}#${pull.prNumber}`) };
    },
  );
}

/** The event that runs the check again on `pull`, at its head. */
function rerunOf(installationId: number, pull: PullRef & { headSha: string }, trigger: string | undefined): CheckRequest {
  const data = { installationId, owner: pull.owner, repo: pull.repo, repository: `${pull.owner}/${pull.repo}`, prNumber: pull.prNumber, headSha: pull.headSha };
  return { name: APPROVED_CHECK_EVENT, data: trigger === undefined ? data : { ...data, trigger } };
}

/**
 * The check's name and PRD on this pull request, or null when it gets no check: its base branch has no
 * loop config, or `ci.approvedContext` is null there, or it names no PRD approved on the server. A broken
 * config posts no check either: the outbox check says what is wrong with it.
 */
async function targetOf(octokit: GitHubClient, { owner, repo, prNumber }: { owner: string; repo: string; prNumber: PrNumber }): Promise<Target | null> {
  const pr = await readPull(octokit, { owner, repo, prNumber });
  const product = productPrdOf(pr.body);
  const config = await configAt(octokit, { owner, repo, ref: pr.baseSha });
  const name = config?.ci.approvedContext ?? null;
  if (!config || name === null) return null;
  if (product) return { kind: 'product', name, prd: product };

  const subject = subjectOf(pr, config, `${owner}/${repo}`);
  if ('skip' in subject) return null;
  let at: { owner: string; repo: string; ref: string; config: Config };
  let which: (folder: { prd: PrdNumber; topic: string }) => boolean;
  if (subject.kind === 'feature') {
    at = { owner, repo, ref: pr.headSha, config };
    which = (folder) => folder.topic === subject.topic;
  } else {
    const feature = await featurePullOf(octokit, { slug: subject.repo, prd: subject.prd });
    if ('held' in feature) return { kind: 'repo', name, prd: subject.prd, held: feature.held, head: pr.headSha };
    const [planOwner = '', planRepo = ''] = subject.repo.split('/');
    at = { owner: planOwner, repo: planRepo, ref: feature.pull.headSha, config: feature.config };
    which = (folder) => folder.prd === subject.prd;
  }
  const folder = await prdFolderAt(octokit, { ...at, which });
  if (!folder) return null;
  const source = { owner: at.owner, repo: at.repo, ref: at.ref, paths: at.config.paths };
  return { kind: 'repo', name, prd: folder.prd, source, dir: folder.dir };
}

/** A ◆ PRD's reading and the head it was read at, or null for a ◇ PRD. */
async function judgedAt(octokit: GitHubClient, target: Extract<Target, { kind: 'repo' }>, ask: AskJudge) {
  if ('held' in target) return { reading: heldReading(target.held), head: target.head };
  const reading = await readingAt(octokit, target.source, { prd: target.prd, dir: target.dir }, ask);
  return reading ? { reading, head: target.source.ref } : null;
}

/** The record as the check reads it: reached, or held since now when the reader is missing or throws. */
async function readingOf(readRecord: RecordReader | null, repository: string, prd: ProductPrdRef, now: () => Date, log: (line: string) => void): Promise<RecordReading> {
  const held = (why: string): RecordReading => {
    log(`approved check of ${repository} for ${prd.id} is held: ${why}`);
    return { reachable: false, since: now().toISOString() };
  };
  if (!readRecord) return held('the App cannot read the server here');
  try {
    return { reachable: true, record: await readRecord(repository, prd) };
  } catch (error) {
    return held(error instanceof Error ? error.message : String(error));
  }
}

/** The PRD page's part the check's Details opens: a product PRD's attestation, or a ◆ PRD's approval
 * (`anchor`); none when the record was not read. */
export function attestationUrl(galaxyUrl: string, dossierId: string | null, anchor: 'attestation' | 'approval' = 'attestation'): string | null {
  return dossierId ? `${galaxyUrl.replace(/\/+$/, '')}/prd/${dossierId}#${anchor}` : null;
}

/** Posts the check run, completed, on the head SHA. @returns its id */
async function postApproved(
  octokit: GitHubClient,
  { owner, repo, headSha, name, verdict, galaxyUrl, anchor }:
    { owner: string; repo: string; headSha: string; name: string; verdict: ApprovedVerdict; galaxyUrl: string; anchor: 'attestation' | 'approval' },
): Promise<number> {
  const details = attestationUrl(galaxyUrl, verdict.dossierId, anchor);
  const { data } = await octokit.request('POST /repos/{owner}/{repo}/check-runs', {
    owner,
    repo,
    name,
    head_sha: headSha,
    external_id: APPROVED_EXTERNAL_ID,
    status: 'completed',
    conclusion: verdict.conclusion,
    completed_at: new Date().toISOString(),
    ...(details ? { details_url: details } : {}),
    output: { title: verdict.title, summary: verdict.summary.slice(0, MAX_SUMMARY) },
  });
  return CreatedSchema.parse(data).id;
}

/** The budget's refusal behind `error`, however deep Octokit wrapped it; null when there is none. */
function refusalIn(error: unknown): GithubPaused | GithubDeferred | null {
  for (let cause = error, depth = 0; cause instanceof Error && depth < 4; cause = cause.cause, depth += 1) {
    if (cause instanceof GithubPaused || cause instanceof GithubDeferred) return cause;
  }
  return null;
}

/** Runs a step's GitHub work: a call the budget refused logs one line, and the step is retried once the budget allows it. */
async function onBudget<T>(where: string, log: (line: string) => void, work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    const refused = refusalIn(error);
    if (!refused) throw error;
    log(`approved check of ${where} waits for the GitHub budget: ${refused.message}`);
    throw new RetryAfterError(refused.message, new Date(refused.until), { cause: refused });
  }
}
