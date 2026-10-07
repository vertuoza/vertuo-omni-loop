import { describe, expect, it } from 'vitest';
import { parseConfig } from '../config.ts';
import { parseFlowConfig, type TargetFlow } from '../plan-repo/copy-flow.ts';
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

const ALONE = parseConfig("kit: 1\nrepo:\n  slug: acme/widgets\nlandings:\n  alone: ['^db/migrations/', '/db/migrations/']\n");

describe('gradePlan — landings.alone', () => {
  it('refuses a slice touching a land-alone path and another, naming the slice, its landing and the other prefix', () => {
    const graded = gradePlan(planMd(['| s1 | A | `db/migrations/` `src/total/` | — | 1 |']), { config: ALONE });
    expect(graded.violations).toEqual([expect.stringMatching(/^landing: s1 \(landing 1\) touches db\/migrations\/, which lands alone, and also src\/total\/ — /)]);
  });

  it('refuses a landing holding a land-alone slice and one that is not, naming both', () => {
    const graded = gradePlan(planMd(['| s1 | A | `db/migrations/` | — | 1 |', '| s2 | B | `src/` | — | 1 |']), { config: ALONE });
    expect(graded.violations).toEqual([expect.stringMatching(/^landing: landing 1 holds s1, which land alone, and s2, which do not — /)]);
  });

  it('accepts a PRD whose every slice lands alone, in one landing', () => {
    const graded = gradePlan(
      planMd(['| s1 | A | `db/migrations/2026_add_total` | — | 1 |', '| s2 | B | `services/quote/db/migrations/` | — | 1 |']),
      { config: ALONE },
    );
    expect(graded.violations).toEqual([]);
  });

  it('accepts landing 1 of migrations only and landing 2 of code only', () => {
    const graded = gradePlan(
      planMd(['| s1 | A | `db/migrations/` | — | 1 | 1 |', '| s2 | B | `src/` | — | 1 | 2 |', '| s3 | C | `app/` | s2 | 2 | 2 |'], LANDED),
      { config: ALONE },
    );
    expect(graded.violations).toEqual([]);
  });

  it('refuses nothing new when the config declares no pattern', () => {
    const graded = gradePlan(planMd(['| s1 | A | `db/migrations/` `src/` | — | 1 |', '| s2 | B | `app/` | — | 1 |']), { config: CONFIG });
    expect(graded.violations).toEqual([]);
  });
});

describe('gradePlan — landings in a plan repository', () => {
  it('grades landings that span targets, counting collisions per repository and landing', () => {
    const header = '| id | repo | slice | territory | blocked by | wave | landing |';
    const markdown = [
      '## Repositories',
      '',
      '| repo | role | read at | knowledge |',
      '| --- | --- | --- | --- |',
      `| api | back-end | ${'a'.repeat(40)} | own |`,
      '| plan | plan | — | own |',
      '',
      '## Slices',
      '',
      planMd(['| s1 | api | expand | `src/db/` | — | 1 | 1 |', '| s2 | api | code | `src/` | — | 1 | 2 |', '| s3 | plan | docs | `src/` | — | 1 | 2 |'], header),
    ].join('\n');
    const graded = gradePlan(markdown, { config: PLAN_REPO });
    expect(graded.violations).toEqual([]);
    expect(graded.landings.map(({ landing, slices }) => [landing, slices])).toEqual([[1, ['s1']], [2, ['s2', 's3']]]);
    expect(graded.collisions).toEqual([]);
  });
});

// The spec's Solution example (PRD 1089), its hook files never read by the grading.
const FLOW = parseConfig(`kit: 1
repo:
  slug: acme/widgets
flow:
  rules:
    plan:
      - slice: { maxFiles: 15 }
    subPr: { merge: squash, requireChecks: [phpunit] }
  hooks:
    do-work.test:
      after: .omni-loop/flow/contract-tests.md
  areas:
    kernel:
      paths: ['^src/kernel/']
      rules:
        plan:
          - slice: { alone: true, maxFiles: 5 }
          - wave: first
          - blocks: all
        subPr: { requireChecks: [phpunit, phpstan-max], approval: person }
      hooks:
        do-work.test: { replace: .omni-loop/flow/kernel/tests.md }
    migrations:
      paths: ['^database/migrations/']
      rules:
        plan:
          - slice: { alone: true, maxFiles: 1 }
          - landing: alone
`);

