// The runner's health reports (PRD 2102, s1): `runRunner()` on a fake app, a fake clock and a fixed
// machine. A report goes right after registering, then every 15 s, and one the app refuses or never
// answers prints one line while the runner keeps polling for jobs. Nothing here reads the real machine.
//
// The pause (s2): a machine under pressure opens no new `next`, a slot already waiting keeps its hold
// and runs the job it gets, a running job is never touched, and two quiet samples in a row resume it.
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { ExecText } from '../context.ts';
import type { PrdNumber } from '../ids.ts';
import type { MergedCount } from './follow.ts';
import { RunnerRefused, RunnerUnreachable } from './api.ts';
import type { HealthReport, JobUpdate, RunnerApi, RunnerJob } from './api.ts';
import { DEFAULT_LIMITS } from './health.ts';
import type { MachineReads } from './health.ts';
import { runRunner } from './runner.ts';
import type { RunnerOptions } from './runner.ts';
import type { JobSession, Terminal } from './terminal.ts';
import { accountBook, accountsStateFile, DEFAULT_HANDOFF } from './accounts.ts';
import type { Account, Accounts } from './accounts.ts';
import type { TokenSource } from './tokens.ts';

const GB = 1024 ** 3;
const T0 = Date.parse('2026-10-16T12:00:00.000Z');

/** A machine whose cores each spend 300 ms busy and 700 ms idle between two samples. */
function machine(): MachineReads {
  let samples = 0;
  return {
    cpus: () => {
      samples += 1;
      const times = { user: 300 * samples, nice: 0, sys: 0, idle: 700 * samples, irq: 0 };
      return [{ times }, { times }];
    },
    loadavg: () => [1.5, 1, 1],
    cores: () => 2,
    totalmem: () => 8 * GB,
    freemem: () => 2 * GB,
    meminfo: () => null,
    statfs: () => ({ bsize: 1024, blocks: (100 * GB) / 1024, bavail: (40 * GB) / 1024 }),
  };
}

/**
 * A fake app: registers `r1`, holds every `next` until the runner stops, and answers health reports
 * with `answers` in turn (`ok`, or the error it throws), each taking `reportMs` of the fake clock.
 */
function fakeApp(answers: ('ok' | Error)[], { reportMs = 0 } = {}) {
  const reports: HealthReport[] = [];
  const nexts: number[] = [];
  const clock = { now: T0 };
  const stop = new AbortController();
  const api: RunnerApi = {
    register: () => Promise.resolve({ id: 'r1' }),
    next: (_runner, signal) => {
      nexts.push(clock.now);
      return new Promise((resolve) => {
        signal?.addEventListener('abort', () => {
          resolve(null);
        }, { once: true });
      });
    },
    update: () => Promise.resolve({ cancel: false }),
    githubToken: () => Promise.reject(new RunnerRefused('refused (404)')),
    health: (runner, report) => {
      expect(runner).toBe('r1');
      reports.push(report);
      clock.now += reportMs;
      const answer = answers[reports.length - 1] ?? 'ok';
      if (reports.length >= answers.length) stop.abort();
      return answer === 'ok' ? Promise.resolve() : Promise.reject(answer);
    },
  };
  return { api, reports, nexts, clock, stop };
}

/** The fake app `run` drives: its routes, its clock and the stop it aborts once it has heard enough. */
type App = { api: RunnerApi; clock: { now: number }; stop: AbortController };

/** Runs the runner on `app` until it stops itself: its exit code, what it printed, and every wait the health loop took. */
async function run(app: App, over: Partial<RunnerOptions> = {}) {
  const printed: string[] = [];
  const waits: number[] = [];
  const code = await runRunner({
    name: 'box-1', slots: 2, timeoutMs: 60_000, version: '0.0.442', checkouts: new Map(), api: app.api,
    terminal: { start: () => undefined, stop: () => undefined, alive: () => false },
    exec: () => '', home: mkdtempSync(join(tmpdir(), 'omni-runner-health-')), wrapper: [], env: {},
    print: (line) => printed.push(line), stop: app.stop.signal, now: () => app.clock.now,
    // Once stopped, no wait; the hour between sweeps waits for the stop; every other wait passes at once,
    // on the fake clock.
    sleep: (ms, signal) => new Promise((resolve) => {
      if (signal?.aborted) {
        resolve();
        return;
      }
      if (ms === 60 * 60 * 1000) {
        signal?.addEventListener('abort', () => {
          resolve();
        }, { once: true });
        return;
      }
      waits.push(ms);
      app.clock.now += ms;
      setImmediate(resolve);
    }),
    machine: machine(),
    ...over,
  });
  return { code, printed, waits };
}

describe('the runner\'s health reports', () => {
  it('sends the machine\'s sample right after registering, then every 15 s, the CPU from the second on', async () => {
    const app = fakeApp(['ok', 'ok', 'ok']);
    const { code, printed, waits } = await run(app);
    expect(code).toBe(0);
    const quiet = { paused: null, limits: DEFAULT_LIMITS };
    expect(app.reports).toEqual([
      { cpu: null, load1: 1.5, cores: 2, memUsed: 6 * GB, memTotal: 8 * GB, diskFree: 40 * GB, diskTotal: 100 * GB, ...quiet },
      { cpu: 30, load1: 1.5, cores: 2, memUsed: 6 * GB, memTotal: 8 * GB, diskFree: 40 * GB, diskTotal: 100 * GB, ...quiet },
      { cpu: 30, load1: 1.5, cores: 2, memUsed: 6 * GB, memTotal: 8 * GB, diskFree: 40 * GB, diskTotal: 100 * GB, ...quiet },
    ]);
    expect(waits).toEqual([15_000, 15_000]);
    expect(printed.filter((line) => line.startsWith('health'))).toEqual([]);
  });

  it('keeps 15 s between two samples when a report is slow', async () => {
    const app = fakeApp(['ok', 'ok', 'ok'], { reportMs: 4000 });
    const { waits } = await run(app);
    expect(waits).toEqual([11_000, 11_000]);
  });

  it('prints one line for a refused report and one for a report that timed out, and runs on', async () => {
    const app = fakeApp([new RunnerRefused('refused (404)'), new RunnerUnreachable('POST /api/runners/r1/health: timed out'), 'ok', 'ok']);
    const { code, printed } = await run(app);
    expect(code).toBe(0);
    expect(app.reports).toHaveLength(4);
    expect(printed.filter((line) => line.startsWith('health'))).toEqual([
      'health not sent: refused (404)',
      'health not sent: POST /api/runners/r1/health: timed out',
    ]);
    // Neither stopped the slots: both kept their `next` open, and the runner ended only when stopped.
    expect(app.nexts).toHaveLength(2);
    expect(printed.at(-1)).toBe('runner box-1 stopped');
  });

  it('carries on after a report fails in a way it did not expect', async () => {
    const app = fakeApp([new TypeError('fetch failed'), 'ok']);
    const { code, printed } = await run(app);
    expect(code).toBe(0);
    expect(printed).toContain('health not sent: fetch failed');
    expect(app.reports).toHaveLength(2);
  });
});

