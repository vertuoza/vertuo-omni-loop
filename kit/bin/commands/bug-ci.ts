// `omni bug ci <n> --pr <pr> --reproduction <sha> --fix <sha> --test <name> --out <dir> [--wait <minutes>]`
// — level B of a bug fix's proof ladder (PRD 2578): the red and the green read from CI. It reads, through
// `gh` and nothing else (never an edit of a CI file, never a change of the pull request's draft state),
// the runs of the reproduction commit and of the fix commit, waits until both finished (`--wait`, 30
// minutes by default, polled every 30 seconds), then applies `../../lib/bug/ci.ts`. It writes `red.txt`
// and `green.txt` in `--out` — the log lines around the test, masked, and the run's link — which
// `omni bug film` turns into the GIF, and prints the folder's path. Otherwise it prints why on one line
// to stderr and exits 1: `job <name> skipped`, `no failed log names <test>`, `every check passed on
// <commit>`, `the runs did not finish within <wait>`, or `gh failed: <its last line>`. Exit 2: a usage error.
import { mkdirSync, writeFileSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import { z } from 'zod';
import { failedNames, finished, proveCi } from '../../lib/bug/ci.ts';
import type { CiJob, CiSide } from '../../lib/bug/ci.ts';
import { PrNumberSchema, type PrNumber } from '../../lib/ids.ts';
import { errorMessage, issueArg, parseArgs, positiveInt, println, usageError } from '../args.ts';
import type { Exec, FreeIo } from '../io.ts';

const USAGE = 'usage: omni bug ci <n> --pr <pr> --reproduction <sha> --fix <sha> --test <name> --out <dir> [--wait <minutes>]';
const DEFAULT_WAIT = 30;
const POLL_MS = 30_000;
const GH_ERROR = 'GhError';

const RunsSchema = z.array(z.object({ databaseId: z.number() }));
const JobsSchema = z.object({
  jobs: z.array(z.object({ databaseId: z.number(), name: z.string(), status: z.string(), conclusion: z.string().nullable(), url: z.string() })),
});

/** What a test injects: the clock and the sleep. */
type CiOptions = { sleep?: ((ms: number) => Promise<void>) | undefined; now?: (() => number) | undefined };

type Ask = { pr: PrNumber; reproduction: string; fix: string; test: string; out: string; waitMinutes: number };

/** `--wait` as minutes: the default when absent, else a number, or a usage error. */
function minutes(value: string | undefined): number {
  if (value === undefined) return DEFAULT_WAIT;
  const count = Number(value);
  if (Number.isFinite(count) && count >= 0) return count;
  throw usageError(`omni bug ci: --wait ${value} is not a number of minutes.`);
}

/** The request in `args`, or a usage error. */
function askOf(args: string[]): Ask {
  const { positional, flags } = parseArgs('bug ci', args, { values: ['pr', 'reproduction', 'fix', 'test', 'out', 'wait'] });
  if (positional.length !== 1) throw usageError(USAGE);
  issueArg('bug ci', '<n>', positional[0]);
  const pr = PrNumberSchema.parse(positiveInt('bug ci', '--pr', flags.pr));
  const { reproduction = '', fix = '', test = '', out = '' } = flags;
  if ([reproduction, fix, test, out].includes('')) throw usageError(`${USAGE} (--reproduction, --fix, --test and --out are needed)`);
  return { pr, reproduction, fix, test, out, waitMinutes: minutes(flags.wait) };
}

/** The last line gh wrote when it failed, from its error. */
function ghReason(error: unknown): string {
  const written: unknown = error instanceof Error && 'stderr' in error ? error.stderr : undefined;
  const text = typeof written === 'string' ? written : errorMessage(error);
  return text.trim().split('\n').at(-1)?.trim() || 'no output';
}

/** What `gh` printed for `args`, or the error `ci` prints as `gh failed: <its last line>`. */
function gh(exec: Exec, cwd: string, args: string[]): string {
  try {
    return exec('gh', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (error) {
    throw Object.assign(new Error(`gh failed: ${ghReason(error)}`), { name: GH_ERROR });
  }
}

type IdJob = CiJob & { id: number };

/** The jobs of every run of `sha`, without their logs. */
function jobsOf(exec: Exec, cwd: string, sha: string): IdJob[] {
  const runs = RunsSchema.parse(JSON.parse(gh(exec, cwd, ['run', 'list', '--commit', sha, '--json', 'databaseId', '--limit', '50'])));
  return runs.flatMap(({ databaseId }) =>
    JobsSchema.parse(JSON.parse(gh(exec, cwd, ['run', 'view', String(databaseId), '--json', 'jobs']))).jobs.map((job) => ({
      name: job.name,
      status: job.status,
      conclusion: job.conclusion ?? '',
      url: job.url,
      log: '',
      id: job.databaseId,
    })),
  );
}

/** `jobs` with the log of every one whose name is in `names`. */
function withLogs(exec: Exec, cwd: string, jobs: IdJob[], names: readonly string[]): CiJob[] {
  return jobs.map(({ id, ...job }) => (names.includes(job.name) ? { ...job, log: gh(exec, cwd, ['run', 'view', '--job', String(id), '--log']) } : job));
}

const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** Both sides, once each has finished; or null when `deadline` passes first. */
async function finishedSides(exec: Exec, cwd: string, ask: Ask, { sleep = wait, now = Date.now }: CiOptions): Promise<[IdJob[], IdJob[]] | null> {
  const deadline = now() + ask.waitMinutes * 60_000;
  for (;;) {
    const reproduction = jobsOf(exec, cwd, ask.reproduction);
    const fix = jobsOf(exec, cwd, ask.fix);
    if (finished({ sha: ask.reproduction, jobs: reproduction }) && finished({ sha: ask.fix, jobs: fix })) return [reproduction, fix];
    if (now() >= deadline) return null;
    await sleep(POLL_MS);
  }
}

/** Runs `omni bug ci`; the exit code. */
export async function ci(args: string[], io: FreeIo & CiOptions): Promise<number> {
  const { cwd, stdout, stderr, exec } = io;
  const ask = askOf(args);
  try {
    const sides = await finishedSides(exec, cwd, ask, io);
    if (sides === null) {
      println(stderr, `the runs did not finish within ${ask.waitMinutes} minutes`);
      return 1;
    }
    const names = failedNames({ sha: ask.reproduction, jobs: sides[0] });
    const reproduction: CiSide = { sha: ask.reproduction, jobs: withLogs(exec, cwd, sides[0], names) };
    const fix: CiSide = { sha: ask.fix, jobs: withLogs(exec, cwd, sides[1], names) };
    const proof = proveCi({ pr: ask.pr, test: ask.test, reproduction, fix });
    if (!proof.ok) {
      println(stderr, proof.line);
      return 1;
    }
    const out = isAbsolute(ask.out) ? ask.out : join(cwd, ask.out);
    mkdirSync(out, { recursive: true });
    writeFileSync(join(out, 'red.txt'), proof.red);
    writeFileSync(join(out, 'green.txt'), proof.green);
    println(stdout, out);
    return 0;
  } catch (error) {
    if (error instanceof SyntaxError || error instanceof z.ZodError) {
      println(stderr, 'gh failed: its answer was not the JSON asked for');
      return 1;
    }
    if (error instanceof Error && error.name === GH_ERROR) {
      println(stderr, error.message);
      return 1;
    }
    throw error;
  }
}