describe('gradePlan — flow rules (PRD 1089)', () => {
  it('refuses a slice mixing a migration and code, naming the slice, the area and slice alone (acceptance 2)', () => {
    const graded = gradePlan(planMd(['| s1 | A | `database/migrations/x.sql` `src/Invoice.php` | — | 1 |']), { config: FLOW });
    expect(graded.violations).toContainEqual(expect.stringMatching(/^flow: s1 touches database\/migrations\/x\.sql \(area migrations\) .* — migrations: slice alone/));
  });

  it('refuses a kernel slice behind another slice, and passes it moved to the first wave (acceptance 3)', () => {
    const behind = gradePlan(planMd(['| s1 | A | `src/Invoice.php` | — | 1 |', '| s2 | B | `src/kernel/Bus/` | s1 | 2 |']), { config: FLOW });
    expect(behind.violations).toContainEqual(expect.stringMatching(/^flow: s2 \(wave 2\) touches area kernel .* — kernel: wave first/));
    const first = gradePlan(planMd(['| s1 | B | `src/kernel/Bus/` | — | 1 |', '| s2 | A | `src/Invoice.php` | s1 | 2 |']), { config: FLOW });
    expect(first.violations).toEqual([]);
  });

  it('refuses what landings.alone refuses, naming the same slices (acceptance 10)', () => {
    const alias = parseConfig("kit: 1\nrepo:\n  slug: acme/widgets\nlandings:\n  alone: ['^database/migrations/']\n");
    const area = parseConfig(
      "kit: 1\nrepo:\n  slug: acme/widgets\nflow:\n  areas:\n    migrations:\n      paths: ['^database/migrations/']\n      rules:\n        plan:\n          - landing: alone\n",
    );
    const named = (lines: string[]) => lines.map((line) => line.replace(/ \(area migrations\)/, ''));
    for (const markdown of [
      planMd(['| s1 | A | `database/migrations/` `src/` | — | 1 |']),
      planMd(['| s1 | A | `database/migrations/` | — | 1 |', '| s2 | B | `src/` | — | 1 |']),
      planMd(['| s1 | A | `database/migrations/` | — | 1 | 1 |', '| s2 | B | `src/` | — | 1 | 2 |'], LANDED),
    ]) {
      expect(named(gradePlan(markdown, { config: area }).violations)).toEqual(gradePlan(markdown, { config: alias }).violations);
    }
  });
});

describe('gradePlan — each target against its own flow (PRD 1089, s6)', () => {
  const MULTI = parseConfig(`kit: 1
repo:
  slug: acme/plan
plan:
  targets:
    - repo: acme/back
      role: back-end
      knowledge: imported
      readAt: ${'b'.repeat(40)}
    - repo: acme/web
      role: front-end
      knowledge: imported
      readAt: ${'c'.repeat(40)}
    - repo: acme/legacy
      role: legacy
      knowledge: none
flow:
  areas:
    docs:
      paths: ['^docs/']
      rules:
        plan:
          - slice: { maxFiles: 1 }
`);
  const back = parseFlowConfig(
    "flow:\n  areas:\n    migrations:\n      paths: ['^src/db/']\n      rules:\n        plan:\n          - slice: { alone: true }\n",
    'back',
  );
  const web = parseFlowConfig("flow:\n  areas:\n    kernel:\n      paths: ['^src/']\n      rules:\n        plan:\n          - wave: first\n", 'web');
  const TARGETS = new Map<string, TargetFlow>([
    ['back', { ok: true, config: back }],
    ['web', { ok: true, config: web }],
  ]);
  const header = '| id | repo | slice | territory | blocked by | wave |';
  const plan = (rows: string[], names: string[]) =>
    [
      '## Repositories',
      '',
      '| repo | role | read at | knowledge |',
      '| --- | --- | --- | --- |',
      ...names.map((name) => (name === 'plan' ? '| plan | plan | — | own |' : `| ${name} | x | ${'a'.repeat(40)} | imported |`)),
      '',
      '## Slices',
      '',
      planMd(rows, header),
    ].join('\n');

  it("grades a back row against back's flow and a web row against web's: one path, two rules (acceptance 12)", () => {
    const graded = gradePlan(
      plan(
        [
          '| s1 | back | mixed | `src/db/x.sql` `src/Invoice.php` | — | 1 |',
          '| s2 | web | mixed | `src/db/x.sql` `src/Invoice.php` | — | 1 |',
          '| s3 | web | late | `lib/` | — | 1 |',
        ],
        ['back', 'web'],
      ),
      { config: MULTI, targets: TARGETS },
    );
    expect(graded.violations).toEqual([
      expect.stringMatching(/^flow \(back\): s1 touches src\/db\/x\.sql \(area migrations\) .* — migrations: slice alone/),
      expect.stringMatching(/^flow \(web\): s2 \(wave 1\) touches area kernel and does not sit before s3 .* — kernel: wave first/),
    ]);
  });

  it("grades the plan repository's own rows against its own flow, and a target with no copied flow against the kit's defaults", () => {
    const graded = gradePlan(
      plan(['| s1 | plan | docs | `docs/a.md` `docs/b.md` | — | 1 |', '| s2 | legacy | docs | `docs/a.md` `docs/b.md` | — | 2 |'], ['legacy', 'plan']),
      { config: MULTI, targets: TARGETS },
    );
    expect(graded.violations).toEqual([expect.stringMatching(/^flow \(plan\): s1 touches 2 paths — docs: slice maxFiles 1/)]);
  });

  it("meets the kit's defaults for every target when no copied flow is given", () => {
    const graded = gradePlan(plan(['| s1 | back | mixed | `src/db/x.sql` `src/Invoice.php` | — | 1 |'], ['back']), { config: MULTI });
    expect(graded.violations).toEqual([]);
  });

  it('refuses a copied flow that cannot be read, once, naming the target and the file', () => {
    const graded = gradePlan(plan(['| s1 | back | a | `src/` | — | 1 |'], ['back']), {
      config: MULTI,
      targets: new Map<string, TargetFlow>([['back', { ok: false, file: '.omni-loop/knowledge/repos/back/flow/config.yml', reason: 'not valid YAML' }]]),
    });
    expect(graded.violations).toEqual(["flow: back's imported flow at .omni-loop/knowledge/repos/back/flow/config.yml cannot be read — not valid YAML"]);
  });
});