/** A machine of 10 GB whose memory used is `percents[n]` percent at its nth sample, the last one after. */
function memoryMachine(percents: readonly number[]): MachineReads {
  let samples = 0;
  return {
    ...machine(),
    totalmem: () => 10 * GB,
    freemem: () => {
      const percent = percents[Math.min(samples, percents.length - 1)] ?? 0;
      samples += 1;
      return ((100 - percent) / 100) * 10 * GB;
    },
  };
}

/**
 * A fake app that holds every `next` until it is handed a job or the runner stops, records each job's
 * reports, and stops the runner after `reports` health reports, calling `onReport` with each one's number.
 */
function holdingApp(reports: number, onReport: (n: number) => void = () => undefined) {
  const heard: HealthReport[] = [];
  const updates: JobUpdate[] = [];
  const held: ((job: RunnerJob | null) => void)[] = [];
  let nexts = 0;
  const clock = { now: T0 };
  const stop = new AbortController();
  const api: RunnerApi = {
    register: () => Promise.resolve({ id: 'r1' }),
    next: (_runner, signal) => {
      nexts += 1;
      return new Promise((resolve) => {
        held.push(resolve);
        signal?.addEventListener('abort', () => {
          resolve(null);
        }, { once: true });
      });
    },
    update: (_job, update) => {
      updates.push(update);
      return Promise.resolve({ cancel: false });
    },
    githubToken: () => Promise.reject(new RunnerRefused('refused (404)')),
    health: (_runner, report) => {
      heard.push(report);
      onReport(heard.length);
      if (heard.length >= reports) stop.abort();
      return Promise.resolve();
    },
  };
  return { api, clock, stop, reports: heard, updates, held, nexts: () => nexts };
}

describe('the pause', () => {
  it('opens no next while the machine is under pressure, stays paused on one quiet sample, and resumes on the second', async () => {
    const nextsAt: number[] = [];
    const app = holdingApp(4, () => nextsAt.push(app.nexts()));
    const { code, printed } = await run(app, { machine: memoryMachine([91, 50, 50, 50]) });
    expect(code).toBe(0);
    // The resume is decided at the third sample; the two slots open their next right after it.
    expect(nextsAt).toEqual([0, 0, 0, 2]);
    expect(app.reports.map((report) => report.paused)).toEqual(['memory 91%', 'memory 91%', null, null]);
    expect(app.reports.map((report) => report.limits)).toEqual(Array(4).fill(DEFAULT_LIMITS));
    expect(printed.filter((line) => /^(paused|resumed)/.test(line))).toEqual(['paused: memory 91%', 'resumed']);
  });

  it('pauses at the limits it is given, and carries them in its report', async () => {
    const limits = { maxMemory: 40, minDiskGb: 10, maxLoad: 1.5 };
    const app = holdingApp(2);
    const { printed } = await run(app, { machine: memoryMachine([50]), limits });
    expect(app.nexts()).toBe(0);
    expect(app.reports.map((report) => [report.paused, report.limits])).toEqual([['memory 50%', limits], ['memory 50%', limits]]);
    expect(printed).toContain('paused: memory 50%');
  });

  it('lets a slot already waiting keep its hold and run the job it gets, never touching it, and opens no next after it while paused', async () => {
    const home = mkdtempSync(join(tmpdir(), 'omni-runner-pause-'));
    const stopped: string[] = [];
    const terminal: Terminal = { start: () => undefined, stop: (name) => stopped.push(name), alive: () => true };
    const app = holdingApp(8, (n) => {
      // The second sample is under pressure: the slot's next, held since the first, hands it a job.
      if (n === 2) app.held[0]?.({ id: '7', line: '/omni:yolo 7', repo: 'acme/widgets', sentBy: null, sentByKey: null, github: null, allowedSkills: [] });
      // The job runs through two more samples under pressure, then ends by itself.
      if (n === 5) writeFileSync(join(home, 'logs', 'job-7.exit'), '0\n');
    });
    const { code, printed } = await run(app, {
      slots: 1, timeoutMs: 24 * 60 * 60 * 1000, home, terminal,
      checkouts: new Map([['acme/widgets', join(home, 'widgets')]]),
      machine: memoryMachine([50, 91]),
    });
    expect(code).toBe(0);
    expect(printed).toContain('paused: memory 91%');
    expect(printed).toContain('job 7 claimed: /omni:yolo 7 (acme/widgets)');
    expect(printed).toContain('job 7 done');
    expect(app.updates.map((update) => update.status).at(-1)).toBe('done');
    expect(app.updates.filter((update) => update.status === 'running').length).toBeGreaterThan(1);
    expect(stopped).toEqual([]);
    // The one next it held when the pause began, and none after the job, the machine still under pressure.
    expect(app.nexts()).toBe(1);
    expect(printed.at(-1)).toBe('runner box-1 stopped');
  });
});

