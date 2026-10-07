import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { loopPush, MAX_PUSH_BYTES, type LoopDeps } from './api';
import { fakeLoops, type FakeAccount } from './store.fake';
import { loopReader } from './store';
import { loopState, SILENT_AFTER_MS } from './state';

// What an answer of POST /api/loops carries, checked as it is read.
const Answer = z.looseObject({
  error: z.string().optional(),
  loopId: z.string().optional(),
  state: z.string().optional(),
  planVersion: z.number().optional(),
});

const ACME = '00000000-0000-4000-8000-000000000ace';
const OTHER = '00000000-0000-4000-8000-00000000beef';
const ADA: FakeAccount = { id: '00000000-0000-4000-8000-0000000000a1', email: 'ada@acme.test', workspaces: [ACME] };
const BOB: FakeAccount = { id: '00000000-0000-4000-8000-0000000000b1', email: 'bob@acme.test', workspaces: [ACME] };
const CARL: FakeAccount = { id: '00000000-0000-4000-8000-0000000000c1', email: 'carl@other.test', workspaces: [OTHER] };
const NELL: FakeAccount = { id: '00000000-0000-4000-8000-0000000000f1', email: 'nell@none.test', workspaces: [] };
const START = Date.parse('2026-10-07T10:00:00Z');

type Call = { token?: string | null; raw?: string };

function world({ database = true } = {}) {
  const clock = { now: START };
  const fake = fakeLoops({ 'ada-token': ADA, 'bob-token': BOB, 'carl-token': CARL, 'nell-token': NELL }, { [ACME]: 'acme', [OTHER]: 'other' }, () => clock.now);
  // The stub answers only the calls the route makes, so it is not a whole Supabase client.
  const deps: LoopDeps = { connect: database ? fake.client as unknown as LoopDeps['connect'] : null };
  const send = async (body: unknown, { token = 'ada-token', raw }: Call = {}) => {
    const response = await loopPush(new Request('https://omni.example/api/loops', {
      method: 'POST',
      headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), 'content-type': 'application/json' },
      body: raw ?? JSON.stringify(body),
    }), deps);
    const text = await response.text();
    return { status: response.status, body: text ? Answer.parse(JSON.parse(text)) : null };
  };
  const start = async (extra: Record<string, unknown> = {}, call: Call = {}) => {
    const answer = await send({ ...START_BODY, ...extra }, call);
    return { ...answer, loopId: answer.body?.loopId ?? '' };
  };
  const loop = (id: string) => fake.tables.loops.find((l) => l.id === id);
  return { clock, fake, send, start, loop };
}

const PLAN = { steps: [{ n: 1, prd: 7, slice: 's1' }, { n: 2, prd: 9, slice: 's1', beside: 1 }] };
const START_BODY = { event: 'start', repo: 'acme/widgets', prds: [7, 9], plan: PLAN };
const tick = (loopId: string, extra: Record<string, unknown> = {}) => ({
  event: 'tick', loopId, step: 1, steps: 2, prd: 7, action: 'wave', result: 'wave 1 merged: s1, s2',
  link: 'https://omni.example/prd/7', merged: [101, 102], items: ['s1-01-first-wave'],
  nextWakeAt: new Date(START + 90_000).toISOString(), ...extra,
});

