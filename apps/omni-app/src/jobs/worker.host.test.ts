// Bug #2756: a run of the worker lives inside a Vercel function (`/api/github` and `/api/server-event` stop at
// 60 s, `/api/jobs-sweep` at 300 s), but it claimed jobs for its own 240 seconds, so a try still running when the
// function was stopped lost its claim, and a job lost on its last try failed with "its claim ran out on its last
// try". A run is told when its function ends: it claims nothing it has too little time left for, and a job still
// running near that end is given back, its try kept, before the function is stopped.
import { describe, expect, it, vi } from 'vitest';
import type { ClaimedJob, Finish, JobLedger } from './ledger.ts';
import { runDue, type JobHandler } from './worker.ts';

const START = Date.parse('2026-11-12T15:31:57Z');
const at = (ms: number) => new Date(ms).toISOString();

/** A ledger in memory: the jobs it hands out, one per claim, and every finish it was sent. */
function fakeLedger(count: number) {
  const queue: ClaimedJob[] = Array.from({ length: count }, (_, n) => ({
    id: `job-${String(n + 1)}`,
    kind: 'escalation',
    key: `escalation@2026-11-12T15:00:00.000Z#${String(n + 1)}`,
    subject: 'escalation',
    payload: {},
    tries: 1,
    maxTries: 3,
    claim: `claim-${String(n + 1)}`,
    claimedUntil: at(START + 300_000),
  }));
  const claims: number[] = [];
  const finished: Finish[] = [];
  const ledger: JobLedger = {
    claim: ({ limit }) => {
      claims.push(limit);
      return Promise.resolve(queue.splice(0, limit));
    },
    finish: (input) => {
      finished.push(input);
      return Promise.resolve('queued');
    },
  };
  return { ledger, claims, finished };
}

/** The run's function, ending at `endsAt` (ms since the epoch). */
const endingAt = (endsAt: number) => ({ endsAt });

describe('runDue inside a function that ends (bug #2756)', () => {
  it('a run in a 60-second function claims no job once too little of the function is left', async () => {
    const clock = { now: START };
    const { ledger, claims } = fakeLedger(5);
    const takes45s: JobHandler = () => {
      clock.now += 45_000;
      return Promise.resolve({ outcome: 'done' });
    };
    const summary = await runDue({ ledger, handlers: { escalation: takes45s }, clock: () => clock.now, ...endingAt(START + 60_000), log: () => undefined });
    // One job, 45 seconds: 15 seconds left is too little to claim another.
    expect(claims).toHaveLength(1);
    expect(summary.ran).toBe(1);
  });

  it('a job still running as its function nears its end is given back, its try kept, before the function is stopped', async () => {
    vi.useFakeTimers();
    try {
      const { ledger, finished } = fakeLedger(1);
      const neverEnds: JobHandler = () => new Promise(() => undefined);
      // The function ends 30 seconds from now: the run gives the job back 5 seconds before, so the finish lands.
      void runDue({ ledger, handlers: { escalation: neverEnds }, clock: () => START, ...endingAt(START + 30_000), log: () => undefined });
      await vi.advanceTimersByTimeAsync(24_999);
      expect(finished).toEqual([]);
      await vi.advanceTimersByTimeAsync(1);
      expect(finished).toHaveLength(1);
      expect(finished[0]).toMatchObject({ id: 'job-1', claim: 'claim-1', outcome: 'waiting' });
    } finally {
      vi.useRealTimers();
    }
  });
});
