import { describe, expect, it } from 'vitest';
import { parseConfig } from '../config.ts';
import { gradePlan } from '../inbox/plan-grade.ts';
import { parseWorkSliceId } from '../ids.ts';
import { landingPlan, mergeAfterLine } from './landing-plan.ts';

const CONFIG = parseConfig('kit: 1\nrepo:\n  slug: acme/widgets\n');

function chainOf(rows: string[], { landingsTable = '', repo = null }: { landingsTable?: string; repo?: string | null } = {}) {
  const markdown = ['| id | slice | territory | blocked by | wave | landing |', '| --- | --- | --- | --- | --- | --- |', ...rows, '', landingsTable].join('\n');
  const { slices, landings } = gradePlan(markdown, { config: CONFIG });
  return landingPlan({ landings, slices, branches: CONFIG.branches, defaultBranch: 'main', topic: 'widgets', repo });
}

describe('landingPlan', () => {
  it('opens a PRD of one landing on the feature branch, into the default branch, with no suffix', () => {
    expect(chainOf(['| s1 | A | `a/` | — | 1 | 1 |'])).toEqual([
      {
        landing: 1,
        planLanding: 1,
        count: 1,
        name: 'landing-1',
        mergeWhen: null,
        branch: 'feat/widgets',
        base: 'main',
        titleSuffix: '',
        mergeAfter: null,
        slices: [{ id: parseWorkSliceId('s1'), title: 'A' }],
      },
    ]);
  });

  it('stacks landing n on landing n-1, each titled (n/N), each merged after the one before', () => {
    const chain = chainOf(['| s1 | Expand | `db/` | — | 1 | 1 |', '| s2 | Code | `src/` | — | 1 | 2 |', '| s3 | Contract | `db/` | — | 1 | 3 |'], {
      landingsTable: '## Landings\n\n| landing | name | merge when |\n| --- | --- | --- |\n| 1 | expand | — |\n| 2 | code | — |\n| 3 | contract | — |\n',
    });
    expect(chain.map(({ branch, base, titleSuffix }) => ({ branch, base, titleSuffix }))).toEqual([
      { branch: 'feat/widgets-1of3-expand', base: 'main', titleSuffix: ' (1/3)' },
      { branch: 'feat/widgets-2of3-code', base: 'feat/widgets-1of3-expand', titleSuffix: ' (2/3)' },
      { branch: 'feat/widgets-3of3-contract', base: 'feat/widgets-2of3-code', titleSuffix: ' (3/3)' },
    ]);
    expect(chain.map(mergeAfterLine)).toEqual([
      null,
      'Merge after landing 1 (expand) is deployed.',
      'Merge after landing 2 (code) is deployed.',
    ]);
    expect(chain[1]?.slices).toEqual([{ id: parseWorkSliceId('s2'), title: 'Code' }]);
  });

  it("keeps, for one repository of a plan repository's plan, only its landings, numbered within it", () => {
    const slices = [
      { id: parseWorkSliceId('s1'), title: 'Expand', repo: 'api', landing: 1 },
      { id: parseWorkSliceId('s2'), title: 'Code', repo: 'api', landing: 2 },
      { id: parseWorkSliceId('s3'), title: 'Screen', repo: 'web', landing: 2 },
    ];
    const landings = [
      { landing: 1, name: 'expand', mergeWhen: null, slices: [parseWorkSliceId('s1')], waves: [1] },
      { landing: 2, name: 'code', mergeWhen: null, slices: [parseWorkSliceId('s2'), parseWorkSliceId('s3')], waves: [1] },
    ];
    const plan = (repo: string) => landingPlan({ landings, slices, branches: CONFIG.branches, defaultBranch: 'main', topic: 'widgets', repo });
    expect(plan('api').map(({ landing, planLanding, branch, titleSuffix }) => ({ landing, planLanding, branch, titleSuffix }))).toEqual([
      { landing: 1, planLanding: 1, branch: 'feat/widgets-1of2-expand', titleSuffix: ' (1/2)' },
      { landing: 2, planLanding: 2, branch: 'feat/widgets-2of2-code', titleSuffix: ' (2/2)' },
    ]);
    expect(plan('web').map(({ landing, planLanding, branch, base, titleSuffix, mergeAfter }) => ({ landing, planLanding, branch, base, titleSuffix, mergeAfter }))).toEqual([
      { landing: 1, planLanding: 2, branch: 'feat/widgets', base: 'main', titleSuffix: '', mergeAfter: null },
    ]);
  });
});
