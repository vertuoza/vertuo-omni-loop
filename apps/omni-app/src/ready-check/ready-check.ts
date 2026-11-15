// `ready-check`: the check posting **omni / ready** on a gated feature PR's latest commit (PRD 2898 s7), the
// verdict `omni ready <prd>` prints in a checkout: the kit's ready rule, run on facts the App reads through
// GitHub (./facts.ts). It runs as the `pr-ready` job of the ledger (./job.ts), its stages in order in one try:
//
//   "target"   read the pull request and its base branch's config. Nothing is posted, not even `skipped`, on a
//              base without the loop's config, one that does not parse, one whose `ready.checks` is `off`, a
//              pull request that is no feature PR into the default branch, one whose PRD has no folder at the
//              head, or, under `ready.checks: mission`, a PRD in no running, waiting or paused mission
//   "judge"    read the facts at the head and run the rule (`readyVerdict`)
//   "publish"  post the check (./output.ts), unless the latest `omni / ready` run of that commit already says
//              the same; a run still going is updated rather than left behind. Then save the verdict for the
//              PRD page (`public.ready_verdicts`, ./store.ts), when the App reaches the database
//   failure    once the 5th try threw, the check `neutral`, not judged, saying why, on a gated pull request
//
// It never gates `omni ready`: the skill runs the rule on its own facts, and leaves this check out of check 1.
// Every temporary folder is removed whatever happens. GitHub's budget low is thrown as the budget's own refusal.
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createContext, type Context } from 'omni-loop/kit/lib/context.ts';
import type { PrdNumber, PrNumber } from 'omni-loop/kit/lib/ids.ts';
import { READY_CHECK_NAME, readyVerdict } from 'omni-loop/kit/lib/ready/checks.ts';
import type { Criterion } from 'omni-loop/kit/lib/ready/criteria.ts';
import type { AcceptanceReport } from 'omni-loop/kit/lib/ready/report.ts';
import type { Config } from 'omni-loop/kit/lib/types.ts';
import { z } from 'zod';
import type { Json } from '../../../../supabase/database.types.ts';
import { pullKind } from '../evaluate/evaluate.ts';
import { readBaseConfig, readPull, type GitHubClient, type PullFacts, type Repo } from '../outbox-check/github.ts';
import { prdAtHead, readyFacts } from './facts.ts';
import { notJudgedOutput, readyOutput, READY_EXTERNAL_ID, type ReadyOutput, type Verdict } from './output.ts';
import type { ReadyStore } from './store.ts';

/** What a run of the check needs to find the pull request. */
export type ReadyRequest = { installationId: number; owner: string; repo: string; prNumber: PrNumber; headSha: string };

/** A gated pull request: its facts, the base's config, its PRD and the context rooted at the head's snapshot. */
type Gated = { pr: PullFacts; config: Config; prd: PrdNumber; ctx: Context };

/** What the check's run ended with. */
export type ReadyRun = { posted: false; reason: string } | { posted: boolean; verdict: Verdict['state']; saved: boolean; reason: string | null };

