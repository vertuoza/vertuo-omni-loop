import { describe, expect, it } from 'vitest';
import { parseConfig } from '../config.ts';
import { areaOf, resolveFlow, resolveTerritory } from './resolve.ts';

// The spec's Solution example (PRD 1089).
const SPEC_FLOW = `flow:
  rules:
    plan:
      - slice: { maxFiles: 15 }
    subPr: { merge: squash, requireChecks: [phpunit] }
  hooks:
    do-work.test:
      after: .omni-loop/flow/contract-tests.md
    pr.open:
      replace: .omni-loop/flow/open-pr.md
  areas:
    kernel:
      paths: ['^src/kernel/']
      knowledge: kernel
      rules:
        plan:
          - slice: { alone: true, maxFiles: 5 }
          - wave: first
          - blocks: all
        subPr: { requireChecks: [phpunit, phpstan-max], approval: person }
      hooks:
        plan.slice: { before: .omni-loop/flow/kernel/plan.md }
        do-work.test: { replace: .omni-loop/flow/kernel/tests.md }
    migrations:
      paths: ['^database/migrations/']
      rules:
        plan:
          - slice: { alone: true, maxFiles: 1 }
          - landing: alone
`;

const flowOf = (yaml: string) => resolveFlow(parseConfig(`kit: 1\n${yaml}`));
const SPEC = flowOf(SPEC_FLOW);

describe('areaOf', () => {
  it.each([
    ['src/kernel/Bus/Dispatcher.php', 'kernel'],
    ['database/migrations/x.sql', 'migrations'],
    ['src/Invoice.php', 'default'],
    ['vendor/src/kernel/x.php', 'default'],
  ])('puts %s in %s', (path, area) => {
    expect(areaOf(SPEC, path).name).toBe(area);
  });

  it('takes the first area in declared order when two match', () => {
    const flow = flowOf("flow:\n  areas:\n    first:\n      paths: ['^src/']\n    second:\n      paths: ['^src/kernel/']\n");
    expect(areaOf(flow, 'src/kernel/a.php').name).toBe('first');
  });

  it('puts every path in the default area when there is no flow', () => {
    expect(areaOf(flowOf(''), 'src/kernel/a.php').name).toBe('default');
  });
});

describe('resolveFlow', () => {
  it('gives an area what it inherits: the strictest limit, the union of checks, its own merge', () => {
    const kernel = SPEC.areas.find(({ name }) => name === 'kernel');
    expect(kernel?.rules).toEqual({
      plan: { alone: true, maxFiles: 5, waveFirst: true, blocksAll: true, landingAlone: false },
      subPr: { merge: 'squash', requireChecks: ['phpunit', 'phpstan-max'], approval: 'person', territory: null, maxOpen: null },
    });
    expect(kernel?.knowledge).toBe('kernel');
  });

  it('keeps an area that says inherit: false to its own rules and hooks', () => {
    const flow = flowOf(
      "flow:\n  rules:\n    plan:\n      - slice: { maxFiles: 2 }\n    subPr: { requireChecks: [unit] }\n  hooks:\n    do-work.test: a.md\n" +
        "  areas:\n    docs:\n      paths: ['^docs/']\n      inherit: false\n      rules:\n        plan:\n          - slice: { maxFiles: 40 }\n",
    );
    const docs = flow.areas[0];
    expect(docs?.rules.plan.maxFiles).toBe(40);
    expect(docs?.rules.subPr.requireChecks).toEqual([]);
    expect(docs?.hooks).toEqual({});
  });

  it('lets an inheriting area relax nothing: a looser limit loses to the default one', () => {
    const flow = flowOf("flow:\n  rules:\n    plan:\n      - slice: { maxFiles: 2 }\n  areas:\n    docs:\n      paths: ['^docs/']\n      rules:\n        plan:\n          - slice: { maxFiles: 40 }\n");
    expect(flow.areas[0]?.rules.plan.maxFiles).toBe(2);
  });

  it('lets an area replace the default merge method', () => {
    const flow = flowOf("flow:\n  rules:\n    subPr: { merge: squash }\n  areas:\n    kernel:\n      paths: ['^k/']\n      rules:\n        subPr: { merge: rebase }\n");
    expect(flow.areas[0]?.rules.subPr.merge).toBe('rebase');
  });

  it('has no rule and no hook with no flow', () => {
    expect(flowOf('')).toEqual({
      defaultArea: {
        name: 'default',
        patterns: [],
        knowledge: null,
        inherit: false,
        rules: {
          plan: { alone: false, maxFiles: null, waveFirst: false, blocksAll: false, landingAlone: false },
          subPr: { merge: null, requireChecks: [], approval: null, territory: null, maxOpen: null },
        },
        hooks: {},
      },
      areas: [],
    });
  });
});

