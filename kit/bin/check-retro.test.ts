// PRD 2338, s1: `omni check retro [--retro <prd>]`, and `omni check all` running it, through `main()` on
// a fixture repository.
import { describe, expect, it } from 'vitest';
import { formText, makeRepo } from '../test/fixture.ts';
import { main } from './omni.ts';

const CONFIG = { '.omni-loop/config.yml': 'kit: 1\nrepo:\n  slug: acme/widgets\n' };
const D = '.omni-loop/delivery';
const TESTING = { '.omni-loop/knowledge/playbook/testing.md': formText({ frontMatter: { state: 'filled' }, slots: [{ id: 'never', required: true, by: 'human', body: '- A test never calls the network.' }] }) };
const FILE = `${D}/shipped/0042-a/retro.json`;
const RED = 'repeated-red:check';

/** PRD 42's `retro.json`: one merge run keeping `RED` as issue #101, with `outcomes` when given. */
function retro(outcomes?: Record<string, unknown>): string {
  const run = {
    run: 'merge',
    findings: [],
    lessons: [{ text: 'A lesson.', findings: [RED] }],
    issues: { [RED]: { number: 101, url: 'https://github.com/acme/widgets/issues/101', state: 'open' } },
    ...(outcomes ? { outcomes } : {}),
  };
  return `${JSON.stringify({ prd: 42, runs: [run] }, null, 2)}\n`;
}

/** Runs `omni <argv>` in `root`: `{ code, out, err }`. */
async function omni(root: string, argv: readonly string[]) {
  const out: string[] = [];
  const err: string[] = [];
  const code = await main(argv, { cwd: root, stdout: { write: (s) => out.push(s) }, stderr: { write: (s) => err.push(s) } });
  return { code, out: out.join(''), err: err.join('') };
}

describe('omni check retro', () => {
  it('passes a repository with no retro', async () => {
    const { root } = makeRepo({ git: true, files: CONFIG });
    expect(await omni(root, ['check', 'retro'])).toEqual({ code: 0, out: 'check retro — 0 retro(s), 0 outcome(s), each one sound.\n', err: '' });
  });

  it('passes a retro from before PRD 2338, whose kept lessons have no outcome', async () => {
    const { root } = makeRepo({ git: true, files: { ...CONFIG, [FILE]: retro() } });
    expect(await omni(root, ['check', 'retro'])).toEqual({ code: 0, out: 'check retro — 1 retro(s), 0 outcome(s), each one sound.\n', err: '' });
  });

  it('refuses a became naming a blank or missing slot, and a staysHere with no reason, naming the PRD, the lesson and why', async () => {
    const cases: Array<[Record<string, unknown>, string]> = [
      [{ [RED]: { became: 'playbook/testing#levels' } }, 'became playbook/testing#levels does not resolve — .omni-loop/knowledge/playbook/testing.md has no slot "levels"'],
      [{ [RED]: { became: 'playbook/review#never' } }, 'became playbook/review#never does not resolve — no form file at .omni-loop/knowledge/playbook/review.md'],
      [{ [RED]: { staysHere: '' } }, 'stays here with no reason'],
    ];
    for (const [outcomes, why] of cases) {
      const { root } = makeRepo({ git: true, files: { ...CONFIG, ...TESTING, [FILE]: retro(outcomes) } });
      const { code, out } = await omni(root, ['check', 'retro']);
      expect(code, why).toBe(1);
      expect(out, why).toBe(`check retro — a retro's lesson does not hold what it claims:\n  ${FILE}: PRD 42, lesson \`${RED}\` (#101): ${why}\n`);
    }
  });

  it('with --retro, refuses a kept lesson with no outcome, and passes once it has one', async () => {
    const { root } = makeRepo({ git: true, files: { ...CONFIG, ...TESTING, [FILE]: retro() } });
    const open = await omni(root, ['check', 'retro', '--retro', '42']);
    expect(open.code).toBe(1);
    expect(open.out).toContain(`  ${FILE}: PRD 42, lesson \`${RED}\` (#101): kept, with no outcome — `);

    const { root: settled } = makeRepo({ git: true, files: { ...CONFIG, ...TESTING, [FILE]: retro({ [RED]: { became: 'playbook/testing#never' } }) } });
    expect(await omni(settled, ['check', 'retro', '--retro', '42'])).toEqual({
      code: 0,
      out: 'check retro — 1 retro(s), 1 outcome(s), each one sound; PRD 42: 1 kept lesson(s), each with an outcome.\n',
      err: '',
    });
  });

  it('with --retro, refuses a PRD whose retro is not there, and a value that is no PRD number', async () => {
    const { root } = makeRepo({ git: true, files: CONFIG });
    const missing = await omni(root, ['check', 'retro', '--retro', '42']);
    expect(missing.code).toBe(1);
    expect(missing.out).toContain('  PRD 42: no folder in .omni-loop/delivery/inbox or .omni-loop/delivery/shipped');
    const wrong = await omni(root, ['check', 'retro', '--retro', 'next']);
    expect(wrong.code).toBe(2);
    expect(wrong.err).toMatch(/--retro/);
  });

  it('is run by omni check all, which goes red on an unsound outcome, and takes --retro there too', async () => {
    const { root } = makeRepo({ git: true, files: { ...CONFIG, [FILE]: retro({ [RED]: { staysHere: 'a rule already says it' } }) } });
    const green = await omni(root, ['check', 'all']);
    expect(green.out).toMatch(/^check retro — 1 retro\(s\), 1 outcome\(s\), each one sound\.$/m);
    expect(green.code, green.out).toBe(0);
    expect((await omni(root, ['check', 'all', '--retro', '42'])).out).toMatch(/^check retro — .*; PRD 42: 1 kept lesson\(s\), each with an outcome\.$/m);

    const { root: red } = makeRepo({ git: true, files: { ...CONFIG, [FILE]: retro({ [RED]: { staysHere: ' ' } }) } });
    const refused = await omni(red, ['check', 'all']);
    expect(refused.code).toBe(1);
    expect(refused.out).toContain(`  ${FILE}: PRD 42, lesson \`${RED}\` (#101): stays here with no reason\n`);
  });

  it('says --retro is ignored by a guard that does not read the retros', async () => {
    const { root } = makeRepo({ git: true, files: CONFIG });
    const { code, err } = await omni(root, ['check', 'outbox', '--retro', '42']);
    expect(code).toBe(0);
    expect(err).toBe('omni check: --retro 42 ignored — the retro guard did not run.\n');
  });

  it('names retro among the guards when the guard is unknown', async () => {
    const { root } = makeRepo({ git: true, files: CONFIG });
    const { code, err } = await omni(root, ['check', 'retros']);
    expect(code).toBe(2);
    expect(err).toMatch(/usage: omni check \[[^\]]*\bretro\b[^\]]*\].*\[--retro <prd>\]/);
  });
});
