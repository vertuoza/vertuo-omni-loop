/**
 * **Level B of a bug fix's proof ladder: the red and the green seen in CI** (PRD 2578, slice s1).
 *
 * `omni bug ci <n>` reads the checks of two commits through `gh`: the reproduction commit (red) and the
 * fix commit (green). This module is the pure rule over what it read. The red is proven when a job
 * failed on the reproduction commit and its log names the test; the green when that same job passed on
 * the fix commit. The two excerpts (`red.txt` and `green.txt`, the inputs of `omni bug film`) are the
 * log lines around the test, masked as every excerpt the kit writes (L-GDPR-2), then the run's link.
 * Anything else is one line saying why, never a guess.
 */
import { maskSecrets } from '../openrouter.ts';

/** One job of a run, as `gh run view --json jobs` lists it, with its `log` when the caller loaded it. */
export type CiJob = { name: string; status: string; conclusion: string; url: string; log: string };

/** The jobs of every run of one commit. */
export type CiSide = { sha: string; jobs: readonly CiJob[] };

export type CiProof = { ok: true; red: string; green: string } | { ok: false; line: string };

const BEFORE = 5;
const AFTER = 14;
const TAIL = 20;
const SHORT = 7;
/** The prefix `gh run view --log` puts on every line: job, step and timestamp. */
const GH_PREFIX = /^[^\t\n]*\t[^\t\n]*\t\d{4}-\d{2}-\d{2}T[\d:.]+Z ?/;

const short = (sha: string): string => sha.slice(0, SHORT);

/** Whether every job of the side finished, and there is at least one: a commit with no run yet is not finished. */
export function finished(side: CiSide): boolean {
  return side.jobs.length > 0 && side.jobs.every((job) => job.status === 'completed');
}

const failed = (job: CiJob): boolean => job.conclusion === 'failure';
const skipped = (job: CiJob): boolean => job.conclusion === 'skipped';

/** The lines of `log` without gh's prefix, the empty ones at the end dropped. */
function logLines(log: string): string[] {
  const lines = log
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => line.replace(GH_PREFIX, ''));
  while (lines.length > 0 && (lines.at(-1) ?? '').trim() === '') lines.pop();
  return lines;
}

/** The log lines around the first one naming `test` (the log's tail when none does), masked. */
function around(log: string, test: string): string[] {
  const lines = logLines(log);
  const at = lines.findIndex((line) => line.includes(test));
  const from = at === -1 ? Math.max(0, lines.length - TAIL) : Math.max(0, at - BEFORE);
  const to = at === -1 ? lines.length : at + AFTER + 1;
  return lines.slice(from, to).map((line) => maskSecrets(line));
}

/** One excerpt file: what the job was, the log lines, the run's link. */
function excerpt(pr: number, side: CiSide, job: CiJob, test: string): string {
  return `${[`#${pr} · ${short(side.sha)} · job ${job.name}`, ...around(job.log, test), `Run: ${job.url}`].join('\n')}\n`;
}

/** The job that proves the red: failed on the reproduction commit with a log naming the test; else why not. */
function redJob(side: CiSide, test: string): { job: CiJob } | { line: string } {
  const named = side.jobs.find((job) => failed(job) && job.log.includes(test));
  if (named) return { job: named };
  const idle = side.jobs.find(skipped);
  if (idle) return { line: `job ${idle.name} skipped` };
  if (side.jobs.some(failed)) return { line: `no failed log names ${test}` };
  return { line: `every check passed on ${short(side.sha)}` };
}

/** The same job on the fix commit when it passed; else why not. */
function greenJob(side: CiSide, name: string): { job: CiJob } | { line: string } {
  const job = side.jobs.find((candidate) => candidate.name === name && candidate.conclusion === 'success');
  if (job) return { job };
  const other = side.jobs.find((candidate) => candidate.name === name);
  if (!other) return { line: `job ${name} did not run on ${short(side.sha)}` };
  return { line: skipped(other) ? `job ${name} skipped` : `job ${name} did not pass on ${short(side.sha)}` };
}

/**
 * The proof of two finished sides: the two excerpts, or the one line saying why there is none.
 * `pr` is the pull request the runs belong to, named in each excerpt's first line.
 */
export function proveCi({ pr, test, reproduction, fix }: { pr: number; test: string; reproduction: CiSide; fix: CiSide }): CiProof {
  const red = redJob(reproduction, test);
  if ('line' in red) return { ok: false, line: red.line };
  const green = greenJob(fix, red.job.name);
  if ('line' in green) return { ok: false, line: green.line };
  return { ok: true, red: excerpt(pr, reproduction, red.job, test), green: excerpt(pr, fix, green.job, test) };
}

/** The names of the jobs that failed on a side: the ones whose logs the red may need. */
export const failedNames = (side: CiSide): string[] => side.jobs.filter(failed).map((job) => job.name);
