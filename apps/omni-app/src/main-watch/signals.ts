// What one lane of a watch read on GitHub (PRD 2410): a lane is a repository the PRD merged into, its
// merge commit and its seven days. Three signals break it, each read in full on every look, so a look
// that comes again (a replay, the next day) reads the same breaks and the store adds none twice:
//
//   ci-red      a job of any workflow run on the merge commit ending red, in any attempt: a red that a
//               re-run turned green counts. One break per run and job name, its source `<run>/<job>`.
//               When one is red, the parent commit's result for the same workflow and job is kept beside
//               it (green, red or unknown), so a reader sees when main was red before the merge. Only
//               GitHub Actions is read, never the check-runs API, as the retro reads it (PRD 72).
//   revert      a commit pushed to the default branch within the seven days that reverts the merge
//               commit (`This reverts commit <sha>`), a pull request of the PRD by its title
//               (`Revert "<title>"`, with or without its number) or by its number (`Reverts <owner/name>#<n>`,
//               the body of GitHub's revert pull request). Its source is the revert's sha.
//   regression  an issue opened within the seven days that names the PRD (`#<n>`, `<owner/name>#<n>` or
//               its link; in a target repository only with the plan repository's name), or, labelled
//               `labels.regression`, whose body or `/omni:bug-fix` triage (its Regression line) names one
//               of the lane's pull requests. An issue an app opened, or one labelled `labels.retro` (the
//               retro's own issues name the PRD), is no regression. Its source is the issue's number.
//
// A read GitHub refuses (403, 404, 410) is named in `unread` (`ci`, `reverts`, `regressions`), never
// read as quiet; any other failure is thrown, so Inngest retries the step. Nothing here writes.
import { z } from 'zod';
import type { PrNumber, PrdNumber } from 'omni-loop/kit/lib/ids.ts';
import { PER_PAGE, paginate } from '../retro/github.ts';
import { parseGitHub } from '../retro/github.schema.ts';
import { readOrRefused, within } from '../retro/kinds/after-merge.reads.ts';
import { runJobs } from '../retro/kinds/jobs.ts';
import type { Octokit } from '../retro/retro.types.ts';

/** A repository the PRD merged into, as the watch reads it. */
export type Lane = {
  /** `owner/name`, in lower case. */
  lane: string;
  owner: string;
  repo: string;
  /** The installation the App reads the lane as. */
  installationId: number;
  /** The default branch the PRD merged into. */
  base: string;
  mergeSha: string;
  mergedAt: string;
  watchUntil: string;
  /** The feature PR (or PRs, one per landing) and the sub-PRs into them. */
  pulls: { number: PrNumber; title: string }[];
};

/** One signal that broke a lane, as `prd_main_breaks` keeps it. */
export type Break = {
  kind: 'ci-red' | 'revert' | 'regression';
  source: string;
  url: string;
  title: string;
  parent: 'green' | 'red' | 'unknown' | null;
  at: string;
};

/** What one look at a lane read: its breaks, and each signal GitHub would not let the App read. */
export type Read = { breaks: Break[]; unread: Unread[] };
export type Unread = 'ci' | 'reverts' | 'regressions';

/** What a look needs beyond the lane: the PRD, its repository and the two labels it reads. */
export type SignalScope = { prd: PrdNumber; planSlug: string; regressionLabel: string; retroLabel: string };

const RUNS = 'GET /repos/{owner}/{repo}/actions/runs';
const COMMIT = 'GET /repos/{owner}/{repo}/commits/{ref}';
const COMMITS = 'GET /repos/{owner}/{repo}/commits';
const ISSUES = 'GET /repos/{owner}/{repo}/issues';
const COMMENTS = 'GET /repos/{owner}/{repo}/issues/{issue_number}/comments';

const GREEN: ReadonlySet<unknown> = new Set(['success']);
const RED: ReadonlySet<unknown> = new Set(['failure', 'timed_out', 'startup_failure']);
const TRIAGE_MARKER = '<!-- omni-bug:triage -->';

const RunSchema = z.looseObject({
  id: z.number(),
  name: z.string().nullish(),
  html_url: z.string().nullish(),
  created_at: z.string().nullish(),
  updated_at: z.string().nullish(),
});
const RunsPageSchema = z.looseObject({ workflow_runs: z.array(RunSchema).nullish() });
const ParentsSchema = z.looseObject({ parents: z.array(z.looseObject({ sha: z.string() })).nullish() });
const CommitSchema = z.looseObject({
  sha: z.string(),
  html_url: z.string(),
  commit: z.looseObject({
    message: z.string(),
    committer: z.looseObject({ date: z.string().nullish() }).nullish(),
    author: z.looseObject({ date: z.string().nullish() }).nullish(),
  }),
});
const LabelSchema = z.union([z.string(), z.looseObject({ name: z.string() })]);
const IssueSchema = z.looseObject({
  number: z.number(),
  title: z.string().nullish(),
  body: z.string().nullish(),
  html_url: z.string(),
  created_at: z.string(),
  pull_request: z.unknown().optional(),
  user: z.looseObject({ type: z.string().nullish() }).nullish(),
  labels: z.array(LabelSchema).nullish(),
});
const CommentSchema = z.looseObject({ body: z.string().nullish() });

