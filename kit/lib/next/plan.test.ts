// PRD 1139, slice s3: the loop plan — every slice of every driven PRD in numbered steps.
import { describe, expect, it } from 'vitest';
import { parsePrd, parseWorkSliceId } from '../ids.ts';
import { crossOrders, planLoop } from './plan.ts';
import type { PlanSliceInput, PrdInput } from './plan.ts';

const slice = (id: string, territory: string[], wave: number | null, state: PlanSliceInput['state'] = 'runnable'): PlanSliceInput => ({
  id: parseWorkSliceId(id),
  territory,
  wave,
  state,
});
const prd = (n: number, slices: PlanSliceInput[] | null, over: Partial<PrdInput> = {}): PrdInput => ({ prd: parsePrd(n), blockedBy: [], slices, ended: null, ...over });

/** Each step as `<prd> <kind> <wave> [<slices>]`, in order. */
const shape = (plan: ReturnType<typeof planLoop>) => plan.steps.map((step) => `${step.step}: ${step.prd} ${step.kind}${step.wave === null ? '' : ` w${step.wave}`}${step.slices.length ? ` ${step.slices.join(',')}` : ''}`);

describe('planLoop', () => {
  it("keeps each PRD's waves in order, then a finish step", () => {
    const plan = planLoop({ prds: [prd(7, [slice('s2', ['b/'], 2), slice('s1', ['a/'], 1), slice('s3', ['c/'], 1)])], shipped: [] });
    expect(shape(plan)).toEqual(['1: 7 wave w1 s1,s3', '2: 7 wave w2 s2', '3: 7 finish']);
    expect(plan.version).toBe(1);
    expect(plan.reason).toBeNull();
    expect(plan.steps[1]?.after).toEqual([1]);
  });

  it('runs two PRDs whose slices share territory in series, and says why', () => {
    const plan = planLoop({
      prds: [prd(1030, [slice('s3', ['apps/galaxy/src/nav/'], 1)]), prd(1017, [slice('s2', ['apps/galaxy/src/nav/sidebar.ts', 'x/'], 1)])],
      shipped: [],
    });
    expect(shape(plan)).toEqual(['1: 1017 wave w1 s2', '2: 1017 finish', '3: 1030 wave w1 s3', '4: 1030 finish']);
    expect(plan.steps[2]?.after).toEqual([1]);
    expect(plan.steps[2]?.why).toEqual(['1030 s3 after 1017 s2: both touch apps/galaxy/src/nav/']);
    expect(crossOrders(plan)).toEqual(['step 3: 1030 s3 after 1017 s2: both touch apps/galaxy/src/nav/']);
    expect(plan.steps[1]?.beside).toEqual([3]);
  });

  it('marks PRDs that share nothing to run beside each other', () => {
    const plan = planLoop({ prds: [prd(8, [slice('s1', ['b/'], 1)]), prd(7, [slice('s1', ['a/'], 1)])], shipped: [] });
    expect(shape(plan)).toEqual(['1: 7 wave w1 s1', '2: 8 wave w1 s1', '3: 7 finish', '4: 8 finish']);
    expect(plan.steps[0]?.beside).toEqual([2]);
    expect(plan.steps[1]?.beside).toEqual([1]);
    expect(plan.steps[2]?.beside).toEqual([4]);
    expect(crossOrders(plan)).toEqual([]);
  });

  it('holds blocked-by between driven PRDs: the blocked one waits until the other ships', () => {
    const plan = planLoop({ prds: [prd(7, [slice('s1', ['a/'], 1)], { blockedBy: [parsePrd(9)] }), prd(9, [slice('s1', ['b/'], 1)])], shipped: [] });
    expect(shape(plan)).toEqual(['1: 9 wave w1 s1', '2: 9 finish', '3: 7 wave w1 s1', '4: 7 finish']);
    expect(plan.steps[2]?.after).toEqual([2]);
    expect(plan.steps[2]?.why).toEqual(['7 after 9: blocked by it until it ships']);
  });

  it('a blocker outside the loop that has not shipped is waited for; one that has shipped is not', () => {
    const waiting = planLoop({ prds: [prd(7, [slice('s1', ['a/'], 1)], { blockedBy: [parsePrd(5)] })], shipped: [] });
    expect(waiting.steps[0]?.waitsFor).toEqual([5]);
    expect(waiting.steps[0]?.why).toEqual(['7 waits for 5 to ship']);
    const free = planLoop({ prds: [prd(7, [slice('s1', ['a/'], 1)], { blockedBy: [parsePrd(5)] })], shipped: [parsePrd(5)] });
    expect(free.steps[0]?.waitsFor).toEqual([]);
  });

  it('a PRD with no plan yet is one plan step', () => {
    const plan = planLoop({ prds: [prd(7, null)], shipped: [] });
    expect(shape(plan)).toEqual(['1: 7 plan']);
  });

  it('a slice already merged orders nothing, and a PRD with a stuck slice gives way', () => {
    const merged = planLoop({ prds: [prd(7, [slice('s1', ['a/'], 1)]), prd(8, [slice('s1', ['a/'], 1, 'merged')])], shipped: [] });
    expect(crossOrders(merged)).toEqual([]);
    const stuck = planLoop({ prds: [prd(7, [slice('s1', ['a/'], 1, 'stuck')]), prd(8, [slice('s1', ['a/'], 1)])], shipped: [] });
    expect(shape(stuck)).toEqual(['1: 8 wave w1 s1', '2: 8 finish', '3: 7 wave w1 s1', '4: 7 finish']);
    expect(stuck.steps[2]?.why).toEqual(['7 s1 after 8 s1: both touch a/']);
  });

  it('a slice with no wave runs after the numbered waves', () => {
    const plan = planLoop({ prds: [prd(7, [slice('s9', ['z/'], null), slice('s1', ['a/'], 1)])], shipped: [] });
    expect(shape(plan)).toEqual(['1: 7 wave w1 s1', '2: 7 wave s9', '3: 7 finish']);
  });

  it('the same plans and boards give the same steps, whatever order they come in', () => {
    const a = prd(1030, [slice('s3', ['n/'], 1), slice('s4', ['m/'], 2)]);
    const b = prd(1017, [slice('s2', ['n/'], 1)]);
    const c = prd(1040, [slice('s1', ['m/'], 1)], { blockedBy: [parsePrd(1017)] });
    const one = planLoop({ prds: [a, b, c], shipped: [] });
    const two = planLoop({ prds: [c, b, a], shipped: [] });
    expect(two).toEqual(one);
  });

  it('records what it saw, so a later tick can tell what changed', () => {
    const plan = planLoop({ prds: [prd(7, [slice('s1', ['a/'], 1, 'stuck'), slice('s2', ['b/'], 1)])], shipped: [] });
    expect(plan.seen).toEqual([{ prd: 7, slices: ['s1', 's2'], stuck: ['s1'], ended: null }]);
    expect(plan.prds).toEqual([7]);
  });
});
