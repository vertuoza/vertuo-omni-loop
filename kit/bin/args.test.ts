// Bug #571: a number an omni command is given (a PRD, an issue, a pull request) is plain digits.
// "1e2" or "0x10" used to be read as PRD 100 or PRD 16 instead of being refused.
import { describe, expect, it } from 'vitest';
import { makeRepo } from '../test/fixture.ts';
import { positiveInt } from './args.ts';
import { main } from './omni.ts';

const CONFIG = 'kit: 1\nrepo:\n  slug: acme/widgets\n';

/** Runs `omni <argv>` in a fixture repository holding PRD 16 and PRD 100: `{ code, out, err }`. */
async function omni(argv: readonly string[]) {
  const { root } = makeRepo({
    git: true,
    files: {
      '.omni-loop/config.yml': CONFIG,
      '.omni-loop/delivery/inbox/0016-sixteen/spec.md': '# PRD 16\n',
      '.omni-loop/delivery/inbox/0100-hundred/spec.md': '# PRD 100\n',
    },
  });
  const out: string[] = [];
  const err: string[] = [];
  const code = await main(argv, { cwd: root, stdout: { write: (s) => out.push(s) }, stderr: { write: (s) => err.push(s) } });
  return { code, out: out.join(''), err: err.join('') };
}

describe('a PRD number written in another form than plain digits', () => {
  for (const written of ['0x10', '1e2', ' 16', '16 ', '+16', '0b10', '16.0']) {
    it(`omni prd "${written}" is refused, not read as another PRD`, async () => {
      const { code, out, err } = await omni(['prd', written]);
      expect(err).toBe(`omni prd: <n> must be a positive number, got "${written}".\n`);
      expect(out).toBe('');
      expect(code).toBe(2);
    });
  }

  it('plain digits still name the PRD', async () => {
    const { code, out } = await omni(['prd', '16']);
    expect(code).toBe(0);
    expect(out).toContain('PRD 16');
  });
});

describe('positiveInt', () => {
  it('reads plain digits, leading zeros included', () => {
    expect(positiveInt('prd', '<n>', '7')).toBe(7);
    expect(positiveInt('prd', '<n>', '0007')).toBe(7);
    expect(positiveInt('prd', '<n>', '556')).toBe(556);
  });

  it('refuses zero, a negative, a fraction, an empty string and no value', () => {
    for (const value of ['0', '000', '-3', '1.5', '', undefined, true] as const) {
      expect(() => positiveInt('prd', '<n>', value)).toThrow(/must be a positive number/);
    }
  });

  it('refuses every form other than plain digits, for every command that reads a number', () => {
    for (const value of ['0x10', '0o20', '0b10', '1e2', '16.0', '+16', ' 16', '16\n', '1_000', 'Infinity']) {
      expect(() => positiveInt('item new', '--prd', value)).toThrow(`omni item new: --prd must be a positive number, got "${value}".`);
    }
  });
});