type Run = z.infer<typeof RunSchema>;
type Issue = z.infer<typeof IssueSchema>;

/** Every signal of one lane, read in full: CI on the merge commit, then reverts, then regressions. */
export async function readSignals(octokit: Octokit, lane: Lane, scope: SignalScope): Promise<Read> {
  const unread: Unread[] = [];
  const breaks = [...(await ciBreaks(octokit, lane, unread)), ...(await revertBreaks(octokit, lane, unread)), ...(await regressionBreaks(octokit, lane, scope, unread))];
  return { breaks, unread: [...new Set(unread)] };
}

// ---- CI on the merge commit ---------------------------------------------------------------------

/** Every workflow run on `sha`, or the status GitHub refused them with. */
function runsOn(octokit: Octokit, { owner, repo }: Lane, sha: string) {
  return readOrRefused(() =>
    paginate((page) =>
      octokit.request(RUNS, { owner, repo, head_sha: sha, per_page: PER_PAGE, page }).then(({ data }) => parseGitHub(RunsPageSchema, data, RUNS).workflow_runs ?? []),
    ),
  );
}

/** A red job of a run on the merge commit. */
type RedJob = { run: Run; name: string; url: string | null; at: string | null };

/** The red jobs on the merge commit, every attempt read, one per run and job name. */
async function ciBreaks(octokit: Octokit, lane: Lane, unread: Unread[]): Promise<Break[]> {
  const runs = await runsOn(octokit, lane, lane.mergeSha);
  if (runs.status !== null) {
    unread.push('ci');
    return [];
  }
  const red: RedJob[] = [];
  for (const run of runs.value) red.push(...(await redJobsOf(octokit, lane, run, unread)));
  if (red.length === 0) return [];
  const parent = await parentResults(octokit, lane);
  return red.map((job) => ciBreak(lane, job, parent.get(jobKey(job.run.name, job.name)) ?? 'unknown'));
}

/** The red jobs of one run, every attempt read, each job name once; none, and `ci` unread, when GitHub refused them. */
async function redJobsOf(octokit: Octokit, lane: Lane, run: Run, unread: Unread[]): Promise<RedJob[]> {
  const jobs = await readOrRefused(() => runJobs(octokit, { owner: lane.owner, repo: lane.repo, runId: run.id, filter: 'all' }));
  if (jobs.status !== null) {
    unread.push('ci');
    return [];
  }
  const red = new Map<string, RedJob>();
  // The first red attempt of each job name is the break; a later attempt of it adds nothing.
  for (const job of jobs.value.filter((one) => RED.has(one.conclusion))) {
    if (!red.has(job.name)) red.set(job.name, { run, name: job.name, url: job.html_url ?? null, at: job.completed_at ?? null });
  }
  return [...red.values()];
}

/** One red job as the break it is, its parent's result beside it. */
function ciBreak(lane: Lane, { run, name, url, at }: RedJob, parent: 'green' | 'red' | 'unknown'): Break {
  return {
    kind: 'ci-red',
    source: `${String(run.id)}/${name}`.slice(0, 200),
    url: https(url) ?? https(run.html_url) ?? `https://github.com/${lane.lane}/commit/${lane.mergeSha}`,
    title: `${run.name ?? 'workflow'} › ${name}`.slice(0, 300),
    parent,
    at: at ?? run.updated_at ?? run.created_at ?? lane.mergedAt,
  };
}

const jobKey = (workflow: string | null | undefined, job: string) => `${workflow ?? ''}\u0000${job}`;

/** The parent commit's latest result per workflow and job: green or red, else unknown; nothing when it cannot be read. */
async function parentResults(octokit: Octokit, lane: Lane): Promise<Map<string, 'green' | 'red' | 'unknown'>> {
  const results = new Map<string, 'green' | 'red' | 'unknown'>();
  const commit = await readOrRefused(async () => parseGitHub(ParentsSchema, (await octokit.request(COMMIT, { owner: lane.owner, repo: lane.repo, ref: lane.mergeSha })).data, COMMIT));
  const parent = commit.value?.parents?.[0]?.sha;
  if (!parent) return results;
  const runs = await runsOn(octokit, lane, parent);
  for (const run of runs.value ?? []) {
    const jobs = await readOrRefused(() => runJobs(octokit, { owner: lane.owner, repo: lane.repo, runId: run.id, filter: 'latest' }));
    for (const job of jobs.value ?? []) {
      results.set(jobKey(run.name, job.name), GREEN.has(job.conclusion) ? 'green' : RED.has(job.conclusion) ? 'red' : 'unknown');
    }
  }
  return results;
}

