import { describe, expect, it } from 'vitest';
import { GithubDeferred, GithubPaused } from '@omni/github';
import type { ClaimedJob, Finish, FinishAnswer, JobLedger } from './ledger.ts';
import { LEASE_SECONDS, runDue, TIME_BUDGET_MS, type JobHandler, type JobResult } from './worker.ts';

const START = Date.parse('2027-01-13T09:00:00Z');
const MINUTE = 60_000;
const at = (ms: number) => new Date(ms).toISOString();

/** What a finish answers by default: the state the outcome leads to. */
const stateAfter = ({ outcome }: Finish): FinishAnswer => (outcome === 'retry' || outcome === 'waiting' ? 'queued' : outcome);

/** A ledger in memory: the jobs it hands out, one per claim, and every finish it was sent. */
function fakeLedger(jobs: Partial<ClaimedJob>[], { finish = (input) => Promise.resolve(stateAfter(input)) }: { finish?: (input: Finish) => Promise<FinishAnswer> } = {}) {
  const queue: ClaimedJob[] = jobs.map((job, n) => ({
    id: `job-${String(n + 1)}`,
    kind: 'knowledge-pack',
    key: `initech/pack-api@${String(n + 1).repeat(40)}`,
    subject: 'initech/pack-api',
    payload: { installationId: 7 },
    tries: 1,
    claim: `claim-${String(n + 1)}`,
    claimedUntil: at(START + 5 * MINUTE),
    ...job,
  }));
  const claims: { limit: number; leaseSeconds: number }[] = [];
  const finished: Finish[] = [];
  const ledger: JobLedger = {
    claim: (input) => {
      claims.push(input);
      return Promise.resolve(queue.splice(0, input.limit));
    },
    finish: (input) => {
      finished.push(input);
      return finish(input);
    },
  };
  return { ledger, claims, finished };
}

/** A clock the handlers move forward. */
function clockAt(ms: number) {
  const clock = { now: ms };
  return { clock, read: () => clock.now };
}

const ends = (result: JobResult): JobHandler => () => Promise.resolve(result);
const done = ends({ outcome: 'done' });
const throws = (...errors: Error[]): JobHandler => {
  let n = 0;
  return () => Promise.reject(errors[Math.min(n++, errors.length - 1)] ?? new Error('no error given'));
};

const run = (ledger: JobLedger, handler: JobHandler, extra: { clock?: () => number; log?: (line: string) => void } = {}) =>
  runDue({ ledger, handlers: { 'knowledge-pack': handler }, clock: extra.clock ?? (() => START), log: extra.log ?? (() => undefined) });

