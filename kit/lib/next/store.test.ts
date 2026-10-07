// PRD 1139, slice s3: the loop plan kept in the checkout.
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parsePrd, parseWorkSliceId } from '../ids.ts';
import { planLoop } from './plan.ts';
import { LOOP_PLAN_FILE, readLoopPlans, writeLoopPlans } from './store.ts';

const plan = planLoop({ prds: [{ prd: parsePrd(7), blockedBy: [], slices: [{ id: parseWorkSliceId('s1'), territory: ['a/'], wave: 1, state: 'stuck' }], ended: null }], shipped: [] });

describe('the loop plan file', () => {
  it('reads back every version written, and is ignored by git', () => {
    const root = mkdtempSync(join(tmpdir(), 'omni-'));
    writeLoopPlans(root, [plan, { ...plan, version: 2, reason: 'why' }]);
    expect(readLoopPlans(root)).toEqual([plan, { ...plan, version: 2, reason: 'why' }]);
    expect(readFileSync(join(root, dirname(LOOP_PLAN_FILE), '.gitignore'), 'utf8')).toBe('*\n');
  });

  it("keeps a plan repository's steps with their repositories (PRD 1162, slice s1)", () => {
    const root = mkdtempSync(join(tmpdir(), 'omni-'));
    const across = planLoop({ prds: [{ prd: parsePrd(7), blockedBy: [], slices: [{ id: parseWorkSliceId('s1'), territory: ['a/'], wave: 1, state: 'runnable', repo: 'crew' }], ended: null }], shipped: [] });
    writeLoopPlans(root, [across]);
    expect(readLoopPlans(root)[0]?.steps[0]?.repos).toEqual(['crew']);
  });

  it('reads a missing, broken or foreign file as no plan', () => {
    const root = mkdtempSync(join(tmpdir(), 'omni-'));
    expect(readLoopPlans(root)).toEqual([]);
    mkdirSync(join(root, dirname(LOOP_PLAN_FILE)), { recursive: true });
    writeFileSync(join(root, LOOP_PLAN_FILE), '{"versions": [');
    expect(readLoopPlans(root)).toEqual([]);
    writeFileSync(join(root, LOOP_PLAN_FILE), '{"versions": []}');
    expect(readLoopPlans(root)).toEqual([]);
  });
});
