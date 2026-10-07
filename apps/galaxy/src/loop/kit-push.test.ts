// PRD 1139: the two halves of the loops' contract, held together. The kit's `omni loop push` shapes
// its bodies with kit/lib/loop/body.ts, from the loop plan `omni next --plan` keeps at
// `.omni-loop/local/loop-plan.json` (kit/lib/next/store.ts); this app takes them through loopPush()
// (./api.ts), which refuses an unknown field or a malformed one. Each body the kit sends, built from a
// plan written and read back through the kit's own store, is taken here as it is, and the plan the app
// stores is the plan the file holds.
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { parseOutboxItemId, parsePr, parsePrd, parseWorkSliceId } from 'vertuo-omni-plan/kit/lib/ids.ts';
import { parkBody, startBody, stopBody, tickBody } from 'vertuo-omni-plan/kit/lib/loop/body.ts';
import type { LoopPlan } from 'vertuo-omni-plan/kit/lib/next/plan.ts';
import { readLoopPlans, writeLoopPlans } from 'vertuo-omni-plan/kit/lib/next/store.ts';
import { loopPush, type LoopDeps } from './api';
import { fakeLoops, type FakeAccount } from './store.fake';

const Answer = z.looseObject({ error: z.string().optional(), loopId: z.string().optional(), state: z.string().optional(), planVersion: z.number().optional() });

const ACME = '00000000-0000-4000-8000-000000000ace';
const ADA: FakeAccount = { id: '00000000-0000-4000-8000-0000000000a1', email: 'ada@acme.test', workspaces: [ACME] };
const START = Date.parse('2026-10-07T10:00:00Z');

function world() {
  const fake = fakeLoops({ 'ada-token': ADA }, { [ACME]: 'acme' }, () => START);
  // The stub answers only the calls the route makes, so it is not a whole Supabase client.
  const deps: LoopDeps = { connect: fake.client as unknown as LoopDeps['connect'] };
  // The body goes through JSON, as the kit's client sends it.
  const send = async (body: unknown) => {
    const response = await loopPush(new Request('https://omni.example/api/loops', {
      method: 'POST', headers: { authorization: 'Bearer ada-token', 'content-type': 'application/json' }, body: JSON.stringify(body),
    }), deps);
    return { status: response.status, body: Answer.parse(await response.json()) };
  };
  return { fake, send };
}

const prd = (n: number) => parsePrd(n);
const slice = (id: string) => parseWorkSliceId(id);

/** A loop plan as `omni next --plan` computes one: two PRDs, one in series after the other. */
function plan(version: number, reason: string | null): LoopPlan {
  return {
    version, reason, prds: [prd(7), prd(9)],
    steps: [
      { step: 1, prd: prd(7), kind: 'wave', wave: 1, slices: [slice('s1'), slice('s2')], after: [], waitsFor: [], why: [], beside: [] },
      { step: 2, prd: prd(9), kind: 'wave', wave: 1, slices: [slice('s1')], after: [1], waitsFor: [], why: ['9 s1 after 7 s1: both touch apps/galaxy/src/nav/'], beside: [] },
      { step: 3, prd: prd(7), kind: 'finish', wave: null, slices: [], after: [1], waitsFor: [], why: [], beside: [2] },
    ],
    seen: [
      { prd: prd(7), slices: [slice('s1'), slice('s2')], stuck: [], ended: null },
      { prd: prd(9), slices: [slice('s1')], stuck: version > 1 ? [slice('s1')] : [], ended: null },
    ],
  };
}

/** A checkout's loop plan file, written and read back through the kit's store, as the kit reads it. */
function keptPlans(versions: LoopPlan[]): LoopPlan[] {
  const root = mkdtempSync(join(tmpdir(), 'loop-plan-'));
  writeLoopPlans(root, versions);
  return readLoopPlans(root);
}

describe('the bodies omni loop push sends are the ones POST /api/loops takes', () => {
  it('start, tick, a tick with a replan, park and stop each answer 2xx, and the app stores the file\'s plans', async () => {
    const [first, second] = keptPlans([plan(1, null), plan(2, 'replanned v2: s1 of PRD 9 stuck → 7 moves up')]);
    if (!first || !second) throw new Error('the kit kept no plan');
    const { fake, send } = world();

    const started = await send(startBody({ repo: 'acme/widgets', plan: first, takeOver: false }));
    expect(started).toEqual({ status: 201, body: { loopId: expect.any(String), state: 'running', planVersion: 1 } });
    const loopId = started.body.loopId ?? '';

    const ticked = await send(tickBody({
      loopId, step: 1, steps: first.steps.length, prd: prd(7), action: 'wave', result: `wave 1 merged:\ns1, s2 ${'x'.repeat(400)}`,
      link: 'https://omni.example/prd/7', merged: [parsePr(21), parsePr(22)], items: [parseOutboxItemId('s1-01-list')],
      nextWakeAt: new Date(START + 90_000).toISOString(),
    }));
    expect(ticked).toEqual({ status: 200, body: { loopId, state: 'running', planVersion: 1 } });

    const replanned = await send(tickBody({ loopId, step: 2, steps: second.steps.length, prd: prd(9), action: 'wait', result: 'ci running', replan: second }));
    expect(replanned).toEqual({ status: 200, body: { loopId, state: 'running', planVersion: 2 } });

    const parked = await send(parkBody({ loopId, prd: prd(9), who: 'the PM', what: 'two outbox questions', link: 'https://github.com/acme/widgets/pull/9' }));
    expect(parked.status).toBe(200);
    expect(await send(stopBody(loopId))).toEqual({ status: 200, body: { loopId, state: 'parked', planVersion: 2 } });

    // What the app keeps is the file's plan, each version, as the kit wrote it.
    expect(fake.tables.loop_plans.map(({ version, reason, plan: stored }) => ({ version, reason, plan: stored }))).toEqual([
      { version: 1, reason: 'the first plan', plan: JSON.parse(JSON.stringify(first)) },
      { version: 2, reason: 'replanned v2: s1 of PRD 9 stuck → 7 moves up', plan: JSON.parse(JSON.stringify(second)) },
    ]);
    expect(fake.tables.loops).toEqual([expect.objectContaining({ repo: 'acme/widgets', prds: [7, 9], state: 'parked' })]);
    expect(fake.tables.loop_ticks.map((t) => [t.step, t.steps, t.prd, t.action])).toEqual([[1, 3, 7, 'wave'], [2, 3, 9, 'wait']]);
  });

  it('a plan whose reason is set opens the loop with it; a take-over is the flag the app reads', async () => {
    const [kept] = keptPlans([plan(1, 'two PRDs, one after the other')]);
    if (!kept) throw new Error('the kit kept no plan');
    const { fake, send } = world();
    expect((await send(startBody({ repo: 'acme/widgets', plan: kept, takeOver: true }))).status).toBe(201);
    expect(fake.tables.loop_plans[0]?.reason).toBe('two PRDs, one after the other');
    expect(fake.calls[0]?.args.p_body).toMatchObject({ takeOver: true });
  });
});