describe('the tokens (PRD 2102, s4)', () => {
  const MACHINE = { last5h: { input: 1, output: 2, cacheRead: 3, cacheWrite: 4 }, today: { input: 10, output: 20, cacheRead: 30, cacheWrite: 40 } };
  const JOB_TOKENS = { input: 5, output: 6, cacheRead: 7, cacheWrite: 8 };
  const counts = (machine: typeof MACHINE | null, job: typeof JOB_TOKENS | null, worktrees: string[] = []): TokenSource => ({
    job: (worktree) => {
      worktrees.push(worktree);
      return job;
    },
    machine: () => machine,
  });

  /** Runs one job on a fake app that answers health in turn and refuses a job report that carries tokens when `refuseTokens`. */
  async function withJob({ health, refuseTokens = false, tokens }: { health: 'ok' | 'fails'; refuseTokens?: boolean; tokens: TokenSource }) {
    const home = mkdtempSync(join(tmpdir(), 'omni-runner-tokens-'));
    const base = holdingApp(7, (n) => {
      if (n === 2) base.held[0]?.({ id: '7', line: '/omni:yolo 7', repo: 'acme/widgets', sentBy: null, sentByKey: null, github: null, allowedSkills: [] });
      if (n === 6) writeFileSync(join(home, 'logs', 'job-7.exit'), '0\n');
    });
    const sent: JobUpdate[] = [];
    const api: RunnerApi = {
      ...base.api,
      update: (job, update) => {
        sent.push(update);
        if (refuseTokens && update.tokens !== undefined) return Promise.reject(new RunnerRefused('refused (400)'));
        return base.api.update(job, update);
      },
      health: (runner, report) => (health === 'ok' ? base.api.health(runner, report) : base.api.health(runner, report).then(() => Promise.reject(new RunnerUnreachable('down')))),
    };
    const { code, printed } = await run({ ...base, api }, {
      slots: 1, timeoutMs: 24 * 60 * 60 * 1000, home, checkouts: new Map([['acme/widgets', join(home, 'widgets')]]), tokens,
      terminal: { start: () => undefined, stop: () => undefined, alive: () => true },
    });
    return { code, printed, sent, reports: base.reports, home };
  }

  it('carries the machine\'s tokens of the last 5 h and today in each health report, and leaves them out when unreadable', async () => {
    const app = fakeApp(['ok', 'ok']);
    await run(app, { tokens: counts(MACHINE, null) });
    expect(app.reports.map((report) => report.tokens)).toEqual([MACHINE, MACHINE]);
    const unreadable = fakeApp(['ok']);
    await run(unreadable, { tokens: counts(null, null) });
    expect(unreadable.reports[0]).not.toHaveProperty('tokens');
  });

  it('carries a job\'s tokens, counted from its worktree, in each report once the health route answered', async () => {
    const worktrees: string[] = [];
    const { code, sent, home } = await withJob({ health: 'ok', tokens: counts(MACHINE, JOB_TOKENS, worktrees) });
    expect(code).toBe(0);
    expect(sent.length).toBeGreaterThan(2);
    // The first report, the claim's running mark, has counted nothing yet.
    for (const update of sent.slice(1)) expect(update.tokens).toEqual(JOB_TOKENS);
    expect(sent.at(-1)?.status).toBe('done');
    expect(new Set(worktrees)).toEqual(new Set([join(home, 'wt', 'widgets-job-7')]));
  });

  it('sends no job tokens while the health route has not answered', async () => {
    const { sent } = await withJob({ health: 'fails', tokens: counts(MACHINE, JOB_TOKENS) });
    expect(sent.length).toBeGreaterThan(2);
    for (const update of sent) expect(update).not.toHaveProperty('tokens');
  });

  it('sends a report the app refused for its tokens again without them, and no later report carries any', async () => {
    const { sent, code } = await withJob({ health: 'ok', refuseTokens: true, tokens: counts(MACHINE, JOB_TOKENS) });
    expect(code).toBe(0);
    const refused = sent.filter((update) => update.tokens !== undefined);
    expect(refused).toHaveLength(1);
    const at = sent.indexOf(refused[0] as JobUpdate);
    expect(sent[at + 1]).not.toHaveProperty('tokens');
    expect(sent.slice(at + 1).every((update) => update.tokens === undefined)).toBe(true);
    expect(sent.at(-1)?.status).toBe('done');
  });
});

/** What a job's ending is run with: what the runner is started with, the reports the app refuses with a 400 (as an app older than the fields in them does), and whether the session is alive. */
type Ending = { over?: Partial<RunnerOptions>; refusing?: (update: JobUpdate) => boolean; alive?: boolean };

/**
 * Runs one job on `line` that ends with `exit` (`''` when it writes none), its log being `log`: every
 * report the app got.
 */
async function jobEnding(line: string, log: string, exit: string, { over = {}, refusing = () => false, alive = true }: Ending = {}): Promise<JobUpdate[]> {
  const home = mkdtempSync(join(tmpdir(), 'omni-runner-outcome-'));
  const base = holdingApp(7, (n) => {
    if (n === 2) base.held[0]?.({ id: '7', line, repo: 'acme/widgets', sentBy: null, sentByKey: null, github: null, allowedSkills: [] });
    if (n === 6 && exit !== '') writeFileSync(join(home, 'logs', 'job-7.exit'), exit);
  });
  const sent: JobUpdate[] = [];
  const api: RunnerApi = {
    ...base.api,
    update: (job, update) => {
      sent.push(update);
      return refusing(update) ? Promise.reject(new RunnerRefused('refused (400)')) : base.api.update(job, update);
    },
  };
  await run({ ...base, api }, {
    slots: 1, timeoutMs: 24 * 60 * 60 * 1000, home, checkouts: new Map([['acme/widgets', join(home, 'widgets')]]),
    terminal: { start: () => { writeFileSync(join(home, 'logs', 'job-7.log'), log); }, stop: () => undefined, alive: () => alive },
    ...over,
  });
  return sent;
}

