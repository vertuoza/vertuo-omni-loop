// The mission store at `alone` for a product roadmap (PRD omni-loop-21 s3), as the service role, never calling Supabase: a
// scope of product ids, the mandate's resumes, a mission's branch per repository, a step's resumes, and the committee's
// deferred verdict with its option. Each request recorded, each answer handed.
import { describe, expect, it } from 'vitest';
import { parseIssue, parsePrd, parseProductPrdId, parseProductRoadmapId } from 'omni-loop/kit/lib/ids.ts';
import { missionStore, resumeKey, resumeOfKey, type MissionRecord } from './store.ts';
import { fakeMissionStore } from './store.fake.ts';

const ID = '0b7c1f6e-3a52-4d8e-9f10-2c4b6a8d0e11';

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

const taken = () => new Response(JSON.stringify({ code: '23505', message: 'duplicate key value', details: null, hint: null }), { status: 409, headers: { 'content-type': 'application/json' } });

const mission: MissionRecord = {
  id: ID,
  workspace: 'ws-1',
  repo: 'acme/widgets',
  fleet: 'night-shift',
  number: parseIssue(21),
  title: 'Alone',
  level: 'alone',
  status: 'running',
  waitingOn: null,
  parallel: 2,
  scope: { prds: [parsePrd(2896)], roadmaps: [] },
};

const row = { id: ID, workspace_id: 'ws-1', repo: 'acme/widgets', fleet: 'night-shift', number: 21, title: 'Alone', status: 'running', waiting_on: null };
const job = (over: Record<string, unknown>) => ({ id: 'job-1', mission_key: `mission:${ID}:prd:7:run:1`, resumes: null, status: 'done', outcome: null, reason: null, pr_url: null, limited_until: null, parts: null, ...over });
const verdicts = [{ role: 'pm' as const, answer: 'yes' as const, sentence: 'In scope.' }, { role: 'architect' as const, answer: 'no' as const, sentence: 'Too wide.' }];

