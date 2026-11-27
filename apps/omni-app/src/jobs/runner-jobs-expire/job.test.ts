// The `runner-jobs-expire` job (PRD omni-loop-35 s3) with a fake store and a fixed clock, and its store over a fake
// fetch: no test calls Supabase. The sweep's own rules are proven in the database (supabase/checks/runner_jobs_expire.sql).
import { describe, expect, it } from 'vitest';
import { jobLedger, type ClaimedJob } from '../ledger.ts';
import { SCHEDULES, scheduledJobs } from '../schedule.ts';
import { RUNNER_JOBS_EXPIRE_KIND, runnerJobsExpireHandler } from './job.ts';
import { expireStore, type ExpireCounts } from './store.ts';

const NOW = Date.parse('2027-01-29T12:00:00.000Z');
const JOB = { id: 'j-1', kind: RUNNER_JOBS_EXPIRE_KIND, payload: { slot: '2027-01-29T12:00:00.000Z' } } as unknown as ClaimedJob;
const COUNTS: ExpireCounts = { failed: 21, expired: 1, questions: 2, grouped: 22 };

type Call = { method: string; path: string; search: string; body: unknown; key: string | null };

/** A database answering `answer` to every call (a refusal with `status`), and the calls it was sent. */
function dbFetch(answer: unknown, status = 200) {
  const calls: Call[] = [];
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const request = input instanceof Request ? input : new Request(String(input), init);
    const url = new URL(request.url);
    const text = request.method === 'GET' ? '' : await request.text();
    calls.push({ method: request.method, path: url.pathname, search: decodeURIComponent(url.search), body: text ? JSON.parse(text) : null, key: request.headers.get('apikey') });
    return new Response(JSON.stringify(answer), { status, headers: { 'content-type': 'application/json' } });
  };
  return { fetch, calls };
}

const connection = (fetch: typeof globalThis.fetch) => ({ url: 'https://db.example', key: 'service-key', fetch });

describe('the runner-jobs-expire job', () => {
  it('calls the sweep once at the clock\'s time and logs its four counts', async () => {
    const at: string[] = [];
    const said: string[] = [];
    const handler = runnerJobsExpireHandler({
      store: { expire: (now) => { at.push(now.toISOString()); return Promise.resolve(COUNTS); } },
      clock: () => NOW,
      log: (line) => said.push(line),
    });
    expect(await handler(JOB)).toEqual({ outcome: 'done' });
    expect(at).toEqual(['2027-01-29T12:00:00.000Z']);
    expect(said).toEqual(['runner jobs expire: 21 queued ended failed, 1 waiting expired, 2 rounds closed, 22 per-job findings grouped']);
  });

  it('fails its run when the sweep fails, so the ledger tries again', async () => {
    const handler = runnerJobsExpireHandler({ store: { expire: () => Promise.reject(new Error('the database refused: boom')) }, clock: () => NOW, log: () => undefined });
    await expect(handler(JOB)).rejects.toThrow('boom');
  });

  it('runs every 15 minutes on the ledger, 3 tries, one job per slot', () => {
    expect(SCHEDULES).toContainEqual({ kind: RUNNER_JOBS_EXPIRE_KIND, periodMinutes: 15, maxTries: 3 });
    const jobs = scheduledJobs(SCHEDULES, Date.parse('2027-01-29T12:20:00.000Z')).filter((job) => job.kind === RUNNER_JOBS_EXPIRE_KIND);
    expect(jobs).toEqual([{
      kind: RUNNER_JOBS_EXPIRE_KIND, key: 'runner-jobs-expire@2027-01-29T12:15:00.000Z', subject: RUNNER_JOBS_EXPIRE_KIND,
      payload: { slot: '2027-01-29T12:15:00.000Z' }, lane: RUNNER_JOBS_EXPIRE_KIND, maxTries: 3,
    }]);
  });

  it('reads late when it stops: the ledger\'s health is sent its kind and its 15-minute period', async () => {
    const db = dbFetch({ state: 'late', late: 0, failed: 0, scheduled: 1 });
    await jobLedger(connection(db.fetch)).health();
    const sent = new URLSearchParams(db.calls[0]?.search ?? '');
    const kinds = (sent.get('p_kinds') ?? '').replace(/[{}]/g, '').split(',');
    const periods = (sent.get('p_periods') ?? '').replace(/[{}]/g, '').split(',');
    expect(periods[kinds.indexOf(RUNNER_JOBS_EXPIRE_KIND)]).toBe('900');
  });
});

describe('the store — runner_jobs_expire as the service role', () => {
  it('calls the function with the time, as the service role, and parses its counts', async () => {
    const db = dbFetch(COUNTS);
    expect(await expireStore(connection(db.fetch)).expire(new Date(NOW))).toEqual(COUNTS);
    expect(db.calls).toEqual([expect.objectContaining({ method: 'POST', path: '/rest/v1/rpc/runner_jobs_expire', body: { p_now: '2027-01-29T12:00:00.000Z' }, key: 'service-key' })]);
  });

  it('throws on a refusal, naming its code, and on an answer out of shape', async () => {
    await expect(expireStore(connection(dbFetch({ message: 'permission denied', code: '42501' }, 403).fetch)).expire(new Date(NOW))).rejects.toThrow('the database refused: permission denied (42501)');
    await expect(expireStore(connection(dbFetch({ failed: 1 }).fetch)).expire(new Date(NOW))).rejects.toThrow();
  });
});
