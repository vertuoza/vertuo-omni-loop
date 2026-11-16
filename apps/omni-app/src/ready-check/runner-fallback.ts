// The e2e fallback of the ready check (PRD 2898 s8, spec "Where the proof comes from"): when a gated feature PR's
// `e2e` scenarios did not run in CI (`e2e.ci` false, no model key or no `e2e.url` there), CI writes no `acceptance`
// check run and keeps the report of the head commit as the artifact `acceptance-report`, its `e2e` criteria
// `pending` (scripts/acceptance-report.ts). Each run of the ready check then, before it reads its facts:
//
//   kept       reads that artifact of the head commit; none yet (CI still going), or an `acceptance` run already
//              completed on the commit (CI's, or the App's own), and there is nothing to do
//   job        the runner job of `/omni:acceptance <prd> --pr <n> --sha <head>` the App itself sent; none, and it
//              queues it for any runner of the workspace (sent by the app, never in a person's name), unless
//              `e2e.url` is not set, when no runner could reach the scenarios either
//   report     the kept report, its `e2e` results replaced by the ones the job's log ends on once it ended
//              (kit/lib/runner/acceptance-line.ts); while no runner has run them, they stay `pending`, saying
//              why: `no runner has run the e2e scenarios yet`, or how the runner's run ended without a result
//   post       the `acceptance` check run of the head commit, in the App's name: in progress while a criterion
//              waits, so check 1 and check 3 read `not finished` and never green (BL-GATE-1), its text the report
//              as `omni ready` and the App read it; completed, `success` or `failure`, once nothing waits. The
//              run in progress is updated in place, and nothing is written when it would say the same
//
// The report is the App's own status record (BL-ASK-1): no person's answer is read or written here. GitHub's
// refusal is thrown, for the job to retry; the artifact unreadable leaves the check to say so (`not judged`).
import type { Criterion } from 'omni-loop/kit/lib/ready/criteria.ts';
import { ACCEPTANCE_CHECK_NAME, parseAcceptanceReport, renderAcceptanceReport, type AcceptanceReport } from 'omni-loop/kit/lib/ready/report.ts';
import { acceptanceLine, acceptanceOfLog } from 'omni-loop/kit/lib/runner/acceptance-line.ts';
import type { PrdNumber, PrNumber } from 'omni-loop/kit/lib/ids.ts';
import type { Config } from 'omni-loop/kit/lib/types.ts';
import { z } from 'zod';
import type { GitHubClient, Repo } from '../outbox-check/github-schema.ts';
import type { AppJob, ReadyStore } from './store.ts';
import { unzipText } from './zip.ts';

/** The artifact CI keeps the report in, and the report's file inside it (.github/workflows/checks.yml). */
const KEPT_ARTIFACT = 'acceptance-report';
const KEPT_FILE = 'report.json';

/** The `external_id` of the `acceptance` run the App writes, telling it from CI's. */
export const ACCEPTANCE_EXTERNAL_ID = 'omni-acceptance';

type Result = AcceptanceReport['results'][number];

/** What one look at the fallback did. */
export type Fallback =
  | { acted: false; why: string }
  | { acted: true; job: 'queued' | 'waiting' | 'ended' | 'none'; waiting: number; posted: boolean };

const ArtifactsSchema = z.looseObject({
  artifacts: z.array(z.looseObject({ id: z.number(), expired: z.boolean().nullish(), workflow_run: z.looseObject({ head_sha: z.string().nullish() }).nullish() })),
});

const RunSchema = z.looseObject({ id: z.number(), status: z.string().nullish(), conclusion: z.string().nullish(), output: z.looseObject({ title: z.string().nullish(), summary: z.string().nullish(), text: z.string().nullish() }).nullish() });
const RunsSchema = z.looseObject({ check_runs: z.array(RunSchema).nullish() });

