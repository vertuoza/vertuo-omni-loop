// `omni flow show` and `omni flow verdict` (PRD 1089, s4), through the CLI.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { makeRepo, realExec } from '../test/fixture.ts';
import type { TokenStore } from '../lib/ask/client.ts';
import { parsePr } from '../lib/ids.ts';
import type { LoopChange, LoopChangeDetail } from '../lib/loop-reads/contract.ts';
import { aChange, fakeLoopReads } from '../lib/loop-reads/fake.ts';
import { LoopReadError } from '../lib/loop-reads/port.ts';
import { main } from './omni.ts';

type LoopCheck = LoopChangeDetail['review']['checks'][number];

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

  it('prints them as JSON, beside what the plans declare', async () => {
    const { out } = await omni(['flow', 'show', '--json']);
    expect(JSON.parse(out)).toMatchObject({
      differences: [{ area: 'default' }, { area: 'kernel' }, { area: 'migrations' }],
      contracts: { declare: false, kinds: ['api', 'db'] },
    });
  });

  it('says the repository runs the defaults with no flow', async () => {
    const { code, out } = await omni(['flow', 'show'], { flow: '', files: {} });
    expect(code).toBe(0);
    expect(out).toBe("flow — none: this repository runs the kit's defaults.\ncontracts: none\n");
  });
});

describe('omni flow show: the contracts line (PRD 1870, criterion 9)', () => {
  it.each([
    ['contracts:\n  declare: true\n', 'contracts: declare api, db'],
    ['contracts:\n  declare: true\n  kinds: [api, event]\n', 'contracts: declare api, event'],
    ['contracts:\n  declare: false\n  kinds: [api, event]\n', 'contracts: none'],
    ['', 'contracts: none'],
  ])('with %j, prints %j as the last line before the areas and their hooks', async (contracts, line) => {
    const { code, out } = await omni(['flow', 'show'], { flow: contracts + SPEC_FLOW });
    expect(code).toBe(0);
    const lines = out.split('\n');
    expect(lines[1]).toBe(line);
    expect(lines.filter((text) => text.startsWith('contracts:'))).toEqual([line]);
  });

  it('carries the ask as JSON, kinds included', async () => {
    const { out } = await omni(['flow', 'show', '--json'], { flow: 'contracts:\n  declare: true\n  kinds: [api, event]\n', files: {} });
    expect(JSON.parse(out)).toEqual({ differences: [], contracts: { declare: true, kinds: ['api', 'event'] } });
  });
});

