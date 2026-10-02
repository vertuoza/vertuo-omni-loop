// Checks red again and again (PRD 72, "The facts, and what makes a finding"): every CI run on every
// slice's commits, the last lines of each red run's log, a check red on several commits or in several
// slices, a check red then green on one commit, and the tests the logs name as failing. Its findings
// are `repeated-red:<check>`, `flaky:<check>` and `failing-test:<test>`; its thresholds are in `rules`.
//
// `gather` reads GitHub Actions, never the check-runs API (decision 14: the retro never reads a check
// run): the workflow runs of each slice's branch, every job of each run, all attempts included, and
// the log of each red job only, cut to its last `LIMITS.logTailLines` lines. A check is a job's name.
// Checks another app posts (the outbox check, a deploy preview) are not read. `detect` and `describe`
// are pure: the logs are read by `./ci-logs.ts`.
//
// Each finding's evidence links the red runs; a red run whose log was read also carries its last
// lines as the evidence item's `excerpt`, which `narrate` sends to the model and `render` leaves out.
import { LIMITS, THRESHOLDS } from '../rules.ts';
import { PER_PAGE, paginate } from '../github.ts';
import { cleanLog, readTestLog, tailOf } from './ci-logs.ts';
import type { Counts, Reporter } from './ci-logs.ts';
import type { Evidence, Kind, RetroPrd, RetroPull } from './index.ts';
import { JobsPageSchema, WorkflowRunsPageSchema } from './schema.ts';
import type { Job, WorkflowRun } from './schema.ts';
import { sliceOf } from './slice-of.ts';
import type { Config } from 'vertuo-omni-plan/kit/lib/types.ts';

/** One job of one run, as the kind keeps it. */
type JobRecord = {
  id: number;
  run: number;
  workflow: string | null;
  check: string;
  slice: string;
  sha: string | null | undefined;
  attempt: number;
  status: string | null | undefined;
  conclusion: string | null;
  url: string | null;
  completedAt: string | null;
};

type Unread = { slice: string; run?: number; status: number };
type Log = { tail: string | null; status?: number };
type Records = { slices: string[]; unread: Unread[]; jobs: JobRecord[]; logs: Record<string, Log | undefined> };

type RedRun = {
  id: number;
  check: string;
  slice: string;
  commit: string;
  attempt: number;
  url: string | null;
  reporter: Reporter | null;
  tests: string[];
  counts: Counts | null;
  log: string;
  excerpt?: string;
};

type Flip = { commit: string; slice: string; red: JobRecord; green: JobRecord };
type Check = { check: string; runs: number; red: number; redCommits: string[]; redSlices: string[]; flips: Flip[] };
type Test = { test: string; runs: number; checks: string[]; slices: string[] };

type Facts = {
  slices: string[];
  unread: Unread[];
  totals: { runs: number; red: number; checks: number; commits: number; slices: number };
  checks: (Omit<Check, 'flips'> & { redThenGreen: { commit: string; slice: string }[] })[];
  redRuns: RedRun[];
  tests: Test[];
};

/** What `readOrRefused` gives: the value read, or the status GitHub refused it with. */
type Read<T> = { value: T; status: null } | { value: null; status: number };

const RUNS = 'GET /repos/{owner}/{repo}/actions/runs';
const JOBS = 'GET /repos/{owner}/{repo}/actions/runs/{run_id}/jobs';
const LOGS = 'GET /repos/{owner}/{repo}/actions/jobs/{job_id}/logs';

/** How many runs' jobs, or logs, are read at once. */
const PARALLEL_READS = 4;
/** What GitHub answers for what it will not let the app read, or no longer has. */
const UNREADABLE: ReadonlySet<unknown> = new Set([403, 404, 410]);