/** The report CI kept for the head commit; null while there is none, or why it cannot be read. */
async function keptReport(octokit: GitHubClient, { owner, repo, headSha }: Repo & { headSha: string }): Promise<{ report: AcceptanceReport } | { why: string } | null> {
  const { data } = await octokit.request('GET /repos/{owner}/{repo}/actions/artifacts', { owner, repo, name: KEPT_ARTIFACT, per_page: 100 });
  const own = ArtifactsSchema.parse(data).artifacts.filter((artifact) => artifact.workflow_run?.head_sha === headSha && artifact.expired !== true);
  const newest = own.reduce<(typeof own)[number] | null>((last, artifact) => (last === null || artifact.id > last.id ? artifact : last), null);
  if (newest === null) return null;
  const zip = await octokit.request('GET /repos/{owner}/{repo}/actions/artifacts/{artifact_id}/{archive_format}', { owner, repo, artifact_id: newest.id, archive_format: 'zip' });
  const bytes = zip.data instanceof ArrayBuffer ? Buffer.from(zip.data) : Buffer.isBuffer(zip.data) ? zip.data : null;
  if (bytes === null) return { why: `the ${KEPT_ARTIFACT} artifact came back as no archive` };
  const file = unzipText(bytes, KEPT_FILE);
  if (!file.ok) return { why: `the ${KEPT_ARTIFACT} artifact cannot be read: ${file.why}` };
  const read = parseAcceptanceReport(file.text);
  if (!read.ok) return { why: read.why };
  return read.report.commit === headSha ? { report: read.report } : { why: `the ${KEPT_ARTIFACT} artifact is of ${read.report.commit.slice(0, 8)}, not ${headSha.slice(0, 8)}` };
}

/** Whether the App's job ended, done or not. */
const ended = (job: AppJob | null): job is AppJob => job !== null && ['done', 'failed', 'cancelled'].includes(job.status);

/** Why the `e2e` criteria still wait once the App's job ended with no result: how its run ended. */
function noResult(job: AppJob): string {
  const said = acceptanceOfLog(job.logTail);
  const how = said !== null && !said.ok ? said.why : job.reason ?? `it ended ${job.status} with no result`;
  return `the runner's e2e run gave no result (${how}); a new commit runs it again`;
}

/**
 * The report as it now stands: the kept one while no runner's job ended (its `e2e` criteria pending in CI's own words,
 * `no runner has run the e2e scenarios yet`); its `e2e` results the runner's once the job gave them; else each `e2e`
 * criterion still pending, saying how the runner's run ended.
 */
function standingReport(kept: AcceptanceReport, criteria: readonly Criterion[], job: AppJob | null): AcceptanceReport {
  if (!ended(job)) return kept;
  const e2e = new Set(criteria.filter((criterion) => criterion.kind === 'e2e').map((criterion) => criterion.number));
  const others = kept.results.filter((result) => result.kind !== 'e2e' || !e2e.has(result.ac));
  const said = acceptanceOfLog(job.logTail);
  const ran = said?.ok === true && said.report.commit === kept.commit
    ? said.report.results.filter((result) => result.kind === 'e2e' && e2e.has(result.ac))
    : criteria
      .filter((criterion) => e2e.has(criterion.number))
      .map((criterion): Result => ({ ac: criterion.number, kind: 'e2e', state: 'pending', title: `AC-${String(criterion.number)}: ${criterion.scenario ?? 'its scenario'}`, proof: null, why: noResult(job) }));
  return { ...kept, results: [...others, ...ran].sort((a, b) => a.ac - b.ac) };
}

/** How one criterion stands, its mark and its proof. */
function standing(criterion: Criterion, report: AcceptanceReport): { mark: '✓' | '✗' | '…'; words: string; proof: string } {
  const own = report.results.filter((result) => result.ac === criterion.number && result.kind === criterion.kind);
  const proof = [...new Set(own.flatMap((result) => (result.proof === null ? [] : [result.proof])))].join(', ') || '—';
  if (own.some((result) => result.state === 'failed')) return { mark: '✗', words: 'failed', proof };
  if (own.some((result) => result.state === 'passed')) return { mark: '✓', words: 'proven', proof };
  const pending = own.find((result) => result.state === 'pending');
  if (pending) return { mark: '…', words: pending.why ?? 'waiting', proof };
  return { mark: '✗', words: own.length > 0 ? 'skipped' : 'no proof on this commit', proof };
}

/** What the `acceptance` check run says of `report`. */
type AcceptanceOutput = { status: 'in_progress' | 'completed'; conclusion: 'success' | 'failure' | null; title: string; summary: string; text: string };

