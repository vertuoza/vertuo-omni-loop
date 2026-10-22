// PRD 2338, s3: `omni retro outcome`, through `main()` on a fixture repository.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { formText, makeRepo } from '../test/fixture.ts';
import { main } from './omni.ts';

const CONFIG = { '.omni-loop/config.yml': 'kit: 1\nrepo:\n  slug: acme/widgets\n' };
const D = '.omni-loop/delivery';
const TESTING = { '.omni-loop/knowledge/playbook/testing.md': formText({ frontMatter: { state: 'filled' }, slots: [{ id: 'never', required: true, by: 'human', body: '- A test never calls the network.' }] }) };
const JSON_FILE = `${D}/shipped/0042-a/retro.json`;
const MD_FILE = `${D}/shipped/0042-a/retro.md`;
const RED = 'repeated-red:check';
const CHURN = 'churn:a.ts';

type Doc = { runs: Array<{ outcomes?: unknown }> };

function retro(outcomes?: Record<string, unknown>): string {
  const issue = (number: number) => ({ number, url: `https://github.com/acme/widgets/issues/${String(number)}`, state: 'open' });
  const merge = { run: 'merge', findings: [], issues: { [RED]: issue(101), [CHURN]: issue(102) } };
  const day14 = { run: 'day-14', findings: [], issues: {}, ...(outcomes ? { outcomes } : {}) };
  return `${JSON.stringify({ prd: 42, runs: [merge, day14] }, null, 2)}\n`;
}

const MARKDOWN = [
  '# Retro — PRD 42',
  '',
  '## Findings',
  '',
  `### F1 · One — \`${RED}\` · [#101](https://github.com/acme/widgets/issues/101)`,
  '',
  '- **What happened:** red.',
  '- **Evidence:** [run](https://x)',
  '',
  `### F2 · Two — \`${CHURN}\``,
  '',
  '- **What happened:** churn.',
  '',
].join('\n');

const FILES = { ...CONFIG, ...TESTING, [JSON_FILE]: retro(), [MD_FILE]: MARKDOWN };

async function omni(root: string, argv: readonly string[]) {
  const out: string[] = [];
  const err: string[] = [];
  const code = await main(argv, { cwd: root, stdout: { write: (s) => out.push(s) }, stderr: { write: (s) => err.push(s) } });
  return { code, out: out.join(''), err: err.join('') };
}

const read = (root: string, file: string) => readFileSync(join(root, file), 'utf8');
const doc = (root: string) => JSON.parse(read(root, JSON_FILE)) as Doc;