describe('resolveTerritory', () => {
  const at = (territory: string[]) => resolveTerritory(SPEC, territory);

  it.each([
    [['src/kernel/Bus/'], ['kernel']],
    [['database/migrations/x.sql', 'src/Invoice.php'], ['default', 'migrations']],
    [['src/Invoice.php', 'src/kernel/', 'database/migrations/'], ['default', 'kernel', 'migrations']],
    [[], []],
  ])('puts %j in the areas %j', (territory, areas) => {
    expect(at(territory).areas.map(({ name }) => name)).toEqual(areas);
  });

  it('keeps each area\'s own paths', () => {
    expect(at(['src/a.php', 'src/kernel/b.php', 'src/c.php']).areas.map(({ name, paths }) => [name, paths])).toEqual([
      ['default', ['src/a.php', 'src/c.php']],
      ['kernel', ['src/kernel/b.php']],
    ]);
  });

  it('combines the rules of every area it touches: the strictest limit, the union of checks, approval sticks', () => {
    const { rules } = at(['src/Invoice.php', 'src/kernel/', 'database/migrations/']);
    expect(rules).toEqual({
      plan: { alone: true, maxFiles: 1, waveFirst: true, blocksAll: true, landingAlone: true },
      subPr: { merge: 'squash', requireChecks: ['phpunit', 'phpstan-max'], approval: 'person', territory: null, maxOpen: null },
    });
  });

  it('makes territory: block stick across areas, and keeps the smallest maxOpen', () => {
    const flow = flowOf(
      "flow:\n  rules:\n    subPr: { territory: report, maxOpen: 4 }\n  areas:\n    kernel:\n      paths: ['^k/']\n      inherit: false\n      rules:\n        subPr: { territory: block, maxOpen: 1 }\n",
    );
    expect(resolveTerritory(flow, ['a/', 'k/']).rules.subPr).toMatchObject({ territory: 'block', maxOpen: 1 });
    expect(resolveTerritory(flow, ['a/']).rules.subPr).toMatchObject({ territory: 'report', maxOpen: 4 });
  });

  it('follows the kernel\'s replace over the default area\'s, after hooks adding up', () => {
    const { hooks } = at(['src/kernel/Bus/Dispatcher.php']);
    expect(hooks['do-work.test']).toEqual({
      before: [],
      replace: { area: 'kernel', path: '.omni-loop/flow/kernel/tests.md', alias: null },
      after: [{ area: 'default', path: '.omni-loop/flow/contract-tests.md', alias: null }],
    });
    expect(hooks['plan.slice']?.before).toEqual([{ area: 'kernel', path: '.omni-loop/flow/kernel/plan.md', alias: null }]);
    expect(hooks['pr.open']?.replace).toEqual({ area: 'default', path: '.omni-loop/flow/open-pr.md', alias: null });
  });

  it('names every point of the catalog, with no hook where none applies', () => {
    const { hooks } = resolveTerritory(flowOf(''), ['src/a.php']);
    expect(Object.keys(hooks)).toHaveLength(9);
    expect(hooks['do-work.test']).toEqual({ before: [], replace: null, after: [] });
  });

  it('adds extend hooks up, the default area\'s first, then each area\'s in declared order, each once', () => {
    const flow = flowOf(
      "flow:\n  hooks:\n    do-work.start: d.md\n  areas:\n    one:\n      paths: ['^one/']\n      hooks:\n        do-work.start: { before: b1.md, after: one.md }\n" +
        "    two:\n      paths: ['^two/']\n      hooks:\n        do-work.start: two.md\n",
    );
    const { hooks } = resolveTerritory(flow, ['two/x', 'one/x', 'x']);
    expect(hooks['do-work.start']?.before.map(({ path }) => path)).toEqual(['b1.md']);
    expect(hooks['do-work.start']?.after.map(({ path }) => path)).toEqual(['d.md', 'one.md', 'two.md']);
  });

  it('reports two merge methods and two replace hooks on one slice as conflicts, never settling them', () => {
    const flow = flowOf(
      "flow:\n  areas:\n    one:\n      paths: ['^one/']\n      rules:\n        subPr: { merge: rebase }\n      hooks:\n        pr.open: { replace: o.md }\n" +
        "    two:\n      paths: ['^two/']\n      rules:\n        subPr: { merge: merge }\n      hooks:\n        pr.open: { replace: t.md }\n",
    );
    const both = resolveTerritory(flow, ['one/a', 'two/b']);
    expect(both.conflicts.merge).toEqual([{ area: 'one', method: 'rebase' }, { area: 'two', method: 'merge' }]);
    expect(both.conflicts.replace).toEqual([
      { point: 'pr.open', hooks: [{ area: 'one', path: 'o.md', alias: null }, { area: 'two', path: 't.md', alias: null }] },
    ]);
    expect(both.rules.subPr.merge).toBe('rebase');
    expect(both.hooks['pr.open']?.replace?.path).toBe('o.md');
    expect(resolveTerritory(flow, ['one/a']).conflicts).toEqual({ merge: [], replace: [] });
  });

  it('sees no conflict in one method declared twice, or an area replace over the default one', () => {
    const flow = flowOf(
      "flow:\n  rules:\n    subPr: { merge: rebase }\n  hooks:\n    pr.open: { replace: d.md }\n  areas:\n    one:\n      paths: ['^one/']\n      hooks:\n        pr.open: { replace: o.md }\n",
    );
    const both = resolveTerritory(flow, ['one/a', 'b']);
    expect(both.conflicts).toEqual({ merge: [], replace: [] });
    expect(both.hooks['pr.open']?.replace?.path).toBe('o.md');
  });
});