describe('the outcome (PRD 2223)', () => {
  /** Runs one job on `line` that ends with `exit`, its log being `log`: every report the app got. */
  const ending = (line: string, log: string, exit: string, slices?: (prd: PrdNumber, cwd: string) => Promise<MergedCount>): Promise<JobUpdate[]> =>
    jobEnding(line, log, exit, slices ? { over: { slices } } : {});

  it.each([
    ['/omni:yolo-fix 7', '12:00:00 Done: ok\n/omni:yolo-fix 7\n', 'answers'],
    ['/omni:yolo 7', '/omni:yolo 7\n\n', 'held'],
    ['/omni:yolo 7', '/omni:pr-care 7\n', 'ready'],
  ])('sends the outcome of %s when its log ends on %j', async (line, log, outcome) => {
    const last = (await ending(line, log, '0\n')).at(-1);
    expect(last).toMatchObject({ status: 'done', outcome });
  });

  it('sends none for another skill, or a failed job', async () => {
    expect((await ending('/omni:pr-care 7', '/omni:pr-care 7\n', '0\n')).at(-1)).not.toHaveProperty('outcome');
    const failed = (await ending('/omni:yolo 7', '/omni:yolo-fix 7\n', '1\n')).at(-1);
    expect(failed).toMatchObject({ status: 'failed' });
    expect(failed).not.toHaveProperty('outcome');
  });

  it.each(['/omni:yolo 7', '/omni:yolo-fix 7'])('ends %s stopped, with its slice count read in the job\'s worktree, when its log has no hand-off for the PRD (PRD 2375)', async (line) => {
    const asked: [number, string][] = [];
    const last = (await ending(line, 'built two sub-PRs\n/omni:yolo 8\n', '0\n', (prd, cwd) => {
      asked.push([Number(prd), cwd]);
      return Promise.resolve({ merged: 0, total: 5 });
    })).at(-1);
    expect(last).toMatchObject({ status: 'done', outcome: 'stopped', slicesMerged: 0, slicesTotal: 5 });
    expect(asked).toHaveLength(1);
    expect(asked[0]?.[0]).toBe(7);
    expect(asked[0]?.[1]).toContain('widgets-job-7');
  });

  it('ends stopped with no count when the board cannot be read, and the job still ends', async () => {
    for (const slices of [() => Promise.resolve(null), () => Promise.reject(new Error('board failed'))]) {
      const last = (await ending('/omni:yolo 7', 'Done\n', '0\n', slices)).at(-1);
      expect(last).toMatchObject({ status: 'done', outcome: 'stopped' });
      expect(last).not.toHaveProperty('slicesMerged');
      expect(last).not.toHaveProperty('slicesTotal');
    }
  });

  it.each(['/omni:mega-bug-fix 381', '/omni:mega-bug-fix #381', '/omni:mega-bug-fix https://github.com/acme/plan/issues/381'])(
    'ends %s stopped, with no slice count, when its hand-off ends on the line that resumes the issue', async (line) => {
      const asked: number[] = [];
      const slices = (): Promise<MergedCount> => {
        asked.push(1);
        return Promise.resolve({ merged: 0, total: 1 });
      };
      const last = (await ending(line, 'The fix stopped short.\n/omni:mega-bug-fix #381\n', '0\n', slices)).at(-1);
      expect(last).toMatchObject({ status: 'done', outcome: 'stopped' });
      expect(last).not.toHaveProperty('slicesMerged');
      expect(asked).toEqual([]);
    });

  it('sends no outcome for a mega bug fix that ended, one of a description, or one that failed', async () => {
    const ended = '> Review the PRs and merge them in this order, the record PR last.\n';
    expect((await ending('/omni:mega-bug-fix #381', ended, '0\n')).at(-1)).not.toHaveProperty('outcome');
    expect((await ending('/omni:mega-bug-fix the total is wrong', '/omni:mega-bug-fix #381\n', '0\n')).at(-1)).not.toHaveProperty('outcome');
    const failed = (await ending('/omni:mega-bug-fix #381', '/omni:mega-bug-fix #381\n', '1\n')).at(-1);
    expect(failed).toMatchObject({ status: 'failed' });
    expect(failed).not.toHaveProperty('outcome');
  });

  it('keeps the hand-off outcome, reads no count for it, and reads none for another skill', async () => {
    const asked: number[] = [];
    const slices = (): Promise<MergedCount> => {
      asked.push(1);
      return Promise.resolve({ merged: 1, total: 2 });
    };
    expect((await ending('/omni:yolo 7', '/omni:yolo 7\n', '0\n', slices)).at(-1)).toMatchObject({ outcome: 'held' });
    expect((await ending('/omni:pr-care 7', 'Done\n', '0\n', slices)).at(-1)).not.toHaveProperty('outcome');
    expect((await ending('/omni:yolo 7', 'Done\n', '1\n', slices)).at(-1)).not.toHaveProperty('outcome');
    expect(asked).toEqual([]);
  });

  it('sends a final report the app refused for its outcome again without it', async () => {
    const home = mkdtempSync(join(tmpdir(), 'omni-runner-outcome-'));
    const base = holdingApp(7, (n) => {
      if (n === 2) base.held[0]?.({ id: '7', line: '/omni:yolo 7', repo: 'acme/widgets', sentBy: null, sentByKey: null, github: null, allowedSkills: [] });
      if (n === 6) writeFileSync(join(home, 'logs', 'job-7.exit'), '0\n');
    });
    const sent: JobUpdate[] = [];
    const api: RunnerApi = {
      ...base.api,
      update: (job, update) => {
        sent.push(update);
        return update.outcome === undefined ? base.api.update(job, update) : Promise.reject(new RunnerRefused('refused (400)'));
      },
    };
    await run({ ...base, api }, {
      slots: 1, timeoutMs: 24 * 60 * 60 * 1000, home, checkouts: new Map([['acme/widgets', join(home, 'widgets')]]),
      terminal: { start: () => { writeFileSync(join(home, 'logs', 'job-7.log'), '/omni:yolo 7\n'); }, stop: () => undefined, alive: () => true },
    });
    expect(sent.filter((update) => update.status === 'done').map((update) => update.outcome)).toEqual(['held', undefined]);
  });
});