/** Why a pull request gets no check, or the gated pull request. */
async function readyTarget(
  octokit: GitHubClient,
  { store, request, head }: { store: ReadyStore | null; request: ReadyRequest; head: string },
): Promise<Gated | { skip: string }> {
  const { owner, repo, prNumber, installationId } = request;
  const pr = await readPull(octokit, { owner, repo, prNumber });
  const base = mkdtempSync(join(tmpdir(), 'omni-ready-config-'));
  let config: Config | null;
  try {
    ({ config } = await readBaseConfig(octokit, { owner, repo, baseSha: pr.baseSha, dest: base }));
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
  if (!config || config.ready.checks === 'off') return { skip: 'the ready checks are off here, or the loop is not installed' };
  const kind = pullKind(pr, config);
  if ('skip' in kind || kind.kind !== 'feature') return { skip: 'not a feature pull request into the default branch' };
  const ctx = createContext(head, config);
  const prd = await prdAtHead(octokit, ctx, { owner, repo, pr });
  if (prd === null) return { skip: `no PRD folder at the head carries ${pr.headRef}'s topic` };
  if (config.ready.checks === 'mission') {
    if (store === null) return { skip: 'the missions cannot be read here' };
    if (!(await store.inMission({ installationId, repository: `${owner}/${repo}`, prd }))) return { skip: `PRD ${String(prd)} is in no running or paused mission` };
  }
  return { pr, config, prd, ctx };
}

const RunSchema = z.looseObject({ id: z.number(), status: z.string().nullish(), conclusion: z.string().nullish(), html_url: z.string().nullish(), output: z.looseObject({ title: z.string().nullish(), summary: z.string().nullish() }).nullish() });
const RunsSchema = z.looseObject({ check_runs: z.array(RunSchema).nullish() });
const WrittenSchema = z.looseObject({ id: z.number(), html_url: z.string().nullish() });

/** Whether the run already says what `output` says. */
const says = (run: z.infer<typeof RunSchema>, output: ReadyOutput) =>
  run.status === output.status && (run.conclusion ?? null) === (output.status === 'completed' ? output.conclusion : null) && run.output?.title === output.title && run.output.summary === output.summary;

/**
 * Posts the check on `headSha`: nothing when its latest run there already says the same, an update of that run
 * while it is still going, else a new run. @returns whether it wrote, and the run's link
 */
async function postReady(octokit: GitHubClient, { owner, repo, headSha, output }: Repo & { headSha: string; output: ReadyOutput }): Promise<{ posted: boolean; url: string | null }> {
  const { data } = await octokit.request('GET /repos/{owner}/{repo}/commits/{ref}/check-runs', { owner, repo, ref: headSha, check_name: READY_CHECK_NAME, per_page: 100 });
  const latest = (RunsSchema.parse(data).check_runs ?? []).reduce<z.infer<typeof RunSchema> | null>((last, run) => (last === null || run.id > last.id ? run : last), null);
  if (latest !== null && says(latest, output)) return { posted: false, url: latest.html_url ?? null };
  const { status, title, summary } = output;
  const body = {
    owner,
    repo,
    status,
    ...(output.status === 'completed' ? { conclusion: output.conclusion, completed_at: new Date().toISOString() } : {}),
    output: { title, summary },
  };
  const written =
    latest !== null && latest.status !== 'completed'
      ? await octokit.request('PATCH /repos/{owner}/{repo}/check-runs/{check_run_id}', { ...body, check_run_id: latest.id })
      : await octokit.request('POST /repos/{owner}/{repo}/check-runs', { ...body, name: READY_CHECK_NAME, head_sha: headSha, external_id: READY_EXTERNAL_ID });
  return { posted: true, url: WrittenSchema.parse(written.data).html_url ?? null };
}

/** How the report stands on one criterion, by its own kind: failed, passed, pending or skipped; null with none. */
function proofOf(criterion: Criterion, report: AcceptanceReport | null) {
  const own = (report?.results ?? []).filter((result) => result.ac === criterion.number && result.kind === criterion.kind);
  const found = ['failed', 'passed', 'pending', 'skipped'].map((state) => own.find((result) => result.state === state)).find((result) => result !== undefined);
  return { proof: found?.proof ?? null, state: found?.state ?? null };
}

/** The criteria as the PRD page shows them: each with its lines, its kind, its proof and its state. */
const criteriaRows = (criteria: readonly Criterion[], report: AcceptanceReport | null): Json =>
  criteria.map((criterion) => ({ number: criterion.number, kind: criterion.kind, scenario: criterion.scenario, lines: criterion.lines, ...proofOf(criterion, report) }));

/** One run of the check on the pull request `request` names. */
export async function runReadyCheck(octokit: GitHubClient, { store, request }: { store: ReadyStore | null; request: ReadyRequest }): Promise<ReadyRun> {
  const head = mkdtempSync(join(tmpdir(), 'omni-ready-head-'));
  const base = mkdtempSync(join(tmpdir(), 'omni-ready-base-'));
  try {
    const target = await readyTarget(octokit, { store, request, head });
    if ('skip' in target) return { posted: false, reason: target.skip };
    const { pr, config, prd, ctx } = target;
    const { owner, repo, prNumber, installationId } = request;
    const read = await readyFacts(octokit, { prd, ctx }, { owner, repo, prNumber, pr, baseFolder: base });
    const verdict = readyVerdict(read.facts);
    const posted = await postReady(octokit, { owner, repo, headSha: pr.headSha, output: readyOutput(verdict, { prd, signature: config.signature }) });
    const saved = store === null
      ? { saved: false, reason: 'the database cannot be reached here' }
      : await store.save({
          installationId,
          repository: `${owner}/${repo}`,
          prd,
          prNumber,
          headSha: pr.headSha,
          state: verdict.state,
          passed: verdict.passed,
          headline: verdict.headline,
          checks: verdict.checks,
          criteria: criteriaRows(read.criteria, read.report),
          checkUrl: posted.url,
        });
    return { posted: posted.posted, verdict: verdict.state, ...saved };
  } finally {
    rmSync(head, { recursive: true, force: true });
    rmSync(base, { recursive: true, force: true });
  }
}

/** Posts the check `neutral`, not judged, saying why, on a gated pull request; nothing on any other, nor when GitHub cannot say. */
export async function postNotJudged(octokit: GitHubClient, { store, request, reason }: { store: ReadyStore | null; request: ReadyRequest; reason: string }): Promise<boolean> {
  const head = mkdtempSync(join(tmpdir(), 'omni-ready-head-'));
  try {
    let target: Gated | { skip: string };
    try {
      target = await readyTarget(octokit, { store, request, head });
    } catch {
      // GitHub or the database may be what failed: whether the pull request is gated stays unknown.
      return false;
    }
    if ('skip' in target) return false;
    return (await postReady(octokit, { owner: request.owner, repo: request.repo, headSha: target.pr.headSha, output: notJudgedOutput(reason) })).posted;
  } finally {
    rmSync(head, { recursive: true, force: true });
  }
}
