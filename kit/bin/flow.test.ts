// `omni flow show` and `omni flow verdict` (PRD 1089, s4), through the CLI.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { makeRepo } from '../test/fixture.ts';
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

describe('omni flow', () => {
  it('names its verbs on a bad one', async () => {
    const { code, err } = await omni(['flow', 'run']);
    expect(code).toBe(2);
    expect(err).toMatch(/usage: omni flow show/);
  });
});