// A bug fix's end (PRD 2425, s2): a done `/omni:bug-fix` or `/omni:mega-bug-fix` job reports the outcome its
// hand-off wrote, the pull request it proved and every pull request its log names; a failed one reports its
// pull requests (the draft it left) and no outcome; any other job reports as it always did.
describe('the bug fix report (PRD 2425, s2)', () => {
  const pr = (repo: string, n: number): string => `https://github.com/${repo}/pull/${String(n)}`;
  const handOff = (...lines: string[]): string => ['10:00:09 Done: ok · 40 turns · $2.10 · 12m 3s', ...lines.map((line) => `10:00:09 ${line}`)].join('\n') + '\n';
  const last = async (line: string, log: string, exit = '0\n', how: Ending = {}): Promise<JobUpdate | undefined> => (await jobEnding(line, log, exit, how)).at(-1);

  it.each(['/omni:bug-fix 612', '/omni:mega-bug-fix 612'])('sends the outcome, the proved pull request and the pull requests of a done %s', async (line) => {
    const log = [
      `10:00:00 PR: ${pr('acme/api', 3)}`,
      `10:00:01 PR: ${pr('acme/widgets', 31)}`,
      handOff('Outcome: pr-opened', '> Review the PRs'),
    ].join('\n');
    expect(await last(line, log)).toMatchObject({ status: 'done', exitCode: 0, outcome: 'pr-opened', prs: [pr('acme/api', 3), pr('acme/widgets', 31)], prUrl: pr('acme/widgets', 31) });
  });

  it('sends the pull request a bug fix proved had already fixed the bug, apart from the ones it opened', async () => {
    const log = handOff('Outcome: already-fixed', `Fixed by: ${pr('acme/widgets', 12)}`);
    const report = await last('/omni:bug-fix 612', `10:00:00 PR: ${pr('acme/widgets', 12)}\n${log}`);
    expect(report).toMatchObject({ status: 'done', outcome: 'already-fixed', fixedBy: pr('acme/widgets', 12) });
    expect(report).not.toHaveProperty('prs');
  });

  it.each(['pr-opened', 'already-fixed', 'need-human', 'needs-brainstorm', 'not-a-bug', 'stuck', 'blocked'])('sends %s as the log words it, not as the app\'s public word', async (word) => {
    expect(await last('/omni:bug-fix 612', handOff(`Outcome: ${word}`))).toMatchObject({ status: 'done', outcome: word });
  });

  it('sends none of the three for a log from before this PRD, or with a word it does not know, and the job still ends done', async () => {
    for (const log of [handOff('nothing to say'), handOff('Outcome: shrugged'), '']) {
      const report = await last('/omni:bug-fix 612', log);
      expect(report).toMatchObject({ status: 'done', exitCode: 0 });
      for (const field of ['outcome', 'fixedBy', 'prs']) expect(report).not.toHaveProperty(field);
    }
  });

  it('sends a failed job its pull requests, the draft it left, and no outcome and no fixed-by', async () => {
    const log = [`10:00:00 PR: ${pr('acme/widgets', 40)}`, '10:00:01 Outcome: stuck', `10:00:02 Fixed by: ${pr('acme/widgets', 12)}`].join('\n');
    const report = await last('/omni:bug-fix 612', log, '1\n');
    expect(report).toMatchObject({ status: 'failed', exitCode: 1, reason: 'exit code 1', prs: [pr('acme/widgets', 40)] });
    expect(report).not.toHaveProperty('outcome');
    expect(report).not.toHaveProperty('fixedBy');
    expect(await last('/omni:mega-bug-fix 612', log, '2\n')).toMatchObject({ status: 'failed', prs: [pr('acme/widgets', 40)] });
    expect(await last('/omni:bug-fix 612', 'crashed before any pull request\n', '1\n')).not.toHaveProperty('prs');
  });

  it('sends a job that stopped before it wrote its exit code, or ran past its timeout, its pull requests too, with no outcome', async () => {
    const log = `10:00:00 PR: ${pr('acme/widgets', 40)}\n${handOff('Outcome: pr-opened')}`;
    const dead = await last('/omni:bug-fix 612', log, '', { alive: false });
    expect(dead).toMatchObject({ status: 'failed', reason: 'the job stopped before it wrote its exit code', prs: [pr('acme/widgets', 40)] });
    expect(dead).not.toHaveProperty('outcome');
    const slow = await last('/omni:bug-fix 612', log, '', { over: { timeoutMs: 1 } });
    expect(slow).toMatchObject({ status: 'failed', reason: 'timeout', prs: [pr('acme/widgets', 40)] });
    expect(slow).not.toHaveProperty('outcome');
  });

  it('reports a yolo job and any other skill\'s job exactly as before: its outcome and pull request, none of the three new fields', async () => {
    const log = `10:00:00 PR: ${pr('acme/widgets', 31)}\n10:00:01 Outcome: pr-opened\n10:00:02 Fixed by: ${pr('acme/widgets', 12)}\n/omni:yolo 7\n`;
    const yolo = await last('/omni:yolo 7', log);
    expect(yolo).toMatchObject({ status: 'done', outcome: 'held', prUrl: pr('acme/widgets', 31) });
    const careful = await last('/omni:pr-care 7', log);
    expect(careful).toMatchObject({ status: 'done', prUrl: pr('acme/widgets', 31) });
    const failed = await last('/omni:yolo 7', log, '1\n');
    for (const report of [yolo, careful, failed]) for (const field of ['fixedBy', 'prs']) expect(report).not.toHaveProperty(field);
    expect(careful).not.toHaveProperty('outcome');
  });

  it.each(['/omni:bug-fix 612', '/omni:mega-bug-fix 612'])('sends the follow-ups of a done %s, in order', async (line) => {
    const log = handOff('Outcome: pr-opened', 'Follow-up: acme/api · First thing.', 'Follow-up: acme/api,acme/web · Second thing.');
    const report = await last(line, log);
    expect(report).toMatchObject({ status: 'done', followUps: [{ repos: ['acme/api'], summary: 'First thing.' }, { repos: ['acme/api', 'acme/web'], summary: 'Second thing.' }] });
  });

  it('sends no follow-ups for a bug fix with none, a refused report or a yolo job', async () => {
    expect(await last('/omni:bug-fix 612', handOff('Outcome: pr-opened'))).not.toHaveProperty('followUps');
    const log = handOff('Outcome: pr-opened', 'Follow-up: acme/api · A thing.');
    expect(await last('/omni:bug-fix 612', log, '1\n')).not.toHaveProperty('followUps');
    expect(await last('/omni:yolo 7', `${log}/omni:yolo 7\n`)).not.toHaveProperty('followUps');
  });

  it('sends a report an app refusing followUps again without them, its other fields kept', async () => {
    const log = `10:00:00 PR: ${pr('acme/widgets', 31)}\n${handOff('Outcome: pr-opened', 'Follow-up: acme/api · A thing.')}`;
    const sent = await jobEnding('/omni:bug-fix 612', log, '0\n', { refusing: (update) => update.followUps !== undefined });
    const ends = sent.filter((update) => update.status === 'done');
    expect(ends).toHaveLength(2);
    expect(ends[0]).toMatchObject({ followUps: [{ repos: ['acme/api'], summary: 'A thing.' }] });
    expect(ends[1]).toMatchObject({ status: 'done', exitCode: 0, outcome: 'pr-opened', prs: [pr('acme/widgets', 31)] });
    expect(ends[1]).not.toHaveProperty('followUps');
  });

  it('sends a final report an older app refuses for the new fields again without them, and the job\'s status still reaches it', async () => {
    const log = `10:00:00 PR: ${pr('acme/widgets', 31)}\n${handOff('Outcome: pr-opened')}`;
    const sent = await jobEnding('/omni:bug-fix 612', log, '0\n', { refusing: (update) => update.prs !== undefined || update.fixedBy !== undefined || update.outcome !== undefined });
    const ends = sent.filter((update) => update.status === 'done');
    expect(ends).toHaveLength(2);
    expect(ends[0]).toMatchObject({ outcome: 'pr-opened', prs: [pr('acme/widgets', 31)] });
    expect(ends[1]).toMatchObject({ status: 'done', exitCode: 0, prUrl: pr('acme/widgets', 31) });
    for (const field of ['outcome', 'fixedBy', 'prs']) expect(ends[1]).not.toHaveProperty(field);
    const failedSent = await jobEnding('/omni:bug-fix 612', log, '1\n', { refusing: (update) => update.prs !== undefined });
    expect(failedSent.filter((update) => update.status === 'failed').map((update) => update.prs)).toEqual([[pr('acme/widgets', 31)], undefined]);
  });
});

