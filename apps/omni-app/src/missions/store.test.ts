import { describe, expect, it } from 'vitest';
import { assertDefined } from 'omni-loop/kit/test/assert.ts';
import { parseIssue, parsePrd } from 'omni-loop/kit/lib/ids.ts';
import { missionStore, type MissionRecord } from './store.ts';

const ID = '0b7c1f6e-3a52-4d8e-9f10-2c4b6a8d0e11';

type Recorded = { method: string; path: string; query: URLSearchParams; body: unknown };

/** A fetch that records each request to the database and answers with the next of `answers`. */
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

function nth<T>(list: readonly T[], index: number): T {
  const item = list[index];
  assertDefined(item, `request ${String(index)}`);
  return item;
}

const storeOn = (fetch: typeof globalThis.fetch) => missionStore({ url: 'https://db.example', key: 'service-key', fetch });

const mission: MissionRecord = {
  id: ID,
  workspace: 'ws-1',
  repo: 'acme/widgets',
  fleet: 'night-shift',
  status: 'running',
  waitingOn: null,
  parallel: 2,
  scope: { prds: [parsePrd(7)], roadmaps: [parseIssue(40)] },
};

const PLAN = ['| id | slice | territory | blocked by | wave |', '| --- | --- | --- | --- | --- |', '| s1 | a | `apps/a/` | — | 1 |'].join('\n');

