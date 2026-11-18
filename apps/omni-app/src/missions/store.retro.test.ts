// The mission store's stuck repairs and milestone retros (PRD 3065 s4), as the service role, never calling Supabase: each request
// recorded, each answer handed.
import { describe, expect, it } from 'vitest';
import { parseIssue, parsePrd } from 'omni-loop/kit/lib/ids.ts';
import { missionStore, type MissionRecord, type MissionRetros } from './store.ts';

const ID = '0b7c1f6e-3a52-4d8e-9f10-2c4b6a8d0e11';
const FP = 'c'.repeat(64);
const JOB = 'a1b2c3d4-0000-4000-8000-000000000005';

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
const retrosOn = (fetch: typeof globalThis.fetch): MissionRetros => {
  const retros = storeOn(fetch).retros;
  if (retros === undefined) throw new Error('the store keeps no retros');
  return retros;
};

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
  scope: { prds: [parsePrd(7)], roadmaps: [parseIssue(2790)] },
};

const jobRow = (over: Record<string, unknown> = {}) => ({ id: 'job-2', mission_key: `mission:${ID}:stuck:1`, resumes: null, status: 'running', outcome: null, reason: null, pr_url: null, limited_until: null, parts: null, line: '/omni:repair --mission 12 --stuck --jobs a,b,c,d,e', ...over });
const taken = () => new Response(JSON.stringify({ code: '23505', message: 'duplicate key', details: null, hint: null }), { status: 409, headers: { 'content-type': 'application/json' } });

describe('missionStore — a mission\'s stuck repairs (PRD 3065)', () => {
  it('reads its stuck repairs, each with the jobs its line names and its resumes', async () => {
    const db = recordingFetch([[jobRow()], [jobRow({ id: 'job-3', resumes: 'job-2', status: 'queued', mission_key: null })], []]);
    expect(await retrosOn(db.fetch).stucks(ID)).toEqual([{ k: 1, job: 'job-2', jobs: ['a', 'b', 'c', 'd', 'e'], attempts: [expect.objectContaining({ id: 'job-2' }), expect.objectContaining({ id: 'job-3', status: 'queued' })] }]);
    expect(db.requests[0]?.query.get('mission_key')).toBe(`like.mission:${ID}:stuck:%`);
  });

  it('queues one as the app, under its key, naming each job by its first 8 characters', async () => {
    const db = recordingFetch([[{ id: 'job-9' }]]);
    expect(await retrosOn(db.fetch).stuck({ mission, k: 2, jobs: [JOB, JOB, JOB, JOB, JOB], toFleet: true })).toBe('job-9');
    expect(db.requests[0]?.body).toMatchObject({ line: '/omni:repair --mission 12 --stuck --jobs a1b2c3d4,a1b2c3d4,a1b2c3d4,a1b2c3d4,a1b2c3d4', mission_key: `mission:${ID}:stuck:2`, sent_by_app: 'omni-app', to_fleet: 'night-shift', mission_id: ID });
  });

  it('keeps its row with its trigger, and reads a stuck row back with no PRD', async () => {
    const row = { id: 'row-1', prd: null, fingerprint: FP, round: 1, number: 1, failed_job_id: JOB, job_id: 'job-2', retro: null, fix_pr: null, outcome: null, trigger: 'stuck' };
    const db = recordingFetch([[row]]);
    expect(await storeOn(db.fetch).keepRepair(mission, { prd: null, fingerprint: FP, round: 1, failedJob: JOB, job: 'job-2', retro: null, fixPr: null, trigger: 'stuck' })).toMatchObject({ id: 'row-1', prd: null, trigger: 'stuck' });
    expect(db.requests[0]?.body).toEqual({ mission_id: ID, prd: null, fingerprint: FP, round: 1, failed_job_id: JOB, job_id: 'job-2', retro: null, fix_pr: null, trigger: 'stuck' });
  });

  it('reads the mission paused by stuck, and pauses it so', async () => {
    const base = { id: ID, workspace_id: 'ws-1', repo: 'acme/widgets', fleet: 'night-shift', number: 12, title: 'Faster quotes', status: 'paused', waiting_on: 'Paused: stuck · why', mandate: { parallel: 2 }, scope: { prds: [7], roadmaps: [] } };
    expect(await storeOn(recordingFetch([[{ ...base, paused_by: 'stuck' }]]).fetch).mission(ID)).toMatchObject({ status: 'paused', pausedBy: 'stuck' });
    expect(await storeOn(recordingFetch([[base]]).fetch).mission(ID)).not.toHaveProperty('pausedBy');
    const db = recordingFetch([[{ id: ID }]]);
    expect(await storeOn(db.fetch).update(ID, 'running', { status: 'paused', waitingOn: 'Paused: stuck · why', nextWakeAt: null, pausedBy: 'stuck' })).toBe(true);
    expect(db.requests[0]?.body).toMatchObject({ status: 'paused', paused_by: 'stuck' });
  });
});

