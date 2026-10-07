// PRD 1139, slice s3: following the frozen loop plan — the first step not done, never a later one
// that could run, save one the plan marked beside it.
import { describe, expect, it } from 'vitest';
import { parsePrd, parseWorkSliceId } from '../ids.ts';
import type { PrdNumber, WorkSliceId } from '../ids.ts';
import type { Verdict } from './decide.ts';
import { followPlan } from './follow.ts';
import type { Live } from './follow.ts';
import { planLoop } from './plan.ts';
import type { PlanSliceInput, PrdInput } from './plan.ts';

const P7 = parsePrd(7);
const P8 = parsePrd(8);
const P9 = parsePrd(9);
const slice = (id: string, territory: string[], wave: number): PlanSliceInput => ({ id: parseWorkSliceId(id), territory, wave, state: 'runnable' });
const prd = (prd: PrdNumber, slices: PlanSliceInput[], over: Partial<PrdInput> = {}): PrdInput => ({ prd, blockedBy: [], slices, ended: null, ...over });

const act = (prd: PrdNumber): Verdict => ({ prd, verdict: 'act', skill: 'wave', why: 'wave can take' });
const wait = (prd: PrdNumber): Verdict => ({ prd, verdict: 'wait', why: 'claim held', wakeHint: 1200 });
const park = (prd: PrdNumber): Verdict => ({ prd, verdict: 'park', why: 'waits on @pm', link: 'https://x/pr/1' });
const done = (prd: PrdNumber): Verdict => ({ prd, verdict: 'done', why: 'merged' });

function live(verdicts: Verdict[], merged: Record<number, string[]> = {}, shipped: number[] = []): Live {
  return {
    verdicts: new Map(verdicts.map((verdict) => [verdict.prd, verdict])),
    merged: new Map(Object.entries(merged).map(([n, ids]) => [parsePrd(Number(n)), new Set<WorkSliceId>(ids.map(parseWorkSliceId))])),
    shipped: new Set(shipped.map(parsePrd)),
  };
}

// 7 and 8 collide on a/ (8 waits on 7); 9 shares nothing and runs beside 7.
const plan = planLoop({
  prds: [prd(P7, [slice('s1', ['a/'], 1), slice('s2', ['b/'], 2)]), prd(P8, [slice('s1', ['a/x'], 1)]), prd(P9, [slice('s1', ['z/'], 1)])],
  shipped: [],
});

describe('followPlan', () => {
  it('the plan reads as expected', () => {
    expect(plan.steps.map((step) => `${step.step}:${step.prd}:${step.kind}:${step.wave ?? '-'}:[${step.beside.join(',')}]`)).toEqual([
      '1:7:wave:1:[2]',
      '2:9:wave:1:[1]',
      '3:7:wave:2:[4,5]',
      '4:8:wave:1:[3,5]',
      '5:9:finish:-:[3,4]',
      '6:7:finish:-:[7]',
      '7:8:finish:-:[6]',
    ]);
  });

  it('returns the first step not done', () => {
    const followed = followPlan(plan, live([act(P7), act(P8), act(P9)]));
    expect(followed).toMatchObject({ state: 'step', step: { step: 1 }, verdict: { prd: 7, verdict: 'act' } });
  });

  it('never a later step that could run: 8 waits on 7 even though its own verdict is act', () => {
    const followed = followPlan(plan, live([act(P7), act(P8), done(P9)], { 7: ['s1'] }));
    expect(followed).toMatchObject({ state: 'step', step: { step: 3 }, verdict: { prd: 7 } });
  });

  it('when the first step waits, a step marked beside it that can act is taken instead', () => {
    const followed = followPlan(plan, live([wait(P7), act(P8), act(P9)]));
    expect(followed).toMatchObject({ state: 'step', step: { step: 2 }, verdict: { prd: 9, verdict: 'act' } });
  });

  it('when the first step waits and nothing beside it can act, the wait is the verdict', () => {
    const followed = followPlan(plan, live([wait(P7), act(P8), wait(P9)]));
    expect(followed).toMatchObject({ state: 'step', step: { step: 1 }, verdict: { prd: 7, verdict: 'wait' } });
  });

  it('a parked PRD is passed over, and the steps that wait on it are held', () => {
    const followed = followPlan(plan, live([park(P7), act(P8), act(P9)]));
    expect(followed).toMatchObject({ state: 'step', step: { step: 2 }, verdict: { prd: 9 } });
  });

  it('a PRD that is done counts every step of it done', () => {
    const followed = followPlan(plan, live([done(P7), act(P8), done(P9)]));
    expect(followed).toMatchObject({ state: 'step', step: { step: 4 }, verdict: { prd: 8 } });
  });

  it('stops once every PRD is parked or done, listing what each waits on', () => {
    const followed = followPlan(plan, live([park(P7), act(P8), done(P9)]));
    expect(followed).toEqual({
      state: 'stop',
      waiting: [park(P7), { prd: 8, verdict: 'park', why: 'waits on PRD 7: step 4 comes after step 1' }],
    });
  });

  it('a step waiting for a PRD outside the loop to ship is held until it has', () => {
    const blocked = planLoop({ prds: [prd(P7, [slice('s1', ['a/'], 1)], { blockedBy: [parsePrd(5)] })], shipped: [] });
    expect(followPlan(blocked, live([act(P7)]))).toEqual({ state: 'stop', waiting: [{ prd: 7, verdict: 'park', why: 'waits on PRD 5 to ship' }] });
    expect(followPlan(blocked, live([act(P7)], {}, [5]))).toMatchObject({ state: 'step', step: { step: 1 } });
  });

  it('every step done stops with nothing waiting', () => {
    expect(followPlan(plan, live([done(P7), done(P8), done(P9)]))).toEqual({ state: 'stop', waiting: [] });
  });
});