// A repository's own skill (PRD 2313, s2): the runner checks the line against the skills the job carries,
// read when the app handed it over, then, once the job's worktree is cut from `origin/<default branch>`,
// that the skill's `SKILL.md` is there: a skill turned off, or only on a branch, never runs. One that
// runs ends done or failed from its exit code alone, with no outcome.
describe("a repository's own skill (PRD 2313, s2)", () => {
  /**
   * Runs one job on `line` carrying `allowed`, its worktree holding the skills `present`, its run ending on
   * `exit`: every report the app got, the sessions started, and the git calls made.
   */
  async function claimed({ line, allowed, present = [], exit = '0\n' }: { line: string; allowed: string[]; present?: string[]; exit?: string }) {
    const home = mkdtempSync(join(tmpdir(), 'omni-runner-skills-'));
    const worktree = join(home, 'wt', 'widgets-job-7');
    const git: string[][] = [];
    // The checkout's `origin/HEAD` names `trunk`: the default branch is read, never assumed. Adding the
    // worktree checks out what `origin/trunk` holds: the skills `present`.
    const exec: ExecText = (file, args) => {
      if (file === 'git') git.push([...args]);
      if (args.includes('worktree') && args.includes('add')) {
        for (const skill of present) {
          mkdirSync(join(worktree, '.claude', 'skills', skill), { recursive: true });
          writeFileSync(join(worktree, '.claude', 'skills', skill, 'SKILL.md'), `---\nname: ${skill}\n---\n`);
        }
      }
      return args.includes('symbolic-ref') ? 'origin/trunk\n' : '';
    };
    const started: string[] = [];
    const base = holdingApp(7, (n) => {
      if (n === 2) base.held[0]?.({ id: '7', line, repo: 'acme/widgets', sentBy: null, sentByKey: null, github: null, allowedSkills: allowed });
      if (n === 6) {
        mkdirSync(join(home, 'logs'), { recursive: true });
        writeFileSync(join(home, 'logs', 'job-7.exit'), exit);
      }
    });
    const sent: JobUpdate[] = [];
    const api: RunnerApi = { ...base.api, update: (job, update) => { sent.push(update); return base.api.update(job, update); } };
    const { printed } = await run({ ...base, api }, {
      slots: 1, timeoutMs: 24 * 60 * 60 * 1000, home, exec, checkouts: new Map([['acme/widgets', join(home, 'widgets')]]),
      terminal: {
        start: (session) => {
          started.push(session.name);
          writeFileSync(join(home, 'logs', 'job-7.log'), `${line}\n`);
        },
        stop: () => undefined,
        alive: () => true,
      },
    });
    return { sent, started, git, printed, home, worktree };
  }

  const worktreeAdd = (git: string[][]) => git.filter((args) => args.includes('worktree') && args.includes('add'));

  it('refuses a skill the job does not carry before it makes a worktree', async () => {
    const { sent, started, git } = await claimed({ line: '/validate-prd 347', allowed: ['audit'] });
    expect(sent).toEqual([{ status: 'failed', reason: 'refused: /validate-prd is not allowed on a runner for this repository' }]);
    expect(started).toEqual([]);
    expect(worktreeAdd(git)).toEqual([]);
  });

  it('refuses a skill the job carries but the default branch lacks, once the worktree is cut from it, without running it', async () => {
    const { sent, started, git, home, worktree, printed } = await claimed({ line: '/validate-prd 347', allowed: ['validate-prd'] });
    expect(worktreeAdd(git)).toEqual([['-C', join(home, 'widgets'), 'worktree', 'add', '--no-track', '-b', 'agent/job-7', worktree, 'origin/trunk']]);
    expect(sent).toEqual([{ status: 'failed', reason: 'refused: /validate-prd is not on trunk' }]);
    expect(started).toEqual([]);
    expect(git.some((args) => args.includes('worktree') && args.includes('remove'))).toBe(true);
    expect(printed).toContain('job 7 failed · refused: /validate-prd is not on trunk');
  });

  it('runs a skill the job carries and its worktree holds, and ends done from its exit code with no outcome', async () => {
    const { sent, started } = await claimed({ line: '/validate-prd 347', allowed: ['validate-prd'], present: ['validate-prd'] });
    expect(started).toEqual(['job-7']);
    const last = sent.at(-1);
    expect(last).toMatchObject({ status: 'done', exitCode: 0 });
    expect(last).not.toHaveProperty('outcome');
  });

  it('ends failed from its exit code, with no outcome', async () => {
    const { sent } = await claimed({ line: '/validate-prd 347', allowed: ['validate-prd'], present: ['validate-prd'], exit: '2\n' });
    const last = sent.at(-1);
    expect(last).toMatchObject({ status: 'failed', exitCode: 2, reason: 'exit code 2' });
    expect(last).not.toHaveProperty('outcome');
  });

  it("runs a fixed skill's line as before, whatever the job carries", async () => {
    const { sent, started } = await claimed({ line: '/omni:pr-care 7', allowed: [] });
    expect(started).toEqual(['job-7']);
    expect(sent.at(-1)).toMatchObject({ status: 'done', exitCode: 0 });
  });
});

