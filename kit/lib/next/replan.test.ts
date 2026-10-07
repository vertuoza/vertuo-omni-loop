// PRD 1139, slice s3: replanning — a new plan version only when reality breaks the plan.
import { describe, expect, it } from 'vitest';
import { parsePrd, parseWorkSliceId } from '../ids.ts';
import { planLoop } from './plan.ts';
import type { PlanSliceInput, PrdInput } from './plan.ts';
import { replan, replanLine } from './replan.ts';

const slice = (id: string, territory: string[], wave: number, state: PlanSliceInput['state'] = 'runnable'): PlanSliceInput => ({
  id: parseWorkSliceId(id),
  territory,
  wave,
  state,
});
const prd = (n: number, slices: PlanSliceInput[] | null, over: Partial<PrdInput> = {}): PrdInput => ({ prd: parsePrd(n), blockedBy: [], slices, ended: null, ...over });

const first = [prd(1030, [slice('s4', ['nav/'], 1), slice('s5', ['m/'], 2)]), prd(1040, [slice('s1', ['nav/a'], 1)])];
const v1 = planLoop({ prds: first, shipped: [] });

describe('replan', () => {
  it('nothing changed gives no new version, even as slices merge and claims move', () => {
    const moved = [prd(1030, [slice('s4', ['nav/'], 1, 'merged'), slice('s5', ['m/'], 2, 'in-flight')]), prd(1040, [slice('s1', ['nav/a'], 1)])];
    expect(replan(v1, { prds: first, shipped: [] })).toBeNull();
    expect(replan(v1, { prds: moved, shipped: [] })).toBeNull();
  });

  it('a stuck slice gives a new version, and says who moves up', () => {
    const stuck = [prd(1030, [slice('s4', ['nav/'], 1, 'stuck'), slice('s5', ['m/'], 2)]), prd(1040, [slice('s1', ['nav/a'], 1)])];
    const v2 = replan(v1, { prds: stuck, shipped: [] });
    expect(v2?.version).toBe(2);
    expect(v2?.reason).toBe('s4 of PRD 1030 stuck → 1040 moves up');
    expect(v2 && replanLine(v2)).toBe('replanned v2: s4 of PRD 1030 stuck → 1040 moves up');
    expect(v2?.steps[0]).toMatchObject({ prd: 1040, kind: 'wave' });
    expect(v2 && replan(v2, { prds: stuck, shipped: [] })).toBeNull();
  });

  it('an added slice gives a new version', () => {
    const added = [prd(1030, [slice('s4', ['nav/'], 1), slice('s5', ['m/'], 2), slice('s6', ['q/'], 2)]), prd(1040, [slice('s1', ['nav/a'], 1)])];
    expect(replan(v1, { prds: added, shipped: [] })?.reason).toBe('s6 added to PRD 1030');
  });

  it('a PRD that gets its plan gives a new version', () => {
    const before = planLoop({ prds: [prd(7, null)], shipped: [] });
    const after = replan(before, { prds: [prd(7, [slice('s1', ['a/'], 1)])], shipped: [] });
    expect(after?.reason).toBe('PRD 7 planned');
    expect(after?.steps.map((step) => step.kind)).toEqual(['wave', 'finish']);
  });

  it('an early ship or close gives a new version; a PRD that ends once every slice merged does not', () => {
    const closed = [prd(1030, [slice('s4', ['nav/'], 1), slice('s5', ['m/'], 2)], { ended: 'closed' }), prd(1040, [slice('s1', ['nav/a'], 1)])];
    expect(replan(v1, { prds: closed, shipped: [] })?.reason).toBe('PRD 1030 closed early');
    const shipped = [prd(1030, [slice('s4', ['nav/'], 1, 'merged'), slice('s5', ['m/'], 2, 'merged')], { ended: 'merged' }), prd(1040, [slice('s1', ['nav/a'], 1)])];
    expect(replan(v1, { prds: shipped, shipped: [] })).toBeNull();
  });

  it('a dropped slice gives a new version, several changes one line', () => {
    const changed = [prd(1030, [slice('s4', ['nav/'], 1)]), prd(1040, [slice('s1', ['nav/a'], 1, 'stuck')])];
    expect(replan(v1, { prds: changed, shipped: [] })?.reason).toBe('s5 dropped from PRD 1030; s1 of PRD 1040 stuck');
  });
});
