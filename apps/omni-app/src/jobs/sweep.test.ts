// The route (PRD 2676 s4): no secret, a wrong secret, a run, `?gaps=1`, the daily forgetting, a replay.
import { describe, expect, it } from 'vitest';
import { readEnv } from '../env.ts';
import { FORGET_HOUR_UTC, jobsSweepRoute, type SweepJobs } from './sweep.ts';

const SECRET = 'cron-secret';
const URL_BASE = 'https://omni-loop.example/api/jobs-sweep';
const RUN = { ran: 1, done: 1, skipped: 0, retry: 0, waiting: 0, later: 0, failed: 0, stale: 0 };
const SCHEDULED = { scheduled: 2, added: 1 };
const DELAYED = { due: 1, posted: 1, skipped: 0, failed: 0, stopped: false };
const GAPS = { read: 2, added: 1, skipped: 0, failed: 0, stopped: false };
const ID = '00000000-0000-4000-8000-000000002676';

function fake(calls: string[], replayed: Awaited<ReturnType<SweepJobs['replay']>> = { replayed: true, id: ID, kind: 'knowledge-pack', key: 'k', state: 'queued', tries: 0 }): SweepJobs {
  return {
    run: () => {
      calls.push('run');
      return Promise.resolve(RUN);
    },
    delayed: () => {
      calls.push('delayed');
      return Promise.resolve(DELAYED);
    },
    schedule: () => {
      calls.push('schedule');
      return Promise.resolve(SCHEDULED);
    },
    gaps: () => {
      calls.push('gaps');
      return Promise.resolve(GAPS);
    },
    replay: (id) => {
      calls.push(`replay ${id}`);
      return Promise.resolve(replayed);
    },
    forget: () => {
      calls.push('forget');
      return Promise.resolve(3);
    },
  };
}

const at = (hour: number) => () => Date.UTC(2026, 10, 9, hour, 7);
const route = (jobs: SweepJobs | null, hour = 12, env: Record<string, string> = { CRON_SECRET: SECRET }) =>
  jobsSweepRoute(readEnv(env), { jobs, clock: at(hour) });
const authed = { authorization: `Bearer ${SECRET}` };

describe('/api/jobs-sweep (PRD 2676 s4)', () => {
  it('refuses a call without the secret, with a wrong one, and when none is set, running nothing', async () => {
    const calls: string[] = [];
    const { GET, POST } = route(fake(calls));
    expect((await GET(new Request(URL_BASE))).status).toBe(401);
    expect((await GET(new Request(URL_BASE, { headers: { authorization: 'Bearer wrong' } }))).status).toBe(401);
    expect((await GET(new Request(URL_BASE, { headers: { authorization: SECRET } }))).status).toBe(401);
    expect((await POST(new Request(URL_BASE, { method: 'POST', body: JSON.stringify({ replay: ID }) }))).status).toBe(401);
    expect((await route(fake(calls), 12, {}).GET(new Request(URL_BASE, { headers: authed }))).status).toBe(401);
    expect(calls).toEqual([]);
  });

  it('posts the delayed checks before it runs the jobs due', async () => {
    const calls: string[] = [];
    await route(fake(calls)).GET(new Request(URL_BASE, { headers: authed }));
    expect(calls.indexOf('delayed')).toBeLessThan(calls.indexOf('run'));
  });

  it('adds the scheduled jobs before it runs the jobs due (PRD omni-loop-3 s1)', async () => {
    const calls: string[] = [];
    await route(fake(calls)).GET(new Request(URL_BASE, { headers: authed }));
    expect(calls.indexOf('schedule')).toBeGreaterThan(-1);
    expect(calls.indexOf('schedule')).toBeLessThan(calls.indexOf('run'));
  });

  it('runs the jobs due with the secret', async () => {
    const calls: string[] = [];
    const response = await route(fake(calls)).GET(new Request(URL_BASE, { headers: authed }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, delayed: DELAYED, scheduled: SCHEDULED, run: RUN });
    expect(calls).toEqual(['delayed', 'schedule', 'run']);
  });

  it('runs the comparison first with ?gaps=1, and forgets nothing outside the daily hour', async () => {
    const calls: string[] = [];
    const response = await route(fake(calls)).GET(new Request(`${URL_BASE}?gaps=1`, { headers: authed }));
    expect(await response.json()).toEqual({ ok: true, gaps: GAPS, delayed: DELAYED, scheduled: SCHEDULED, run: RUN });
    expect(calls).toEqual(['gaps', 'delayed', 'schedule', 'run']);
  });

  it('forgets the old rows once a day, in the hourly call of the daily hour', async () => {
    const calls: string[] = [];
    const response = await route(fake(calls), FORGET_HOUR_UTC).GET(new Request(`${URL_BASE}?gaps=1`, { headers: authed }));
    expect(await response.json()).toEqual({ ok: true, gaps: GAPS, forgotten: 3, delayed: DELAYED, scheduled: SCHEDULED, run: RUN });
    expect(calls).toEqual(['gaps', 'forget', 'delayed', 'schedule', 'run']);
  });

  it('forgets nothing in the plain call of every minute, even in the daily hour', async () => {
    const calls: string[] = [];
    await route(fake(calls), FORGET_HOUR_UTC).GET(new Request(URL_BASE, { headers: authed }));
    expect(calls).toEqual(['delayed', 'schedule', 'run']);
  });

  it('replays a failed job, then runs the jobs due', async () => {
    const calls: string[] = [];
    const response = await route(fake(calls)).POST(new Request(URL_BASE, { method: 'POST', headers: authed, body: JSON.stringify({ replay: ID }) }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, replayed: true, id: ID, run: RUN });
    expect(calls).toEqual([`replay ${ID}`, 'run']);
  });

  it('answers 409 with the reason, and runs nothing, for a job that cannot be replayed', async () => {
    const calls: string[] = [];
    const jobs = fake(calls, { replayed: false, reason: 'the job is not failed' });
    const response = await route(jobs).POST(new Request(URL_BASE, { method: 'POST', headers: authed, body: JSON.stringify({ replay: ID }) }));
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ ok: false, replayed: false, reason: 'the job is not failed' });
    expect(calls).toEqual([`replay ${ID}`]);
  });

  it('answers 400 for a body that names no job', async () => {
    const calls: string[] = [];
    const { POST } = route(fake(calls));
    expect((await POST(new Request(URL_BASE, { method: 'POST', headers: authed, body: '{}' }))).status).toBe(400);
    expect((await POST(new Request(URL_BASE, { method: 'POST', headers: authed, body: 'nope' }))).status).toBe(400);
    expect(calls).toEqual([]);
  });

  it('answers 503 where the App has no database, and 405 to another method', async () => {
    expect((await route(null).GET(new Request(URL_BASE, { headers: authed }))).status).toBe(503);
    const response = await route(fake([])).DELETE(new Request(URL_BASE, { method: 'DELETE', headers: authed }));
    expect(response.status).toBe(405);
    expect(response.headers.get('allow')).toBe('GET, POST');
  });
});