describe('the accounts (PRD 2537, s2)', () => {
  const direct = (id: string, extra: Partial<Account> = {}): Account => ({ id, agent: 'claude', instance: null, model: null, secret: null, budget: null, takes: null, ...extra });
  const file = (accounts: Account[]): Accounts => ({ file: true, accounts, handoff: DEFAULT_HANDOFF });

  /** Runs one job of `line` with `over`: the reports the app got, what the runner printed, and the sessions it started. */
  async function onAccounts(line: string, over: Partial<RunnerOptions>, log = '') {
    const sessions: JobSession[] = [];
    const printed: string[] = [];
    const terminal: Terminal = {
      start: (session) => {
        sessions.push(session);
        writeFileSync(session.argv[session.argv.indexOf('--log') + 1] ?? '', log);
      },
      stop: () => undefined,
      alive: () => true,
    };
    const sent = await jobEnding(line, log, '0\n', { over: { terminal, print: (text) => printed.push(text), ...over } });
    return { sent, sessions, printed };
  }

  const freshBook = (out: string[] = []) => {
    const book = accountBook({ file: accountsStateFile(mkdtempSync(join(tmpdir(), 'omni-runner-book-'))), now: () => T0 });
    for (const id of out) book.markOut(id, new Date(T0 + 3_600_000).toISOString());
    return book;
  };

  it('starts a job on the one Claude account, adding nothing to its session, when there is no accounts file', async () => {
    const { sessions } = await onAccounts('/omni:yolo 7', {});
    expect(sessions[0]?.argv).not.toContain('--account');
  });

  it('starts a job on the first account that is not out, and names it to the session', async () => {
    const { sessions, printed } = await onAccounts('/omni:yolo 7', { accounts: file([direct('one'), direct('two')]), accountBook: freshBook(['one']) });
    expect(sessions[0]?.argv.slice(-2)).toEqual(['--account', 'two']);
    expect(printed).toContain('job 7 runs on account two');
  });

  it('skips an account whose takes leaves out the job\'s skill', async () => {
    const { sessions } = await onAccounts('/omni:yolo 7', { accounts: file([direct('narrow', { takes: ['plan'] }), direct('wide')]), accountBook: freshBook() });
    expect(sessions[0]?.argv.slice(-2)).toEqual(['--account', 'wide']);
  });

  it('skips an account whose agent this kit lacks, and fails a job whose only agent fails its check', async () => {
    const { sessions } = await onAccounts('/omni:yolo 7', { accounts: file([direct('t3', { agent: 't3', instance: 'i' }), direct('plain')]), accountBook: freshBook() });
    expect(sessions[0]?.argv.slice(-2)).toEqual(['--account', 'plain']);
    const broken = await onAccounts('/omni:yolo 7', { accounts: file([direct('only')]), accountBook: freshBook(), exec: (command) => { if (command === 'claude') throw new Error('no claude'); return ''; } });
    expect(broken.sessions).toEqual([]);
    expect(broken.sent.at(-1)).toMatchObject({ status: 'failed', reason: 'no account can take this job: only is unusable: claude is not installed' });
  });

  it('fails a job no account can take, naming each, and starts no session', async () => {
    const { sent, sessions } = await onAccounts('/omni:yolo 7', { accounts: file([direct('one'), direct('narrow', { takes: ['plan'] })]), accountBook: freshBook(['one']) });
    expect(sessions).toEqual([]);
    expect(sent.at(-1)).toMatchObject({ status: 'failed', reason: `no account can take this job: one is out until ${new Date(T0 + 3_600_000).toISOString()}; narrow does not take this skill` });
  });

  it('never lets a secret reach a report: it reads *** wherever the job printed it', async () => {
    const secretFile = join(mkdtempSync(join(tmpdir(), 'omni-runner-secret-')), 'token');
    writeFileSync(secretFile, 'sk-ant-oat-very-secret\n');
    const { sent, printed } = await onAccounts('/omni:yolo 7', { accounts: file([direct('keyed', { secret: secretFile })]), accountBook: freshBook() }, 'token is sk-ant-oat-very-secret\n');
    expect(JSON.stringify(sent)).not.toContain('very-secret');
    expect(JSON.stringify(sent)).toContain('token is ***');
    expect(printed.join('\n')).not.toContain('very-secret');
  });

  it('frees the account when the job ends', async () => {
    const book = freshBook();
    await onAccounts('/omni:yolo 7', { accounts: file([direct('one')]), accountBook: book });
    expect(book.stateOf('one').state).toBe('ready');
  });
});

