// `approved-check`: the Inngest function posting **omni/approved** (`ci.approvedContext`) on a target
// feature PR of a product PRD (PRD 1548 s3): whether what it builds is what was approved.
//
//   step "target"   read the pull request and its base branch's config: a body naming no product PRD
//                   (`Part of mobile-12`), a base without the loop's config, or a config whose
//                   `ci.approvedContext` is null, gets nothing at all, not even `skipped`
//   step "record"   read the product PRD's record, as the service role (./record.ts): its approval in
//                   force and its dossier's latest versions; a read that fails is `held`, never failed
//   step "publish"  post the check run completed, with the conclusion and line `approvedVerdict` gives
//                   (./state.ts) and its Details on the PRD page's attestation
//
// It listens to the outbox check's event, so every pull request action that re-evaluates the outbox
// check re-evaluates this one, and to its own, which the webhook sends for a re-run of an approved check
// run (its `external_id` is APPROVED_EXTERNAL_ID). Debounced per repository and pull request, 3 retries,
// like the outbox check. It posts on events only, never polls: a run held on an unreachable server is
// posted again by the next event, or a re-run.
//
// The installation's GitHub budget is shared with galaxy (PRD 902): a call the budget refuses, paused or
// deferred, is never sent; the step logs one line and is retried once the pause or the window ends.
import { RetryAfterError, type Inngest } from 'inngest';
import { GithubDeferred, GithubPaused } from '@omni/github';
import type { PrNumber } from 'vertuo-omni-plan/kit/lib/ids.ts';
import { APPROVED_CHECK_EVENT, APPROVED_EXTERNAL_ID, CheckRequestDataSchema, OUTBOX_CHECK_EVENT } from '../inngest-client.ts';
import type { OctokitFor } from '../octokit-for.ts';
import { readBaseConfig, readPull, type GitHubClient } from '../outbox-check/github.ts';
import { CreatedSchema } from '../outbox-check/github-schema.ts';
import { MAX_SUMMARY } from '../publish/publish.ts';
import type { RecordReader } from './record.ts';
import { approvedVerdict, productPrdOf, type ApprovedVerdict, type ProductPrdRef, type RecordReading } from './state.ts';

export const APPROVED_FUNCTION_ID = 'approved-check';

/** What a run returns when it posted nothing: no product PRD named, no loop here, or the check turned off. */
const SILENT = Object.freeze({ posted: false, reason: 'not a target feature PR of a product PRD with the approved check on' });

const APPROVED_DEBOUNCE = Object.freeze({
  key: 'event.data.repository + "#" + string(event.data.prNumber)',
  period: '5s',
  timeout: '1m',
});

/** The check's target: its name and the product PRD the pull request is part of. */
type Target = { name: string; prd: ProductPrdRef };

export function createApprovedCheck({
  client,
  octokitFor,
  readRecord,
  galaxyUrl,
  now = () => new Date(),
  log = (line) => { console.error(line); },
}: {
  client: Inngest;
  octokitFor: OctokitFor<GitHubClient>;
  /** The record's reader; null when the App cannot read the server here, which holds every check. */
  readRecord: RecordReader | null;
  galaxyUrl: string;
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

      const reading = await step.run('record', () => readingOf(readRecord, repository, target.prd, now, log));
      const verdict = approvedVerdict(target.prd, reading);

      const checkRunId = await step.run('publish', () => budgeted(async () =>
        postApproved(await octokitFor(installationId), { owner, repo, headSha, name: target.name, verdict, galaxyUrl })));

      return { checkRunId, name: target.name, prd: target.prd.id, state: verdict.state, conclusion: verdict.conclusion };
    },
  );
}

/**
 * The check's name and product PRD on this pull request, or null when it gets no check: its body names
 * no product PRD, its base branch has no loop config, or `ci.approvedContext` is null there. A broken
 * config posts no check either: the outbox check says what is wrong with it.
 */
async function targetOf(octokit: GitHubClient, { owner, repo, prNumber }: { owner: string; repo: string; prNumber: PrNumber }): Promise<Target | null> {
  const pr = await readPull(octokit, { owner, repo, prNumber });
  const prd = productPrdOf(pr.body);
  if (!prd) return null;
  const { config } = await readBaseConfig(octokit, { owner, repo, baseSha: pr.baseSha });
  const name = config?.ci.approvedContext ?? null;
  return name === null ? null : { name, prd };
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

/** The PRD page's attestation, the check's Details; none when the record was not read. */
export function attestationUrl(galaxyUrl: string, dossierId: string | null): string | null {
  return dossierId ? `${galaxyUrl.replace(/\/+$/, '')}/prd/${dossierId}#attestation` : null;
}

/** Posts the check run, completed, on the head SHA. @returns its id */
async function postApproved(
  octokit: GitHubClient,
  { owner, repo, headSha, name, verdict, galaxyUrl }: { owner: string; repo: string; headSha: string; name: string; verdict: ApprovedVerdict; galaxyUrl: string },
): Promise<number> {
  const details = attestationUrl(galaxyUrl, verdict.dossierId);
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
