// `omni runner send '<line>' [--to <runner|fleet>]` and `omni runner follow <n>` (PRD 2251): the
// terminal's side of Send to terminal, with its own sign-in.
//
// `send` queues a line for this repository's workspace and prints the job's id. A line no runner runs is
// refused before any call (`../../lib/runner/line.ts`). `--to` names a runner or a fleet of the workspace
// (the runner first); without it the job goes to any runner.
//
// `follow` finds the newest job of PRD n in this repository (waiting for one while there is none), then
// reads the job and its new lines every 5 seconds and prints its milestones (`../../lib/runner/follow.ts`)
// until it ends: exit 0 on done, 1 on failed, cancelled or runner lost. The page unreachable twelve reads
// in a row (a minute at least: a slow app is waited out, #2552) ends it held, not failed (exit 1). Ctrl-C stops the following only: the job runs on. While it
// follows, the last milestone is kept in `.omni-loop/local/runner-follow/<n>.json` (`{ prd, runner, line,
// at }`) for the HUD to read; the file goes when the follow ends.
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { z } from 'zod';
import type { Fetch, TokenStore } from '../../lib/ask/client.ts';
import { askClient } from '../../lib/ask/client.ts';
import { homeTokens } from '../../lib/ask/client-tokens.ts';
import { credentialsHost } from '../../lib/ask/credentials.ts';
import { ensureLocalDir, LOCAL_DIR } from '../../lib/ask/local-state.ts';
import { loadContext } from '../../lib/context.ts';
import type { PrdNumber } from '../../lib/ids.ts';
import { RunnerRefused, RunnerUnreachable, runnerApi } from '../../lib/runner/api.ts';
import type { KitReads, PrdJob, SendTarget } from '../../lib/runner/api.ts';
import { exitCodeOf, isEnded, milestones } from '../../lib/runner/follow.ts';
import type { MergedCount, Seen } from '../../lib/runner/follow.ts';
import { checkRunnerLine } from '../../lib/runner/line.ts';
import { parseArgs, prdArg, println, usageError } from '../args.ts';
import type { FreeIo, Out } from '../io.ts';
import { board } from './board.ts';

const SEND_USAGE = "usage: omni runner send '<line>' [--to <runner|fleet>]";
const FOLLOW_USAGE = 'usage: omni runner follow <n>';

/** How often a follow reads the job and its lines. */
const FOLLOW_MS = 5000;
/**
 * How many reads in a row may fail before the follow ends held: a minute of pauses at least, up to three
 * when each read times out, so a slow app (a read past its 10 s) is waited out, not taken for one gone (#2552).
 */
const HELD_AFTER = 12;
/** The board's count is read every this many reads, and once the job ended. */
const BOARD_EVERY = 6;

const SIGNED_OUT = 'no sign-in (omni signin) · held';
const UNREACHABLE = 'server unreachable · held, not failed';

/** What a test hands `send` and `follow` beyond `main()`'s own. */
export type FollowOptions = {
  tokens?: TokenStore | undefined;
  home?: string | undefined;
  fetch?: Fetch;
  stop?: AbortSignal;
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
  now?: () => number;
  /** How often the follow reads, in milliseconds (5000). */
  followMs?: number;
  /** The board's count of merged slices; a test's own, else `omni board <n> --json` as it runs here. */
  mergedOf?: (prd: PrdNumber) => Promise<MergedCount>;
};

type Io = FreeIo & FollowOptions;

/** Where a command reads: the page, the repository, the checkout's root, the sign-in and the page's client. */
type At = { askUrl: string; repo: string; root: string; tokens: TokenStore; api: KitReads };

