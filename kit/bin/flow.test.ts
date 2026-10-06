// `omni flow show` and `omni flow verdict` (PRD 1089, s4), through the CLI.
import type { ExecFileSyncOptions } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { makeRepo, realExec } from '../test/fixture.ts';
import { main } from './omni.ts';

function io() {
  const out: string[] = [];
  const err: string[] = [];
  return { out, err, stdout: { write: (s: string) => out.push(s) }, stderr: { write: (s: string) => err.push(s) } };
}

const HEAD = 'kit: 1\nrepo:\n  slug: acme/widgets\n';

// The spec's Solution example, and the hook files it names.
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
const HOOK_FILES = {
  '.omni-loop/flow/contract-tests.md': 'omni-hook: do-work.test\n\nRun the contract tests of slice {slice}.\n',
  '.omni-loop/flow/open-pr.md': 'omni-hook: pr.open\n\nOpen the PR from {head} into {base}.\n',
  '.omni-loop/flow/kernel/plan.md': 'omni-hook: plan.slice\n\nGo through the kernel notes first.\n',
  '.omni-loop/flow/kernel/tests.md': '---\nomni-hook: do-work.test\ninputs: [territory]\n---\nRun phpunit on {territory} only.\n',
};
const PLAN = [
  '# A plan',
  '',
  '| id | slice | territory | blocked by | wave |',
  '| --- | --- | --- | --- | --- |',
  '| s1 | The bus | `src/kernel/Bus/` | — | 1 |',
  '| s2 | Invoices | `src/Invoice.php` | s1 | 2 |',
  '',
].join('\n');

async function omni(args: string[], { flow = SPEC_FLOW, files = HOOK_FILES }: { flow?: string; files?: Record<string, string> } = {}) {
  const { root } = makeRepo({
    git: true,
    files: { '.omni-loop/config.yml': HEAD + flow, '.omni-loop/delivery/inbox/0912-bus/plan.md': PLAN, ...files },
  });
  const s = io();
  const code = await main(args, { cwd: root, ...s });
  return { code, out: s.out.join(''), err: s.err.join(''), root };
}

