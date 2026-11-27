import { describe, expect, it } from 'vitest';
import { parseProductPrdId } from 'omni-loop/kit/lib/ids.ts';
import { productStateOf, type Attempt, type ProductFact, type ProductRun } from './supervisor.ts';

// Bug #3371, the supervisor's reading alone: a build held on a PRD outside the scope whose merged work is on the mission branch
// (`landed`) is sent again as its next run the first time; a second build held so is read as any build held twice (BR-PRODUCT-139),
// and a PRD outside the scope that is not landed still waits for a person.

const P29 = parseProductPrdId('demo-29');
const P27 = parseProductPrdId('demo-27');
const P26 = parseProductPrdId('demo-26');
const fact: ProductFact = { prd: P29, approval: 'standing', blockers: [], targets: ['demo-org/widgets'] };
const where = (landed: readonly typeof P27[]) => ({ joined: new Set<never>(), done: new Set<never>(), branch: 'mission/19-settings', resumes: 3, scope: new Set([P29]), landed: new Set(landed) });

const attempt = (over: Partial<Attempt>): Attempt => ({ id: 'job', status: 'done', outcome: null, reason: null, prUrl: null, ...over });
const build = (run: number, over: Partial<Attempt> = {}): ProductRun => ({ prd: P29, run, job: `job-${String(run)}`, attempts: [attempt({ id: `job-${String(run)}`, ...over })] });

describe('productStateOf, a build held on a PRD outside the scope that is on the branch (bug #3371)', () => {
  it('is sent again as its next run the first time', () => {
    expect(productStateOf(fact, [build(1, { heldOn: [P27] })], where([P27]))).toEqual({ state: 'startable', run: 2 });
  });

  it('a second build held on it is read as any build held twice, never as waiting for the PRD', () => {
    const state = productStateOf(fact, [build(1, { heldOn: [P27], outcome: 'held' }), build(2, { heldOn: [P27], outcome: 'held' })], where([P27]));
    expect(state).toMatchObject({ state: 'waits', why: expect.stringContaining('its build was held twice') as string });
    expect(JSON.stringify(state)).not.toContain("outside the mission's scope");
  });

  it('still waits for a person on the PRDs outside the scope that are not on the branch, naming only those', () => {
    expect(productStateOf(fact, [build(1, { heldOn: [P27, P26] })], where([P27]))).toEqual({
      state: 'waits',
      why: "PRD demo-29: its build waits on PRD demo-26, outside the mission's scope and not on its branch: merge it, or add it to the scope",
    });
  });
});