describe('runDue — each outcome of the spec\'s table (PRD 2676 s1)', () => {
  it('a job that finished is done', async () => {
    const { ledger, finished } = fakeLedger([{}]);
    const summary = await run(ledger, done);
    expect(finished).toEqual([{ id: 'job-1', claim: 'claim-1', outcome: 'done', reason: null, retryAt: null }]);
    expect(summary).toEqual({ ran: 1, done: 1, skipped: 0, retry: 0, waiting: 0, failed: 0, stale: 0 });
  });

  it('a job with nothing to do is skipped, with why', async () => {
    const { ledger, finished } = fakeLedger([{}]);
    const summary = await run(ledger, ends({ outcome: 'skipped', reason: 'it was closed, not merged' }));
    expect(finished).toEqual([{ id: 'job-1', claim: 'claim-1', outcome: 'skipped', reason: 'it was closed, not merged', retryAt: null }]);
    expect(summary.skipped).toBe(1);
  });

  it('a job that threw with tries left is retried after 1, then 5, then 30 minutes, then 2 hours, with its error', async () => {
    const { ledger, finished } = fakeLedger([{ tries: 1 }, { tries: 2 }, { tries: 3 }, { tries: 4 }]);
    const summary = await run(ledger, throws(new Error('GitHub answered 502')));
    expect(finished.map(({ outcome, reason, retryAt }) => ({ outcome, reason, retryAt }))).toEqual([
      { outcome: 'retry', reason: 'GitHub answered 502', retryAt: at(START + 1 * MINUTE) },
      { outcome: 'retry', reason: 'GitHub answered 502', retryAt: at(START + 5 * MINUTE) },
      { outcome: 'retry', reason: 'GitHub answered 502', retryAt: at(START + 30 * MINUTE) },
      { outcome: 'retry', reason: 'GitHub answered 502', retryAt: at(START + 120 * MINUTE) },
    ]);
    expect(summary.retry).toBe(4);
  });

  it('a job that threw on its 5th try is failed, with its error', async () => {
    const { ledger, finished } = fakeLedger([{ tries: 5 }]);
    const summary = await run(ledger, throws(new Error('GitHub answered 502')));
    expect(finished).toEqual([{ id: 'job-1', claim: 'claim-1', outcome: 'failed', reason: 'GitHub answered 502', retryAt: null }]);
    expect(summary.failed).toBe(1);
  });

  it('a job that met a low GitHub budget waits 15 minutes and gives its try back, however deep Octokit wrapped it', async () => {
    const until = START + 40 * MINUTE;
    const deferred = new Error('request failed', { cause: new Error('fetch failed', { cause: new GithubDeferred(until) }) });
    const { ledger, finished } = fakeLedger([{ tries: 5 }, { tries: 2 }]);
    const summary = await run(ledger, throws(deferred, new GithubPaused(until)));
    expect(finished.map(({ outcome, retryAt }) => ({ outcome, retryAt }))).toEqual([
      { outcome: 'waiting', retryAt: at(START + 15 * MINUTE) },
      { outcome: 'waiting', retryAt: at(START + 15 * MINUTE) },
    ]);
    expect(finished[0]?.reason).toBe(new GithubDeferred(until).message);
    expect(summary).toMatchObject({ ran: 2, waiting: 2, failed: 0 });
  });

  it('an error is kept as its first line, cut to 500 characters', async () => {
    const { ledger, finished } = fakeLedger([{}, {}]);
    await run(ledger, throws(new Error('  boom\n    at handler (worker.ts:1:1)'), new Error('x'.repeat(600))));
    expect(finished.map((one) => one.reason)).toEqual(['boom', 'x'.repeat(500)]);
  });

  it('an error with no words says so', async () => {
    const { ledger, finished } = fakeLedger([{}, { tries: 5 }]);
    await run(ledger, throws(new Error('\n   ')));
    expect(finished.map(({ outcome, reason }) => ({ outcome, reason }))).toEqual([
      { outcome: 'retry', reason: 'it threw with no message' },
      { outcome: 'failed', reason: 'it threw with no message' },
    ]);
  });

  it('a kind with no handler is tried again, then failed like any error', async () => {
    const { ledger, finished } = fakeLedger([{ kind: 'unknown-kind', tries: 1 }, { kind: 'unknown-kind', tries: 5 }]);
    await run(ledger, done);
    expect(finished.map(({ outcome, reason }) => ({ outcome, reason }))).toEqual([
      { outcome: 'retry', reason: 'no handler runs jobs of kind unknown-kind here' },
      { outcome: 'failed', reason: 'no handler runs jobs of kind unknown-kind here' },
    ]);
  });

  it('hands the handler the job as claimed', async () => {
    const { ledger } = fakeLedger([{ payload: { installationId: 9, sha: 'a'.repeat(40) } }]);
    const seen: ClaimedJob[] = [];
    await run(ledger, (job) => {
      seen.push(job);
      return Promise.resolve({ outcome: 'done' });
    });
    expect(seen).toEqual([expect.objectContaining({ id: 'job-1', kind: 'knowledge-pack', payload: { installationId: 9, sha: 'a'.repeat(40) } })]);
  });
});