/** A job that ended red. A cancelled or skipped job is no run at all. */
const RED: ReadonlySet<string | null> = new Set(['failure', 'timed_out', 'startup_failure']);
const GREEN: ReadonlySet<string | null> = new Set(['success']);
const REPORTERS: Readonly<Record<Reporter, string>> = Object.freeze({ vitest: 'Vitest', jest: 'Jest', playwright: 'Playwright', pytest: 'pytest' });
const COUNT_ORDER: readonly string[] = Object.freeze(['failed', 'errors', 'flaky', 'passed', 'skipped', 'total']);

export const ci: Kind<Records | null, Facts> = Object.freeze({
  id: 'ci',
  section: 'Checks',
  runs: Object.freeze(['merge'] as const),

  async gather(octokit, { owner, repo, prd, config, pulls }) {
    const branches = sliceBranches(pulls ?? [], prd, config);
    if (branches.length === 0) return null;

    const slices: string[] = [];
    const unread: Unread[] = [];
    const runs: { run: WorkflowRun; slice: string }[] = [];
    for (const { slice, branch } of branches) {
      const read = await readOrRefused(() =>
        paginate((page: number) =>
          octokit
            .request(RUNS, { owner, repo, branch, exclude_pull_requests: true, per_page: PER_PAGE, page })
            .then(({ data }) => WorkflowRunsPageSchema.parse(data).workflow_runs ?? []),
        ),
      );
      // A branch GitHub does not know had no run; a refusal is said in the section.
      if (read.status === 403) unread.push({ slice, status: 403 });
      else slices.push(slice);
      runs.push(...(read.value ?? []).map((run: WorkflowRun) => ({ run, slice })));
    }

    const jobsOfRuns = await inParallel(runs, async ({ run, slice }) => {
      const read = await readOrRefused(() =>
        paginate((page: number) =>
          octokit
            .request(JOBS, { owner, repo, run_id: run.id, filter: 'all', per_page: PER_PAGE, page })
            .then(({ data }) => JobsPageSchema.parse(data).jobs ?? []),
        ),
      );
      if (read.status) unread.push({ slice, run: run.id, status: read.status });
      return (read.value ?? []).map((job: Job) => jobRecord(job, run, slice));
    });
    const jobs = jobsOfRuns.flat();

    const red = jobs.filter((job) => job.status === 'completed' && RED.has(job.conclusion));
    const tails = await inParallel(red, async (job): Promise<Log> => {
      const read = await readOrRefused(() => octokit.request(LOGS, { owner, repo, job_id: job.id }).then(({ data }) => data));
      return read.status ? { tail: null, status: read.status } : { tail: tailOf(cleanLog(asText(read.value)), LIMITS.logTailLines) };
    });
    const logs: Record<string, Log | undefined> = Object.fromEntries(red.map((job, index) => [job.id, tails[index]]));

    return { slices, unread, jobs, logs };
  },

  detect(records) {
    if (!records) return { facts: null, findings: [] };
    const logs = records.logs ?? {};
    const jobs = uniqueBy(records.jobs ?? [], (job) => job.id)
      .filter((job) => job.status === 'completed' && (RED.has(job.conclusion) || GREEN.has(job.conclusion)))
      .sort((a, b) => (a.completedAt ?? '').localeCompare(b.completedAt ?? '') || a.id - b.id);

    const redRuns = jobs.filter((job) => RED.has(job.conclusion)).map((job) => redRun(job, logs[job.id]));
    const checks = checksOf(jobs);
    const tests = testsOf(redRuns);

    const facts: Facts = {
      slices: records.slices ?? [],
      unread: records.unread ?? [],
      totals: {
        runs: jobs.length,
        red: redRuns.length,
        checks: checks.length,
        commits: new Set(jobs.map((job) => job.sha)).size,
        slices: new Set(jobs.map((job) => job.slice)).size,
      },
      checks: checks.map(({ flips, ...check }) => ({ ...check, redThenGreen: flips.map(({ commit, slice }) => ({ commit, slice })) })),
      redRuns,
      tests,
    };

    const evidence = (job: RunLike & { id: number; url: string | null }, label = runLabel(job)): Evidence => {
      const tail = logs[job.id]?.tail;
      return { label, url: job.url, ...(tail ? { excerpt: tail } : {}) };
    };
    const redOf = (predicate: (run: RedRun) => boolean) => redRuns.filter(predicate).map((run) => evidence(run));

    const findings = [
      ...checks
        .filter((check) => check.redCommits.length >= THRESHOLDS.repeatedRedCommits || check.redSlices.length >= THRESHOLDS.repeatedRedSlices)
        .sort((a, b) => b.redCommits.length - a.redCommits.length || b.red - a.red || a.check.localeCompare(b.check))
        .map((check) => ({
          id: `repeated-red:${check.check}`,
          kind: 'repeated-red',
          title: `Check ${check.check} was red again and again`,
          happened: `The check \`${check.check}\` was red on ${count(check.redCommits.length, 'commit')} in ${count(check.redSlices.length, 'slice')} (${check.redSlices.join(', ')}): ${check.red} of its ${count(check.runs, 'run')} were red. The rules flag a check red on ${THRESHOLDS.repeatedRedCommits} or more commits, or in ${THRESHOLDS.repeatedRedSlices} or more slices.`,
          evidence: redOf((run) => run.check === check.check),
        })),
      ...checks
        .filter((check) => check.flips.length > 0)
        .map((check) => ({
          id: `flaky:${check.check}`,
          kind: 'flaky',
          title: `Check ${check.check} turned green on a re-run of the same commit`,
          happened: `The check \`${check.check}\` was red, then green on the same commit with no change to the code, on ${count(check.flips.length, 'commit')}: ${check.flips
            .map((flip) => `\`${flip.commit}\` in ${flip.slice}`)
            .join(', ')}.`,
          evidence: check.flips.flatMap((flip) => [
            evidence(flip.red, runLabel(flip.red, 'red')),
            evidence(flip.green, runLabel(flip.green, 'green')),
          ]),
        })),
      ...tests
        .filter((test) => test.runs >= THRESHOLDS.failingTestRuns)
        .map((test) => ({
          id: `failing-test:${test.test}`,
          kind: 'failing-test',
          title: `Test “${leafOf(test.test)}” failed in several runs`,
          happened: `The test \`${test.test}\` failed in ${count(test.runs, 'red run')}, of the ${test.checks.length === 1 ? 'check' : 'checks'} ${test.checks
            .map((name) => `\`${name}\``)
            .join(', ')}, in ${test.slices.join(', ')}. The rules flag a test failing in ${THRESHOLDS.failingTestRuns} or more runs.`,
          evidence: redOf((run) => run.tests.includes(test.test)),
        })),
    ];

    return { facts, findings };
  },

  describe(facts) {
    if (!facts) return null;
    const { totals } = facts;
    const lines: string[] = [];
    if (totals.runs > 0) {
      lines.push(
        `- ${count(totals.runs, 'run')} of ${count(totals.checks, 'check')} on ${count(totals.commits, 'commit')} in ${count(totals.slices, 'slice')}, read from GitHub Actions: ${totals.red} red.`,
      );
    }
    for (const miss of facts.unread) {
      const what = miss.run ? `the jobs of run ${miss.run} in ${miss.slice}` : `the runs of ${miss.slice}`;
      const why = miss.status === 403 ? ' The app reads them with the `actions: read` permission.' : '';
      lines.push(`- Not read: ${what} (GitHub answered ${miss.status}).${why}`);
    }
    if (lines.length === 0) return null;
    if (totals.runs === 0) return lines;

    lines.push(
      '',
      '| check | runs | red | commits red | slices red | red then green |',
      '| --- | --- | --- | --- | --- | --- |',
      ...facts.checks.map(
        (check) =>
          `| ${cell(check.check)} | ${check.runs} | ${check.red} | ${check.redCommits.length} | ${check.redSlices.join(', ') || '—'} | ${check.redThenGreen.length} |`,
      ),
    );
    if (facts.tests.length > 0) {
      lines.push(
        '',
        'Failing tests, as the red runs’ logs name them:',
        '',
        '| test | red runs | checks | slices |',
        '| --- | --- | --- | --- |',
        ...facts.tests.map((test) => `| \`${cell(test.test)}\` | ${test.runs} | ${cell(test.checks.join(', '))} | ${test.slices.join(', ')} |`),
      );
    }
    if (facts.redRuns.length > 0) {
      lines.push(
        '',
        'Red runs:',
        '',
        '| red run | slice | commit | from its log |',
        '| --- | --- | --- | --- |',
        ...facts.redRuns.map(
          (run) => `| [${cell(runName(run))}](${run.url}) | ${run.slice} | \`${run.commit}\` | ${fromLog(run)} |`,
        ),
      );
    }
    return lines;
  },
});