describe('missionStore — a mission\'s milestone retros (PRD 3065)', () => {
  it('reads the roadmaps of the scope with their PRDs, in order', async () => {
    const db = recordingFetch([[{ id: 'rm-1', number: 2790 }], [{ roadmap_id: 'rm-1', position: 1, row_id: 'a', prd: 7, blockers: [] }, { roadmap_id: 'rm-1', position: 2, row_id: 'b', prd: null, blockers: [] }]]);
    expect(await retrosOn(db.fetch).milestones(mission)).toEqual([{ roadmap: 2790, prds: [7] }]);
  });

  it('reads its retro jobs, each with its milestone, and the rows kept', async () => {
    const db = recordingFetch([[jobRow({ mission_key: `mission:${ID}:retro:2790`, line: '/omni:mission-retro --mission 12 --milestone 2790' })], [], [{ id: 'r-1', milestone: '2790', job_id: 'job-2', skipped: null, file: 'retros/1-roadmap-2790.md' }]]);
    expect(await retrosOn(db.fetch).retros(ID)).toEqual({
      jobs: [{ milestone: '2790', job: 'job-2', attempts: [expect.objectContaining({ id: 'job-2' })] }],
      rows: [{ id: 'r-1', milestone: '2790', job: 'job-2', skipped: null, file: 'retros/1-roadmap-2790.md' }],
    });
    expect(db.requests[0]?.query.get('mission_key')).toBe(`like.mission:${ID}:retro:%`);
    expect(db.requests[2]?.path).toBe('/rest/v1/mission_retros');
  });

  it('queues a milestone retro under its key', async () => {
    const db = recordingFetch([[{ id: 'job-9' }]]);
    expect(await retrosOn(db.fetch).retro({ mission, milestone: 'mission', toFleet: false })).toBe('job-9');
    expect(db.requests[0]?.body).toMatchObject({ line: '/omni:mission-retro --mission 12 --milestone mission', mission_key: `mission:${ID}:retro:mission`, to_fleet: null });
  });

  it('keeps a retro once per milestone, written or skipped, and each item once', async () => {
    const retro = { wentWell: [{ text: 'It went.', cites: [{ kind: 'prd' as const, ref: 7 }] }], toChange: [{ text: 'Change it.', cites: [{ kind: 'pr' as const, ref: 9 }] }] };
    const db = recordingFetch([[{ id: 'r-1' }], taken(), [{ id: 'r-2' }]]);
    const retros = retrosOn(db.fetch);
    expect(await retros.keepRetro(mission, { milestone: '2790', job: 'job-2', retro, file: 'retros/1-roadmap-2790.md' })).toBe('r-1');
    expect(db.requests[0]?.body).toEqual({ mission_id: ID, milestone: '2790', job_id: 'job-2', retro, file: 'retros/1-roadmap-2790.md' });
    expect(await retros.keepRetro(mission, { milestone: '2790', job: 'job-2', retro, file: null })).toBeNull();
    expect(await retros.keepRetro(mission, { milestone: 'mission', job: null, skipped: 'budget reached' })).toBe('r-2');
    expect(db.requests[2]?.body).toEqual({ mission_id: ID, milestone: 'mission', job_id: null, skipped: 'budget reached' });
    const items = recordingFetch([[{ id: 'i-1' }], taken()]);
    const item = (number: number) => ({ number, target: 'law BR-PRODUCT-12', wording: 'Say it.', evidence: ['It was said.'] });
    expect(await retrosOn(items.fetch).keepItems(mission, 'r-1', [item(1), item(2)])).toEqual([1]);
    expect(items.requests[0]?.body).toEqual({ mission_id: ID, retro_id: 'r-1', number: 1, target: 'law BR-PRODUCT-12', wording: 'Say it.', evidence: ['It was said.'] });
  });
});
