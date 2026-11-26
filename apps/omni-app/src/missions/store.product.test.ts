// The mission store keeps a product PRD (PRD omni-loop-21 s3b), as the service role, never calling Supabase: a PRD of a
// mission's events, joins, decisions and repairs written as a number to `prd` or as a product's id to `product_prd`, read back
// from `prd_id`, and named in a job's key. Each request recorded, each answer handed.
import { describe, expect, it } from 'vitest';
import { parseIssue, parsePrd, parseProductPrdId } from 'omni-loop/kit/lib/ids.ts';
import { missionStore, type MissionRecord } from './store.ts';
import { fakeMissionStore } from './store.fake.ts';
import { numberedOf, PrdIdSchema, prdColumns, prdKeyPart, prdOfKey, productRunOfKey } from './store.prd.ts';

const ID = '0b7c1f6e-3a52-4d8e-9f10-2c4b6a8d0e11';
const PRODUCT = parseProductPrdId('omni-loop-15');

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
  number: parseIssue(21),
  title: 'Alone',
  level: 'alone',
  status: 'running',
  waitingOn: null,
  parallel: 2,
  scope: { prds: [parsePrd(2896)], roadmaps: [] },
  products: { prds: [PRODUCT], roadmaps: [] },
};

const verdicts = [{ role: 'pm' as const, answer: 'yes' as const, sentence: 'In scope.' }];
const repairRow = { id: 'r-1', trigger: 'failure', fingerprint: 'a'.repeat(64), round: 1, number: 1, failed_job_id: 'job-1', job_id: null, retro: null, fix_pr: null, outcome: null };

describe('a mission PRD, a repository\'s number or a product\'s id (PRD omni-loop-21 s3b)', () => {
  it('reads `prd_id` as a number or a product PRD\'s id, and refuses anything else', () => {
    expect(PrdIdSchema.parse('2896')).toBe(2896);
    expect(PrdIdSchema.parse('omni-loop-15')).toBe('omni-loop-15');
    for (const bad of ['0', '02896', 'omni-loop', 'omni-loop-R3', 'Omni-loop-15', '']) expect(PrdIdSchema.safeParse(bad).success).toBe(false);
  });

  it('writes a number to `prd` and a product\'s id to `product_prd`, never both', () => {
    expect(prdColumns(parsePrd(2896))).toEqual({ prd: 2896, product_prd: null });
    expect(prdColumns(PRODUCT)).toEqual({ prd: null, product_prd: 'omni-loop-15' });
    expect(prdColumns(null)).toEqual({ prd: null, product_prd: null });
  });

  it('names the PRD in a job\'s key and reads it back, a number or a product\'s id', () => {
    expect(`mission:${ID}:${prdKeyPart(PRODUCT)}:run:1`).toBe(`mission:${ID}:prd:omni-loop-15:run:1`);
    expect(prdOfKey(`mission:${ID}:prd:omni-loop-15:approve:2`)).toBe('omni-loop-15');
    expect(prdOfKey(`mission:${ID}:${prdKeyPart(parsePrd(2896))}:repair:1`)).toBe(2896);
    expect(prdOfKey(`mission:${ID}:pm:1`)).toBeNull();
    expect(prdOfKey(`mission:${ID}:prd:omni-loop-R3:run:1`)).toBeNull();
  });

  it('hands a reader of numbers only a product\'s PRD as `product`, its `prd` null', () => {
    expect(numberedOf(PRODUCT)).toEqual({ prd: null, product: 'omni-loop-15' });
    expect(numberedOf(parsePrd(7))).toEqual({ prd: 7 });
    expect(numberedOf(null)).toEqual({ prd: null });
  });
});