/** A red job as the facts keep it: where it ran, and what its log names; the log itself only when no reporter was read. */
function redRun(job: JobRecord, log: Log | undefined): RedRun {
  const base = { id: job.id, check: job.check, slice: job.slice, commit: short(job.sha), attempt: job.attempt, url: job.url };
  if (!log) return { ...base, reporter: null, tests: [], counts: null, log: 'not read' };
  if (log.tail === null) return { ...base, reporter: null, tests: [], counts: null, log: `not read (${log.status})` };
  const read = readTestLog(log.tail);
  return { ...base, ...read, log: 'read', ...(read.reporter === null ? { excerpt: log.tail } : {}) };
}

/** Per check, in name order: its runs, its red runs, the commits and slices it was red in, and each commit it turned green on. */
function checksOf(jobs: readonly JobRecord[]): Check[] {
  const jobsByName = new Map<string, JobRecord[]>();
  for (const job of jobs) jobsByName.set(job.check, [...(jobsByName.get(job.check) ?? []), job]);

  return [...jobsByName.entries()]
    .map(([name, ofCheck]) => {
      const reds = ofCheck.filter((job) => RED.has(job.conclusion));
      const flips: Flip[] = [];
      ofCheck.forEach((red, index) => {
        if (!RED.has(red.conclusion) || flips.some((flip) => flip.red.sha === red.sha)) return;
        const green = ofCheck.slice(index + 1).find((job) => job.sha === red.sha && GREEN.has(job.conclusion));
        if (green) flips.push({ commit: short(red.sha), slice: red.slice, red, green });
      });
      return {
        check: name,
        runs: ofCheck.length,
        red: reds.length,
        redCommits: [...new Set(reds.map((job) => short(job.sha)))],
        redSlices: [...new Set(reds.map((job) => job.slice))],
        flips,
      };
    })
    .sort((a, b) => a.check.localeCompare(b.check));
}

