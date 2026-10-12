// PRD 1679, s1: `omni budget measure context` and `omni budget set context`, through `main()` on a
// fixture repository. Each count is held to the bytes `omni kb show` prints, so the measure and the
// command can never drift apart.
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FORM_IDS } from '../lib/playbook/forms.ts';
import { formText, makeRepo } from '../test/fixture.ts';
import { main } from './omni.ts';

const PLAYBOOK = '.omni-loop/knowledge/playbook';
const CEILINGS = '.omni-loop/budgets/context.json';
const GUIDE_TEXT = 'Run the whole suite before every push.\n'.repeat(60);

function config(extra = ''): string {
  return `kit: 1\nrepo:\n  slug: acme/widgets\npaths:\n  context: [CLAUDE.md, AGENTS.md]\n${extra}`;
}

function repo(files: Record<string, string> = {}) {
  return makeRepo({
    git: true,
    files: {
      '.omni-loop/config.yml': config(),
      [`${PLAYBOOK}/briefing.md`]: formText({
        frontMatter: { form: 'briefing', state: 'filled' },
        title: 'Briefing',
        slots: [{ id: 'never', required: true, body: 'Never merge into the default branch.' }],
      }),
      [`${PLAYBOOK}/testing.md`]: formText({ frontMatter: { form: 'testing', state: 'filled' }, slots: [{ id: 'commands', required: true, body: 'See: guides/testing.md' }] }),
      '.omni-loop/knowledge/adr/0001-first.md': '# The first decision\n',
      'guides/testing.md': GUIDE_TEXT,
      'CLAUDE.md': '# Claude\n',
      'AGENTS.md': '# Agents\nRead the briefing.\n',
      ...files,
    },
  });
}

async function omni(root: string, argv: readonly string[]) {
  const out: string[] = [];
  const err: string[] = [];
  const code = await main(argv, { cwd: root, stdout: { write: (s: string) => out.push(s) }, stderr: { write: (s: string) => err.push(s) } });
  return { code, out: out.join(''), err: err.join('') };
}

async function measured(root: string): Promise<Record<string, number | { error: string }>> {
  const { code, out } = await omni(root, ['budget', 'measure', 'context', '--json']);
  expect(code).toBe(0);
  return JSON.parse(out) as Record<string, number>;
}

describe('omni budget measure context (PRD 1679)', () => {
  it('counts each form as the bytes omni kb show prints, the pointer expanded', async () => {
    const { root } = repo();
    const sizes = await measured(root);
    for (const form of FORM_IDS) {
      const { out } = await omni(root, ['kb', 'show', form]);
      expect([form, sizes[form === 'briefing' ? 'briefing' : `form:${form}`]]).toEqual([form, Buffer.byteLength(out)]);
    }
    expect(sizes['form:testing']).toBeGreaterThan(Buffer.byteLength(GUIDE_TEXT));
  });

  it('counts each context file and sums session', async () => {
    const sizes = await measured(repo().root);
    expect(sizes['context:CLAUDE.md']).toBe(9);
    expect(sizes['context:AGENTS.md']).toBe(28);
    expect(sizes.session).toBe(Number(sizes.briefing) + 9 + 28);
  });

  it('prints one line per target, its bytes and its approximate tokens', async () => {
    const { root } = repo();
    const sizes = await measured(root);
    const { code, out, err } = await omni(root, ['budget', 'measure', 'context']);
    expect(code).toBe(0);
    expect(err).toBe('');
    const lines = out.trimEnd().split('\n');
    expect(lines.map((line) => line.split(/\s+/)[0])).toEqual(Object.keys(sizes));
    expect(lines.find((line) => line.startsWith('context:AGENTS.md'))).toMatch(/^context:AGENTS\.md\s+28 bytes {2}~7 tokens$/);
  });

  it('exits 1 on a missing context file, naming it, and still prints the rest', async () => {
    const { root } = repo({ '.omni-loop/config.yml': config().replace('AGENTS.md', 'GONE.md') });
    const text = await omni(root, ['budget', 'measure', 'context']);
    expect(text.code).toBe(1);
    expect(text.out).toMatch(/^context:GONE\.md\s+error: GONE\.md does not exist$/m);
    expect(text.out).toMatch(/^session\s+error: cannot sum context:GONE\.md$/m);
    expect(text.out).toMatch(/^briefing\s+\d+ bytes/m);
    const json = await omni(root, ['budget', 'measure', 'context', '--json']);
    expect(json.code).toBe(1);
    expect(JSON.parse(json.out)).toMatchObject({ 'context:GONE.md': { error: 'GONE.md does not exist' } });
  });

  it('refuses a budget it does not measure', async () => {
    const { root } = repo();
    for (const argv of [['budget', 'measure', 'perf'], ['budget', 'measure'], ['budget', 'weigh', 'context'], ['budget']]) {
      const { code, err } = await omni(root, argv);
      expect(code).toBe(2);
      expect(err).toMatch(/usage: omni budget/);
    }
  });
});