// A job's parts (PRD 2537, s3): the runner sends the parts its job's process kept beside the log with each
// report, ends a job turnover gave up on with turnover's reason, sends a report an app refuses for its parts
// again without them and none after, and masks the secret of every account the job may have turned over to.
describe("a job's parts (PRD 2537, s3)", () => {
  const PARTS = {
    parts: [
      { agent: 'claude', model: 'claude-opus-5-5', account: 'one', from: '2026-10-16T12:00:00.000Z', to: '2026-10-16T12:01:00.000Z', ended: 'limit', resetsAt: '2026-10-16T17:00:00.000Z', guessed: false, note: 'runner' },
      { agent: 'claude', model: null, account: 'two', from: '2026-10-16T12:01:00.000Z', to: null, ended: null },
    ],
    reason: null,
  };

  /** A terminal whose job writes `log` and, beside it, the parts `parts`. */
  const writing = (log: string, parts: unknown): Terminal => ({
    start: (session) => {
      const path = session.argv[session.argv.indexOf('--log') + 1] ?? '';
      writeFileSync(path, log);
      writeFileSync(path.replace(/\.log$/, '.parts.json'), JSON.stringify(parts));
    },
    stop: () => undefined,
    alive: () => true,
  });

  it('sends the parts with the running reports and the last one', async () => {
    const sent = await jobEnding('/omni:yolo 7', 'working\n', '0\n', { over: { terminal: writing('working\n', PARTS) } });
    expect(sent.filter((update) => update.status === 'running' && update.parts !== undefined).length).toBeGreaterThan(0);
    expect(sent.at(-1)).toMatchObject({ status: 'done', parts: PARTS.parts });
  });

  it('sends no parts when the job kept none, or kept a file out of shape', async () => {
    const none = await jobEnding('/omni:yolo 7', 'working\n', '0\n');
    expect(none.some((update) => update.parts !== undefined)).toBe(false);
    const bad = await jobEnding('/omni:yolo 7', 'working\n', '0\n', { over: { terminal: writing('working\n', { parts: 'no' }) } });
    expect(bad.some((update) => update.parts !== undefined)).toBe(false);
  });

  it("ends a job turnover gave up on with turnover's reason", async () => {
    const reason = 'no tokens left: every account is out until 2026-10-16T17:00:00.000Z';
    const sent = await jobEnding('/omni:yolo 7', 'working\n', '1\n', { over: { terminal: writing('working\n', { ...PARTS, reason }) } });
    expect(sent.at(-1)).toMatchObject({ status: 'failed', exitCode: 1, reason });
  });

  it('sends a report an app refuses for its parts again without them, and none after', async () => {
    const sent = await jobEnding('/omni:yolo 7', 'working\n', '0\n', { over: { terminal: writing('working\n', PARTS) }, refusing: (update) => update.parts !== undefined });
    const refused = sent.findIndex((update) => update.parts !== undefined);
    expect(refused).toBeGreaterThan(-1);
    expect(sent.slice(refused + 1).some((update) => update.parts !== undefined)).toBe(false);
    expect(sent.at(-1)).toMatchObject({ status: 'done' });
  });

  it('masks the secret of every account of the file, not only the one the job started on', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'omni-runner-secrets-'));
    writeFileSync(join(dir, 'one'), 'first-account-secret-value\n');
    writeFileSync(join(dir, 'two'), 'second-account-secret-value\n');
    const accounts: Accounts = {
      file: true,
      handoff: DEFAULT_HANDOFF,
      accounts: ['one', 'two'].map((id) => ({ id, agent: 'claude', instance: null, model: null, secret: join(dir, id), budget: null, takes: null })),
    };
    const log = 'printed second-account-secret-value\n';
    const sent = await jobEnding('/omni:yolo 7', log, '0\n', { over: { terminal: writing(log, PARTS), accounts, accountBook: accountBook({ file: accountsStateFile(dir), now: () => T0 }) } });
    expect(JSON.stringify(sent)).not.toContain('second-account-secret-value');
    expect(JSON.stringify(sent)).toContain('printed ***');
  });
});

describe('no tokens left (PRD 2537, s6)', () => {
  const direct = (id: string): Account => ({ id, agent: 'claude', instance: null, model: null, secret: null, budget: null, takes: null });
  const file = (accounts: Account[]): Accounts => ({ file: true, accounts, handoff: DEFAULT_HANDOFF });
  const bookOf = (app: { clock: { now: number } }, out: Record<string, number>) => {
    const book = accountBook({ file: accountsStateFile(mkdtempSync(join(tmpdir(), 'omni-runner-book-'))), now: () => app.clock.now });
    for (const [id, until] of Object.entries(out)) book.markOut(id, new Date(until).toISOString());
    return book;
  };

  it('opens no next while every account is out, reports Paused with the earliest reset and every account\'s state', async () => {
    const app = holdingApp(2);
    const reset = T0 + 3_600_000;
    const { printed } = await run(app, { accounts: file([direct('one'), direct('two')]), accountBook: bookOf(app, { one: reset + 60_000, two: reset }) });
    const at = new Date(reset);
    const until = `${String(at.getUTCHours()).padStart(2, '0')}:${String(at.getUTCMinutes()).padStart(2, '0')}`;
    expect(app.nexts()).toBe(0);
    expect(app.reports.map((report) => report.paused)).toEqual([`no tokens left until ${until}`, `no tokens left until ${until}`]);
    expect(app.reports[0]?.accounts).toEqual([
      { id: 'one', agent: 'claude', state: 'out', resetsAt: new Date(reset + 60_000).toISOString() },
      { id: 'two', agent: 'claude', state: 'out', resetsAt: new Date(reset).toISOString() },
    ]);
    expect(printed).toContain(`paused: no tokens left until ${until}`);
  });

  it('takes jobs again once the earliest reset has passed', async () => {
    const nextsAt: number[] = [];
    const app = holdingApp(4, () => nextsAt.push(app.nexts()));
    const { printed } = await run(app, { accounts: file([direct('one')]), accountBook: bookOf(app, { one: T0 + 20_000 }) });
    expect(app.reports.map((report) => report.paused === null)).toEqual([false, false, true, true]);
    expect(app.reports.at(-1)?.accounts).toEqual([{ id: 'one', agent: 'claude', state: 'ready' }]);
    expect(printed.filter((line) => /^(paused|resumed)/.test(line))).toEqual([expect.stringMatching(/^paused: no tokens left until /), 'resumed']);
    expect(app.nexts()).toBe(2);
  });

  it('stays unpaused with one account ready, and sends no accounts without a file', async () => {
    const ready = holdingApp(1);
    await run(ready, { accounts: file([direct('one'), direct('two')]), accountBook: bookOf(ready, { one: T0 + 3_600_000 }) });
    expect(ready.reports[0]?.paused).toBeNull();
    expect(ready.reports[0]?.accounts?.map((account) => account.state)).toEqual(['out', 'ready']);
    const none = holdingApp(1);
    await run(none);
    expect(none.reports[0]).not.toHaveProperty('accounts');
  });

  it('sends a report again without the accounts an app refuses, and none after', async () => {
    const app = holdingApp(3);
    const seen: boolean[] = [];
    const health = app.api.health;
    app.api.health = (runner, report) => {
      seen.push('accounts' in report);
      return 'accounts' in report ? Promise.reject(new RunnerRefused('refused (400)')) : health(runner, report);
    };
    await run(app, { accounts: file([direct('one')]), accountBook: bookOf(app, {}) });
    expect(seen).toEqual([true, false, false, false]);
    expect(app.reports.every((report) => !('accounts' in report))).toBe(true);
  });
});
