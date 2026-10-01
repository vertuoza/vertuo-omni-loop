// PRD #99, slice s1: `omni sign trailer | footer`, through `main()` on a fixture repository (AC 3).
// PRD #215: the footer links home (slice s1), and the hero is Omni-man (slice s2).
import { describe, expect, it } from 'vitest';
import { makeRepo } from '../test/fixture.ts';
import { main } from './omni.ts';

const CONFIG = 'kit: 1\nrepo:\n  slug: acme/widgets\n';

/** Runs `omni <argv>` in a fixture repository whose config is `config`: `{ code, out, err }`. */
async function omni(argv: readonly string[], config = CONFIG) {
  const { root } = makeRepo({ git: true, files: { '.omni-loop/config.yml': config } });
  const out: string[] = [];
  const err: string[] = [];
  const code = await main(argv, { cwd: root, stdout: { write: (s) => out.push(s) }, stderr: { write: (s) => err.push(s) } });
  return { code, out: out.join(''), err: err.join('') };
}

describe('omni sign', () => {
  it('trailer prints exactly the co-author line, and nothing else', async () => {
    expect(await omni(['sign', 'trailer'])).toEqual({
      code: 0,
      out: 'Co-authored-by: Omni-man <333776611+omni-loop-invader[bot]@users.noreply.github.com>\n',
      err: '',
    });
  });

  it('footer prints the footer, its name and home filled, followed by the hidden marker (PRD #215)', async () => {
    expect(await omni(['sign', 'footer'])).toEqual({
      code: 0,
      out: '🦸 Omni-man by [Omni Loop](https://vertuo-omni-loop-galaxy.vercel.app) © <!-- omni-loop:signed -->\n',
      err: '',
    });
  });

  it('prints what the config names, when it overrides the default', async () => {
    const config = `${CONFIG}signature:\n  name: Robo\n  email: robo@example.com\n  footer: Made by Robo\n`;
    expect((await omni(['sign', 'trailer'], config)).out).toBe('Co-authored-by: Robo <robo@example.com>\n');
    expect((await omni(['sign', 'footer'], config)).out).toBe('Made by Robo <!-- omni-loop:signed -->\n');
  });

  it('a config setting only home moves the link, and nothing else (PRD #215, AC 3)', async () => {
    const config = `${CONFIG}signature:\n  home: https://example.com\n`;
    expect(await omni(['sign', 'footer'], config)).toEqual({
      code: 0,
      out: '🦸 Omni-man by [Omni Loop](https://example.com) © <!-- omni-loop:signed -->\n',
      err: '',
    });
    expect((await omni(['sign', 'trailer'], config)).out).toBe(
      'Co-authored-by: Omni-man <333776611+omni-loop-invader[bot]@users.noreply.github.com>\n',
    );
  });

  it('a config setting only name renames the hero in both lines, the link unchanged (PRD #215, AC 3)', async () => {
    const config = `${CONFIG}signature:\n  name: Robo\n`;
    expect((await omni(['sign', 'footer'], config)).out).toBe(
      '🦸 Robo by [Omni Loop](https://vertuo-omni-loop-galaxy.vercel.app) © <!-- omni-loop:signed -->\n',
    );
    expect((await omni(['sign', 'trailer'], config)).out).toBe(
      'Co-authored-by: Robo <333776611+omni-loop-invader[bot]@users.noreply.github.com>\n',
    );
  });

  it('a home that is not https is refused, naming signature.home (PRD #215, AC 5)', async () => {
    const { code, out, err } = await omni(['sign', 'footer'], `${CONFIG}signature:\n  home: http://example.com\n`);
    expect(code).not.toBe(0);
    expect(out).toBe('');
    expect(err).toMatch(/signature\.home/);
  });

  it('with signature: null, both print nothing and exit 0', async () => {
    const config = `${CONFIG}signature: null\n`;
    expect(await omni(['sign', 'trailer'], config)).toEqual({ code: 0, out: '', err: '' });
    expect(await omni(['sign', 'footer'], config)).toEqual({ code: 0, out: '', err: '' });
  });

  it('refuses no line, another line, an extra argument or a flag: one usage line, exit 2', async () => {
    for (const argv of [['sign'], ['sign', 'header'], ['sign', 'trailer', 'extra'], ['sign', 'footer', '--json']]) {
      const { code, out, err } = await omni(argv);
      expect(code).toBe(2);
      expect(out).toBe('');
      expect(err.split('\n').filter(Boolean)).toHaveLength(1);
      expect(err).toMatch(/omni sign/);
    }
  });
});