describe('omni budget set context (PRD 1679)', () => {
  it("writes each target's size rounded up to the next KiB into budgets.context.file", async () => {
    const { root, read } = repo();
    const sizes = await measured(root);
    const { code, out } = await omni(root, ['budget', 'set', 'context']);
    expect(code).toBe(0);
    const written = JSON.parse(read(CEILINGS)) as Record<string, number>;
    expect(Object.keys(written).sort()).toEqual(Object.keys(sizes).sort());
    for (const [target, bytes] of Object.entries(sizes)) expect([target, written[target]]).toEqual([target, Math.ceil(Number(bytes) / 1024) * 1024]);
    expect(out).toMatch(/^set session \d+$/m);
    expect(out).toContain(`written to ${CEILINGS}; 0 kept as they were.`);
  });

  it('writes where budgets.context.file says', async () => {
    const { root, read } = repo({ '.omni-loop/config.yml': config('budgets:\n  context:\n    file: limits/ctx.json\n') });
    expect((await omni(root, ['budget', 'set', 'context'])).code).toBe(0);
    expect(JSON.parse(read('limits/ctx.json'))).toHaveProperty('session');
    expect(existsSync(join(root, CEILINGS))).toBe(false);
  });

  it('never raises a ceiling that exists, and adds the ones missing', async () => {
    const { root, read } = repo({ [CEILINGS]: '{ "briefing": 10, "form:testing": 999999 }\n' });
    const { code, out } = await omni(root, ['budget', 'set', 'context']);
    expect(code).toBe(0);
    const written = JSON.parse(read(CEILINGS)) as Record<string, number>;
    expect(written.briefing).toBe(10);
    expect(written['form:testing']).toBe(999999);
    expect(written).toHaveProperty('context:CLAUDE.md', 1024);
    expect(out).not.toMatch(/^set briefing/m);
    expect(out).toContain('; 2 kept as they were.');
  });

  it('leaves the file untouched when every target has a ceiling', async () => {
    const { root, read } = repo();
    await omni(root, ['budget', 'set', 'context']);
    const before = read(CEILINGS);
    const { code, out } = await omni(root, ['budget', 'set', 'context']);
    expect(code).toBe(0);
    expect(read(CEILINGS)).toBe(before);
    expect(out).toMatch(/0 first ceiling\(s\) written/);
  });

  it('writes nothing and exits 1 on a measurement error, naming it', async () => {
    const { root } = repo({ '.omni-loop/config.yml': config().replace('AGENTS.md', 'GONE.md') });
    const { code, err } = await omni(root, ['budget', 'set', 'context']);
    expect(code).toBe(1);
    expect(err).toMatch(/cannot measure context:GONE\.md: GONE\.md does not exist; session: .* — nothing written/);
    expect(existsSync(join(root, CEILINGS))).toBe(false);
  });

  it('exits 1 on a ceilings file it cannot read, writing nothing', async () => {
    const { root, read } = repo({ [CEILINGS]: '{ "briefing": "big" }\n' });
    const { code, err } = await omni(root, ['budget', 'set', 'context']);
    expect(code).toBe(1);
    expect(err).toMatch(/context\.json: briefing/);
    expect(read(CEILINGS)).toBe('{ "briefing": "big" }\n');
  });
});