/** `url` when it is an https link, else `null`. */
function https(url: string | null | undefined): string | null {
  return url && /^https:\/\/\S+$/.test(url) ? url : null;
}

// ---- Reverts ------------------------------------------------------------------------------------

/** The commits pushed to the default branch within the window that revert the lane. */
async function revertBreaks(octokit: Octokit, lane: Lane, unread: Unread[]): Promise<Break[]> {
  const { owner, repo, base, mergedAt, watchUntil } = lane;
  const commits = await readOrRefused(() =>
    paginate((page) =>
      octokit
        .request(COMMITS, { owner, repo, sha: base, since: mergedAt, until: watchUntil, per_page: PER_PAGE, page })
        .then(({ data }) => parseGitHub(z.array(CommitSchema), data, COMMITS)),
    ),
  );
  if (commits.status !== null) {
    unread.push('reverts');
    return [];
  }
  return commits.value
    .filter((commit) => commit.sha !== lane.mergeSha && revertsLane(commit.commit.message, lane))
    .map((commit) => ({
      kind: 'revert',
      source: commit.sha,
      url: commit.html_url,
      title: (commit.commit.message.split('\n')[0] ?? commit.sha).slice(0, 300),
      parent: null,
      at: commit.commit.committer?.date ?? commit.commit.author?.date ?? mergedAt,
    }));
}

/** Whether a commit's message reverts the lane: its merge commit, or one of its pull requests by title or number. */
export function revertsLane(message: string, lane: Pick<Lane, 'lane' | 'mergeSha' | 'pulls'>): boolean {
  const numbers = new Set<number>(lane.pulls.map((pull) => pull.number));
  return revertsCommit(message, lane.mergeSha) || revertsTitle(message, lane.pulls, numbers) || revertsNumber(message, lane.lane, numbers);
}

/** `This reverts commit <sha>`, naming the merge commit by its sha or a prefix of seven characters or more. */
function revertsCommit(message: string, mergeSha: string): boolean {
  return [...message.matchAll(/This reverts commit ([0-9a-f]{7,40})\b/gi)].some(([, sha = '']) => mergeSha.toLowerCase().startsWith(sha.toLowerCase()));
}

