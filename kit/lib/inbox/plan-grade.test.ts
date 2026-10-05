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
    const anyRows: unknown = expect.any(Array);
    expect(graded.matrices).toEqual([{ repo: null, rows: anyRows }]);
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

const LANDED = '| id | slice | territory | blocked by | wave | landing |';

function landingsTable(rows: string[]) {
  return ['', '## Landings', '', '| landing | name | merge when |', '| --- | --- | --- |', ...rows, ''].join('\n');
}

describe('gradePlan — landings', () => {
  it('grades a plan with no landing column as one landing, as it always did', () => {
    const graded = gradePlan(planMd(['| s1 | A | `a/` | — | 1 |', '| s2 | B | `b/` | s1 | 2 |']), { config: CONFIG });
    expect(graded.slices.map((slice) => slice.landing)).toEqual([1, 1]);
    expect(graded.landings).toEqual([{ landing: 1, name: 'landing-1', mergeWhen: null, slices: ['s1', 's2'], waves: [1, 2] }]);
    expect(graded.violations).toEqual([]);
  });

  it('counts waves within each landing and names landings landing-<n> without a table', () => {
    const graded = gradePlan(
      planMd(
        ['| s1 | expand | `db/` | — | 1 | 1 |', '| s2 | read it | `src/a/` | — | 1 | 2 |', '| s3 | show it | `src/b/` | s2 | 2 | 2 |'],
        LANDED,
      ),
      { config: CONFIG },
    );
    expect(graded.violations).toEqual([]);
    expect(graded.slices.map((slice) => [slice.id, slice.landing])).toEqual([['s1', 1], ['s2', 2], ['s3', 2]]);
    expect(graded.landings).toEqual([
      { landing: 1, name: 'landing-1', mergeWhen: null, slices: ['s1'], waves: [1] },
      { landing: 2, name: 'landing-2', mergeWhen: null, slices: ['s2', 's3'], waves: [1, 2] },
    ]);
  });

  it('reads the names and merge conditions of a ## Landings table', () => {
    const markdown =
      planMd(['| s1 | expand | `db/` | — | 1 | 1 |', '| s2 | code | `src/` | — | 1 | 2 |'], LANDED) +
      landingsTable(['| 1 | expand | the column exists nowhere yet |', '| 2 | code | landing 1 is deployed |']);
    const graded = gradePlan(markdown, { config: CONFIG });
    expect(graded.violations).toEqual([]);
    expect(graded.landings.map(({ landing, name, mergeWhen }) => ({ landing, name, mergeWhen }))).toEqual([
      { landing: 1, name: 'expand', mergeWhen: 'the column exists nowhere yet' },
      { landing: 2, name: 'code', mergeWhen: 'landing 1 is deployed' },
    ]);
  });

  it('refuses landings that do not run from 1 with no gap, naming the missing one', () => {
    const graded = gradePlan(planMd(['| s1 | A | `a/` | — | 1 | 1 |', '| s2 | B | `b/` | — | 1 | 3 |'], LANDED), { config: CONFIG });
    expect(graded.violations).toEqual([expect.stringMatching(/^landing: no slice sits in landing 2 /)]);
  });

  it('refuses a landing cell that is no whole number from 1', () => {
    const graded = gradePlan(planMd(['| s1 | A | `a/` | — | 1 | first |', '| s2 | B | `b/` | — | 1 | 0 |'], LANDED), { config: CONFIG });
    expect(graded.violations).toEqual([expect.stringMatching(/^landing: s1 reads/), expect.stringMatching(/^landing: s2 reads "0"/)]);
  });

  it('refuses a slice blocked by a slice of another landing', () => {
    const graded = gradePlan(planMd(['| s1 | A | `a/` | — | 1 | 1 |', '| s2 | B | `b/` | s1 | 1 | 2 |'], LANDED), { config: CONFIG });
    expect(graded.violations).toEqual([expect.stringMatching(/^blocked by: s2 \(landing 2\) is blocked by s1 \(landing 1\)/)]);
  });

  it('sees a same-wave collision within a landing, and none across landings', () => {
    const across = gradePlan(planMd(['| s1 | A | `src/` | — | 1 | 1 |', '| s2 | B | `src/` | — | 1 | 2 |'], LANDED), { config: CONFIG });
    expect(across.collisions).toEqual([]);
    expect(across.violations).toEqual([]);
    expect(across.matrices[0]?.rows).toEqual([{ pair: 's1 · s2', shared: '`src/`', resolved: 's1 l1w1 · s2 l2w1' }]);

    const within = gradePlan(
      planMd(['| s0 | Z | `z/` | — | 1 | 1 |', '| s1 | A | `src/` | — | 1 | 2 |', '| s2 | B | `src/` | — | 1 | 2 |'], LANDED),
      { config: CONFIG },
    );
    expect(within.collisions).toEqual([expect.objectContaining({ left: 's1', right: 's2', wave: 1 })]);
    expect(within.violations).toEqual([expect.stringMatching(/^s1 and s2 share `?src\/`? and both sit in wave 1 of landing 2 — /)]);
  });

  it('refuses a ## Landings table that names a landing the slices do not use, or misses one they use', () => {
    const extra =
      planMd(['| s1 | A | `a/` | — | 1 | 1 |', '| s2 | B | `b/` | — | 1 | 2 |'], LANDED) +
      landingsTable(['| 1 | expand | — |', '| 2 | code | — |', '| 3 | contract | — |']);
    expect(gradePlan(extra, { config: CONFIG }).violations).toEqual(['## Landings: landing 3 has a row and holds no slice.']);

    const missing = planMd(['| s1 | A | `a/` | — | 1 | 1 |', '| s2 | B | `b/` | — | 1 | 2 |'], LANDED) + landingsTable(['| 1 | expand | — |']);
    expect(gradePlan(missing, { config: CONFIG }).violations).toEqual(['## Landings: landing 2 holds slices and has no row.']);
  });

  it('refuses a landing name that is not kebab-case, and a landing with two rows', () => {
    const markdown = planMd(['| s1 | A | `a/` | — | 1 | 1 |'], LANDED) + landingsTable(['| 1 | The Expand | — |', '| 1 | expand | — |']);
    expect(gradePlan(markdown, { config: CONFIG }).violations).toEqual([
      '## Landings: landing 1 is named "The Expand", not one kebab-case name.',
      '## Landings: landing 1 has more than one row.',
    ]);
  });

  it('grades a column whose every value is 1 as one landing', () => {
    const graded = gradePlan(planMd(['| s1 | A | `a/` | — | 1 | 1 |', '| s2 | B | `a/` | s1 | 2 | 1 |'], LANDED), { config: CONFIG });
    expect(graded.violations).toEqual([]);
    expect(graded.landings).toHaveLength(1);
    expect(graded.matrices[0]?.rows).toEqual([{ pair: 's1 · s2', shared: '`a/`', resolved: 's1 w1 · s2 w2' }]);
  });
});
