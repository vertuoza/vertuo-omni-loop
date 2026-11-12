import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { GithubDeferred, GithubPaused } from '@omni/github';
import { fakeStepLedger } from '../../test/saved-steps.ts';
import { savedStep } from '../saved-step.ts';
import type { ClaimedJob, Finish, FinishAnswer, JobLedger } from './ledger.ts';
import { CLAIM_LEFT_MS, CUT_SHORT, FINISH_MARGIN_MS, LEASE_SECONDS, runDue, TIME_BUDGET_MS, type FailureHook, type JobHandler, type JobResult } from './worker.ts';

const START = Date.parse('2027-01-13T09:00:00Z');
const MINUTE = 60_000;
const at = (ms: number) => new Date(ms).toISOString();

/** What a finish answers by default: the state the outcome leads to. */
const stateAfter = ({ outcome }: Finish): FinishAnswer => (outcome === 'retry' || outcome === 'waiting' || outcome === 'later' ? 'queued' : outcome);

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
    expect(summary).toEqual({ ran: 1, done: 1, skipped: 0, retry: 0, waiting: 0, later: 0, failed: 0, stale: 0 });
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

  it('a job that asks to run again later is later, at its date, with the progress its next run reads (PRD omni-loop-3 s1)', async () => {
    const lines: string[] = [];
    const { ledger, finished } = fakeLedger([{ tries: 5, progress: { look: 3 } }]);
    const seen: unknown[] = [];
    const summary = await run(ledger, (job) => {
      seen.push(job.progress);
      return Promise.resolve({ outcome: 'later', at: new Date(START + MINUTE), progress: { look: 4 } });
    }, { log: (line) => lines.push(line) });
    expect(seen).toEqual([{ look: 3 }]);
    expect(finished).toEqual([{ id: 'job-1', claim: 'claim-1', outcome: 'later', reason: null, retryAt: at(START + MINUTE), progress: { look: 4 } }]);
    expect(summary).toEqual({ ran: 1, done: 0, skipped: 0, retry: 0, waiting: 0, later: 1, failed: 0, stale: 0 });
    expect(lines).toEqual([]);
  });

  it('a later the ledger failed (its 21st) counts as failed, says why, and runs the failure hook', async () => {
    const lines: string[] = [];
    const reasons: string[] = [];
    const { ledger } = fakeLedger([{}], { finish: () => Promise.resolve('failed') });
    const summary = await runDue({
      ledger,
      handlers: { 'knowledge-pack': () => Promise.resolve({ outcome: 'later', at: new Date(START + MINUTE), progress: { look: 21 } }) },
      failures: { 'knowledge-pack': (_job, reason) => {
        reasons.push(reason);
        return Promise.resolve();
      } },
      clock: () => START,
      log: (line) => lines.push(line),
    });
    expect(summary).toMatchObject({ ran: 1, later: 0, failed: 1 });
    expect(reasons).toEqual(['it asked to run later more than 20 times']);
    expect(lines).toEqual([`job knowledge-pack initech/pack-api@${'1'.repeat(40)}: failed: it asked to run later more than 20 times`]);
  });

  it('each job has its own tries: one of 3 tries fails on its 3rd throw; none set is 5', async () => {
    const { ledger, finished } = fakeLedger([{ tries: 2, maxTries: 3 }, { tries: 3, maxTries: 3 }, { tries: 3 }]);
    await run(ledger, throws(new Error('GitHub answered 502')));
    expect(finished.map(({ outcome }) => outcome)).toEqual(['retry', 'failed', 'retry']);
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
    expect(await run(ledger, done)).toEqual({ ran: 0, done: 0, skipped: 0, retry: 0, waiting: 0, later: 0, failed: 0, stale: 0 });
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

describe('runDue — the failure hook of a kind (PRD 2688 s1)', () => {
  type Called = { id: string; kind: string; reason: string };

  /** A hook that records each call, then does what `then` says. */
  function hookOf(then: () => Promise<void> = () => Promise.resolve()) {
    const calls: Called[] = [];
    const hook: FailureHook = (job, reason) => {
      calls.push({ id: job.id, kind: job.kind, reason });
      return then();
    };
    return { hook, calls };
  }

  const runWith = (ledger: JobLedger, handler: JobHandler, failures: Readonly<Partial<Record<string, FailureHook>>>, log: (line: string) => void = () => undefined) =>
    runDue({ ledger, handlers: { 'pr-outbox': handler, 'knowledge-pack': handler }, failures, clock: () => START, log });

  it('runs once, on the 5th throw only, with the job and its error\'s first line', async () => {
    const { hook, calls } = hookOf();
    const { ledger } = fakeLedger([1, 2, 3, 4, 5].map((tries) => ({ kind: 'pr-outbox', tries })));
    const summary = await runWith(ledger, throws(new Error('GitHub answered 502\n    at handler')), { 'pr-outbox': hook });
    expect(calls).toEqual([{ id: 'job-5', kind: 'pr-outbox', reason: 'GitHub answered 502' }]);
    expect(summary).toMatchObject({ ran: 5, retry: 4, failed: 1 });
  });

  it('runs on no other outcome: done, skipped, a retry, or a wait on GitHub\'s budget on the 5th try', async () => {
    const { hook, calls } = hookOf();
    const { ledger } = fakeLedger([{ kind: 'pr-outbox', tries: 5 }, { kind: 'pr-outbox', tries: 5 }, { kind: 'pr-outbox', tries: 5 }]);
    let n = 0;
    await runWith(ledger, () => {
      n += 1;
      if (n === 1) return Promise.resolve({ outcome: 'done' });
      if (n === 2) return Promise.resolve({ outcome: 'skipped', reason: 'not a loop pull request' });
      return Promise.reject(new GithubDeferred(START + 40 * MINUTE));
    }, { 'pr-outbox': hook });
    expect(calls).toEqual([]);
  });

  it('runs only the failing job\'s own kind: a kind with no hook fails as before', async () => {
    const { hook, calls } = hookOf();
    const { ledger, finished } = fakeLedger([{ kind: 'knowledge-pack', tries: 5 }]);
    await runWith(ledger, throws(new Error('boom')), { 'pr-outbox': hook });
    expect(calls).toEqual([]);
    expect(finished.map(({ outcome }) => outcome)).toEqual(['failed']);
  });

  it('runs only once the ledger kept the job failed: not when a refresh queued it again, its claim was taken over, or the finish was refused', async () => {
    const { hook, calls } = hookOf();
    const answers: Record<string, () => Promise<FinishAnswer>> = {
      'job-1': () => Promise.resolve('queued'),
      'job-2': () => Promise.resolve('stale'),
      'job-3': () => Promise.reject(new Error('the database refused: connection reset')),
      'job-4': () => Promise.resolve('failed'),
    };
    const { ledger } = fakeLedger([1, 2, 3, 4].map(() => ({ kind: 'pr-outbox', tries: 5 })), {
      finish: ({ id }) => (answers[id] ?? (() => Promise.resolve('failed')))(),
    });
    await runWith(ledger, throws(new Error('boom')), { 'pr-outbox': hook });
    expect(calls.map(({ id }) => id)).toEqual(['job-4']);
  });

  it('a hook that throws is logged, and the run goes on', async () => {
    const lines: string[] = [];
    const { hook, calls } = hookOf(() => Promise.reject(new Error('GitHub answered 500\n    at hook')));
    const { ledger, finished } = fakeLedger([{ kind: 'pr-outbox', tries: 5 }, { kind: 'pr-outbox', tries: 1 }]);
    let n = 0;
    const summary = await runWith(ledger, () => (++n === 1 ? Promise.reject(new Error('boom')) : Promise.resolve({ outcome: 'done' })), { 'pr-outbox': hook }, (line) => lines.push(line));
    expect(calls).toHaveLength(1);
    expect(finished.map(({ outcome }) => outcome)).toEqual(['failed', 'done']);
    expect(summary).toMatchObject({ ran: 2, failed: 1, done: 1 });
    expect(lines).toContain(`job pr-outbox initech/pack-api@${'1'.repeat(40)}: its failure hook threw: GitHub answered 500`);
  });

  it('with no hooks given, a failure is as it always was', async () => {
    const { ledger, finished } = fakeLedger([{ tries: 5 }]);
    expect((await run(ledger, throws(new Error('boom')))).failed).toBe(1);
    expect(finished.map(({ outcome }) => outcome)).toEqual(['failed']);
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

describe('runDue — a job\'s saved steps (PRD omni-loop-4 s1)', () => {
  const Count = z.object({ count: z.number() });

  /** A handler of two saved steps, `first` and `second`, counting how often each ran; it throws after `first` once. */
  function twoSteps({ throwAfterFirst = false } = {}) {
    const ran: string[] = [];
    let thrown = !throwAfterFirst;
    const handler: JobHandler = async (_job, run) => {
      const step = run?.step;
      if (!step) throw new Error('no step given');
      await savedStep(step, 'first', Count, () => {
        ran.push('first');
        return { count: 1 };
      });
      if (!thrown) {
        thrown = true;
        throw new Error('the function was cut');
      }
      await savedStep(step, 'second', Count, () => {
        ran.push('second');
        return { count: 2 };
      });
      return { outcome: 'done' };
    };
    return { handler, ran };
  }

  it('saves each step on the ledger and renews the claim, for the worker\'s lease, after each', async () => {
    const steps = fakeStepLedger();
    const { ledger } = fakeLedger([{}]);
    const { handler, ran } = twoSteps();
    const renew = vi.spyOn(steps.ledger, 'renew');
    const summary = await runDue({ ledger: { ...ledger, ...steps.ledger }, handlers: { 'knowledge-pack': handler }, clock: () => START, log: () => undefined });
    expect(summary.done).toBe(1);
    expect(ran).toEqual(['first', 'second']);
    expect(steps.calls).toEqual({ read: ['job-1'], saved: ['job-1 first', 'job-1 second'], renewed: ['job-1', 'job-1'] });
    expect(renew).toHaveBeenCalledWith({ id: 'job-1', claim: 'claim-1', leaseSeconds: LEASE_SECONDS });
    expect(steps.stepsOf('job-1')).toEqual({ first: { count: 1 }, second: { count: 2 } });
  });

  it('a run cut after a step carries on from the next step on its retry: no finished step runs again', async () => {
    const steps = fakeStepLedger();
    const { handler, ran } = twoSteps({ throwAfterFirst: true });
    const cut = fakeLedger([{ id: 'job-40', claim: 'claim-1', tries: 1 }]);
    expect((await runDue({ ledger: { ...cut.ledger, ...steps.ledger }, handlers: { 'knowledge-pack': handler }, clock: () => START, log: () => undefined })).retry).toBe(1);
    const retried = fakeLedger([{ id: 'job-40', claim: 'claim-2', tries: 2 }]);
    expect((await runDue({ ledger: { ...retried.ledger, ...steps.ledger }, handlers: { 'knowledge-pack': handler }, clock: () => START, log: () => undefined })).done).toBe(1);
    expect(ran).toEqual(['first', 'second']);
  });

  it('a ledger without saved steps gives each run steps of its own', async () => {
    const { ledger } = fakeLedger([{}, {}]);
    const { handler, ran } = twoSteps();
    const summary = await run(ledger, handler);
    expect(summary.done).toBe(2);
    expect(ran).toEqual(['first', 'second', 'first', 'second']);
  });
});

describe('runDue — inside a function that ends (bug #2756)', () => {
  const runIn = (ledger: JobLedger, handler: JobHandler, endsAt: number, extra: { clock?: () => number; log?: (line: string) => void } = {}) =>
    runDue({ ledger, handlers: { 'knowledge-pack': handler }, clock: extra.clock ?? (() => START), endsAt, log: extra.log ?? (() => undefined) });

  it('keeps 5 seconds for a finish and claims only with 20 seconds left', () => {
    expect(FINISH_MARGIN_MS).toBe(5_000);
    expect(CLAIM_LEFT_MS).toBe(20_000);
  });

  it('claims with exactly 20 seconds left, and not with less', async () => {
    const enough = fakeLedger([{}]);
    expect((await runIn(enough.ledger, done, START + CLAIM_LEFT_MS)).done).toBe(1);
    const short = fakeLedger([{}]);
    expect((await runIn(short.ledger, done, START + CLAIM_LEFT_MS - 1)).ran).toBe(0);
    expect(short.claims).toEqual([]);
  });

  it('gives back a job still running 5 seconds before the end: waiting a minute, said why, counted, logged, and claims nothing more', async () => {
    vi.useFakeTimers();
    try {
      const lines: string[] = [];
      const { ledger, finished, claims } = fakeLedger([{ tries: 3 }, {}]);
      const running = runIn(ledger, () => new Promise(() => undefined), START + 60_000, { log: (line) => lines.push(line) });
      await vi.advanceTimersByTimeAsync(55_000);
      const summary = await running;
      expect(finished).toEqual([{ id: 'job-1', claim: 'claim-1', outcome: 'waiting', reason: CUT_SHORT, retryAt: at(START + MINUTE) }]);
      expect(summary).toEqual({ ran: 1, done: 0, skipped: 0, retry: 0, waiting: 1, later: 0, failed: 0, stale: 0 });
      expect(claims).toHaveLength(1);
      expect(lines).toEqual([`job knowledge-pack initech/pack-api@${'1'.repeat(40)}: waiting on try 3: ${CUT_SHORT}`]);
    } finally {
      vi.useRealTimers();
    }
  });

  it('a job that ends in time is kept as it ended, and the run goes on', async () => {
    const { clock, read } = clockAt(START);
    const { ledger, finished } = fakeLedger([{}, {}]);
    const summary = await runIn(ledger, () => {
      clock.now += 10_000;
      return Promise.resolve({ outcome: 'done' });
    }, START + 60_000, { clock: read });
    expect(summary.done).toBe(2);
    expect(finished.map(({ outcome }) => outcome)).toEqual(['done', 'done']);
  });

  it('a job that throws in time is retried as before, never given back', async () => {
    const { ledger, finished } = fakeLedger([{}]);
    await runIn(ledger, throws(new Error('GitHub answered 502')), START + 60_000);
    expect(finished[0]).toMatchObject({ outcome: 'retry', reason: 'GitHub answered 502' });
  });

  it('with less than 5 seconds left once claimed, the job is given back at once', async () => {
    const { clock, read } = clockAt(START);
    const { ledger, finished } = fakeLedger([{}]);
    const slowClaim: JobLedger = {
      ...ledger,
      claim: async (input) => {
        clock.now += 18_000;
        return ledger.claim(input);
      },
    };
    await runIn(slowClaim, () => new Promise(() => undefined), START + 20_000, { clock: read });
    expect(finished[0]).toMatchObject({ outcome: 'waiting', reason: CUT_SHORT });
  });
});