/** A first line `Revert "<title>"`, the title one of the pull requests' or ending in one of their numbers. */
function revertsTitle(message: string, pulls: Lane['pulls'], numbers: ReadonlySet<number>): boolean {
  const inner = /^Revert "(.+)"/.exec(message.split('\n')[0] ?? '')?.[1];
  if (inner === undefined) return false;
  const numbered = /\s*\(#(\d+)\)$/.exec(inner);
  if (numbered && numbers.has(Number(numbered[1]))) return true;
  const title = numbered ? inner.slice(0, numbered.index) : inner;
  return pulls.some((pull) => pull.title === title);
}

/** `Reverts <owner/name>#<n>` or `Reverts #<n>`, the body of GitHub's revert pull request, naming one of the pull requests. */
function revertsNumber(message: string, slug: string, numbers: ReadonlySet<number>): boolean {
  return [...message.matchAll(/\bReverts (?:([\w.-]+\/[\w.-]+))?#(\d+)\b/g)].some(
    ([, repo, number]) => (repo === undefined || repo.toLowerCase() === slug) && numbers.has(Number(number)),
  );
}

// ---- Regressions --------------------------------------------------------------------------------

/** The issues opened within the window that name the PRD, or regressions traced to one of the lane's pull requests. */
async function regressionBreaks(octokit: Octokit, lane: Lane, scope: SignalScope, unread: Unread[]): Promise<Break[]> {
  const { owner, repo, mergedAt, watchUntil } = lane;
  const issues = await readOrRefused(() =>
    paginate((page) =>
      octokit
        .request(ISSUES, { owner, repo, state: 'all', since: mergedAt, per_page: PER_PAGE, page })
        .then(({ data }) => parseGitHub(z.array(IssueSchema), data, ISSUES)),
    ),
  );
  if (issues.status !== null) {
    unread.push('regressions');
    return [];
  }
  const window = { from: mergedAt, to: watchUntil };
  const candidates = issues.value.filter((issue) => isReport(issue, window, scope)).sort((a, b) => a.number - b.number);
  const trace = tracer(octokit, lane, scope, unread);
  const breaks: Break[] = [];
  for (const issue of candidates) {
    if (await trace(issue)) breaks.push(regressionBreak(issue));
  }
  return breaks;
}

/** An issue a person opened within the window: not a pull request, not an app's, not one of the retro's. */
function isReport(issue: Issue, window: { from: string; to: string }, scope: SignalScope): boolean {
  return issue.pull_request === undefined && within(window, issue.created_at) && issue.user?.type !== 'Bot' && !labelled(issue, scope.retroLabel);
}

/**
 * Whether an issue is traced to the PRD: it names the PRD, or, labelled a regression, its body or its
 * triage names one of the lane's pull requests. A triage GitHub would not let the App read leaves
 * `regressions` unread.
 */
function tracer(octokit: Octokit, lane: Lane, scope: SignalScope, unread: Unread[]): (issue: Issue) => Promise<boolean> {
  const namesThePrd = namesPrd(scope.prd, scope.planSlug, { bare: lane.lane === scope.planSlug.toLowerCase() });
  const namesAPull = namesPull(lane);
  return async (issue) => {
    if (namesThePrd(`${issue.title ?? ''}\n${issue.body ?? ''}`)) return true;
    if (!labelled(issue, scope.regressionLabel)) return false;
    if (namesAPull(issue.body ?? '')) return true;
    const triage = await triageOf(octokit, lane, issue);
    if (triage === undefined) unread.push('regressions');
    return typeof triage === 'string' && namesAPull(triage);
  };
}

/** One traced issue as the break it is. */
function regressionBreak(issue: Issue): Break {
  const title = issue.title?.trim() || `Issue #${String(issue.number)}`;
  return { kind: 'regression', source: String(issue.number), url: issue.html_url, title: title.slice(0, 300), parent: null, at: issue.created_at };
}

/** Whether the issue carries `label`. */
function labelled(issue: Issue, label: string): boolean {
  return (issue.labels ?? []).some((one) => (typeof one === 'string' ? one : one.name) === label);
}

/** The Regression line of the issue's `/omni:bug-fix` triage: `null` when it has none, `undefined` when GitHub refused the read. */
async function triageOf(octokit: Octokit, { owner, repo }: Lane, issue: Issue): Promise<string | null | undefined> {
  const comments = await readOrRefused(() =>
    paginate((page) =>
      octokit
        .request(COMMENTS, { owner, repo, issue_number: issue.number, per_page: PER_PAGE, page })
        .then(({ data }) => parseGitHub(z.array(CommentSchema), data, COMMENTS)),
    ),
  );
  if (comments.status !== null) return undefined;
  for (const comment of comments.value) {
    const line = triageRegression(comment.body ?? '');
    if (line !== null) return line;
  }
  return null;
}

/** The Regression line of a `/omni:bug-fix` triage comment, after its label; `null` for any other comment. */
export function triageRegression(body: string): string | null {
  if (!body.trimStart().startsWith(TRIAGE_MARKER)) return null;
  return /^- \*\*Regression:\*\*\s*(.+)$/m.exec(body)?.[1]?.trim() ?? null;
}

/**
 * Whether a text names PRD `prd` of `slug`: `<slug>#<n>` or its issue link and, when `bare` (the lane
 * is the PRD's own repository), `#<n>` alone. Never `#70` for `#7`, nor an HTML entity.
 */
export function namesPrd(prd: PrdNumber, slug: string, { bare }: { bare: boolean }): (text: string) => boolean {
  const s = escape(slug);
  const forms = [`${s}#${String(prd)}(?!\\d)`, `github\\.com/${s}/issues/${String(prd)}(?!\\d)`];
  if (bare) forms.push(`(?:^|[^\\w&/.-])#${String(prd)}(?!\\d)`);
  const pattern = new RegExp(forms.join('|'), 'i');
  return (text) => pattern.test(text);
}

/** Whether a text names one of the lane's pull requests: `#<n>`, `<owner/name>#<n>` or its link. */
export function namesPull(lane: Pick<Lane, 'lane' | 'pulls'>): (text: string) => boolean {
  const numbers = new Set<number>(lane.pulls.map((pull) => pull.number));
  const s = escape(lane.lane);
  const pattern = new RegExp(`(?:github\\.com/${s}/pull/|${s}#|(?:^|[^\\w&/.-])#)(\\d+)(?!\\d)`, 'gi');
  return (text) => [...text.matchAll(pattern)].some(([, number]) => numbers.has(Number(number)));
}

function escape(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