describe('missionStore at alone, for a product roadmap (PRD omni-loop-21 s3)', () => {
  it('reads a scope of product ids beside repository numbers, the numbers as the supervisor reads them and the products apart', async () => {
    const db = recordingFetch([[{ ...row, mandate: { parallel: 2, level: 'alone' }, scope: { prds: [2896, 'omni-loop-15'], roadmaps: ['omni-loop-R3', 40] } }]]);
    const read = await storeOn(db.fetch).mission(ID);
    expect(read?.scope).toEqual({ prds: [2896], roadmaps: [40] });
    expect(read?.products).toEqual({ prds: [parseProductPrdId('omni-loop-15')], roadmaps: [parseProductRoadmapId('omni-loop-R3')] });
    // A scope of a repository's numbers only reads no products, as before.
    const only = await storeOn(recordingFetch([[{ ...row, mandate: { parallel: 2 }, scope: { prds: [7], roadmaps: [] } }]]).fetch).mission(ID);
    expect(only).not.toHaveProperty('products');
  });

  it('reads the mandate\'s resumes, 3 when it names none', async () => {
    const at = (mandate: Record<string, unknown>) => recordingFetch([[{ ...row, mandate, scope: { prds: [7], roadmaps: [] } }]]).fetch;
    expect((await storeOn(at({ parallel: 2, resumes: 0 })).mission(ID))?.resumes).toBe(0);
    expect((await storeOn(at({ parallel: 2, resumes: 10 })).mission(ID))?.resumes).toBe(10);
    expect((await storeOn(at({ parallel: 2 })).mission(ID))?.resumes).toBe(3);
    await expect(storeOn(at({ parallel: 2, resumes: 11 })).mission(ID)).rejects.toThrow();
  });

  it('names a step\'s k-th resume by its key, and reads a key back to its step and resume', () => {
    expect(resumeKey(`mission:${ID}:prd:7:run:1`, 0)).toBe(`mission:${ID}:prd:7:run:1`);
    expect(resumeKey(`mission:${ID}:prd:7:run:1:review:1`, 2)).toBe(`mission:${ID}:prd:7:run:1:review:1:resume:2`);
    expect(resumeOfKey(`mission:${ID}:pm:2:resume:10`)).toEqual({ key: `mission:${ID}:pm:2`, resume: 10 });
    expect(resumeOfKey(`mission:${ID}:prd:7:run:1`)).toEqual({ key: `mission:${ID}:prd:7:run:1`, resume: 0 });
    // 11 is past what a mandate takes: no resume of it reads.
    expect(resumeOfKey(`mission:${ID}:prd:7:run:1:resume:11`)).toEqual({ key: `mission:${ID}:prd:7:run:1:resume:11`, resume: 0 });
  });

  it('reads each resume of a step as a run of that step, its resume count with it', async () => {
    const db = recordingFetch([[job({}), job({ id: 'job-2', mission_key: `mission:${ID}:prd:7:run:1:review:1` }), job({ id: 'job-3', mission_key: `mission:${ID}:prd:7:run:1:review:1:resume:1`, status: 'queued' })], []]);
    const runs = await storeOn(db.fetch).runs(ID);
    expect(runs.map((one) => [one.job, one.step, 'resume' in one ? one.resume : 0])).toEqual([['job-1', 'build', 0], ['job-2', 'review:1', 0], ['job-3', 'review:1', 1]]);
    expect(runs[0]).not.toHaveProperty('resume');
  });

  it('sends a step\'s resume under its own key, the same line as the step\'s', async () => {
    const db = recordingFetch([[{ id: 'job-9' }]]);
    expect(await storeOn(db.fetch).send({ mission, prd: parsePrd(7), run: 1, step: 'build', toFleet: true, skill: 'yolo', resume: 2 })).toBe('job-9');
    expect(db.requests[0]?.body).toMatchObject({ mission_key: `mission:${ID}:prd:7:run:1:resume:2`, line: '/omni:yolo 7 --for-review --base mission/21-alone', sent_by_app: 'omni-app', to_fleet: 'night-shift' });
  });

  it('sends a PM\'s and a committee\'s resume under their own keys, and reads them back with their resume', async () => {
    const db = recordingFetch([[{ id: 'job-4' }], [{ id: 'job-5' }]]);
    const store = storeOn(db.fetch);
    expect(await store.pm({ mission, round: 2, line: '/omni:plan 2896', toFleet: false, resume: 1 })).toBe('job-4');
    expect(await store.approve({ mission, prd: parsePrd(7), round: 1, toFleet: false, resume: 3 })).toBe('job-5');
    expect(db.requests.map((one) => (one.body as { mission_key: string }).mission_key)).toEqual([`mission:${ID}:pm:2:resume:1`, `mission:${ID}:prd:7:approve:1:resume:3`]);

    const pm = { line: '/omni:plan 2896', ...job({ id: 'job-4', mission_key: `mission:${ID}:pm:2:resume:1`, status: 'queued' }) };
    expect((await storeOn(recordingFetch([[pm]]).fetch).pmJobs(ID)).map((one) => [one.round, 'resume' in one ? one.resume : 0])).toEqual([[2, 1]]);
    const committee = recordingFetch([[job({ id: 'job-5', mission_key: `mission:${ID}:prd:7:approve:1:resume:3` })], []]);
    expect((await storeOn(committee.fetch).committees(ID)).map((one) => [one.prd, one.round, 'resume' in one ? one.resume : 0])).toEqual([[7, 1, 3]]);
    // Only an approval's decisions are a committee's: an item's are read by `decisions`.
    expect(committee.requests[1]?.query.get('kind')).toBe('eq.approve');
  });

  it('keeps the mission\'s branch once per repository, lowercase, and reads them back in the order they were cut', async () => {
    const db = recordingFetch([[{ repo: 'acme/gadgets' }], taken(), [{ repo: 'acme/widgets', branch: 'mission/21-alone', cut_at: '2027-01-29T09:00:00Z' }, { repo: 'acme/gadgets', branch: 'mission/21-alone', cut_at: '2027-01-29T09:00:01Z' }]]);
    const store = storeOn(db.fetch);
    expect(await store.keepBranch(mission, { repo: 'Acme/Gadgets', branch: 'mission/21-alone' })).toBe(true);
    expect(db.requests[0]).toMatchObject({ method: 'POST', path: '/rest/v1/mission_branches', body: { mission_id: ID, repo: 'acme/gadgets', branch: 'mission/21-alone' } });
    expect(await store.keepBranch(mission, { repo: 'acme/gadgets', branch: 'mission/21-other' })).toBe(false);
    expect(await store.branches(ID)).toEqual([
      { repo: 'acme/widgets', branch: 'mission/21-alone', cutAt: '2027-01-29T09:00:00Z' },
      { repo: 'acme/gadgets', branch: 'mission/21-alone', cutAt: '2027-01-29T09:00:01Z' },
    ]);
    expect(db.requests[2]?.query.get('mission_id')).toBe(`eq.${ID}`);
    expect(db.requests[2]?.query.get('order')).toBe('cut_at.asc');
  });

  it('records an item\'s decision through mission_decide_item(), deferred with its option, as the database kept it', async () => {
    const db = recordingFetch([{ decision: 'd-1', outcome: 'deferred', why: ['the Architect answered no: Too wide.'], option: 'A' }]);
    const kept = await storeOn(db.fetch).decideItem(mission, { prd: parsePrd(2896), item: '2896-s1-02', job: 'job-7', verdicts, decision: { outcome: 'deferred', why: ['the Architect answered no: Too wide.'], option: 'A' } });
    expect(kept).toEqual({ outcome: 'deferred', why: ['the Architect answered no: Too wide.'], option: 'A' });
    expect(db.requests[0]).toMatchObject({
      method: 'POST',
      path: '/rest/v1/rpc/mission_decide_item',
      body: { p_mission: ID, p_prd: 2896, p_job: 'job-7', p_item: '2896-s1-02', p_verdicts: verdicts, p_outcome: 'deferred', p_why: ['the Architect answered no: Too wide.'], p_option: 'A' },
    });
    const refused = new Response(JSON.stringify({ code: '22023', message: 'Option: A to D.', details: null, hint: 'option' }), { status: 400, headers: { 'content-type': 'application/json' } });
    await expect(storeOn(recordingFetch([refused]).fetch).decideItem(mission, { prd: parsePrd(2896), item: 'x', job: 'job-7', verdicts, decision: { outcome: 'deferred', why: ['no'], option: null } })).rejects.toThrow(/Option/);
  });

  it('reads every decision of the mission, an approval\'s and an item\'s, carried, deferred or escalated', async () => {
    const db = recordingFetch([[
      { kind: 'approve', prd: 2896, item: null, job_id: 'job-5', outcome: 'carried', why: [], option: null, decided_at: '2027-01-29T09:00:00Z' },
      { kind: 'answer', prd: 2896, item: '2896-s1-01', job_id: 'job-6', outcome: 'carried', why: ['on the escalation list: it bears on the business law BL-ASK-1: a person decides'], option: null, decided_at: '2027-01-29T09:01:00Z' },
      { kind: 'answer', prd: 2896, item: '2896-s1-02', job_id: 'job-7', outcome: 'deferred', why: ['the Architect answered no: Too wide.'], option: 'A', decided_at: '2027-01-29T09:02:00Z' },
    ]]);
    const read = await storeOn(db.fetch).decisions(ID);
    expect(read.map((one) => [one.kind, one.item, one.outcome, one.option])).toEqual([['approve', null, 'carried', null], ['answer', '2896-s1-01', 'carried', null], ['answer', '2896-s1-02', 'deferred', 'A']]);
    expect(read[2]).toEqual({ kind: 'answer', prd: 2896, item: '2896-s1-02', job: 'job-7', outcome: 'deferred', why: ['the Architect answered no: Too wide.'], option: 'A', decidedAt: '2027-01-29T09:02:00Z' });
    expect(db.requests[0]?.query.get('order')).toBe('decided_at.asc');
  });
});