describe('the aliases of PRD 1086', () => {
  it('reads landings.alone as an area with landing: alone, giving the same result as the flow form', () => {
    const alias = flowOf("landings:\n  alone: ['^db/migrations/', '/db/migrations/']\n");
    const form = flowOf("flow:\n  areas:\n    migrations:\n      paths: ['^db/migrations/', '/db/migrations/']\n      rules:\n        plan:\n          - landing: alone\n");
    for (const territory of [['db/migrations/1.sql'], ['db/migrations/', 'src/total/'], ['app/db/migrations/x.sql'], ['src/']]) {
      const [a, f] = [resolveTerritory(alias, territory), resolveTerritory(form, territory)];
      expect(a.rules).toEqual(f.rules);
      expect(a.hooks).toEqual(f.hooks);
      expect(a.areas.map(({ paths }) => paths)).toEqual(f.areas.map(({ paths }) => paths));
    }
    expect(areaOf(alias, 'db/migrations/1.sql').name).toBe('landings.alone');
    expect(areaOf(alias, 'db/migrations/1.sql').rules.plan.landingAlone).toBe(true);
  });

  it('puts the landings.alone area after the declared ones', () => {
    const flow = flowOf("landings:\n  alone: ['^db/']\nflow:\n  areas:\n    kernel:\n      paths: ['^db/kernel/']\n");
    expect(flow.areas.map(({ name }) => name)).toEqual(['kernel', 'landings.alone']);
    expect(areaOf(flow, 'db/kernel/x').name).toBe('kernel');
  });

  it('reads pr.openWith as the pr.open replace hook marked alias: claude, giving the same result as the flow form', () => {
    const alias = flowOf('pr:\n  openWith: /create-pr\n');
    const form = flowOf('flow:\n  hooks:\n    pr.open: { replace: { path: /create-pr, alias: claude } }\n');
    expect(resolveTerritory(alias, ['src/']).hooks).toEqual(resolveTerritory(form, ['src/']).hooks);
    expect(resolveTerritory(alias, ['src/']).hooks['pr.open']?.replace).toEqual({ area: 'default', path: '/create-pr', alias: 'claude' });
  });
});