describe('missionStore keeps a product PRD (PRD omni-loop-21 s3b)', () => {
  it('records a product PRD\'s event, its join, under its id, and a repository PRD\'s under its number', async () => {
    const db = recordingFetch([[{ id: 'e-1' }, { id: 'e-2' }]]);
    await storeOn(db.fetch).record(ID, [
      { kind: 'prd-joined', role: 'supervisor', prd: PRODUCT, job: null, link: null, sentence: 'omni-loop-15 joined the mission branch.' },
      { kind: 'prd-joined', role: 'supervisor', prd: parsePrd(2896), job: null, link: null, sentence: '2896 joined the mission branch.' },
    ], new Date('2027-01-29T10:00:00Z'));
    expect(db.requests[0]).toMatchObject({ method: 'POST', path: '/rest/v1/mission_events' });
    expect(db.requests[0]?.body).toMatchObject([{ kind: 'prd-joined', prd: null, product_prd: 'omni-loop-15' }, { kind: 'prd-joined', prd: 2896, product_prd: null }]);
  });

  it('reads the events back from `prd_id`, a product PRD\'s as `product`', async () => {
    const db = recordingFetch([[{ kind: 'prd-joined', prd_id: 'omni-loop-15', job_id: null }, { kind: 'prd-joined', prd_id: '2896', job_id: 'job-1' }, { kind: 'paused', prd_id: null, job_id: null }]]);
    expect(await storeOn(db.fetch).events(ID)).toEqual([
      { kind: 'prd-joined', prd: null, product: 'omni-loop-15', job: null },
      { kind: 'prd-joined', prd: 2896, job: 'job-1' },
      { kind: 'paused', prd: null, job: null },
    ]);
    expect(db.requests[0]?.query.get('select')).toBe('kind,prd_id,job_id');
  });

  it('reads a fleet\'s decision event on a product PRD as `product`', async () => {
    const db = recordingFetch([[{ kind: 'decided', prd_id: 'omni-loop-15', sentence: 'The fleet carried it.', link: null, actor: 'agent' }]]);
    expect(await storeOn(db.fetch).fleetEvents(ID)).toEqual([{ kind: 'decided', prd: null, product: 'omni-loop-15', sentence: 'The fleet carried it.', link: null, actor: 'agent' }]);
  });

  it('keeps a product PRD\'s repair under its id, and reads it back by its id (bug #3302: a product PRD is repaired too)', async () => {
    const db = recordingFetch([[{ ...repairRow, prd_id: 'omni-loop-15' }]]);
    const kept = await storeOn(db.fetch).keepRepair(mission, { prd: PRODUCT, fingerprint: 'a'.repeat(64), round: 1, failedJob: 'job-1', job: null, retro: null, fixPr: null });
    expect(db.requests[0]?.body).toMatchObject({ prd: null, product_prd: 'omni-loop-15', failed_job_id: 'job-1' });
    expect(kept).toMatchObject({ id: 'r-1', prd: 'omni-loop-15' });
    const read = await storeOn(recordingFetch([[], [{ ...repairRow, prd_id: '2896' }, { ...repairRow, id: 'r-2', prd_id: 'omni-loop-15' }]]).fetch).repairs(ID);
    expect(read.rows.map((one) => [one.id, one.prd])).toEqual([['r-1', 2896], ['r-2', 'omni-loop-15']]);
  });

  it('records an item\'s decision on a product PRD through mission_decide_item() named by its id', async () => {
    const db = recordingFetch([{ decision: 'd-1', outcome: 'carried', why: [], option: null }]);
    await storeOn(db.fetch).decideItem(mission, { prd: PRODUCT, item: 'omni-loop-15-s1-01', job: 'job-7', verdicts, decision: { outcome: 'carried', why: [], option: null } });
    expect(db.requests[0]).toMatchObject({ path: '/rest/v1/rpc/mission_decide_item', body: { p_mission: ID, p_product_prd: 'omni-loop-15', p_job: 'job-7', p_item: 'omni-loop-15-s1-01' } });
    expect(db.requests[0]?.body).not.toHaveProperty('p_prd');
  });

  it('lists a product PRD\'s decision under its id', async () => {
    const db = recordingFetch([[{ kind: 'answer', prd_id: 'omni-loop-15', item: 'omni-loop-15-s1-01', job_id: 'job-7', outcome: 'deferred', why: ['no'], option: 'A', decided_at: '2027-01-29T09:02:00Z' }]]);
    expect(await storeOn(db.fetch).decisions(ID)).toEqual([{ kind: 'answer', prd: 'omni-loop-15', item: 'omni-loop-15-s1-01', job: 'job-7', outcome: 'deferred', why: ['no'], option: 'A', decidedAt: '2027-01-29T09:02:00Z' }]);
  });
});

describe('fakeMissionStore keeps a product PRD (PRD omni-loop-21 s3b): what the later slices build on', () => {
  const facts = { prd: parsePrd(2896), approval: 'standing' as const, stage: 'open' as const, blockers: [], territory: null };

  it('records a product PRD\'s event and repair, and reads them as the store does', async () => {
    const fake = fakeMissionStore({ mission, facts: [facts] });
    await fake.store.record(ID, [{ kind: 'prd-joined', role: 'supervisor', prd: PRODUCT, job: null, link: null, sentence: 'omni-loop-15 joined.' }], new Date('2027-01-29T10:00:00Z'));
    expect(await fake.store.events(ID)).toEqual([{ kind: 'prd-joined', prd: null, product: 'omni-loop-15', job: null }]);
    expect(await fake.store.keepRepair(mission, { prd: PRODUCT, fingerprint: 'a'.repeat(64), round: 1, failedJob: 'job-1', job: null, retro: null, fixPr: null })).toMatchObject({ prd: 'omni-loop-15', number: 1 });
    expect(fake.repairRows().map((one) => one.prd)).toEqual(['omni-loop-15']);
  });

  it('records and lists an item\'s decision on a product PRD under its id', async () => {
    const fake = fakeMissionStore({ mission, facts: [facts] });
    await fake.store.decideItem(mission, { prd: PRODUCT, item: 'omni-loop-15-s1-01', job: 'job-7', verdicts, decision: { outcome: 'carried', why: [], option: null } });
    expect((await fake.store.decisions(ID)).map((one) => [one.prd, one.item, one.outcome])).toEqual([['omni-loop-15', 'omni-loop-15-s1-01', 'carried']]);
  });
});