describe('gradePlan — readOnly and consumes targets (PRD 1162)', () => {
  const CONSUMING = parseConfig(
    [
      'kit: 1',
      'repo:',
      '  slug: acme/plan',
      'plan:',
      '  targets:',
      '    - repo: acme/api',
      '      role: back-end',
      '      knowledge: none',
      '    - repo: acme/web',
      '      role: front-end',
      '      knowledge: none',
      '      consumes: [api]',
      '    - repo: acme/legacy',
      '      role: legacy',
      '      knowledge: none',
      '      readOnly: true',
      '',
    ].join('\n'),
  );
  const header = '| id | repo | slice | territory | blocked by | wave |';
  const multi = (slices: string[]) => {
    const repos = [...new Set(slices.map((row) => row.split('|')[2]?.trim()))];
    return [
      '## Repositories',
      '',
      '| repo | role | read at | knowledge |',
      '| --- | --- | --- | --- |',
      ...repos.map((repo) => `| ${repo} | target | ${'a'.repeat(40)} | none |`),
      '',
      '## Slices',
      '',
      planMd(slices, header),
    ].join('\n');
  };

  it('refuses a slice in a readOnly target, naming the slice and the target', () => {
    const graded = gradePlan(multi(['| s1 | api | A | `a/` | — | 1 |', '| s2 | legacy | B | `b/` | — | 1 |']), { config: CONSUMING });
    expect(graded.violations).toEqual(['readOnly: s2 lands in legacy, a read-only target — no slice may name it.']);
  });

  it('refuses a consumer slice blocked by a slice of a target it consumes, naming both slices', () => {
    const graded = gradePlan(multi(['| s1 | api | A | `a/` | — | 1 |', '| s2 | web | B | `b/` | s1 | 2 |']), { config: CONSUMING });
    expect(graded.violations).toEqual([
      'consumes: s2 (web) is blocked by s1 (api), and web consumes api — web installs what api publishes from its default branch, so the change it waits on is an earlier PRD of its own.',
    ]);
  });

  it('passes a consumer slice blocked only by slices of its own repository, and a provider blocked by its consumer', () => {
    const own = gradePlan(multi(['| s1 | web | A | `a/` | — | 1 |', '| s2 | web | B | `b/` | s1 | 2 |', '| s3 | api | C | `c/` | — | 1 |']), {
      config: CONSUMING,
    });
    expect(own.violations).toEqual([]);
    const reverse = gradePlan(multi(['| s1 | web | A | `a/` | — | 1 |', '| s2 | api | B | `b/` | s1 | 2 |']), { config: CONSUMING });
    expect(reverse.violations).toEqual([]);
  });

  it('refuses nothing new in a plan repository whose targets carry neither field', () => {
    expect(gradePlan(multi(['| s1 | api | A | `a/` | — | 1 |']), { config: PLAN_REPO }).violations).toEqual([]);
  });
});
