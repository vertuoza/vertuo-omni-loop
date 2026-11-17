// The mission store's repairs (PRD 2980 s5), as the service role, never calling Supabase: each request recorded, each answer handed.
import { describe, expect, it } from 'vitest';
import { parseIssue, parsePrd } from 'omni-loop/kit/lib/ids.ts';
import { missionStore, type MissionRecord } from './store.ts';

const ID = '0b7c1f6e-3a52-4d8e-9f10-2c4b6a8d0e11';
const FP = 'c'.repeat(64);

type Recorded = { method: string; path: string; query: URLSearchParams; body: unknown };

/** A fetch that records each request and answers with the next of `answers` (a Response as is, anything else as JSON). */
function recordingFetch(answers: unknown[] = []) {
  const requests: Recorded[] = [];
  const fetch: typeof globalThis.fetch = (input, init = {}) =>
    new Promise((resolve) => {
      const url = new URL(input instanceof Request ? input.url : String(input));
      const body: unknown = typeof init.body === 'string' ? JSON.parse(init.body) : null;
      requests.push({ method: init.method ?? 'GET', path: url.pathname, query: url.searchParams, body });
      const answer: unknown = answers.shift() ?? [];
      resolve(answer instanceof Response ? answer : new Response(JSON.stringify(answer), { status: 200, headers: { 'content-type': 'application/json' } }));
    });
  return { fetch, requests };
}

const storeOn = (fetch: typeof globalThis.fetch) => missionStore({ url: 'https://db.example', key: 'service-key', fetch });

const mission: MissionRecord = {
  id: ID,
  workspace: 'ws-1',
  repo: 'acme/widgets',
  fleet: 'night-shift',
  number: parseIssue(12),
  title: 'Faster quotes',
  level: 'own-branch',
  status: 'running',
  waitingOn: null,
  parallel: 2,
  scope: { prds: [parsePrd(7)], roadmaps: [] },
};

const repairRow = { id: 'row-1', prd: 7, fingerprint: FP, round: 1, number: 2, failed_job_id: 'job-1', job_id: 'job-2', retro: null, fix_pr: null, outcome: null };
const jobRow = (over: Record<string, unknown> = {}) => ({ id: 'job-2', mission_key: `mission:${ID}:prd:7:repair:1`, resumes: null, status: 'running', outcome: null, reason: null, pr_url: null, limited_until: null, parts: null, line: '/omni:repair --mission 12 --prd 7 --job job-1', ...over });
const refusal = (hint: string) => new Response(JSON.stringify({ code: '23514', message: 'A repair over its budget.', details: null, hint }), { status: 400, headers: { 'content-type': 'application/json' } });

describe('missionStore — a mission\'s repairs (PRD 2980)', () => {
  it('reads its repair jobs, each with the job it repairs and its resumes, and the rows the database kept', async () => {
    const db = recordingFetch([[jobRow()], [jobRow({ id: 'job-3', resumes: 'job-2', status: 'queued' })], [], [repairRow]]);
    const read = await storeOn(db.fetch).repairs(ID);
    expect(read.jobs).toEqual([{ prd: 7, k: 1, job: 'job-2', failedJob: 'job-1', attempts: [expect.objectContaining({ id: 'job-2', status: 'running' }), expect.objectContaining({ id: 'job-3', status: 'queued' })] }]);
    expect(read.rows).toEqual([{ id: 'row-1', prd: 7, fingerprint: FP, round: 1, number: 2, failedJob: 'job-1', job: 'job-2', retro: null, fixPr: null, outcome: null }]);
    expect(db.requests[0]?.query.get('mission_key')).toBe(`like.mission:${ID}:prd:%:repair:%`);
    expect(db.requests[3]?.path).toBe('/rest/v1/mission_repairs');
  });

  it('queues a repair as the app, under its key, its line naming the mission by number and the failed job', async () => {
    const db = recordingFetch([[{ id: 'job-9' }]]);
    expect(await storeOn(db.fetch).repair({ mission, prd: parsePrd(7), k: 2, failedJob: 'job-1', toFleet: true })).toBe('job-9');
    expect(db.requests[0]?.body).toMatchObject({ line: '/omni:repair --mission 12 --prd 7 --job job-1', mission_key: `mission:${ID}:prd:7:repair:2`, sent_by_app: 'omni-app', to_fleet: 'night-shift', mission_id: ID });
  });

  it('keeps a repair\'s row, numbered by the database, or answers the cap it was refused on', async () => {
    const row = { prd: parsePrd(7), fingerprint: FP, round: 2, failedJob: 'job-1', job: 'job-2', retro: null, fixPr: 'https://github.com/acme/widgets/pull/51' };
    const db = recordingFetch([[{ ...repairRow, round: 2, fix_pr: row.fixPr }]]);
    expect(await storeOn(db.fetch).keepRepair(mission, row)).toMatchObject({ id: 'row-1', number: 2, round: 2, fixPr: row.fixPr });
    expect(db.requests[0]?.body).toEqual({ mission_id: ID, prd: 7, fingerprint: FP, round: 2, failed_job_id: 'job-1', job_id: 'job-2', retro: null, fix_pr: row.fixPr });
    expect(await storeOn(recordingFetch([refusal('mission')]).fetch).keepRepair(mission, row)).toEqual({ spent: 'mission' });
    expect(await storeOn(recordingFetch([refusal('fingerprint')]).fetch).keepRepair(mission, row)).toEqual({ spent: 'cause' });
  });

  it('sets a repair\'s outcome once, and reads the Omni Loop bug a fingerprint was filed as', async () => {
    const db = recordingFetch([[{ id: 'row-1' }], [{ repo: 'vertuoza/vertuo-omni-loop', issue: 3100 }], []]);
    const store = storeOn(db.fetch);
    await store.endRepair('row-1', 'fixed');
    expect(db.requests[0]).toMatchObject({ method: 'PATCH', body: { outcome: 'fixed' } });
    expect(db.requests[0]?.query.get('outcome')).toBe('is.null');
    expect(await store.bugIssue(FP)).toEqual({ repo: 'vertuoza/vertuo-omni-loop', issue: 3100 });
    expect(await store.bugIssue(FP)).toBeNull();
  });

  it('knows the workspace by its repositories\' owners and names and the logins on its events', async () => {
    const db = recordingFetch([[{ full_name: 'acme/widgets' }, { full_name: 'acme/gadgets' }], [{ actor: 'ada' }, { actor: null }]]);
    expect(await storeOn(db.fetch).names(mission)).toEqual(['acme/widgets', 'acme', 'widgets', 'acme/gadgets', 'gadgets', 'ada']);
    expect(db.requests[1]?.query.get('actor')).toBe('neq.agent');
  });
});