/** The `acceptance` check run of `report`: in progress while a criterion waits, else success only when every one is proven. */
function acceptanceOutput(criteria: readonly Criterion[], report: AcceptanceReport): AcceptanceOutput {
  const rows = criteria.map((criterion) => ({ criterion, ...standing(criterion, report) }));
  const proven = rows.filter((row) => row.mark === '✓').length;
  const count = `${String(proven)} of ${String(rows.length)} criteria proven`;
  const summary = [
    '| criterion | kind | state | proof |',
    '| --- | --- | --- | --- |',
    ...rows.map(({ criterion, mark, words, proof }) => `| AC-${String(criterion.number)} | ${criterion.kind} | ${mark} ${words} | ${proof} |`),
    '',
    'Written by the Omni App from the report CI kept and the e2e run of a runner of the workspace (PRD 2898).',
  ].join('\n');
  const text = renderAcceptanceReport(report);
  if (rows.some((row) => row.mark === '…')) return { status: 'in_progress', conclusion: null, title: `${count}; the e2e scenarios wait on a runner`, summary, text };
  return { status: 'completed', conclusion: proven === rows.length ? 'success' : 'failure', title: count, summary, text };
}

/** Whether the run already says what `output` says. */
const says = (run: z.infer<typeof RunSchema>, output: AcceptanceOutput) =>
  run.status === output.status && (run.conclusion ?? null) === output.conclusion && run.output?.title === output.title && run.output.summary === output.summary && run.output.text === output.text;

/** Writes the `acceptance` run of `headSha`: the one in progress updated, else a new one; nothing when it says the same. */
async function postAcceptance(octokit: GitHubClient, { owner, repo, headSha, going, output }: Repo & { headSha: string; going: z.infer<typeof RunSchema> | null; output: AcceptanceOutput }): Promise<boolean> {
  if (going !== null && says(going, output)) return false;
  const { status, conclusion, title, summary, text } = output;
  const body = { owner, repo, status, ...(conclusion === null ? {} : { conclusion, completed_at: new Date().toISOString() }), output: { title, summary, text } };
  if (going !== null) await octokit.request('PATCH /repos/{owner}/{repo}/check-runs/{check_run_id}', { ...body, check_run_id: going.id });
  else await octokit.request('POST /repos/{owner}/{repo}/check-runs', { ...body, name: ACCEPTANCE_CHECK_NAME, head_sha: headSha, external_id: ACCEPTANCE_EXTERNAL_ID });
  return true;
}

/** What one look at the fallback reads: the pull request, its PRD and the spec's criteria at its head, the base's config. */
export type FallbackRequest = Repo & { installationId: number; prNumber: PrNumber; prd: PrdNumber; headSha: string; criteria: readonly Criterion[]; config: Config };

/** One look at the fallback of a gated feature PR's head commit: queue the runner's job, then write what stands. */
export async function runnerFallback(octokit: GitHubClient, store: ReadyStore | null, request: FallbackRequest): Promise<Fallback> {
  const { owner, repo, headSha, criteria, config } = request;
  if (!criteria.some((criterion) => criterion.kind === 'e2e')) return { acted: false, why: 'the spec has no e2e criterion' };
  const { data } = await octokit.request('GET /repos/{owner}/{repo}/commits/{ref}/check-runs', { owner, repo, ref: headSha, check_name: ACCEPTANCE_CHECK_NAME, per_page: 100 });
  const runs = RunsSchema.parse(data).check_runs ?? [];
  if (runs.some((run) => run.status === 'completed')) return { acted: false, why: 'the acceptance run of the commit is written' };
  const kept = await keptReport(octokit, { owner, repo, headSha });
  if (kept === null) return { acted: false, why: 'CI kept no acceptance report for the commit yet' };
  if ('why' in kept) return { acted: false, why: kept.why };
  if (!kept.report.results.some((result) => result.kind === 'e2e' && result.state === 'pending')) return { acted: false, why: 'no e2e scenario waits on a runner' };

  const line = acceptanceLine({ prd: request.prd, pr: request.prNumber, sha: headSha });
  const asked = { installationId: request.installationId, repository: `${owner}/${repo}`, line };
  let job = store === null ? null : await store.appJob(asked);
  let step: 'queued' | 'waiting' | 'ended' | 'none' = job === null ? 'none' : ended(job) ? 'ended' : 'waiting';
  if (store !== null && job === null && config.e2e.url !== null) {
    const queued = await store.queueApp(asked);
    if (queued.job !== null) {
      step = 'queued';
      job = { status: 'queued', logTail: '', reason: null };
    }
  }
  const report = standingReport(kept.report, criteria, job);
  const output = acceptanceOutput(criteria, report);
  const going = runs.reduce<z.infer<typeof RunSchema> | null>((last, run) => (last === null || run.id > last.id ? run : last), null);
  const posted = await postAcceptance(octokit, { owner, repo, headSha, going, output });
  return { acted: true, job: step, waiting: report.results.filter((result) => result.state === 'pending').length, posted };
}