describe('POST /api/loops start: a loop opens', () => {
  it('answers 201 with the loop\'s id, running on plan version 1, and records it for its owner', async () => {
    const w = world();
    const { status, body, loopId } = await w.start();
    expect(status).toBe(201);
    expect(body).toEqual({ loopId, state: 'running', planVersion: 1 });
    expect(loopId).toMatch(/^[0-9a-f-]{36}$/);
    expect(w.loop(loopId)).toMatchObject({ user_id: ADA.id, workspace_id: ACME, repo: 'acme/widgets', prds: [7, 9], state: 'running', parked: [] });
    expect(w.fake.tables.loop_plans).toEqual([expect.objectContaining({ loop_id: loopId, version: 1, reason: 'the first plan', plan: PLAN })]);
  });

  it('sends exactly what the database needs: the event, no loop, and the fields', async () => {
    const w = world();
    await w.start({ repo: 'Acme/Widgets', reason: 'two PRDs, side by side' });
    expect(w.fake.calls).toEqual([{ fn: 'loop_push', args: {
      p_event: 'start', p_loop: null,
      p_body: { repo: 'Acme/Widgets', prds: [7, 9], plan: PLAN, reason: 'two PRDs, side by side', takeOver: false },
    } }]);
  });

  it('refuses a second start for the same person and repository while one is live, naming it', async () => {
    const w = world();
    const first = await w.start();
    const { status, body } = await w.start();
    expect(status).toBe(409);
    expect(body?.error).toContain(first.loopId);
    expect(w.fake.tables.loops).toHaveLength(1);
  });

  it('refuses a take-over of a loop that is not silent, and takes over a silent one', async () => {
    const w = world();
    const first = await w.start();
    await w.send(tick(first.loopId));
    expect((await w.start({ takeOver: true })).status).toBe(409);
    w.clock.now += 90_000 + SILENT_AFTER_MS;
    const plain = await w.start();
    expect(plain.status).toBe(409);
    expect(plain.body?.error).toContain('silent');
    const taken = await w.start({ takeOver: true });
    expect(taken.status).toBe(201);
    expect(w.loop(first.loopId)?.state).toBe('stopped');
    expect(w.loop(taken.loopId)?.state).toBe('running');
  });

  it('lets another person run their own loop on the same repository', async () => {
    const w = world();
    await w.start();
    expect((await w.start({}, { token: 'bob-token' })).status).toBe(201);
  });
});

describe('POST /api/loops tick, park and stop', () => {
  it('a tick appends a ledger row and moves the next wake', async () => {
    const w = world();
    const { loopId } = await w.start();
    const { status, body } = await w.send(tick(loopId));
    expect(status).toBe(200);
    expect(body).toEqual({ loopId, state: 'running', planVersion: 1 });
    expect(w.fake.tables.loop_ticks).toEqual([expect.objectContaining({
      loop_id: loopId, step: 1, steps: 2, prd: 7, action: 'wave', result: 'wave 1 merged: s1, s2',
      link: 'https://omni.example/prd/7', merged: [101, 102], items: ['s1-01-first-wave'], next_wake_at: new Date(START + 90_000).toISOString(),
    })]);
    expect(w.loop(loopId)).toMatchObject({ next_wake_at: new Date(START + 90_000).toISOString(), last_tick_at: new Date(START).toISOString() });
  });

  it('a tick that replanned adds the next plan version, with its reason', async () => {
    const w = world();
    const { loopId } = await w.start();
    const replan = { reason: 'replanned v2: s4 of PRD 9 stuck → 7 moves up', plan: { steps: [] } };
    const { body } = await w.send(tick(loopId, { replan }));
    expect(body?.planVersion).toBe(2);
    expect(w.fake.tables.loop_plans.map((p) => [p.version, p.reason])).toEqual([[1, 'the first plan'], [2, replan.reason]]);
  });

  it('park records the PRD with who and what it waits on; stop then ends the loop parked', async () => {
    const w = world();
    const { loopId } = await w.start();
    const parked = await w.send({ event: 'park', loopId, prd: 9, who: 'Pierre', what: 'the outbox questions', link: 'https://github.com/acme/widgets/pull/9' });
    expect(parked.status).toBe(200);
    expect(w.loop(loopId)?.parked).toEqual([{ prd: 9, who: 'Pierre', what: 'the outbox questions', link: 'https://github.com/acme/widgets/pull/9', at: new Date(START).toISOString() }]);
    const stopped = await w.send({ event: 'stop', loopId });
    expect(stopped).toEqual({ status: 200, body: { loopId, state: 'parked', planVersion: 1 } });
    expect(w.loop(loopId)?.stopped_at).toBe(new Date(START).toISOString());
  });

  it('stop ends the loop stopped when nothing waits, a tick of a parked PRD taking it out', async () => {
    const w = world();
    const { loopId } = await w.start();
    await w.send({ event: 'park', loopId, prd: 7, who: 'Pierre', what: 'phase-0' });
    await w.send(tick(loopId));
    expect(w.loop(loopId)?.parked).toEqual([]);
    expect((await w.send({ event: 'stop', loopId })).body?.state).toBe('stopped');
  });

  it('refuses any push to a loop that has stopped', async () => {
    const w = world();
    const { loopId } = await w.start();
    await w.send({ event: 'stop', loopId });
    expect((await w.send(tick(loopId))).status).toBe(409);
  });
});

