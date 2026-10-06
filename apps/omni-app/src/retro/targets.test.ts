import { describe, expect, it } from 'vitest';
import { parseConfig } from 'vertuo-omni-plan/kit/lib/config.ts';
import { planTargets } from './targets.ts';

const PLAN_CONFIG = parseConfig(
  [
    'kit: 1',
    'repo:',
    '  slug: acme/plan',
    '  defaultBranch: main',
    'plan:',
    '  targets:',
    '    - repo: acme/backend',
    '      role: back-end',
    '      knowledge: own',
    '    - repo: acme/frontend',
    '      role: front-end',
    '      knowledge: none',
    '',
  ].join('\n'),
);

const PLAN = [
  '# Plan',
  '',
  '## Repositories',
  '',
  '| repo | role | read at | knowledge |',
  '| --- | --- | --- | --- |',
  '| frontend | front-end | abc1234 | none |',
  '| plan | plan | — | own |',
  '| backend | back-end | def5678 | own |',
  '| mobile | mobile | 0123456 | none |',
  '',
  '## Slices',
  '',
  '| id | repo | slice | territory | blocked by | wave |',
  '| --- | --- | --- | --- | --- | --- |',
  '| s1 | backend | The API | `src/api` | — | 1 |',
  '| s2 | frontend | The screen | `src/screen` | s1 | 2 |',
  '| s3 | mobile | The app | `src/app` | s1 | 2 |',
  '',
].join('\n');

describe('planTargets — the targets a retro reads', () => {
  it("names each target row of `## Repositories` in the table's order, the plan repository excepted, with its feature branch", () => {
    expect(planTargets({ config: PLAN_CONFIG, plan: PLAN, planSlug: 'acme/plan', topic: 'widget' })).toEqual([
      { name: 'frontend', slug: 'acme/frontend', branches: ['feat/widget'] },
      { name: 'backend', slug: 'acme/backend', branches: ['feat/widget'] },
      { name: 'mobile', slug: null, branches: ['feat/widget'] },
    ]);
  });

  it('names one feature branch per landing a target has slices in', () => {
    const landed = PLAN.replace('| id | repo | slice | territory | blocked by | wave |', '| id | repo | slice | territory | blocked by | wave | landing |')
      .replace('| --- | --- | --- | --- | --- | --- |', '| --- | --- | --- | --- | --- | --- | --- |')
      .replace('| s1 | backend | The API | `src/api` | — | 1 |', '| s1 | backend | The API | `src/api` | — | 1 | 1 |\n| s4 | backend | The cache | `src/cache` | s1 | 2 | 2 |')
      .replace('| s2 | frontend | The screen | `src/screen` | s1 | 2 |', '| s2 | frontend | The screen | `src/screen` | s1 | 2 | 2 |')
      .replace('| s3 | mobile | The app | `src/app` | s1 | 2 |', '| s3 | mobile | The app | `src/app` | s1 | 2 | 2 |')
      .concat('\n## Landings\n\n| landing | name | merge when |\n| --- | --- | --- |\n| 1 | api | — |\n| 2 | screens | the API is live |\n');
    const backend = planTargets({ config: PLAN_CONFIG, plan: landed, planSlug: 'acme/plan', topic: 'widget' }).find((target) => target.name === 'backend');
    expect(backend?.branches).toEqual(['feat/widget-1of2-api', 'feat/widget-2of2-screens']);
  });

  it('names none for a PRD of one repository: no plan section, no plan, or no `## Repositories`', () => {
    const single = parseConfig('kit: 1\n');
    expect(planTargets({ config: single, plan: PLAN, planSlug: 'acme/plan', topic: 'widget' })).toEqual([]);
    expect(planTargets({ config: PLAN_CONFIG, plan: null, planSlug: 'acme/plan', topic: 'widget' })).toEqual([]);
    expect(planTargets({ config: PLAN_CONFIG, plan: '# Plan\n\n| id | slice | territory |\n| --- | --- | --- |\n| s1 | x | `a` |\n', planSlug: 'acme/plan', topic: 'widget' })).toEqual([]);
  });
});