describe("the store reads and sends a mission's product PRDs (PRD omni-loop-21 s9b)", () => {
  it('reads a product build back from its key, and no other key', () => {
    expect(productRunOfKey(`mission:${ID}:prd:omni-loop-15:run:2`)).toEqual({ prd: 'omni-loop-15', run: 2 });
    for (const other of [`mission:${ID}:prd:2896:run:1`, `mission:${ID}:prd:omni-loop-15:run:1:review:1`, `mission:${ID}:prd:omni-loop-15:approve:1`]) expect(productRunOfKey(other)).toBeNull();
  });

  it('queues a product build under its key, with the line it is given', async () => {
    const db = recordingFetch([[{ id: 'job-9' }]]);
    const line = '/omni:ultra-yolo omni-loop-15 --base-of acme/widgets=mission/21-alone';
    expect(await storeOn(db.fetch).products?.send({ mission, prd: PRODUCT, run: 1, line, toFleet: true })).toBe('job-9');
    expect(db.requests[0]).toMatchObject({ method: 'POST', path: '/rest/v1/runner_jobs', body: { line, mission_key: `mission:${ID}:prd:omni-loop-15:run:1`, to_fleet: 'night-shift' } });
  });

  it('reads what a build that ended with no result word was held on from its log tail, and reads no log for any other (bug #3345)', async () => {
    const row = (id: string, prd: string, status: string, outcome: string | null) => ({ id, mission_key: `mission:${ID}:prd:${prd}:run:1`, resumes: null, status, outcome, reason: null, pr_url: null, limited_until: null, parts: null, line: `/omni:ultra-yolo ${prd}` });
    const tail = '12:16:48 **Held: PRD omni-loop-30 is blocked by omni-loop-28.** Nothing was built.\n12:16:48 /omni:ultra-yolo omni-loop-30';
    const db = recordingFetch([[row('j30', 'omni-loop-30', 'done', null), row('j28', 'omni-loop-28', 'done', 'ready'), row('j29', 'omni-loop-29', 'running', null)], [], [{ id: 'j30', log_tail: tail }]]);
    const runs = (await storeOn(db.fetch).products?.runs(ID)) ?? [];
    expect(runs.map(({ prd, attempts }) => [prd, attempts.at(-1)?.heldOn ?? null])).toEqual([['omni-loop-30', ['omni-loop-28']], ['omni-loop-28', null], ['omni-loop-29', null]]);
    expect(db.requests.at(-1)?.query.get('id')).toBe('in.(j30)');
    expect(db.requests.at(-1)?.query.get('select')).toBe('id,log_tail');
  });

  it('reads when each product build and each item committee was queued, which orders them (bug #3369)', async () => {
    const build = { id: 'j28', mission_key: `mission:${ID}:prd:omni-loop-28:run:5`, resumes: null, status: 'queued', outcome: null, reason: null, pr_url: null, line: '/omni:ultra-yolo omni-loop-28', queued_at: '2026-11-26T19:16:00+00:00' };
    const ask = { ...build, id: 'j-ask', mission_key: null, status: 'done', line: '/omni:committee omni-loop-28 --item s1-02-parts-live-in-omni-ui --bound 0.6', queued_at: '2026-11-26T19:02:00+00:00' };
    const store = storeOn(recordingFetch([[build], [], [ask]]).fetch);
    expect(((await store.products?.runs(ID)) ?? []).map(({ job, sentAt }) => [job, sentAt])).toEqual([['j28', '2026-11-26T19:16:00+00:00']]);
    expect((await store.asks(ID)).map(({ job, sentAt }) => [job, sentAt])).toEqual([['j-ask', '2026-11-26T19:02:00+00:00']]);
  });

  it('reads no product PRD for a mission whose scope names none', async () => {
    const db = recordingFetch();
    const numbered: MissionRecord = { ...mission };
    delete numbered.products;
    expect(await storeOn(db.fetch).products?.facts(numbered)).toEqual([]);
    expect(db.requests).toEqual([]);
  });
});