describe('omni flow show <point>', () => {
  it('prints no hook and kitStep: run with no flow (spec acceptance 1)', async () => {
    const { code, out } = await omni(['flow', 'show', 'do-work.test'], { flow: '', files: {} });
    expect(code).toBe(0);
    expect(out).toBe('point    do-work.test\nareas    default\nhooks    none\nkitStep: run\n');
  });

  it("returns a kernel slice's replace hook as JSON (spec acceptance 6)", async () => {
    const { code, out } = await omni(['flow', 'show', 'do-work.test', '--prd', '912', '--slice', 's1', '--json']);
    expect(code).toBe(0);
    expect(JSON.parse(out)).toMatchSnapshot();
  });

  it("prints a slice's hooks as text, each with its text", async () => {
    const { code, out } = await omni(['flow', 'show', 'do-work.test', '--prd', '912', '--slice', 's1']);
    expect(code).toBe(0);
    expect(out).toMatchSnapshot();
  });

  it('reads a path as the territory', async () => {
    const { code, out } = await omni(['flow', 'show', 'plan.slice', '--path', 'src/kernel/Bus/Dispatcher.php', '--json']);
    expect(code).toBe(0);
    expect(JSON.parse(out)).toMatchObject({ areas: ['kernel'], before: [{ path: '.omni-loop/flow/kernel/plan.md' }], kitStep: 'run' });
  });

  it('refuses, exit 1, when a hook file is not there', async () => {
    const { code, out } = await omni(['flow', 'show', 'pr.open'], { files: {} });
    expect(code).toBe(1);
    expect(out).toMatch(/^not ok pr\.open \.omni-loop\/flow\/open-pr\.md \(default, replace\) does not exist$/m);
  });

  it.each([
    [['flow', 'show', 'do-work.lint'], /not a point of the catalog/],
    [['flow', 'show', 'do-work.test', '--prd', '912'], /--prd and --slice go together/],
    [['flow', 'show', 'do-work.test', '--prd', '912', '--slice', 's9'], /PRD 912's plan has no slice s9/],
    [['flow', 'show', 'do-work.test', '--prd', '912', '--slice', 's1', '--path', 'a'], /either --prd and --slice, or --path/],
  ])('refuses %j as a usage error', async (args, message) => {
    const { code, err } = await omni(args);
    expect(code).toBe(2);
    expect(err).toMatch(message);
  });

  it('carries no Claude path, slash command or tool name in any point\'s JSON', async () => {
    for (const point of ['plan.slice', 'plan.done', 'do-work.start', 'do-work.test', 'pr.open', 'wave.merge', 'yolo.ready']) {
      const { out } = await omni(['flow', 'show', point, '--prd', '912', '--slice', 's1', '--json']);
      expect(out).not.toMatch(/\.claude\/|"\/[a-z][\w:-]*"|\/omni:|\b(Bash|Skill|Agent|Read|Edit|Write)\b/);
    }
  });
});

describe('omni flow show --path', () => {
  it('prints a kernel path\'s area, rules and hooks (spec acceptance 4)', async () => {
    const { code, out } = await omni(['flow', 'show', '--path', 'src/kernel/Bus/Dispatcher.php']);
    expect(code).toBe(0);
    expect(out).toMatchSnapshot();
  });

  it('prints it as JSON', async () => {
    const { out } = await omni(['flow', 'show', '--path', 'src/kernel/Bus/Dispatcher.php', '--json']);
    expect(JSON.parse(out)).toMatchObject({ area: 'kernel', knowledge: 'kernel', rules: { subPr: { approval: 'person' } } });
  });
});

describe('omni flow show', () => {
  it("prints each difference from the kit's defaults, area by area (spec acceptance 5)", async () => {
    const { code, out } = await omni(['flow', 'show']);
    expect(code).toBe(0);
    expect(out).toMatchSnapshot();
  });

  it('prints them as JSON', async () => {
    const { out } = await omni(['flow', 'show', '--json']);
    expect(JSON.parse(out)).toMatchObject([{ area: 'default' }, { area: 'kernel' }, { area: 'migrations' }]);
  });

  it('says the repository runs the defaults with no flow', async () => {
    const { code, out } = await omni(['flow', 'show'], { flow: '', files: {} });
    expect(code).toBe(0);
    expect(out).toBe("flow — none: this repository runs the kit's defaults.\n");
  });
});

describe('omni flow verdict', () => {
  it.each([
    ['ran 12 tests\nomni-hook do-work.test: pass\n', 0, 'ok\n'],
    ['omni-hook do-work.test: fail 2 tests red\n', 1, 'not ok do-work.test 2 tests red\n'],
    ['ran 12 tests\n', 1, 'not ok do-work.test no verdict\n'],
  ])('reads %j (spec acceptance 7)', async (output, exit, printed) => {
    const { root } = makeRepo({ git: true, files: { '.omni-loop/config.yml': HEAD } });
    writeFileSync(join(root, 'out.txt'), output);
    const s = io();
    const code = await main(['flow', 'verdict', 'do-work.test', '--from', 'out.txt'], { cwd: root, ...s });
    expect(code).toBe(exit);
    expect(s.out.join('')).toBe(printed);
  });

  it.each([
    [['flow', 'verdict', 'do-work.test'], /usage: omni flow verdict <point> --from <file>/],
    [['flow', 'verdict', 'do-work.lint', '--from', 'out.txt'], /not a point of the catalog/],
    [['flow', 'verdict', 'do-work.test', '--from', 'missing.txt'], /cannot read missing\.txt/],
  ])('refuses %j as a usage error', async (args, message) => {
    const { code, err } = await omni(args);
    expect(code).toBe(2);
    expect(err).toMatch(message);
  });
});

// `omni flow check merge` (PRD 1089, s5): the sub-PR's facts come from a faked `gh`, git runs for real.
const KERNEL_REBASE = SPEC_FLOW.replace(
  'subPr: { requireChecks: [phpunit, phpstan-max], approval: person }',
  'subPr: { merge: rebase, requireChecks: [phpunit, phpstan-max], approval: person }',
);
const GREEN = [
  { __typename: 'CheckRun', name: 'phpunit', status: 'COMPLETED', conclusion: 'SUCCESS' },
  { __typename: 'CheckRun', name: 'phpstan-max', status: 'COMPLETED', conclusion: 'SUCCESS' },
];
const APPROVED = [{ author: { login: 'ada' }, state: 'APPROVED' }];
type Gh = { head?: string; reviews?: unknown[]; rollup?: unknown[]; files?: string[]; open?: { number: number; headRefName: string }[] };

function fakeGh({ head = 'feat/bus--s1', reviews = [], rollup = GREEN, files = ['src/kernel/Bus/Dispatcher.php'], open = [] }: Gh, calls: string[]) {
  return (cmd: string, args: readonly string[], options?: ExecFileSyncOptions) => {
    if (cmd !== 'gh') return realExec(cmd, args, options);
    calls.push(args.join(' '));
    if (args[1] === 'view') {
      return JSON.stringify({ number: 12, state: 'OPEN', baseRefName: 'feat/bus', headRefName: head, reviews, statusCheckRollup: rollup });
    }
    if (args[1] === 'diff') return `${files.join('\n')}\n`;
    if (args[1] === 'list') return JSON.stringify(open);
    throw new Error(`unexpected gh ${args.join(' ')}`);
  };
}

async function checkMerge(args: string[], { flow = SPEC_FLOW, gh = {} }: { flow?: string; gh?: Gh } = {}) {
  const { root } = makeRepo({
    git: true,
    files: { '.omni-loop/config.yml': HEAD + flow, '.omni-loop/delivery/inbox/0912-bus/plan.md': PLAN, ...HOOK_FILES },
  });
  const s = io();
  const calls: string[] = [];
  const code = await main(['flow', 'check', 'merge', ...args], { cwd: root, exec: fakeGh(gh, calls), ...s });
  return { code, out: s.out.join(''), err: s.err.join(''), calls };
}

describe('omni flow check merge', () => {
  it('refuses a kernel sub-PR no person approved, naming kernel: approval person (spec acceptance 8)', async () => {
    const { code, out } = await checkMerge(['--pr', '12']);
    expect(code).toBe(1);
    expect(out).toBe('not ok kernel: approval person — no person has approved #12\n');
  });

  it('prints ok and the rebase command once approved and green (spec acceptance 8)', async () => {
    const { code, out } = await checkMerge(['--pr', '12'], { flow: KERNEL_REBASE, gh: { reviews: APPROVED } });
    expect(code).toBe(0);
    expect(out).toBe('ok\ngh pr merge 12 --rebase --delete-branch\n');
  });

  it("prints today's squash command with no flow", async () => {
    const { code, out, calls } = await checkMerge(['--pr', '12'], { flow: '', gh: { rollup: [] } });
    expect(code).toBe(0);
    expect(out).toBe('ok\ngh pr merge 12 --squash --delete-branch\n');
    expect(calls).toEqual([
      'pr view 12 --repo acme/widgets --json number,state,baseRefName,headRefName,reviews,statusCheckRollup',
      'pr diff 12 --repo acme/widgets --name-only',
    ]);
  });

  it('reports a path outside the territory and merges, or refuses it under territory: block', async () => {
    const files = ['src/kernel/Bus/Dispatcher.php', 'README.md'];
    const reported = await checkMerge(['--pr', '12'], { flow: '', gh: { files } });
    expect(reported.code).toBe(0);
    expect(reported.out).toBe("ok\ngh pr merge 12 --squash --delete-branch\nreport README.md is outside the slice's territory\n");
    const blocked = await checkMerge(['--pr', '12'], { flow: 'flow:\n  rules:\n    subPr: { territory: block }\n', gh: { files } });
    expect(blocked.code).toBe(1);
    expect(blocked.out).toBe("not ok default: territory block — README.md is outside the slice's territory\n");
  });

  it('refuses past maxOpen, counting the open sub-PRs of the slices the plan names', async () => {
    const flow = "flow:\n  areas:\n    kernel:\n      paths: ['^src/kernel/']\n      rules:\n        subPr: { maxOpen: 1 }\n";
    const open = [
      { number: 12, headRefName: 'feat/bus--s1' },
      { number: 13, headRefName: 'feat/bus--s2' },
      { number: 14, headRefName: 'feat/other--s1' },
    ];
    const both = await checkMerge(['--pr', '12'], { flow: flow.replace("['^src/kernel/']", "['^src/kernel/', '^src/Invoice']"), gh: { open } });
    expect(both.code).toBe(1);
    expect(both.out).toBe('not ok kernel: maxOpen 1 — 2 of its sub-PRs are open: #12, #13\n');
    expect((await checkMerge(['--pr', '12'], { flow, gh: { open } })).code).toBe(0);
  });

  it('prints the verdict as JSON', async () => {
    const { code, out } = await checkMerge(['--pr', '12', '--json'], { flow: KERNEL_REBASE, gh: { reviews: APPROVED } });
    expect(code).toBe(0);
    expect(JSON.parse(out)).toEqual({
      ok: true,
      method: 'rebase',
      command: ['gh', 'pr', 'merge', '12', '--rebase', '--delete-branch'],
      areas: ['kernel'],
      reasons: [],
      reported: [],
    });
  });

  it("asks a target's repository and names it in the command", async () => {
    const { code, out, calls } = await checkMerge(['--pr', '12', '--repo', 'acme/back'], { flow: '', gh: { rollup: [] } });
    expect(code).toBe(0);
    expect(out).toBe('ok\ngh pr merge 12 --squash --delete-branch --repo acme/back\n');
    expect(calls.every((call) => call.includes('--repo acme/back'))).toBe(true);
  });

  it.each([
    [['--pr', 'x'], /--pr/],
    [[], /usage: omni flow check merge --pr <n>/],
    [['--pr', '12', '--repo', 'back'], /back is not a target/],
  ])('refuses %j as a usage error', async (args, message) => {
    const { code, err } = await checkMerge(args);
    expect(code).toBe(2);
    expect(err).toMatch(message);
  });

  it('names its check on a bad one', async () => {
    const { code, err } = await omni(['flow', 'check', 'land']);
    expect(code).toBe(2);
    expect(err).toMatch(/usage: omni flow check merge/);
  });
});

describe('omni flow', () => {
  it('names its verbs on a bad one', async () => {
    const { code, err } = await omni(['flow', 'run']);
    expect(code).toBe(2);
    expect(err).toMatch(/usage: omni flow show/);
  });
});