describe('fakeMissionStore at alone (PRD omni-loop-21 s3): what the later slices build on', () => {
  const facts = { prd: parsePrd(2896), approval: 'standing' as const, stage: 'open' as const, blockers: [], territory: null };

  it('keeps one branch per repository and sends each resume once', async () => {
    const fake = fakeMissionStore({ mission, facts: [facts] });
    expect(await fake.store.keepBranch(mission, { repo: 'acme/widgets', branch: 'mission/21-alone' })).toBe(true);
    expect(await fake.store.keepBranch(mission, { repo: 'ACME/widgets', branch: 'mission/21-other' })).toBe(false);
    expect((await fake.store.branches(ID)).map((one) => [one.repo, one.branch])).toEqual([['acme/widgets', 'mission/21-alone']]);

    const sent = { mission, prd: parsePrd(2896), run: 1, step: 'build' as const, toFleet: true, skill: 'yolo' as const };
    expect(await fake.store.send(sent)).not.toBeNull();
    expect(await fake.store.send({ ...sent, resume: 1 })).not.toBeNull();
    expect(await fake.store.send({ ...sent, resume: 1 })).toBeNull();
    expect((await fake.store.runs(ID)).map((one) => ('resume' in one ? one.resume : 0))).toEqual([0, 1]);
    expect(fake.jobs().map((one) => one.key)).toEqual([`mission:${ID}:prd:2896:run:1`, `mission:${ID}:prd:2896:run:1:resume:1`]);
  });

  it('records an item\'s decision once, escalated off alone, and lists it with the approvals\' decisions', async () => {
    const fake = fakeMissionStore({ mission, facts: [facts] });
    const one = { prd: parsePrd(2896), item: '2896-s1-02', job: 'job-7', verdicts, decision: { outcome: 'deferred' as const, why: ['the Architect answered no: Too wide.'], option: 'A' as const } };
    expect(await fake.store.decideItem(mission, one)).toEqual({ outcome: 'deferred', why: ['the Architect answered no: Too wide.'], option: 'A' });
    // Recorded once: a replay answers what was kept.
    expect(await fake.store.decideItem(mission, { ...one, decision: { outcome: 'carried', why: [], option: null } })).toMatchObject({ outcome: 'deferred' });
    const withYou = await fake.store.decideItem({ ...mission, level: 'with-you' }, { ...one, item: '2896-s1-03', job: 'job-8' });
    expect(withYou).toEqual({ outcome: 'escalated', why: ['the Architect answered no: Too wide.', 'the mission is not at alone: a person answers its items'], option: null });
    expect((await fake.store.decisions(ID)).map((each) => [each.kind, each.item, each.outcome, each.option])).toEqual([['answer', '2896-s1-02', 'deferred', 'A'], ['answer', '2896-s1-03', 'escalated', null]]);
  });
});
