// `omni check context` (PRD 1679, s2): what every agent reads, held to its ceilings by the ratchet
// against the base — green under every ceiling; red with the five parts of the message on a form over
// budget; red "needs a person's yes" on a raised ceiling until a settled raise item names it; neutral,
// exit 0, on a measurement error; and part of `omni check all` while budgets are on. On a temporary
// git repository whose `main` holds the ceilings, checked out on a branch.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { raiseLine } from '../lib/budgets/ratchet.ts';
import { formText, makeRepo } from '../test/fixture.ts';
import { main } from './omni.ts';

const PLAYBOOK = '.omni-loop/knowledge/playbook';
const CEILINGS = '.omni-loop/budgets/context.json';
const GUIDE = 'guides/testing.md';
const GUIDE_TEXT = 'Run the whole suite before every push.\n'.repeat(20);
const BIG_GUIDE = 'Run the whole suite before every push, and read every log line twice.\n'.repeat(80);

function config(enabled: boolean): string {
  return `kit: 1\nrepo:\n  slug: acme/widgets\npaths:\n  context: [AGENTS.md]\nbudgets:\n  context:\n    enabled: ${enabled}\n`;
}

const testingForm = (guide: string) =>
  formText({ frontMatter: { form: 'testing', state: 'filled' }, slots: [{ id: 'commands', required: true, body: `See: ${guide}` }] });