/** This checkout's repository, page and root; else the line printed, and the exit code `1`. */
function placeOf(io: Io): { slug: string; askUrl: string; root: string } | 1 {
  let ctx;
  try {
    ctx = loadContext(io.cwd, { exec: io.exec });
  } catch (error) {
    println(io.stderr, `omni runner: ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  }
  const { slug } = ctx.config.repo;
  const askUrl = ctx.config.ask.url;
  if (slug && askUrl) return { slug, askUrl, root: ctx.root };
  println(io.stderr, slug ? 'omni runner: no Omni page is set here (ask.url) · held' : 'omni runner: no repository slug — set repo.slug in the config.');
  return 1;
}

/** Where this checkout reads, with the person's sign-in; else the line printed, and the exit code `1`. */
function signedInAt(io: Io): At | 1 {
  const place = placeOf(io);
  if (place === 1) return 1;
  const { slug, askUrl, root } = place;
  const tokens = io.tokens ?? homeTokens({ home: io.home, omniToken: io.vars.omniToken?.token ?? null });
  if (!tokens.read(credentialsHost(askUrl))) {
    println(io.stdout, SIGNED_OUT);
    return 1;
  }
  return { askUrl, repo: slug, root, tokens, api: runnerApi({ askUrl, tokens, fetch: io.fetch ?? globalThis.fetch }) };
}

/** Where `--to` sends the job: a runner of the workspace by its name, else a fleet, else a refusal. */
async function targetOf(to: string | undefined, repo: string, reads: KitReads): Promise<SendTarget | string> {
  if (to === undefined) return { kind: 'any' };
  const runners = await reads.runners(repo);
  const runner = runners.find((candidate) => candidate.name === to);
  if (runner) return { kind: 'runner', runner: runner.id };
  if (runners.some((candidate) => candidate.fleet === to)) return { kind: 'fleet', fleet: to };
  return `omni runner: no runner or fleet named "${to}" in this workspace.`;
}

/** `omni runner send '<line>' [--to <runner|fleet>]`. */
export async function send(args: string[], io: Io): Promise<number> {
  const { positional, flags } = parseArgs('runner', args, { values: ['to'] });
  const [line] = positional;
  if (positional.length !== 1 || line === undefined || flags.to === '') throw usageError(SEND_USAGE);
  // A repository's own skill (PRD 2313) is the app's to allow: the shape and the fixed list are checked here, the name left to it.
  const own = /^\/([a-z][a-z0-9-]*)(?: |$)/.exec(line)?.[1];
  const checked = checkRunnerLine(line, own === undefined ? [] : [own]);
  if (!checked.ok) {
    println(io.stderr, `omni runner: ${checked.reason}`);
    return 1;
  }
  const at = signedInAt(io);
  if (at === 1) return 1;
  try {
    const target = await targetOf(flags.to, at.repo, at.api);
    if (typeof target === 'string') {
      println(io.stderr, target);
      return 1;
    }
    const job = await at.api.send({ line, repo: at.repo, target });
    println(io.stdout, job.id);
    return 0;
  } catch (error) {
    println(io.stderr, `omni runner: ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  }
}

/** Waits `ms`, or less when `signal` aborts. */
const pause = (ms: number, signal?: AbortSignal): Promise<void> => delay(ms, undefined, signal ? { signal } : {}).catch(() => undefined);

/** Ctrl-C (or SIGTERM) as a signal, and how to stop listening. */
export function interrupts(): { signal: AbortSignal; release(): void } {
  const controller = new AbortController();
  const stop = (): void => {
    controller.abort();
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
  return {
    signal: controller.signal,
    release() {
      process.off('SIGINT', stop);
      process.off('SIGTERM', stop);
    },
  };
}

/** What `omni board --json` prints that the count reads: each slice's state. */
const BoardSchema = z.object({ slices: z.array(z.object({ state: z.string() })) });
/** What the page answers for a PRD's dossier: its link. */
const DossierSchema = z.object({ url: z.string().min(1) });

/** `omni board <n> --json` as it runs here: how many slices are merged of how many; `null` when it cannot be read. */
export async function boardCount(prd: PrdNumber, io: Io): Promise<MergedCount> {
  let text = '';
  const sink: Out = { write: () => undefined };
  const capture: Out = { write: (chunk) => (text += chunk) };
  try {
    if ((await board.run([String(prd), '--json'], { cwd: io.cwd, exec: io.exec, env: io.env, vars: io.vars, script: io.script, tokens: io.tokens, home: io.home, ...(io.fetch ? { fetch: io.fetch } : {}), stdout: capture, stderr: sink })) !== 0) return null;
    const read = BoardSchema.safeParse(JSON.parse(text));
    if (!read.success) return null;
    const { slices } = read.data;
    return { merged: slices.filter((slice) => slice.state === 'merged').length, total: slices.length };
  } catch {
    return null;
  }
}

/** The PRD's page link, or `null` when it has none or the page cannot be read. */
async function pageOf(prd: PrdNumber, at: At, fetch: Fetch): Promise<string | null> {
  try {
    const client = askClient({ baseUrl: at.askUrl, host: credentialsHost(at.askUrl), tokens: at.tokens, fetch });
    const found = DossierSchema.safeParse(await client.findDossier({ repo: at.repo, prd }));
    return found.success ? found.data.url : null;
  } catch {
    return null;
  }
}

/** The file the HUD reads while a follow runs. */
const followFile = (root: string, prd: PrdNumber): string => join(root, LOCAL_DIR, 'runner-follow', `${String(prd)}.json`);

/** One follow, as it runs: where it reads, and what it has read so far. */
type Follow = { prd: PrdNumber; at: At; io: Io; seen: Seen | null; job: string | null; cursor: number; merged: MergedCount; reads: number };

/** The job's new lines after the cursor, which moves on. */
async function newLines(run: Follow, job: string): Promise<string[]> {
  const lines: string[] = [];
  for (;;) {
    const read = await run.at.api.lines(job, run.cursor);
    for (const line of read.lines) {
      lines.push(line.text);
      run.cursor = Math.max(run.cursor, line.seq);
    }
    if (!read.more || read.lines.length === 0) return lines;
  }
}

/** Keeps the last milestone for the HUD of this checkout. */
function remember(run: Follow, job: PrdJob, line: string): void {
  const { root } = run.at;
  ensureLocalDir(root);
  mkdirSync(join(root, LOCAL_DIR, 'runner-follow'), { recursive: true });
  const at = new Date((run.io.now ?? Date.now)()).toISOString();
  writeFileSync(followFile(root, run.prd), `${JSON.stringify({ prd: Number(run.prd), runner: job.runner, line, at }, null, 2)}\n`);
}

/** The PRD's job (the newest while none is followed), or `null` while it has none. */
async function jobOf(run: Follow): Promise<PrdJob | null> {
  const jobs = await run.at.api.prdJobs(run.at.repo, run.prd);
  return (run.job === null ? jobs[0] : jobs.find((job) => job.id === run.job)) ?? null;
}

/** The board's count when it is due (every sixth read, and once the job ended), else the last one read. */
async function countOf(run: Follow, ended: boolean): Promise<MergedCount> {
  if (run.reads % BOARD_EVERY !== 0 && !ended) return run.merged;
  return (run.io.mergedOf ?? ((prd) => boardCount(prd, run.io)))(run.prd);
}

/** One read: the job, its new lines and their milestones, printed; the exit code once the job ended, else `null`. */
async function read(run: Follow): Promise<number | null> {
  const job = await jobOf(run);
  if (job === null) {
    if (run.reads === 0) println(run.io.stdout, `waiting for a job of PRD ${String(run.prd)}`);
    return null;
  }
  run.job = job.id;
  const lines = await newLines(run, job.id);
  const ended = isEnded(job);
  run.merged = await countOf(run, ended);
  const page = ended ? await pageOf(run.prd, run.at, run.io.fetch ?? globalThis.fetch) : null;
  const next = milestones(run.seen, { ...job, repo: run.at.repo }, lines, run.merged, page);
  run.seen = next.seen;
  for (const line of next.lines) println(run.io.stdout, line);
  const last = next.lines.at(-1);
  if (last !== undefined) remember(run, job, last);
  return ended ? exitCodeOf(job) : null;
}

/** The line a failed read ends the follow on, or `null` to read again (the page failed fewer than {@link HELD_AFTER} times in a row). */
function endOf(error: unknown, failures: number): string | null {
  if (error instanceof RunnerRefused) return error.message;
  if (!(error instanceof RunnerUnreachable)) throw error;
  return failures >= HELD_AFTER ? UNREACHABLE : null;
}

/** Reads until the job ends, the page stays unreadable or `signal` aborts: the exit code. */
async function follow(run: Follow, signal: AbortSignal): Promise<number> {
  let failures = 0;
  while (!signal.aborted) {
    try {
      const code = await read(run);
      if (code !== null) return code;
      failures = 0;
    } catch (error) {
      failures += 1;
      const end = endOf(error, failures);
      if (end !== null) {
        println(run.io.stdout, end);
        return 1;
      }
    }
    run.reads += 1;
    await (run.io.sleep ?? pause)(run.io.followMs ?? FOLLOW_MS, signal);
  }
  println(run.io.stdout, `stopped following PRD ${String(run.prd)} · the job runs on`);
  return 130;
}

/** `omni runner follow <n>`. */
export async function followCommand(args: string[], io: Io): Promise<number> {
  const { positional } = parseArgs('runner', args);
  if (positional.length !== 1) throw usageError(FOLLOW_USAGE);
  const prd = prdArg('runner', '<n>', positional[0]);
  const at = signedInAt(io);
  if (at === 1) return 1;
  const stop = io.stop ? { signal: io.stop, release: () => undefined } : interrupts();
  try {
    return await follow({ prd, at, io, seen: null, job: null, cursor: 0, merged: null, reads: 0 }, stop.signal);
  } finally {
    stop.release();
    rmSync(followFile(at.root, prd), { force: true });
  }
}