describe('missionStore — the mission as the service role, never calling Supabase (PRD 2842 s4)', () => {
  it('reads the mission row as the supervisor sees it', async () => {
    const db = recordingFetch([[{ id: ID, workspace_id: 'ws-1', repo: 'acme/widgets', fleet: 'night-shift', status: 'running', waiting_on: null, mandate: { parallel: 3 }, scope: { prds: [7], roadmaps: [] } }]]);
    expect(await storeOn(db.fetch).mission(ID)).toEqual({ ...mission, parallel: 3, scope: { prds: [7], roadmaps: [] } });
    expect(nth(db.requests, 0).query.get('id')).toBe(`eq.${ID}`);
    expect(await storeOn(recordingFetch([[]]).fetch).mission(ID)).toBeNull();
  });

  it('reads each PRD of its scope inside its workspace and repository: roadmaps, stages, approval, voids and plan', async () => {
    const db = recordingFetch([
      [{ id: 'rm-1', number: 40 }],
      [
        { roadmap_id: 'rm-1', position: 1, row_id: 'P1', prd: 8, blockers: [] },
        { roadmap_id: 'rm-1', position: 2, row_id: 'P2', prd: 9, blockers: ['P1'] },
      ],
      [{ prd: 7, stage: 'inbox' }, { prd: 8, stage: 'building' }, { prd: 8, stage: 'outbox' }, { prd: 9, stage: 'shipped' }],
      [{ id: 'd-7', prd: 7 }, { id: 'd-8', prd: 8 }],
      [{ id: 'a-7b', dossier_id: 'd-7' }, { id: 'a-7a', dossier_id: 'd-7' }, { id: 'a-8', dossier_id: 'd-8' }],
      [{ approval_id: 'a-8' }],
      [{ content: PLAN }],
      [],
    ]);
    expect(await storeOn(db.fetch).facts(mission)).toEqual([
      { prd: 7, approval: 'standing', stage: 'open', blockers: [], territory: ['apps/a/'] },
      { prd: 8, approval: 'voided', stage: 'ready', blockers: [], territory: null },
      { prd: 9, approval: 'none', stage: 'merged', blockers: [8], territory: null },
    ]);
    const [roadmaps, , stages, pages, approvals, voids, plan] = db.requests;
    expect([roadmaps?.path, roadmaps?.query.get('workspace_id'), roadmaps?.query.get('repo'), roadmaps?.query.get('number')]).toEqual(['/rest/v1/roadmaps', 'eq.ws-1', 'eq.acme/widgets', 'in.(40)']);
    expect([stages?.query.get('workspace_id'), stages?.query.get('repository'), stages?.query.get('prd')]).toEqual(['eq.ws-1', 'eq.acme/widgets', 'in.(7,8,9)']);
    expect([pages?.query.get('workspace_id'), pages?.query.get('home_repo'), pages?.query.get('kind')]).toEqual(['eq.ws-1', 'eq.acme/widgets', 'eq.prd']);
    expect(approvals?.query.get('approval_kind')).toBe('eq.product');
    expect(voids?.query.get('approval_id')).toBe('in.(a-7b,a-8)');
    expect([plan?.path, plan?.query.get('dossier_id'), plan?.query.get('kind')]).toEqual(['/rest/v1/dossier_versions', 'eq.d-7', 'eq.plan']);
  });

  it('reads the jobs it sent, each with the resumes that carry it, by its key\'s PRD and run', async () => {
    const job = (id: string, over: Record<string, unknown> = {}) => ({ id, mission_key: null, resumes: null, status: 'queued', outcome: null, reason: null, pr_url: null, ...over });
    const db = recordingFetch([
      [job('j-1', { mission_key: `mission:${ID}:prd:7:run:1`, status: 'failed', reason: 'runner lost' }), job('j-2', { mission_key: `mission:${ID}:prd:8:run:2`, status: 'done', outcome: 'ready' })],
      [job('j-1b', { resumes: 'j-1', status: 'failed', reason: 'runner lost' })],
      [job('j-1c', { resumes: 'j-1b', status: 'running' })],
    ]);
    const runs = await storeOn(db.fetch).runs(ID);
    expect(runs.map(({ prd, run, step, job: id, attempts }) => [prd, run, step, id, attempts.map((one) => `${one.id}:${one.status}`)])).toEqual([
      [7, 1, 'build', 'j-1', ['j-1:failed', 'j-1b:failed', 'j-1c:running']],
      [8, 2, 'build', 'j-2', ['j-2:done']],
    ]);
    expect(nth(db.requests, 0).query.get('mission_id')).toBe(`eq.${ID}`);
    expect(nth(db.requests, 1).query.get('resumes')).toBe('in.(j-1,j-2)');
    expect(nth(db.requests, 2).query.get('resumes')).toBe('in.(j-1b)');
    expect(db.requests).toHaveLength(3);
  });

  it('reads a Reviewer job\'s step from its key, and what it posted from its log\'s posted line alone (PRD 2871)', async () => {
    const job = (id: string, over: Record<string, unknown> = {}) => ({ id, mission_key: null, resumes: null, status: 'done', outcome: null, reason: null, pr_url: null, ...over });
    const REVIEW = 'https://github.com/acme/widgets/pull/12#pullrequestreview-99';
    const db = recordingFetch([
      [
        job('j-1', { mission_key: `mission:${ID}:prd:7:run:1`, outcome: 'review' }),
        job('j-2', { mission_key: `mission:${ID}:prd:7:run:1:review:1`, outcome: 'changes' }),
        job('j-3', { mission_key: `mission:${ID}:prd:7:run:1:fix:1`, status: 'running' }),
      ],
      [],
      [{ id: 'j-2', log_tail: `thinking\nomni review: posted round 1 (changes, 2 findings) on PR #12: ${REVIEW}\n/omni:yolo-fix 7 --for-review` }],
    ]);
    const runs = await storeOn(db.fetch).runs(ID);
    expect(runs.map(({ run, step, job: id, attempts }) => [run, step, id, attempts.map((one) => one.posted ?? null)])).toEqual([
      [1, 'build', 'j-1', [null]],
      [1, 'review:1', 'j-2', [{ findings: 2, url: REVIEW }]],
      [1, 'fix:1', 'j-3', [null]],
    ]);
    const logs = nth(db.requests, 2);
    expect([logs.path, logs.query.get('select'), logs.query.get('id')]).toEqual(['/rest/v1/runner_jobs', 'id,log_tail', 'in.(j-2)']);
  });

  it('sends the build for review as the app, to the fleet or to any runner, and answers null for a key already held', async () => {
    const db = recordingFetch([[{ id: 'j-9' }], new Response(JSON.stringify({ message: 'duplicate key', code: '23505' }), { status: 409, headers: { 'content-type': 'application/json' } })]);
    const store = storeOn(db.fetch);
    expect(await store.send({ mission, prd: parsePrd(7), run: 1, step: 'build', toFleet: true })).toBe('j-9');
    expect(nth(db.requests, 0).body).toEqual({
      workspace_id: 'ws-1',
      repo: 'acme/widgets',
      line: '/omni:yolo 7 --for-review',
      sent_by_app: 'omni-app',
      to_fleet: 'night-shift',
      mission_id: ID,
      mission_key: `mission:${ID}:prd:7:run:1`,
    });
    expect(await store.send({ mission, prd: parsePrd(7), run: 1, step: 'build', toFleet: false })).toBeNull();
    expect(nth(db.requests, 1).body).toMatchObject({ to_fleet: null });
  });

  it('sends the Reviewer and the fix under their own keys (PRD 2871)', async () => {
    const db = recordingFetch([[{ id: 'j-10' }], [{ id: 'j-11' }], [{ id: 'j-12' }]]);
    const store = storeOn(db.fetch);
    await store.send({ mission, prd: parsePrd(7), run: 1, step: 'review:1', toFleet: true });
    await store.send({ mission, prd: parsePrd(7), run: 1, step: 'fix:1', toFleet: true });
    await store.send({ mission, prd: parsePrd(7), run: 2, step: 'review:2', toFleet: true });
    expect(db.requests.map(({ body }) => body)).toMatchObject([
      { line: '/omni:review 7', mission_key: `mission:${ID}:prd:7:run:1:review:1` },
      { line: '/omni:yolo-fix 7 --for-review', mission_key: `mission:${ID}:prd:7:run:1:fix:1` },
      { line: '/omni:review 7', mission_key: `mission:${ID}:prd:7:run:2:review:2` },
    ]);
  });

  it('finds a runner of the fleet only when it holds the repository', async () => {
    expect(await storeOn(recordingFetch([[{ repos: ['Acme/Widgets'] }]]).fetch).fleetRunners(mission)).toBe(true);
    expect(await storeOn(recordingFetch([[{ repos: ['acme/other'] }]]).fetch).fleetRunners(mission)).toBe(false);
  });

  it('records events signed agent, a millisecond apart, and nothing for none', async () => {
    const db = recordingFetch([[{ id: 'e-1' }, { id: 'e-2' }]]);
    const store = storeOn(db.fetch);
    const at = new Date('2027-01-22T09:00:00Z');
    await store.record(ID, [
      { kind: 'dispatched', role: 'supervisor', prd: parsePrd(7), job: 'j-1', link: null, sentence: 'Sent.' },
      { kind: 'waits', role: 'supervisor', prd: null, job: null, link: null, sentence: 'Waits.' },
    ], at);
    expect(nth(db.requests, 0).body).toEqual([
      { mission_id: ID, at: '2027-01-22T09:00:00.000Z', role: 'supervisor', actor: 'agent', kind: 'dispatched', prd: 7, job_id: 'j-1', link: null, sentence: 'Sent.' },
      { mission_id: ID, at: '2027-01-22T09:00:00.001Z', role: 'supervisor', actor: 'agent', kind: 'waits', prd: null, job_id: null, link: null, sentence: 'Waits.' },
    ]);
    const none = recordingFetch();
    await storeOn(none.fetch).record(ID, [], at);
    expect(none.requests).toEqual([]);
  });

  it('moves the mission only while its status is still the one the run read', async () => {
    const db = recordingFetch([[{ id: ID }], []]);
    const store = storeOn(db.fetch);
    const next = { status: 'waiting' as const, waitingOn: 'PRD 7: merge it', nextWakeAt: '2027-01-22T09:01:00.000Z' };
    expect(await store.update(ID, 'running', next)).toBe(true);
    expect(nth(db.requests, 0).query.get('status')).toBe('eq.running');
    expect(nth(db.requests, 0).body).toMatchObject({ status: 'waiting', waiting_on: 'PRD 7: merge it', next_wake_at: '2027-01-22T09:01:00.000Z' });
    expect(await store.update(ID, 'running', next)).toBe(false);
  });
});
