// The mission store's Omni Loop bug team (PRD 3088 s3), as the service role, never calling Supabase: each request recorded, each
// answer handed.
import { describe, expect, it } from 'vitest';
import { parseIssue } from 'omni-loop/kit/lib/ids.ts';
import type { Bug } from './bug-team.ts';
import { missionStore, type MissionRecord } from './store.ts';

const ID = '5d2a9c40-7e1b-4f36-8a20-9b3c1d4e5f60';
const FP = 'd'.repeat(64);
const REPO = 'vertuoza/vertuo-omni-loop';

type Recorded = { method: string; path: string; query: URLSearchParams; body: unknown };

/** A fetch that records each request and answers with the next of `answers`, as JSON. */
function recordingFetch(answers: unknown[] = []) {
  const requests: Recorded[] = [];
  const fetch: typeof globalThis.fetch = (input, init = {}) =>
    new Promise((resolve) => {
      const url = new URL(input instanceof Request ? input.url : String(input));
      const body: unknown = typeof init.body === 'string' ? JSON.parse(init.body) : null;
      requests.push({ method: init.method ?? 'GET', path: url.pathname, query: url.searchParams, body });
      resolve(new Response(JSON.stringify(answers.shift() ?? []), { status: 200, headers: { 'content-type': 'application/json' } }));
    });
  return { fetch, requests };
}

const storeOn = (fetch: typeof globalThis.fetch) => missionStore({ url: 'https://db.example', key: 'service-key', fetch });

const mission: MissionRecord = {
  id: ID,
  workspace: 'ws-omni',
  repo: REPO,
  fleet: 'bug-squad',
  number: parseIssue(40),
  title: 'Fix the Omni Loop bugs missions report',
  level: 'with-you',
  status: 'running',
  waitingOn: null,
  parallel: 2,
  scope: { prds: [], roadmaps: [] },
  kind: 'omni-bugs',
};

const missionRow = { id: ID, workspace_id: 'ws-omni', repo: REPO, fleet: 'bug-squad', number: 40, title: mission.title, status: 'running', waiting_on: null, mandate: { parallel: 2 }, scope: { prds: [], roadmaps: [] }, paused_by: null };
const bugRow = { fingerprint: FP, issue: 3102, count: 7, created_at: '2027-01-20T09:00:00Z', state: 'fixing', attempts: 1, fix_pr: null, fixed_in: null, asked_job: null };
const bug: Bug = { fingerprint: FP, issue: parseIssue(3102), count: 7, createdAt: '2027-01-20T09:00:00Z', state: 'fixing', attempts: 1, fixPr: null, fixedIn: null, askedJob: null };
const jobRow = (over: Record<string, unknown> = {}) => ({ id: 'job-2', mission_key: `mission:${ID}:bug:3102:run:2`, resumes: null, status: 'running', outcome: null, reason: null, pr_url: null, limited_until: null, parts: null, line: '/omni:bug-fix #3102', ...over });

describe('missionStore — the Omni Loop bug team (PRD 3088)', () => {
  it('reads a mission\'s kind, a mission of PRDs when the row says none or prds', async () => {
    const db = recordingFetch([[{ ...missionRow, kind: 'omni-bugs' }], [{ ...missionRow, kind: 'prds' }], [missionRow]]);
    const store = storeOn(db.fetch);
    expect(await store.mission(ID)).toMatchObject({ kind: 'omni-bugs' });
    expect(await store.mission(ID)).not.toHaveProperty('kind');
    expect(await store.mission(ID)).not.toHaveProperty('kind');
    expect(db.requests[0]?.query.get('select')).toContain('kind');
  });

  it('reads the bugs filed on its repository that it may take, run or wait on, oldest first', async () => {
    const db = recordingFetch([[bugRow]]);
    expect(await storeOn(db.fetch).bugTeam?.bugs('Vertuoza/Vertuo-Omni-Loop')).toEqual([bug]);
    const read = db.requests[0];
    expect(read?.path).toBe('/rest/v1/omni_bug_reports');
    expect([read?.query.get('repo'), read?.query.get('state'), read?.query.get('order')]).toEqual([`eq.${REPO}`, 'in.(open,fixing,asked)', 'created_at.asc']);
    expect(read?.query.get('select')).toBe('fingerprint,issue,count,created_at,state,attempts,fix_pr,fixed_in,asked_job');
  });

  it('reads its bug-fix jobs by key, each with its resumes', async () => {
    const db = recordingFetch([[jobRow()], [jobRow({ id: 'job-3', resumes: 'job-2', status: 'queued' })], []]);
    expect(await storeOn(db.fetch).bugTeam?.jobs(ID)).toEqual([{ issue: 3102, k: 2, job: 'job-2', attempts: [expect.objectContaining({ id: 'job-2', status: 'running' }), expect.objectContaining({ id: 'job-3', status: 'queued' })] }]);
    expect(db.requests[0]?.query.get('mission_key')).toBe(`like.mission:${ID}:bug:%`);
  });

  it('queues a bug fix as the app, under its key, its line naming the issue alone (AC-9)', async () => {
    const db = recordingFetch([[{ id: 'job-9' }]]);
    expect(await storeOn(db.fetch).bugTeam?.send({ mission, issue: parseIssue(3102), k: 3, toFleet: true })).toBe('job-9');
    expect(db.requests[0]?.body).toEqual({ workspace_id: 'ws-omni', repo: REPO, line: '/omni:bug-fix #3102', sent_by_app: 'omni-app', to_fleet: 'bug-squad', mission_id: ID, mission_key: `mission:${ID}:bug:3102:run:3` });
  });

  it('moves a bug only while it holds the state and tries the run read', async () => {
    const db = recordingFetch([[{ fingerprint: FP }], []]);
    const store = storeOn(db.fetch);
    expect(await store.bugTeam?.move(bug, { state: 'asked', attempts: 1, fixPr: null, askedJob: 'job-2' })).toBe(true);
    expect(await store.bugTeam?.move(bug, { state: 'open', attempts: 2, fixPr: null, askedJob: null })).toBe(false);
    const moved = db.requests[0];
    expect(moved?.method).toBe('PATCH');
    expect(moved?.body).toMatchObject({ state: 'asked', attempts: 1, fix_pr: null, asked_job: 'job-2' });
    expect([moved?.query.get('fingerprint'), moved?.query.get('state'), moved?.query.get('attempts')]).toEqual([`eq.${FP}`, 'eq.fixing', 'eq.1']);
  });
});