describe('omni flow show --repo (PRD 1089, s6)', () => {
  const PLAN_HEAD = `kit: 1
repo:
  slug: acme/plan
plan:
  targets:
    - repo: acme/back
      role: back-end
      knowledge: imported
      readAt: 3f2a9c1e0b7d4c5a8e6f1d2c3b4a5968778695a4
    - repo: acme/web
      role: front-end
      knowledge: own
`;
  const COPY = '.omni-loop/knowledge/repos/back/flow';
  const copied = Object.fromEntries(Object.entries(HOOK_FILES).map(([path, text]) => [`${COPY}/${path}`, text]));

  async function inPlan(args: string[], files: Record<string, string> = { [`${COPY}/config.yml`]: SPEC_FLOW, ...copied }) {
    const { root } = makeRepo({ git: true, files: { '.omni-loop/config.yml': PLAN_HEAD, ...files } });
    const s = io();
    const code = await main(args, { cwd: root, ...s });
    return { code, out: s.out.join(''), err: s.err.join('') };
  }

  it("reads an imported target's copied flow and its hook files from the copy", async () => {
    const { code, out } = await inPlan(['flow', 'show', 'do-work.test', '--repo', 'back', '--path', 'src/kernel/Bus/Dispatcher.php', '--json']);
    expect(code).toBe(0);
    expect(JSON.parse(out)).toMatchObject({ areas: ['kernel'], replace: { area: 'kernel', path: '.omni-loop/flow/kernel/tests.md' }, kitStep: 'replaced' });
    expect(out).toMatch(/Run phpunit/);
  });

  it("prints the target's area for a path, while the plan repository's own flow stays the kit's defaults", async () => {
    expect((await inPlan(['flow', 'show', '--repo', 'acme/back', '--path', 'database/migrations/x.sql'])).out).toMatch(/^area {5}migrations/m);
    expect((await inPlan(['flow', 'show', '--path', 'database/migrations/x.sql'])).out).toMatch(/^area {5}default/m);
  });

  it.each([
    [['flow', 'show', '--repo', 'web'], /web has no copied flow at \.omni-loop\/knowledge\/repos\/web\/flow\/config\.yml/],
    [['flow', 'show', '--repo', 'nope'], /nope is not a target of plan\.targets/],
  ])('refuses %j as a usage error', async (args, message) => {
    const { code, err } = await inPlan(args);
    expect(code).toBe(2);
    expect(err).toMatch(message);
  });

  // vertuoza/vertuo-automation-plan#280 planned eight slices of an `own` back-end that asks for a
  // contract column, with none: the target had no copy, and the planner read the old message
  // ("/omni:mega-invade copies an imported target's flow there") as "this target asks nothing".
  it('says a target with no copy has unknown contracts, whatever its knowledge, and how to copy it', async () => {
    const { err } = await inPlan(['flow', 'show', '--repo', 'web']);
    expect(err).toMatch(/its flow and its contracts are unknown, not the kit's defaults/);
    expect(err).toMatch(/\/omni:mega-invade --sync copies every target's planning config there, `own` included/);
    expect(err).not.toMatch(/imported target's flow/);
  });

  it("prints the target's copy's contracts line, not the plan repository's (PRD 1870, criterion 9)", async () => {
    const declared = { [`${COPY}/config.yml`]: `contracts:\n  declare: true\n  kinds: [api, event]\n${SPEC_FLOW}`, ...copied };
    expect((await inPlan(['flow', 'show', '--repo', 'back'], declared)).out).toMatch(/^contracts: declare api, event$/m);
    expect((await inPlan(['flow', 'show', '--repo', 'back'])).out).toMatch(/^contracts: none$/m);
    expect(JSON.parse((await inPlan(['flow', 'show', '--repo', 'back', '--json'], declared)).out)).toMatchObject({
      contracts: { declare: true, kinds: ['api', 'event'] },
    });
  });

  it('refuses a copied flow the config would refuse, naming its file', async () => {
    const { code, err } = await inPlan(['flow', 'show', '--repo', 'back'], { [`${COPY}/config.yml`]: 'flow:\n  on: {}\n' });
    expect(code).toBe(2);
    expect(err).toMatch(/repos\/back\/flow\/config\.yml is not a valid Omni Loop config/);
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

// `omni flow check merge` (PRD 1089, s5): the sub-PR's facts come from the shared fake `LoopReads`
// (PRD 1665, s6: no `gh` read), git runs for real.
const KERNEL_REBASE = SPEC_FLOW.replace(
  'subPr: { requireChecks: [phpunit, phpstan-max], approval: person }',
  'subPr: { merge: rebase, requireChecks: [phpunit, phpstan-max], approval: person }',
);
const GREEN: LoopCheck[] = [
  { name: 'phpunit', state: 'success' },
  { name: 'phpstan-max', state: 'success' },
];
const APPROVED = ['ada'];
type Loop = {
  head?: string;
  state?: LoopChange['state'];
  approvedBy?: string[];
  checks?: LoopCheck[];
  files?: string[];
  open?: { number: number; headRefName: string }[];
  everything?: LoopReadError;
};

/** The fake's state: sub-PR #12 into `feat/bus` of `repo`, its review and files, and the other open sub-PRs. */
function fakeLoop({ head = 'feat/bus--s1', state = 'open', approvedBy, checks = GREEN, files = ['src/kernel/Bus/Dispatcher.php'], open = [], everything }: Loop, repo: string) {
  const twelve = aChange({ number: parsePr(12), head, base: 'feat/bus', state });
  const others = open.filter(({ number }) => number !== 12).map(({ number, headRefName }) => aChange({ number: parsePr(number), head: headRefName, base: 'feat/bus' }));
  return fakeLoopReads({
    changes: { [repo]: [twelve, ...others] },
    details: { [`${repo}#12`]: { files, review: { checks, mergeable: true, threads: [], ...(approvedBy ? { approvedBy } : {}) } } },
    ...(everything ? { everything } : {}),
  });
}

async function checkMerge(args: string[], { flow = SPEC_FLOW, loop = {} }: { flow?: string; loop?: Loop } = {}) {
  const { root } = makeRepo({
    git: true,
    files: { '.omni-loop/config.yml': HEAD + flow, '.omni-loop/delivery/inbox/0912-bus/plan.md': PLAN, ...HOOK_FILES },
  });
  const s = io();
  const repoAt = args.indexOf('--repo');
  const reads = fakeLoop(loop, repoAt === -1 ? 'acme/widgets' : (args[repoAt + 1] ?? ''));
  const code = await main(['flow', 'check', 'merge', ...args], { cwd: root, exec: realExec, reads, ...s });
  return { code, out: s.out.join(''), err: s.err.join(''), reads: reads.reads };
}

describe('omni flow check merge', () => {
  it('refuses a kernel sub-PR no person approved, naming kernel: approval person (spec acceptance 8)', async () => {
    const { code, out } = await checkMerge(['--pr', '12']);
    expect(code).toBe(1);
    expect(out).toBe('not ok kernel: approval person — no person has approved #12\n');
  });

  it('prints ok and the rebase command once approved and green (spec acceptance 8)', async () => {
    const { code, out } = await checkMerge(['--pr', '12'], { flow: KERNEL_REBASE, loop: { approvedBy: APPROVED } });
    expect(code).toBe(0);
    expect(out).toBe('ok\ngh pr merge 12 --rebase --delete-branch\n');
  });

  it("prints today's squash command with no flow", async () => {
    const { code, out, reads } = await checkMerge(['--pr', '12'], { flow: '', loop: { checks: [] } });
    expect(code).toBe(0);
    expect(out).toBe('ok\ngh pr merge 12 --squash --delete-branch\n');
    expect(reads).toEqual([{ read: 'change', repo: 'acme/widgets', number: 12 }]);
  });

  it('reports a path outside the territory and merges, or refuses it under territory: block', async () => {
    const files = ['src/kernel/Bus/Dispatcher.php', 'README.md'];
    const reported = await checkMerge(['--pr', '12'], { flow: '', loop: { files } });
    expect(reported.code).toBe(0);
    expect(reported.out).toBe("ok\ngh pr merge 12 --squash --delete-branch\nreport README.md is outside the slice's territory\n");
    const blocked = await checkMerge(['--pr', '12'], { flow: 'flow:\n  rules:\n    subPr: { territory: block }\n', loop: { files } });
    expect(blocked.code).toBe(1);
    expect(blocked.out).toBe("not ok default: territory block — README.md is outside the slice's territory\n");
  });

  it("counts the PRD's outbox folder as the slice's ground, as the wave's territory check does", async () => {
    const files = ['src/kernel/Bus/Dispatcher.php', '.omni-loop/delivery/outbox/0912-bus/s1-01-shape.md'];
    const blocked = await checkMerge(['--pr', '12'], { flow: 'flow:\n  rules:\n    subPr: { territory: block }\n', loop: { files } });
    expect(blocked.code).toBe(0);
    expect(blocked.out).toBe('ok\ngh pr merge 12 --squash --delete-branch\n');
  });

  it('refuses past maxOpen, counting the open sub-PRs of the slices the plan names', async () => {
    const flow = "flow:\n  areas:\n    kernel:\n      paths: ['^src/kernel/']\n      rules:\n        subPr: { maxOpen: 1 }\n";
    const open = [
      { number: 12, headRefName: 'feat/bus--s1' },
      { number: 13, headRefName: 'feat/bus--s2' },
      { number: 14, headRefName: 'feat/other--s1' },
    ];
    const both = await checkMerge(['--pr', '12'], { flow: flow.replace("['^src/kernel/']", "['^src/kernel/', '^src/Invoice']"), loop: { open } });
    expect(both.code).toBe(1);
    expect(both.out).toBe('not ok kernel: maxOpen 1 — 2 of its sub-PRs are open: #12, #13\n');
    expect((await checkMerge(['--pr', '12'], { flow, loop: { open } })).code).toBe(0);
  });

  it('prints the verdict as JSON', async () => {
    const { code, out } = await checkMerge(['--pr', '12', '--json'], { flow: KERNEL_REBASE, loop: { approvedBy: APPROVED } });
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
    const { code, out, reads } = await checkMerge(['--pr', '12', '--repo', 'acme/back'], { flow: '', loop: { checks: [] } });
    expect(code).toBe(0);
    expect(out).toBe('ok\ngh pr merge 12 --squash --delete-branch --repo acme/back\n');
    expect(reads).toEqual([{ read: 'change', repo: 'acme/back', number: 12 }]);
  });

  it('lists the open changes into the base, drafts among them, only when an area counts them', async () => {
    const flow = "flow:\n  areas:\n    kernel:\n      paths: ['^src/kernel/']\n      rules:\n        subPr: { maxOpen: 1 }\n";
    const { reads } = await checkMerge(['--pr', '12'], { flow, loop: { state: 'draft' } });
    expect(reads).toEqual([
      { read: 'change', repo: 'acme/widgets', number: 12 },
      { read: 'changes', query: { repo: 'acme/widgets', base: 'feat/bus', state: 'open' } },
    ]);
  });

  it('reads a draft as open, and refuses a merged or closed change', async () => {
    expect((await checkMerge(['--pr', '12'], { flow: '', loop: { state: 'draft' } })).out).toBe('ok\ngh pr merge 12 --squash --delete-branch\n');
    expect((await checkMerge(['--pr', '12'], { flow: '', loop: { state: 'merged' } })).out).toBe('not ok #12 is not open (MERGED)\n');
    expect((await checkMerge(['--pr', '12'], { flow: '', loop: { state: 'closed' } })).out).toBe('not ok #12 is not open (CLOSED)\n');
  });

  it('counts neutral and skipped checks as green, and a check by its worst run', async () => {
    const flow = 'flow:\n  rules:\n    subPr: { requireChecks: [a, b, c] }\n';
    const green = await checkMerge(['--pr', '12'], { flow, loop: { checks: [{ name: 'a', state: 'neutral' }, { name: 'b', state: 'skipped' }, { name: 'c', state: 'success' }] } });
    expect(green.out).toBe('ok\ngh pr merge 12 --squash --delete-branch\n');
    const red = await checkMerge(['--pr', '12'], {
      flow,
      loop: { checks: [{ name: 'a', state: 'success' }, { name: 'a', state: 'failure' }, { name: 'b', state: 'pending' }, { name: 'c', state: 'success' }, { name: 'c', state: 'pending' }] },
    });
    expect(red.out).toBe([
      'not ok default: requireChecks a — a failed on #12',
      'not ok default: requireChecks b — b is pending on #12',
      'not ok default: requireChecks c — c is pending on #12',
      '',
    ].join('\n'));
  });

  it("holds a sub-PR whose page answers no approval when an area asks a person's", async () => {
    const { code, out } = await checkMerge(['--pr', '12'], { flow: KERNEL_REBASE });
    expect(code).toBe(1);
    expect(out).toBe('not ok kernel: approval person — no person has approved #12\n');
  });

  it.each([
    ['no sign-in (omni signin)'],
    ['unreachable'],
    ['refused (404): this Omni page cannot read the loop yet'],
  ])('prints %s alone on stderr, exit 1, when no read can be made', async (line) => {
    const { code, out, err } = await checkMerge(['--pr', '12'], { loop: { everything: new LoopReadError(line, 'everything') } });
    expect(code).toBe(1);
    expect(out).toBe('');
    expect(err).toBe(`${line}\n`);
  });

  it('reads the Omni page of ask.url, calling nothing without a sign-in', async () => {
    const { root } = makeRepo({
      git: true,
      files: { '.omni-loop/config.yml': `${HEAD}ask:\n  url: https://omni.example.test\n`, '.omni-loop/delivery/inbox/0912-bus/plan.md': PLAN },
    });
    let called = false;
    const fetch = () => {
      called = true;
      return Promise.resolve(new Response('{}'));
    };
    const tokens: TokenStore = { read: () => null, write: () => undefined };
    const s = io();
    expect(await main(['flow', 'check', 'merge', '--pr', '12'], { cwd: root, exec: realExec, tokens, fetch, ...s })).toBe(1);
    expect(s.err.join('')).toBe('no sign-in (omni signin)\n');
    expect(called).toBe(false);
  });

  it("asks the Omni page for the sub-PR with the sign-in, and prints its 403 in its own words", async () => {
    const { root } = makeRepo({
      git: true,
      files: { '.omni-loop/config.yml': `${HEAD}ask:\n  url: https://omni.example.test\n`, '.omni-loop/delivery/inbox/0912-bus/plan.md': PLAN },
    });
    const urls: string[] = [];
    const fetch = (url: string) => {
      urls.push(url);
      return Promise.resolve(new Response(JSON.stringify({ error: 'acme/widgets is not in your workspace.' }), { status: 403 }));
    };
    const tokens: TokenStore = { read: () => ({ access_token: 'at', refresh_token: 'rt', expires_at: null }), write: () => undefined };
    const s = io();
    expect(await main(['flow', 'check', 'merge', '--pr', '12'], { cwd: root, exec: realExec, tokens, fetch, ...s })).toBe(1);
    expect(s.err.join('')).toBe('refused (403): acme/widgets is not in your workspace\n');
    expect(urls).toEqual(['https://omni.example.test/api/loop/changes/12?repo=acme%2Fwidgets']);
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
