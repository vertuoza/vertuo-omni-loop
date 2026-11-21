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
  number: parseIssue(12),
  title: 'Faster quotes',
  level: 'with-you',
  status: 'running',
  waitingOn: null,
  parallel: 2,
  scope: { prds: [parsePrd(7)], roadmaps: [parseIssue(40)] },
};

const PLAN = ['| id | slice | territory | blocked by | wave |', '| --- | --- | --- | --- | --- |', '| s1 | a | `apps/a/` | — | 1 |'].join('\n');

describe('missionStore — the mission as the service role, never calling Supabase (PRD 2842 s4)', () => {
  it('reads the level of the mandate, with-you when it names none (PRD 2896)', async () => {
    const row = { id: ID, workspace_id: 'ws-1', repo: 'acme/widgets', fleet: 'night-shift', number: 12, title: 'Faster quotes', status: 'running', waiting_on: null, scope: { prds: [7], roadmaps: [] } };
    expect((await storeOn(recordingFetch([[{ ...row, mandate: { parallel: 2, level: 'own-branch' } }]]).fetch).mission(ID))?.level).toBe('own-branch');
    expect((await storeOn(recordingFetch([[{ ...row, mandate: { parallel: 2 } }]]).fetch).mission(ID))?.level).toBe('with-you');
  });

  it('reads the mission row as the supervisor sees it', async () => {
    const db = recordingFetch([[{ id: ID, workspace_id: 'ws-1', repo: 'acme/widgets', fleet: 'night-shift', number: 12, title: 'Faster quotes', status: 'running', waiting_on: null, mandate: { parallel: 3 }, scope: { prds: [7], roadmaps: [] } }]]);
    // A brief with no hard-to-revert bound, no cap on the fleet's own PRDs and no resumes reads their defaults (PRD 2896 s10, s12; PRD omni-loop-21).
    expect(await storeOn(db.fetch).mission(ID)).toEqual({ ...mission, parallel: 3, scope: { prds: [7], roadmaps: [] }, hardToRevert: 0.6, ownPrds: 0, resumes: 3 });
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
      [{ id: 'a-7b', dossier_id: 'd-7', mission_id: null, approved_at: '2027-01-22T08:00:00Z' }, { id: 'a-7a', dossier_id: 'd-7', mission_id: null, approved_at: '2027-01-22T08:00:00Z' }, { id: 'a-8', dossier_id: 'd-8', mission_id: null, approved_at: '2027-01-22T08:00:00Z' }],
      [{ approval_id: 'a-8' }],
      [{ content: PLAN }],
      [],
    ]);
    expect(await storeOn(db.fetch).facts(mission)).toEqual([
      // Each PRD's page, which the mission pull request links (PRD 2896 s6): none for a PRD with no dossier.
      { prd: 7, approval: 'standing', stage: 'open', blockers: [], territory: ['apps/a/'], page: 'd-7' },
      { prd: 8, approval: 'voided', stage: 'ready', blockers: [], territory: null, page: 'd-8' },
      { prd: 9, approval: 'none', stage: 'merged', blockers: [8], territory: null, page: null },
    ]);
    const [roadmaps, , stages, pages, approvals, voids, plan] = db.requests;
    expect([roadmaps?.path, roadmaps?.query.get('workspace_id'), roadmaps?.query.get('repo'), roadmaps?.query.get('number')]).toEqual(['/rest/v1/roadmaps', 'eq.ws-1', 'eq.acme/widgets', 'in.(40)']);
    expect([stages?.query.get('workspace_id'), stages?.query.get('repository'), stages?.query.get('prd')]).toEqual(['eq.ws-1', 'eq.acme/widgets', 'in.(7,8,9)']);
    expect([pages?.query.get('workspace_id'), pages?.query.get('home_repo'), pages?.query.get('kind')]).toEqual(['eq.ws-1', 'eq.acme/widgets', 'eq.prd']);
    expect(approvals?.query.get('approval_kind')).toBe('eq.product');
    expect(voids?.query.get('approval_id')).toBe('in.(a-7b,a-8)');
    expect([plan?.path, plan?.query.get('dossier_id'), plan?.query.get('kind')]).toEqual(['/rest/v1/dossier_versions', 'eq.d-7', 'eq.plan']);
  });

  it('reads a fleet\'s approval given in another mission as none, and one given in this mission as standing (PRD 2896 s9)', async () => {
    const db = recordingFetch([
      [{ prd: 7, stage: 'inbox' }, { prd: 8, stage: 'inbox' }],
      [{ id: 'd-7', prd: 7 }, { id: 'd-8', prd: 8 }],
      [{ id: 'a-7f', dossier_id: 'd-7', mission_id: 'other-mission', approved_at: '2027-01-22T08:00:00Z' }, { id: 'a-7p', dossier_id: 'd-7', mission_id: null, approved_at: '2027-01-22T08:00:00Z' }, { id: 'a-8f', dossier_id: 'd-8', mission_id: ID, approved_at: '2027-01-22T08:00:00Z' }],
      [],
    ]);
    const read = await storeOn(db.fetch).facts({ ...mission, scope: { prds: [parsePrd(7), parsePrd(8)], roadmaps: [] } });
    expect(read.map(({ prd, approval }) => [prd, approval])).toEqual([[7, 'none'], [8, 'standing']]);
    expect(nth(db.requests, 2).query.get('select')).toBe('id,dossier_id,mission_id,approved_at');
    expect(nth(db.requests, 3).query.get('approval_id')).toBe('in.(a-8f)');
  });

  it('reads the fleet\'s approval as overturned once a person overturned it after it was given, and as standing when it was given again since (PRD 2896 s11)', async () => {
    const run = async (overturnedAt: string) => {
      const db = recordingFetch([
        [{ prd: 8, stage: 'inbox' }],
        [{ id: 'd-8', prd: 8 }],
        [{ id: 'a-8f', dossier_id: 'd-8', mission_id: ID, approved_at: '2027-01-22T08:00:00Z' }],
        [],
        [{ prd: 8, at: overturnedAt }],
      ]);
      const read = await storeOn(db.fetch).facts({ ...mission, scope: { prds: [parsePrd(8)], roadmaps: [] } });
      return { approval: read[0]?.approval, asked: nth(db.requests, 4) };
    };
    const after = await run('2027-01-22T09:00:00Z');
    expect(after.approval).toBe('overturned');
    expect([after.asked.query.get('mission_id'), after.asked.query.get('kind')]).toEqual([`eq.${ID}`, 'eq.overturned']);
    expect((await run('2027-01-22T07:00:00Z')).approval).toBe('standing');
  });

  it('reads the fleet\'s decisions and the overturns of them, oldest first (PRD 2896 s11)', async () => {
    const db = recordingFetch([[{ kind: 'decided', prd: 7, sentence: 'The committee approved PRD 7: pm yes.', link: null, actor: 'agent' }]]);
    expect(await storeOn(db.fetch).fleetEvents(ID)).toEqual([{ kind: 'decided', prd: 7, sentence: 'The committee approved PRD 7: pm yes.', link: null, actor: 'agent' }]);
    expect(nth(db.requests, 0).query.get('kind')).toBe('in.(decided,overturned)');
  });

  it('reads the committees it sent by their keys, each with the decision recorded for it (PRD 2896 s9)', async () => {
    const job = (id: string, key: string, over: Record<string, unknown> = {}) => ({ id, mission_key: key, resumes: null, status: 'done', outcome: null, reason: null, pr_url: null, ...over });
    const db = recordingFetch([
      [job('c-1', `mission:${ID}:prd:7:approve:1`), job('c-2', `mission:${ID}:prd:7:approve:2`, { status: 'running' }), job('j-1', `mission:${ID}:prd:7:run:1`)],
      [{ job_id: 'c-1', outcome: 'escalated', why: ['the Reviewer answered no: Out of scope.'] }],
    ]);
    const committees = await storeOn(db.fetch).committees(ID);
    expect(committees.map(({ prd, round, job: id, attempt, decision }) => [prd, round, id, attempt.status, decision?.outcome ?? null])).toEqual([
      [7, 1, 'c-1', 'done', 'escalated'],
      [7, 2, 'c-2', 'running', null],
    ]);
    expect(nth(db.requests, 0).query.get('mission_key')).toBe(`like.mission:${ID}:prd:%:approve:%`);
    expect([nth(db.requests, 1).path, nth(db.requests, 1).query.get('mission_id')]).toEqual(['/rest/v1/mission_decisions', `eq.${ID}`]);
    expect(await storeOn(recordingFetch([[]]).fetch).committees(ID)).toEqual([]);
  });

  it('records a committee\'s decision through mission_decide_approval(), as the service, and queues a committee under its key (PRD 2896 s9)', async () => {
    const db = recordingFetch([{ decision: 'd-1', outcome: 'carried', why: [], approval: 'a-1' }, [{ id: 'c-9' }]]);
    const store = storeOn(db.fetch);
    const one = { prd: parsePrd(7), round: 1, job: 'c-1', attempt: { id: 'c-1', status: 'done' as const, outcome: null, reason: null, prUrl: null }, decision: null };
    const record = { author: null, read: [{ kind: 'spec', sha256: 'a'.repeat(64) }], verdicts: [{ role: 'pm' as const, answer: 'yes' as const, sentence: 'In scope.' }] };
    expect(await store.decide({ ...mission, level: 'alone' }, one, { record, decision: { outcome: 'carried', why: [] } })).toEqual({ outcome: 'carried', why: [] });
    expect([nth(db.requests, 0).method, nth(db.requests, 0).path]).toEqual(['POST', '/rest/v1/rpc/mission_decide_approval']);
    expect(nth(db.requests, 0).body).toEqual({ p_mission: ID, p_prd: 7, p_job: 'c-1', p_record: record, p_outcome: 'carried', p_why: [] });
    expect(await store.approve({ mission, prd: parsePrd(7), round: 2, toFleet: true })).toBe('c-9');
    expect(nth(db.requests, 1).body).toMatchObject({ line: '/omni:committee 7 --approve', sent_by_app: 'omni-app', to_fleet: 'night-shift', mission_id: ID, mission_key: `mission:${ID}:prd:7:approve:2` });
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
    // The chain is followed until no resume is left to read.
    expect(db.requests).toHaveLength(4);
  });

  it('follows the whole chain of a limited job: three tries and six waits, with the reset and whether it was guessed (PRD 2949)', async () => {
    const job = (id: string, over: Record<string, unknown> = {}) => ({ id, mission_key: null, resumes: null, status: 'failed', outcome: null, reason: null, pr_url: null, limited_until: null, parts: null, ...over });
    const chain = Array.from({ length: 9 }, (_, n) => [job(`w-${String(n + 1)}`, { resumes: n === 0 ? 'j-1' : `w-${String(n)}`, status: n === 8 ? 'queued' : 'failed', limited_until: n === 8 ? null : '2027-01-23T09:00:00Z', parts: n === 7 ? [{ guessed: true }] : null })]);
    const db = recordingFetch([[job('j-1', { mission_key: `mission:${ID}:prd:7:run:1`, limited_until: '2027-01-23T02:00:00Z', parts: [{ agent: 'claude', guessed: false }] })], ...chain]);
    const [one] = await storeOn(db.fetch).runs(ID);
    expect(one?.attempts).toHaveLength(10);
    expect(one?.attempts[0]).toMatchObject({ limitedUntil: '2027-01-23T02:00:00Z', guessed: false });
    expect(one?.attempts[8]).toMatchObject({ limitedUntil: '2027-01-23T09:00:00Z', guessed: true });
    expect(one?.attempts[9]).toMatchObject({ status: 'queued' });
    expect(one?.attempts[9]).not.toHaveProperty('limitedUntil');
  });

  it('reads the runners a job goes to with their slots in use: a fleet\'s, else the ones with no fleet (PRD 2949)', async () => {
    const runner = { id: 'r-1', repos: ['acme/widgets'], slots: 2, last_seen_at: '2027-01-22T09:00:00Z', health: { at: '2027-01-22T09:00:00Z', accounts: [{ state: 'out', resetsAt: '2027-01-22T11:00:00Z' }] } };
    const db = recordingFetch([[runner], [{ runner_id: 'r-1' }, { runner_id: 'r-1' }, { runner_id: null }]]);
    const [seen] = await storeOn(db.fetch).room(mission, true);
    expect(seen).toMatchObject({ repos: ['acme/widgets'], slots: 2, used: 2, lastSeenAt: '2027-01-22T09:00:00Z' });
    expect(nth(db.requests, 0).query.get('fleet')).toBe(`eq.${mission.fleet}`);
    expect(nth(db.requests, 1).query.get('status')).toBe('in.(claimed,running)');
    const none = recordingFetch([[]]);
    expect(await storeOn(none.fetch).room(mission, false)).toEqual([]);
    expect(nth(none.requests, 0).query.get('fleet')).toBe('is.null');
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
    expect(await store.send({ mission, prd: parsePrd(7), run: 1, step: 'build', toFleet: true, skill: 'yolo' })).toBe('j-9');
    expect(nth(db.requests, 0).body).toEqual({
      workspace_id: 'ws-1',
      repo: 'acme/widgets',
      line: '/omni:yolo 7 --for-review',
      sent_by_app: 'omni-app',
      to_fleet: 'night-shift',
      mission_id: ID,
      mission_key: `mission:${ID}:prd:7:run:1`,
    });
    expect(await store.send({ mission, prd: parsePrd(7), run: 1, step: 'build', toFleet: false, skill: 'yolo' })).toBeNull();
    expect(nth(db.requests, 1).body).toMatchObject({ to_fleet: null });
  });

  it('sends a feature branch\'s care job as the app with no mission key, once per head of the mission branch (PRD 2896 s5)', async () => {
    const line = '/omni:pr-care 7 --once --base mission/12-faster-quotes';
    const since = '2027-01-22T09:00:00Z';
    const db = recordingFetch([[], [{ id: 'j-4' }], [{ id: 'j-4' }]]);
    const store = storeOn(db.fetch);
    expect(await store.care({ mission, line, since, toFleet: true })).toBe('j-4');
    const read = nth(db.requests, 0);
    expect(read.path).toBe('/rest/v1/runner_jobs');
    expect(read.query.get('mission_id')).toBe(`eq.${ID}`);
    expect(read.query.get('line')).toBe(`eq.${line}`);
    expect(read.query.get('queued_at')).toBe(`gte.${since}`);
    expect(nth(db.requests, 1).body).toEqual({ workspace_id: 'ws-1', repo: 'acme/widgets', line, sent_by_app: 'omni-app', to_fleet: 'night-shift', mission_id: ID, mission_key: null });
    // One already queued since then: nothing is inserted.
    expect(await store.care({ mission, line, since, toFleet: false })).toBeNull();
    expect(db.requests).toHaveLength(3);
  });

  it('sends an item\'s committee as the app with no mission key, once per item whatever its bound (PRD 2896 s10)', async () => {
    const db = recordingFetch([[], [{ id: 'j-5' }], [{ id: 'j-5' }]]);
    const store = storeOn(db.fetch);
    expect(await store.ask({ mission: { ...mission, hardToRevert: 0.4 }, prd: parsePrd(7), item: 's3-01-keep-the-cap', toFleet: true })).toBe('j-5');
    const read = nth(db.requests, 0);
    expect(read.query.get('mission_id')).toBe(`eq.${ID}`);
    expect(read.query.get('mission_key')).toBe('is.null');
    expect(read.query.get('line')).toBe('like./omni:committee 7 --item s3-01-keep-the-cap%');
    expect(nth(db.requests, 1).body).toEqual({ workspace_id: 'ws-1', repo: 'acme/widgets', line: '/omni:committee 7 --item s3-01-keep-the-cap --bound 0.4', sent_by_app: 'omni-app', to_fleet: 'night-shift', mission_id: ID, mission_key: null });
    expect(await store.ask({ mission, prd: parsePrd(7), item: 's3-01-keep-the-cap', toFleet: false })).toBeNull();
    expect(db.requests).toHaveLength(3);
  });

  it('reads the item committees back by their line, leaving out any other job (PRD 2896 s10)', async () => {
    const row = (id: string, line: string) => ({ id, mission_key: null, resumes: null, status: 'done', outcome: null, reason: null, pr_url: null, line });
    const db = recordingFetch([[row('j-5', '/omni:committee 7 --item s3-01-keep-the-cap --bound 0.6'), row('j-6', '/omni:committee 7 --item Not An Id')]]);
    expect(await storeOn(db.fetch).asks(ID)).toEqual([
      { prd: parsePrd(7), item: 's3-01-keep-the-cap', job: 'j-5', attempt: { id: 'j-5', status: 'done', outcome: null, reason: null, prUrl: null } },
    ]);
    expect(nth(db.requests, 0).query.get('line')).toBe('like./omni:committee % --item %');
  });

  it('sends the build and the fix on the mission branch above with-you, never the Reviewer (PRD 2896)', async () => {
    const db = recordingFetch([[{ id: 'j-1' }], [{ id: 'j-2' }], [{ id: 'j-3' }]]);
    const store = storeOn(db.fetch);
    const own: MissionRecord = { ...mission, level: 'own-branch', title: 'Faster quotes, now!' };
    for (const step of ['build', 'fix:1', 'review:1'] as const) await store.send({ mission: own, prd: parsePrd(7), run: 1, step, toFleet: true, skill: 'yolo' });
    expect(db.requests.map(({ body }) => (body as { line: string }).line)).toEqual([
      '/omni:yolo 7 --for-review --base mission/12-faster-quotes-now',
      '/omni:yolo-fix 7 --for-review --base mission/12-faster-quotes-now',
      '/omni:review 7',
    ]);
  });

  it('adds no base to a PRD of a plan repository, whatever the level (PRD 2896)', async () => {
    const db = recordingFetch([[{ id: 'j-1' }]]);
    await storeOn(db.fetch).send({ mission: { ...mission, level: 'alone' }, prd: parsePrd(7), run: 1, step: 'build', toFleet: false, skill: 'ultra-yolo' });
    expect(nth(db.requests, 0).body).toMatchObject({ line: '/omni:ultra-yolo 7' });
  });

  it('reads the installation of the mission\'s workspace, null when it has none (PRD 2896)', async () => {
    const db = recordingFetch([[{ github_installation_id: 4242 }]]);
    expect(await storeOn(db.fetch).installation(mission)).toBe(4242);
    expect(nth(db.requests, 0).query.get('id')).toBe('eq.ws-1');
    expect(await storeOn(recordingFetch([[{ github_installation_id: null }]]).fetch).installation(mission)).toBeNull();
    expect(await storeOn(recordingFetch([[]]).fetch).installation(mission)).toBeNull();
  });

  it('sends the Reviewer and the fix under their own keys (PRD 2871)', async () => {
    const db = recordingFetch([[{ id: 'j-10' }], [{ id: 'j-11' }], [{ id: 'j-12' }]]);
    const store = storeOn(db.fetch);
    await store.send({ mission, prd: parsePrd(7), run: 1, step: 'review:1', toFleet: true, skill: 'yolo' });
    await store.send({ mission, prd: parsePrd(7), run: 1, step: 'fix:1', toFleet: true, skill: 'yolo' });
    await store.send({ mission, prd: parsePrd(7), run: 2, step: 'review:2', toFleet: true, skill: 'yolo' });
    expect(db.requests.map(({ body }) => body)).toMatchObject([
      { line: '/omni:review 7', mission_key: `mission:${ID}:prd:7:run:1:review:1` },
      { line: '/omni:yolo-fix 7 --for-review', mission_key: `mission:${ID}:prd:7:run:1:fix:1` },
      { line: '/omni:review 7', mission_key: `mission:${ID}:prd:7:run:2:review:2` },
    ]);
  });

  it('sends /omni:ultra-yolo for a PRD of a plan repository, which takes no --for-review (PRD 2873)', async () => {
    const db = recordingFetch([[{ id: 'j-10' }]]);
    expect(await storeOn(db.fetch).send({ mission, prd: parsePrd(7), run: 1, step: 'build', toFleet: false, skill: 'ultra-yolo' })).toBe('j-10');
    expect(nth(db.requests, 0).body).toMatchObject({ line: '/omni:ultra-yolo 7', mission_key: `mission:${ID}:prd:7:run:1` });
  });

  it('reads whether the repository is a live product\'s plan repository, case aside', async () => {
    const db = recordingFetch([[{ plan_repository: 'Acme/Widgets' }]]);
    expect(await storeOn(db.fetch).planRepository(mission)).toBe(true);
    expect(nth(db.requests, 0).query.get('workspace_id')).toBe('eq.ws-1');
    expect(nth(db.requests, 0).query.get('archived_at')).toBe('is.null');
    expect(await storeOn(recordingFetch([[{ plan_repository: 'acme/other' }, { plan_repository: null }]]).fetch).planRepository(mission)).toBe(false);
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