describe('refusals', () => {
  it('401 without a token, or with one the Auth server refuses', async () => {
    const w = world();
    for (const token of [null, 'forged-token']) {
      const { status, body } = await w.start({}, { token });
      expect(status).toBe(401);
      expect(body?.error).toEqual(expect.any(String));
    }
    expect(w.fake.tables.loops).toEqual([]);
  });

  const LOOP = '00000000-0000-4000-8000-00000000100f';
  const malformed: Array<[string, unknown]> = [
    ['a list', [START_BODY]],
    ['an unknown event', { ...START_BODY, event: 'pause' }],
    ['no event', { repo: 'acme/widgets', prds: [7], plan: PLAN }],
    ['a start without its repository', { event: 'start', prds: [7], plan: PLAN }],
    ['a repository not owner/name', { ...START_BODY, repo: 'widgets' }],
    ['a start driving no PRD', { ...START_BODY, prds: [] }],
    ['a start driving 51 PRDs', { ...START_BODY, prds: Array.from({ length: 51 }, (_, i) => i + 1) }],
    ['a PRD numbered 0', { ...START_BODY, prds: [0] }],
    ['a start without its plan', { event: 'start', repo: 'acme/widgets', prds: [7] }],
    ['a plan that is a list', { ...START_BODY, plan: [] }],
    ['`takeOver` not a boolean', { ...START_BODY, takeOver: 'yes' }],
    ['a start with a field of a tick', { ...START_BODY, step: 1 }],
    ['a tick without its loop', { ...tick(LOOP), loopId: undefined }],
    ['a loop id that is not an id', tick('loop-1')],
    ['a tick without its result', { ...tick(LOOP), result: undefined }],
    ['a result over 300 characters', tick(LOOP, { result: 'x'.repeat(301) })],
    ['a step past the plan\'s end', tick(LOOP, { step: 3, steps: 2 })],
    ['a step numbered 0', tick(LOOP, { step: 0 })],
    ['an action not a word', tick(LOOP, { action: 'rm -rf' })],
    ['a link that is not a web address', tick(LOOP, { link: 'file:///etc/passwd' })],
    ['a merged sub-PR that is not a number', tick(LOOP, { merged: ['#101'] })],
    ['a next wake that is not a time', tick(LOOP, { nextWakeAt: 'soon' })],
    ['a tick without its next wake', { ...tick(LOOP), nextWakeAt: undefined }],
    ['a replan without its reason', tick(LOOP, { replan: { plan: {} } })],
    ['an unknown field', tick(LOOP, { transcript: '…' })],
    ['a park without who it waits on', { event: 'park', loopId: LOOP, prd: 9, what: 'answers' }],
    ['a park without on what', { event: 'park', loopId: LOOP, prd: 9, who: 'Pierre' }],
    ['a stop with a field of its own', { event: 'stop', loopId: LOOP, reason: 'done' }],
  ];
  for (const [name, body] of malformed) {
    it(`400 on ${name}`, async () => {
      const w = world();
      const { status, body: answer } = await w.send(body);
      expect(status).toBe(400);
      expect(answer?.error).toEqual(expect.any(String));
      expect(w.fake.calls).toEqual([]);
    });
  }

  it('400 on a body that is not JSON', async () => {
    const w = world();
    expect((await w.send(undefined, { raw: '{not json' })).status).toBe(400);
  });

  it(`413 past ${MAX_PUSH_BYTES} bytes`, async () => {
    const w = world();
    expect((await w.start({ plan: { steps: 'x'.repeat(MAX_PUSH_BYTES) } })).status).toBe(413);
  });

  it('404 for a loop that does not exist', async () => {
    const w = world();
    expect((await w.send(tick(LOOP))).status).toBe(404);
  });

  it('403 when another account pushes to the loop, a member of its workspace too, and the loop stays as it was', async () => {
    const w = world();
    const { loopId } = await w.start();
    for (const token of ['bob-token', 'carl-token']) {
      const { status, body } = await w.send({ event: 'stop', loopId }, { token });
      expect(status).toBe(403);
      expect(body?.error).toContain('another account');
    }
    expect(w.loop(loopId)?.state).toBe('running');
  });

  it('403 for a repository a workspace the caller is not in owns', async () => {
    const w = world();
    const { status, body } = await w.start({}, { token: 'carl-token' });
    expect(status).toBe(403);
    expect(body?.error).toContain('not a member');
    expect(w.fake.tables.loops).toEqual([]);
  });

  it('403 for an account in no workspace, with the database\'s reason and the App\'s link', async () => {
    const w = world();
    const deps: LoopDeps = { connect: w.fake.client as unknown as LoopDeps['connect'], installLink: 'https://github.com/apps/omni/installations/new' };
    const response = await loopPush(new Request('https://omni.example/api/loops', {
      method: 'POST', headers: { authorization: 'Bearer nell-token' }, body: JSON.stringify({ ...START_BODY, repo: 'nowhere/widgets' }),
    }), deps);
    expect(response.status).toBe(403);
    expect(Answer.parse(await response.json()).error).toBe('no workspace owns nowhere/widgets yet — install the Omni App: https://github.com/apps/omni/installations/new');
  });

  it('503 when this deployment has no database', async () => {
    const w = world({ database: false });
    expect((await w.start()).status).toBe(503);
  });
});

