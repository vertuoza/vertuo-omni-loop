import { describe, expect, it } from 'vitest';
import { parseConfig } from '../config.ts';
import { gradePlan } from './plan-grade.ts';

const CONFIG = parseConfig('kit: 1\nrepo:\n  slug: acme/widgets\n');
const PLAN_REPO = parseConfig(
  'kit: 1\nrepo:\n  slug: acme/plan\nplan:\n  targets:\n    - repo: acme/api\n      role: back-end\n      knowledge: none\n',
);

function planMd(rows: string[], header = '| id | slice | territory | blocked by | wave |') {
  return ['# A plan', '', header, `|${' --- |'.repeat(header.split('|').length - 2)}`, ...rows, ''].join('\n');
}

describe('gradePlan (PRD 675)', () => {
  it('grades a clean plan: its slices, its waves, no collision, no violation', () => {
    const graded = gradePlan(planMd(['| s1 | A | `a/` | — | 1 |', '| s2 | B | `b/` | s1 | 2 |']), { config: CONFIG });
    expect(graded.slices.map((slice) => slice.id)).toEqual(['s1', 's2']);
    expect(graded.waves).toEqual([1, 2]);
    expect(graded.multi).toBe(false);
    expect(graded.collisions).toEqual([]);
    expect(graded.violations).toEqual([]);
    expect(graded.parseError).toBeNull();
  });

  it('returns the collisions and every violation of a broken plan', () => {
    const graded = gradePlan(
      planMd([
        '| s1 | A | `a/` | s9 | 1 |',
        '| s2 | B | `a/` | s1 | 1 |',
        '| s3 | C | `c/` | — | 2 |',
        '| s3 | D | `d/` | — | 2 |',
      ]),
      { config: CONFIG },
    );
    expect(graded.collisions).toEqual([expect.objectContaining({ left: 's1', right: 's2', wave: 1 })]);
    expect(graded.violations).toEqual([
      'id "s3" is used by more than one slice row.',
      's1 is blocked by "s9", which names no slice in this plan.',
      's2 (wave 1) is blocked by s1 (wave 1) — a blocker must sit in an earlier wave.',
      expect.stringMatching(/^s1 and s2 share .* and both sit in wave 1 — two slices in one wave may never share territory\.$/),
    ]);
    expect(graded.matrices).toEqual([{ repo: null, rows: expect.any(Array) }]);
  });

  it('refuses a repo column outside a plan repository, and grades one inside', () => {
    const header = '| id | repo | slice | territory | blocked by | wave |';
    const markdown = [
      '## Repositories',
      '',
      '| repo | role | read at | knowledge |',
      '| --- | --- | --- | --- |',
      `| api | target | ${'a'.repeat(40)} | none |`,
      '',
      '## Slices',
      '',
      planMd(['| s1 | api | A | `a/` | — | 1 |'], header),
    ].join('\n');
    expect(gradePlan(markdown, { config: CONFIG }).violations).toEqual([
      'repo: a repo column needs a plan repository.',
      '## Repositories: a Repositories table needs a plan repository.',
    ]);
    const inPlanRepo = gradePlan(markdown, { config: PLAN_REPO });
    expect(inPlanRepo.violations).toEqual([]);
    expect(inPlanRepo.multi).toBe(true);
    expect(inPlanRepo.matrices).toEqual([{ repo: 'api', rows: [] }]);
  });

  it('returns a plan it cannot parse as one violation, never a throw', () => {
    const graded = gradePlan('# A plan\n\n| id | slice | wave |\n| --- | --- | --- |\n| s1 | A | 1 |\n', { config: CONFIG });
    expect(graded.parseError).toEqual(expect.any(String));
    expect(graded.violations).toEqual([graded.parseError]);
    expect(graded.slices).toEqual([]);
    expect(graded.waves).toEqual([]);
  });
});