/** Each test a red run's log names, with how many red runs named it, most first. */
function testsOf(redRuns: readonly RedRun[]): Test[] {
  const byName = new Map<string, Test>();
  for (const run of redRuns) {
    for (const name of run.tests) {
      const test = byName.get(name) ?? { test: name, runs: 0, checks: [], slices: [] };
      byName.set(name, test);
      test.runs += 1;
      if (!test.checks.includes(run.check)) test.checks.push(run.check);
      if (!test.slices.includes(run.slice)) test.slices.push(run.slice);
    }
  }
  return [...byName.values()].sort((a, b) => b.runs - a.runs);
}

function jobRecord(job: Job, run: WorkflowRun, slice: string): JobRecord {
  return {
    id: job.id,
    run: job.run_id ?? run.id,
    workflow: job.workflow_name ?? run.name ?? null,
    check: job.name,
    slice,
    sha: job.head_sha ?? run.head_sha,
    attempt: job.run_attempt ?? 1,
    status: job.status,
    conclusion: job.conclusion ?? null,
    url: job.html_url ?? null,
    completedAt: job.completed_at ?? null,
  };
}

/** A job, or a red run, as a label names it. */
type RunLike = { check: string; slice: string; attempt: number; commit?: string; sha?: string | null | undefined };

/** `fn()`'s value, or the status GitHub answered when it will not let the app read it; anything else is thrown, so Inngest retries the step. */
async function readOrRefused<T>(fn: () => Promise<T>): Promise<Read<T>> {
  try {
    return { value: await fn(), status: null };
  } catch (error) {
    const status = statusOf(error);
    if (typeof status === 'number' && UNREADABLE.has(status)) return { value: null, status };
    throw error;
  }
}