describe('reading the loops', () => {
  it('a member of the workspace reads the loop, its ledger and its plans; another workspace reads nothing', async () => {
    const w = world();
    const { loopId } = await w.start();
    await w.send(tick(loopId, { replan: { reason: 'an added slice', plan: { steps: [] } } }));
    const asBob = loopReader(w.fake.client('bob-token') as never);
    const asCarl = loopReader(w.fake.client('carl-token') as never);
    expect(await asBob.list()).toEqual([expect.objectContaining({ id: loopId, user_id: ADA.id, repo: 'acme/widgets', prds: [7, 9] })]);
    expect(await asBob.loop(loopId)).toMatchObject({ id: loopId, state: 'running' });
    expect((await asBob.ticks(loopId)).map((t) => t.result)).toEqual(['wave 1 merged: s1, s2']);
    expect((await asBob.plans(loopId)).map((p) => p.version)).toEqual([1, 2]);
    expect(await asCarl.list()).toEqual([]);
    expect(await asCarl.loop(loopId)).toBeNull();
    expect(await asCarl.ticks(loopId)).toEqual([]);
    expect(await asCarl.plans(loopId)).toEqual([]);
  });

  it('the newest loop first, read live, then sleeping, then silent, then stopped', async () => {
    const w = world();
    const reader = loopReader(w.fake.client('bob-token') as never);
    const { loopId } = await w.start();
    const state = async () => {
      const row = await reader.loop(loopId);
      if (!row) throw new Error('the loop is gone');
      return loopState(row, w.clock.now);
    };
    expect(await state()).toBe('live');
    await w.send(tick(loopId));
    expect(await state()).toBe('sleeping');
    w.clock.now += 90_000 + SILENT_AFTER_MS;
    expect(await state()).toBe('silent');
    await w.send({ event: 'stop', loopId });
    expect(await state()).toBe('stopped');
    w.clock.now += 1000;
    const later = await w.start({ prds: [11] });
    expect((await reader.list()).map((l) => l.id)).toEqual([later.loopId, loopId]);
  });
});