const git = (root: string, ...args: string[]) => execFileSync('git', args, { cwd: root, stdio: 'ignore' });
const commit = (root: string, message: string) => {
  git(root, 'add', '-A');
  git(root, '-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '--allow-empty', '-m', message);
};

async function omni(root: string, argv: readonly string[]) {
  const out: string[] = [];
  const err: string[] = [];
  const code = await main(argv, { cwd: root, stdout: { write: (s: string) => out.push(s) }, stderr: { write: (s: string) => err.push(s) } });
  return { code, out: out.join(''), err: err.join('') };
}

/** A repository whose `main` holds budgets on and every ceiling at today's size, checked out on `branch`. */
async function repoOn({ branch = 'work', enabled = true, files = {} }: { branch?: string; enabled?: boolean; files?: Record<string, string> } = {}) {
  const repo = makeRepo({
    git: true,
    files: {
      '.omni-loop/config.yml': config(enabled),
      [`${PLAYBOOK}/testing.md`]: testingForm(GUIDE),
      [GUIDE]: GUIDE_TEXT,
      'AGENTS.md': '# Agents\nRead the briefing.\n',
      '.omni-loop/delivery/inbox/0007-budgets/spec.md': '# Budgets\n',
      ...files,
    },
  });
  expect((await omni(repo.root, ['budget', 'set', 'context'])).code).toBe(0);
  commit(repo.root, 'budgets');
  git(repo.root, 'checkout', '-q', '-b', branch);
  return repo;
}

const ceilings = (root: string): Record<string, number> => JSON.parse(readFileSync(join(root, CEILINGS), 'utf8')) as Record<string, number>;

function settledRaise(target: string, ceiling: number, verdict = 'agreed'): string {
  const item = ['---', 'id: s1-01-raise-testing', 'prd: 7', 'slice: s1', 'rank: high', '---', '', '## What I had to decide', '', raiseLine(target, ceiling), ''].join('\n');
  return [
    '# Settled outbox items — PRD 7',
    '',
    '<!-- omni-outbox-settled: s1-01-raise-testing -->',
    '',
    `## s1-01-raise-testing — ${verdict}`,
    '',
    `- Verdict: ${verdict}`,
    '- Approved by: pm',
    '',
    '### The answer, as it was given',
    '',
    '```text',
    'Yes, the testing form needs the room.',
    '```',
    '',
    '### The item, as it was raised',
    '',
    '````text',
    item,
    '````',
    '',
    '<!-- /omni-outbox-settled: s1-01-raise-testing -->',
    '',
  ].join('\n');
}

describe('omni check context (PRD 1679)', () => {
  it('passes, saying so, while budgets are off, and omni check all does not run it', async () => {
    const { root } = await repoOn({ enabled: false });
    const alone = await omni(root, ['check', 'context', '--base', 'main']);
    expect(alone.code).toBe(0);
    expect(alone.out).toContain('check context — budgets are off');
    const all = await omni(root, ['check', 'all', '--base', 'main']);
    expect(all.out).not.toContain('check context');
  });

  it('is green under every ceiling, with the table of target, size, ceiling and change', async () => {
    const { root } = await repoOn();
    const { code, out } = await omni(root, ['check', 'context', '--base', 'main']);
    expect(code).toBe(0);
    expect(out).toMatch(/check context — \d+ target\(s\), every target under its ceiling; compared with main\./);
    expect(out).toContain('| target | size | ceiling | change |');
    expect(out).toMatch(/\| `form:testing` \| [\d.]+ KB \| [\d.]+ KB \| — \|/);
  });

  it('is green when a ceiling is lowered, still above the size', async () => {
    const { root, write } = await repoOn();
    const lowered = { ...ceilings(root), 'context:AGENTS.md': 1024 };
    write(CEILINGS, JSON.stringify(lowered));
    const { code } = await omni(root, ['check', 'context', '--base', 'main']);
    expect(code).toBe(0);
  });

  it('is red on a form over budget, with the five parts of the message, and offers only the prompt with no PRD', async () => {
    const { root, write } = await repoOn();
    write(GUIDE, BIG_GUIDE);
    commit(root, 'docs: the testing guide grows');
    const { code, out } = await omni(root, ['check', 'context', '--base', 'main']);
    expect(code).toBe(1);
    expect(out).toContain('check context — what every agent reads here is over its budget:');
    expect(out).toMatch(/Over budget: the `testing` playbook form is [\d.]+ KB, its ceiling is [\d.]+ KB\./);
    expect(out).toContain('Why it matters: every AI agent working here reads this before it starts');
    expect(out).toMatch(/What grew:\n {4}- `guides\/testing\.md` \+[\d.]+ KB since the base/);
    expect(out).toMatch(/[0-9a-f]{7,} docs: the testing guide grows/);
    expect(out).toContain('Fix it for me: Paste this into Claude: "Trim `guides/testing.md` back under');
    expect(out).not.toContain('/omni:pr-care');
    expect(out).toContain('this pull request belongs to no PRD, so its ceiling cannot be raised here');
    expect(out).toContain('`/omni:bug-fix`');
  });

  it("on a PRD's branch, names the skills and the raise item's line", async () => {
    const { root, write } = await repoOn({ branch: 'feat/budgets--s1' });
    write(GUIDE, BIG_GUIDE);
    const { code, out } = await omni(root, ['check', 'context', '--base', 'main']);
    expect(code).toBe(1);
    expect(out).toContain('`/omni:pr-care` (or `/omni:yolo-fix 7`) handles it by itself');
    expect(out).toMatch(/file a high outbox item of PRD 7 that says why and carries the line Budget raise: `form:testing` to \d+ bytes/);
  });

  it("is red, needing a person's yes, on a raised ceiling until a settled raise names it", async () => {
    const { root, write } = await repoOn({ branch: 'feat/budgets--s1' });
    const before = ceilings(root)['form:testing'] ?? 0;
    write(CEILINGS, JSON.stringify({ ...ceilings(root), 'form:testing': before + 2048 }));
    const red = await omni(root, ['check', 'context', '--base', 'main']);
    expect(red.code).toBe(1);
    expect(red.out).toContain("Needs a person's yes: this PR raises the ceiling of the `testing` playbook form from");

    write('.omni-loop/delivery/outbox/0007-budgets/settled.md', settledRaise('form:testing', before + 1024));
    expect((await omni(root, ['check', 'context', '--base', 'main'])).code).toBe(1);

    write('.omni-loop/delivery/outbox/0007-budgets/settled.md', settledRaise('form:testing', before + 2048, 'drifted'));
    expect((await omni(root, ['check', 'context', '--base', 'main'])).code).toBe(1);

    write('.omni-loop/delivery/outbox/0007-budgets/settled.md', settledRaise('form:testing', before + 2048));
    const green = await omni(root, ['check', 'context', '--base', 'main']);
    expect(green.code).toBe(0);
    expect(green.out).toMatch(/\| `form:testing` \| [\d.]+ KB \| [\d.]+ KB \| \+2 KB \|/);
  });

  it('reads the PRD from --prd when the branch names none', async () => {
    const { root, write } = await repoOn();
    const before = ceilings(root)['form:testing'] ?? 0;
    write(CEILINGS, JSON.stringify({ ...ceilings(root), 'form:testing': before + 2048 }));
    write('.omni-loop/delivery/outbox/0007-budgets/settled.md', settledRaise('form:testing', before + 2048));
    expect((await omni(root, ['check', 'context', '--base', 'main'])).code).toBe(1);
    expect((await omni(root, ['check', 'context', '--base', 'main', '--prd', '7'])).code).toBe(0);
  });

  it('is neutral, exit 0 and the reason printed, on a measurement error', async () => {
    const { root, write } = await repoOn();
    write(`${PLAYBOOK}/testing.md`, testingForm('guides/gone.md'));
    const { code, out } = await omni(root, ['check', 'context', '--base', 'main']);
    expect(code).toBe(0);
    expect(out).toContain('neutral, nothing blocked');
    expect(out).toMatch(/Not measured: the `testing` playbook form — .*guides\/gone\.md does not exist.*A measurement that fails never blocks a merge\./);
  });

  it('is red on a ceilings file that does not parse', async () => {
    const { root, write } = await repoOn();
    write(CEILINGS, '{ not json');
    const { code, out } = await omni(root, ['check', 'context', '--base', 'main']);
    expect(code).toBe(1);
    expect(out).toContain(`${CEILINGS}: not valid JSON`);
  });

  it('raises nothing on an install: a base with no ceilings file', async () => {
    const { root } = makeRepo({
      git: true,
      files: { '.omni-loop/config.yml': config(true), [`${PLAYBOOK}/testing.md`]: testingForm(GUIDE), [GUIDE]: GUIDE_TEXT, 'AGENTS.md': '# Agents\n' },
    });
    git(root, 'checkout', '-q', '-b', 'work');
    expect((await omni(root, ['budget', 'set', 'context'])).code).toBe(0);
    expect((await omni(root, ['check', 'context', '--base', 'main'])).code).toBe(0);
  });

  it('says it did not compare raises when the default base is absent', async () => {
    const { root } = await repoOn();
    const { code, out } = await omni(root, ['check', 'context']);
    expect(code).toBe(0);
    expect(out).toContain('raises not compared — no origin/main');
  });

  it('fails omni check all on a red, and passes it on a neutral', async () => {
    const { root, write } = await repoOn();
    write(GUIDE, BIG_GUIDE);
    const red = await omni(root, ['check', 'all', '--base', 'main']);
    expect(red.code).toBe(1);
    expect(red.out).toContain('Over budget: the `testing` playbook form');
    write(`${PLAYBOOK}/testing.md`, testingForm('guides/gone.md'));
    const neutral = await omni(root, ['check', 'all', '--base', 'main']);
    expect(neutral.out).toContain('check context —');
    expect(neutral.out).toContain('neutral, nothing blocked');
  });
});