describe('runDue — claiming', () => {
  it('claims one job at a time, held 300 seconds, until none is due', async () => {
    const { ledger, claims } = fakeLedger([{}, {}]);
    const summary = await run(ledger, done);
    expect(claims).toEqual([
      { limit: 1, leaseSeconds: LEASE_SECONDS },
      { limit: 1, leaseSeconds: LEASE_SECONDS },
      { limit: 1, leaseSeconds: LEASE_SECONDS },
    ]);
    expect(LEASE_SECONDS).toBe(300);
    expect(summary.ran).toBe(2);
  });

  it('nothing due: one claim, nothing run', async () => {
    const { ledger, claims, finished } = fakeLedger([]);
    expect(await run(ledger, done)).toEqual({ ran: 0, done: 0, skipped: 0, retry: 0, waiting: 0, failed: 0, stale: 0 });
    expect(claims).toHaveLength(1);
    expect(finished).toEqual([]);
  });

  it('stops claiming once its time budget of 240 seconds is spent', async () => {
    expect(TIME_BUDGET_MS).toBe(240_000);
    const { clock, read } = clockAt(START);
    const { ledger, claims } = fakeLedger([{}, {}, {}, {}, {}]);
    const summary = await run(ledger, () => {
      clock.now += 100_000;
      return Promise.resolve({ outcome: 'done' });
    }, { clock: read });
    // Claims at 0 s, 100 s and 200 s; at 300 s the budget is spent.
    expect(claims).toHaveLength(3);
    expect(summary.ran).toBe(3);
  });

  it('claims nothing at all when its budget is spent before it starts', async () => {
    const { ledger, claims } = fakeLedger([{}]);
    const summary = await runDue({ ledger, handlers: {}, clock: () => START, budgetMs: 0, log: () => undefined });
    expect(claims).toEqual([]);
    expect(summary.ran).toBe(0);
  });

  it('a retry is timed from when the job ended, not when the run began', async () => {
    const { clock, read } = clockAt(START);
    const { ledger, finished } = fakeLedger([{}]);
    await run(ledger, () => {
      clock.now += 30_000;
      return Promise.reject(new Error('boom'));
    }, { clock: read });
    expect(finished[0]?.retryAt).toBe(at(START + 30_000 + MINUTE));
  });
});

describe('runDue — a finish that does not land', () => {
  it('a claim taken over is stale: counted, logged, and the run goes on', async () => {
    const lines: string[] = [];
    const { ledger, finished } = fakeLedger([{}, {}], { finish: ({ id }) => Promise.resolve(id === 'job-1' ? 'stale' : 'done') });
    const summary = await run(ledger, done, { log: (line) => lines.push(line) });
    expect(finished).toHaveLength(2);
    expect(summary).toMatchObject({ ran: 2, done: 1, stale: 1 });
    expect(lines).toContain(`job knowledge-pack initech/pack-api@${'1'.repeat(40)}: its claim was taken over, so its done was not kept`);
  });

  it('a finish the database refuses is logged and the run goes on: the claim runs out and the job is due again', async () => {
    const lines: string[] = [];
    const { ledger } = fakeLedger([{}, {}], {
      finish: ({ id }) => (id === 'job-1' ? Promise.reject(new Error('the database refused: connection reset')) : Promise.resolve('done')),
    });
    const summary = await run(ledger, done, { log: (line) => lines.push(line) });
    expect(summary).toMatchObject({ ran: 2, done: 1, stale: 0 });
    expect(lines).toContain(`job knowledge-pack initech/pack-api@${'1'.repeat(40)}: its done was not kept: the database refused: connection reset`);
  });

  it('a claim the database refuses is thrown to the caller', async () => {
    const ledger: JobLedger = {
      claim: () => Promise.reject(new Error('the database refused: permission denied')),
      finish: () => Promise.resolve('done'),
    };
    await expect(run(ledger, done)).rejects.toThrow('permission denied');
  });

  it('logs one line for each job that did not end done', async () => {
    const lines: string[] = [];
    const { ledger } = fakeLedger([{}, { tries: 5 }, {}]);
    let n = 0;
    await run(ledger, () => {
      n += 1;
      if (n === 1) return Promise.resolve({ outcome: 'skipped', reason: 'no product holds initech/pack-api' });
      if (n === 2) return Promise.reject(new Error('GitHub answered 502'));
      return Promise.resolve({ outcome: 'done' });
    }, { log: (line) => lines.push(line) });
    expect(lines).toEqual([
      `job knowledge-pack initech/pack-api@${'1'.repeat(40)}: skipped: no product holds initech/pack-api`,
      `job knowledge-pack initech/pack-api@${'2'.repeat(40)}: failed on try 5: GitHub answered 502`,
    ]);
  });
});