describe('omni retro outcome', () => {
  it('records a became on the run that kept the lesson and its line at the end of the finding, then check retro passes', async () => {
    const { root } = makeRepo({ git: true, files: FILES });
    const result = await omni(root, ['retro', 'outcome', '42', RED, '--became', 'playbook/testing#never']);
    expect(result).toEqual({ code: 0, out: `retro outcome — PRD 42, lesson \`${RED}\` recorded in ${JSON_FILE} and ${MD_FILE}.\n`, err: '' });
    expect(doc(root).runs[0]?.outcomes).toEqual({ [RED]: { became: 'playbook/testing#never' } });
    expect(doc(root).runs[1]?.outcomes).toBeUndefined();
    expect(read(root, JSON_FILE).endsWith('}\n')).toBe(true);
    expect(read(root, MD_FILE)).toBe(MARKDOWN.replace('- **Evidence:** [run](https://x)\n', '- **Evidence:** [run](https://x)\n- **Became:** `playbook/testing#never`\n'));
    expect((await omni(root, ['check', 'retro'])).code).toBe(0);
  });

  it('records a staysHere, its line under the last finding of the file', async () => {
    const { root } = makeRepo({ git: true, files: FILES });
    expect((await omni(root, ['retro', 'outcome', '42', CHURN, '--stays-here', 'a   rule\nalready says it'])).code).toBe(0);
    expect(read(root, MD_FILE)).toBe(`${MARKDOWN.trimEnd()}\n- **Stays here:** a rule already says it\n`);
    expect(doc(root).runs[0]?.outcomes).toEqual({ [CHURN]: { staysHere: 'a   rule\nalready says it' } });
  });

  it('keeps the outcomes already there, and the keys in their order', async () => {
    const { root } = makeRepo({ git: true, files: { ...FILES, [JSON_FILE]: retro({ [RED]: { staysHere: 'why' } }) } });
    expect((await omni(root, ['retro', 'outcome', '42', CHURN, '--stays-here', 'because'])).code).toBe(0);
    expect(doc(root).runs[1]?.outcomes).toEqual({ [RED]: { staysHere: 'why' } });
    expect(doc(root).runs[0]?.outcomes).toEqual({ [CHURN]: { staysHere: 'because' } });
    expect(Object.keys(doc(root))).toEqual(['prd', 'runs']);
  });

  it('still writes the json when retro.md is missing or has no such finding, saying so', async () => {
    const { root } = makeRepo({ git: true, files: { ...CONFIG, [JSON_FILE]: retro() } });
    const result = await omni(root, ['retro', 'outcome', '42', RED, '--stays-here', 'why']);
    expect(result.code).toBe(0);
    expect(result.out).toBe(`retro outcome — PRD 42, lesson \`${RED}\` recorded in ${JSON_FILE} (no line for it in ${MD_FILE}).\n`);
    const { root: other } = makeRepo({ git: true, files: { ...FILES, [MD_FILE]: '# Retro\n' } });
    expect((await omni(other, ['retro', 'outcome', '42', RED, '--stays-here', 'why'])).out).toContain('(no line for it in');
    expect(read(other, MD_FILE)).toBe('# Retro\n');
  });

  it('refuses, writing nothing, an id that does not resolve, an empty reason, an unkept finding and a lesson that has an outcome', async () => {
    const { root } = makeRepo({ git: true, files: { ...FILES, [JSON_FILE]: retro({ [CHURN]: { staysHere: 'why' } }) } });
    const before = [read(root, JSON_FILE), read(root, MD_FILE)];
    const cases: Array<[string[], string]> = [
      [[RED, '--became', 'playbook/testing#levels'], 'became playbook/testing#levels does not resolve — .omni-loop/knowledge/playbook/testing.md has no slot "levels"'],
      [[RED, '--became', 'playbook/review#never'], 'became playbook/review#never does not resolve'],
      [[RED, '--stays-here', '  '], 'stays here with no reason'],
      [['other:finding', '--stays-here', 'why'], 'PRD 42 kept no lesson for `other:finding`'],
      [[CHURN, '--stays-here', 'again'], `PRD 42, lesson \`${CHURN}\` already has an outcome — an outcome is never rewritten`],
    ];
    for (const [rest, why] of cases) {
      const { code, out, err } = await omni(root, ['retro', 'outcome', '42', ...rest]);
      expect(code, why).toBe(1);
      expect(out).toBe('');
      expect(err, why).toContain(`omni retro: ${why}`);
      expect(err).toMatch(/Nothing written\.\n$/);
      expect([read(root, JSON_FILE), read(root, MD_FILE)]).toEqual(before);
    }
  });

  it('refuses a PRD with no folder, no retro.json, or one that is no retro record', async () => {
    const run = (root: string) => omni(root, ['retro', 'outcome', '42', RED, '--stays-here', 'x']);
    const { root } = makeRepo({ git: true, files: CONFIG });
    expect((await run(root)).err).toContain('PRD 42 has no folder in .omni-loop/delivery/inbox or .omni-loop/delivery/shipped');
    const { root: bare } = makeRepo({ git: true, files: { ...CONFIG, [`${D}/shipped/0042-a/spec.md`]: 'x' } });
    expect((await run(bare)).err).toContain(`${JSON_FILE} is missing`);
    const { root: broken } = makeRepo({ git: true, files: { ...CONFIG, [JSON_FILE]: '{' } });
    expect((await run(broken)).err).toContain(`${JSON_FILE} is not a retro record`);
    const { root: noRuns } = makeRepo({ git: true, files: { ...CONFIG, [JSON_FILE]: '{"prd":42,"runs":3}' } });
    expect((await run(noRuns)).err).toContain('is not a retro record — runs:');
  });

  it('is a usage error, exit 2, without a verb, a finding, or exactly one of the two flags', async () => {
    const { root } = makeRepo({ git: true, files: FILES });
    const usages = [
      ['retro'],
      ['retro', 'outcome', '42'],
      ['retro', 'outcome', '42', RED],
      ['retro', 'outcome', '42', RED, '--became', 'a#b', '--stays-here', 'x'],
      ['retro', 'outcome', 'next', RED, '--stays-here', 'x'],
      ['retro', 'outcome', '42', RED, '--stays-here'],
    ];
    for (const argv of usages) {
      const { code, out } = await omni(root, argv);
      expect(code, argv.join(' ')).toBe(2);
      expect(out).toBe('');
    }
  });
});
