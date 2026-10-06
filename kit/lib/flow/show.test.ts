import { describe, expect, it } from 'vitest';
import { parseConfig } from '../config.ts';
import { flowPoint } from './points.ts';
import { resolveFlow } from './resolve.ts';
import { flowDifferences, parseHookFile, showPath, showPoint } from './show.ts';
import { assertDefined } from '../../test/assert.ts';

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
const NONE = flowOf('');

const KERNEL_TESTS = [
  '---',
  'omni-hook: do-work.test',
  'inputs: [territory]',
  '---',
  'Run phpunit on {territory} only.',
  '',
  'omni-hook do-work.test: pass',
  '',
].join('\n');
const CONTRACT = 'omni-hook: do-work.test\n\nRun the contract tests for slice {slice}.\n';
const FILES: Record<string, string> = {
  '.omni-loop/flow/kernel/tests.md': KERNEL_TESTS,
  '.omni-loop/flow/contract-tests.md': CONTRACT,
};
const readHook = (path: string) => FILES[path] ?? null;
const point = (name: string) => {
  const found = flowPoint(name);
  assertDefined(found, name);
  return found;
};
const KERNEL_SLICE = {
  territory: ['src/kernel/Bus/'],
  values: { prd: '912', slice: 's2', territory: 'src/kernel/Bus/', branch: 'feat/bus--s2' },
};

describe('parseHookFile', () => {
  it.each([
    ['fenced front matter', KERNEL_TESTS, { omniHook: 'do-work.test', inputs: ['territory'], verdict: null }],
    ['a bare first paragraph', CONTRACT, { omniHook: 'do-work.test', inputs: null, verdict: null }],
    ['no front matter', 'Just do it.\n', { omniHook: null, inputs: null, verdict: null }],
  ])('reads %s', (_name, text, expected) => {
    expect(parseHookFile(text)).toMatchObject(expected);
  });

  it('keeps the body without its front matter', () => {
    expect(parseHookFile(KERNEL_TESTS).body).toBe('Run phpunit on {territory} only.\n\nomni-hook do-work.test: pass\n');
  });
});

describe('showPoint', () => {
  it('prints no hook and kitStep run with no flow (spec acceptance 1)', () => {
    const view = showPoint(NONE, point('do-work.test'), { readHook });
    expect(view).toMatchObject({ point: 'do-work.test', areas: ['default'], before: [], replace: null, after: [], kitStep: 'run', problems: [] });
  });

  it("returns a kernel slice's replace hook with its text, territory and verdict (spec acceptance 6)", () => {
    expect(showPoint(SPEC, point('do-work.test'), { ...KERNEL_SLICE, readHook })).toMatchSnapshot();
  });

  it('fills the inputs the slice gives into the hook text, and leaves the others as written', () => {
    const view = showPoint(SPEC, point('do-work.test'), { territory: ['src/kernel/Bus/'], values: { territory: 'src/kernel/Bus/' }, readHook });
    expect(view.replace?.text).toContain('Run phpunit on src/kernel/Bus/ only.');
    expect(view.after[0]?.text).toContain('slice {slice}.');
    expect(view.after[0]?.inputs).toEqual({ prd: null, slice: null, territory: 'src/kernel/Bus/', branch: null });
  });

  it('meets only the default area with no territory', () => {
    const view = showPoint(SPEC, point('do-work.test'), { readHook });
    expect(view).toMatchObject({ areas: ['default'], replace: null, kitStep: 'run' });
    expect(view.after.map(({ path }) => path)).toEqual(['.omni-loop/flow/contract-tests.md']);
  });

  it('fails closed on a hook file that is not there', () => {
    const view = showPoint(SPEC, point('pr.open'), { readHook });
    expect(view.problems).toEqual(['.omni-loop/flow/open-pr.md (default, replace) does not exist']);
    expect(view.replace?.text).toBeNull();
  });

  it("names a hook whose front matter names another point", () => {
    const view = showPoint(SPEC, point('pr.open'), { readHook: () => 'omni-hook: do-work.test\n\nOpen it.\n' });
    expect(view.problems).toEqual(['.omni-loop/flow/open-pr.md (default, replace) says omni-hook: do-work.test, not pr.open']);
  });

  it("hands a Claude-only command over without reading a file", () => {
    const flow = resolveFlow(parseConfig('kit: 1\npr:\n  openWith: /create-pr\n'));
    const view = showPoint(flow, point('pr.open'), { readHook: () => null });
    expect(view).toMatchObject({ kitStep: 'replaced', problems: [], replace: { path: '/create-pr', alias: 'claude', text: null } });
  });

  it('carries no Claude path, slash command or tool name in a flow with no alias', () => {
    for (const { point: name } of [point('do-work.test'), point('pr.open'), point('plan.slice')]) {
      const json = JSON.stringify(showPoint(SPEC, point(name), { ...KERNEL_SLICE, readHook }));
      expect(json).not.toMatch(/\.claude\/|"\/[a-z][\w:-]*"|\/omni:|\b(Bash|Skill|Agent|Read|Edit|Write)\b/);
    }
  });
});

describe('showPath', () => {
  it('prints the area of a kernel path, its rules and its hooks (spec acceptance 4)', () => {
    expect(showPath(SPEC, 'src/kernel/Bus/Dispatcher.php')).toMatchSnapshot();
  });

  it('puts any other path in the default area', () => {
    expect(showPath(SPEC, 'src/Invoice.php')).toMatchObject({ area: 'default', paths: [] });
  });
});

describe('flowDifferences', () => {
  it('is empty with no flow', () => {
    expect(flowDifferences(NONE)).toEqual([]);
  });

  it("names each difference from the kit's defaults, area by area (spec acceptance 5)", () => {
    expect(flowDifferences(SPEC)).toMatchSnapshot();
  });

  it('counts squash and territory report as the defaults they are', () => {
    expect(flowDifferences(flowOf('flow:\n  rules:\n    subPr: { merge: squash, territory: report }\n'))).toEqual([]);
  });

  it('names the landings.alone alias as its own area', () => {
    expect(flowDifferences(resolveFlow(parseConfig("kit: 1\nlandings:\n  alone: ['^db/']\n")))).toEqual([
      { area: 'landings.alone', paths: ['^db/'], inherit: true, rules: ['landing alone'], hooks: [] },
    ]);
  });
});