/** `fn` over `items`, at most `PARALLEL_READS` at a time, the results in the items' order. */
async function inParallel<T, R>(items: readonly T[], fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await fn(items[index] as T); // ts-allow: `index` is below `items.length`
    }
  };
  await Promise.all(Array.from({ length: Math.min(PARALLEL_READS, items.length) }, worker));
  return results;
}

/** A log as text, whether the request gave a string or bytes. */
function asText(data: unknown): string {
  if (typeof data === 'string') return data;
  if (data instanceof ArrayBuffer) return Buffer.from(data).toString('utf8');
  if (ArrayBuffer.isView(data)) return Buffer.from(data.buffer, data.byteOffset, data.byteLength).toString('utf8');
  return '';
}

/** Each slice branch the pull requests into the feature branch came from, once, with its slice id. */
function sliceBranches(pulls: readonly RetroPull[], prd: RetroPrd, config: Config): { slice: string; branch: string }[] {
  if (pulls.length === 0) return [];
  const template = config.branches.slice.replace('{topic}', prd.topic);
  const branches: { slice: string; branch: string }[] = [];
  for (const pull of pulls) {
    const slice = sliceOf(pull.headRef, template);
    if (slice !== null && !branches.some((known) => known.branch === pull.headRef)) branches.push({ slice, branch: pull.headRef });
  }
  return branches;
}

function runName(run: RedRun): string {
  return run.attempt > 1 ? `${run.check}, attempt ${run.attempt}` : run.check;
}

function runLabel(job: RunLike, colour: string | null = null): string {
  const attempt = job.attempt > 1 ? `, attempt ${job.attempt}` : '';
  return `${job.check}${colour ? ` ${colour}` : ''} on ${short(job.sha ?? job.commit)} in ${job.slice}${attempt}`;
}

function fromLog(run: RedRun): string {
  if (run.log !== 'read') return run.log;
  if (run.reporter === null) return 'no test named: its last lines are kept as an excerpt';
  const name = REPORTERS[run.reporter];
  if (!run.counts) return `${name}, no count`;
  const counts = run.counts;
  return `${name}: ${COUNT_ORDER.filter((key) => key in counts)
    .map((key) => `${counts[key]} ${key}`)
    .join(', ')}`;
}

/** The last part of a test's name: its title. */
function leafOf(test: string): string | undefined {
  return test.split(/ > |::/).at(-1);
}

function short(sha: string | null | undefined): string {
  return String(sha ?? '').slice(0, 7);
}

function count(n: number, noun: string): string {
  return `${n} ${n === 1 ? noun : `${noun}s`}`;
}

function cell(text: string): string {
  return String(text).replaceAll('|', '\\|');
}

function uniqueBy<T, K>(items: readonly T[], key: (item: T) => K): T[] {
  const seen = new Set<K>();
  return items.filter((item) => !seen.has(key(item)) && seen.add(key(item)));
}

/** The HTTP status a failed request carries, when it carries one. */
function statusOf(error: unknown): unknown {
  return typeof error === 'object' && error !== null && 'status' in error ? error.status : undefined;
}
