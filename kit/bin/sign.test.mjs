// PRD #99, slice s1: `omni sign trailer | footer`, through `main()` on a fixture repository (AC 3).
import { describe, expect, it } from 'vitest';
import { makeRepo } from '../test/fixture.mjs';
import { main } from './omni.mjs';

const CONFIG = 'kit: 1\nrepo:\n  slug: acme/widgets\n';

/** Runs `omni <argv>` in a fixture repository whose config is `config`: `{ code, out, err }`. */
async function omni(argv, config = CONFIG) {
  const { root } = makeRepo({ git: true, files: { '.omni-loop/config.yml': config } });
  const out = [];
  const err = [];
  const code = await main(argv, { cwd: root, stdout: { write: (s) => out.push(s) }, stderr: { write: (s) => err.push(s) } });
  return { code, out: out.join(''), err: err.join('') };
}

describe('omni sign', () => {
  it('trailer prints exactly the co-author line, and nothing else', async () => {
    expect(await omni(['sign', 'trailer'])).toEqual({
      code: 0,
      out: 'Co-authored-by: OmniMan <333776611+omni-loop-invader[bot]@users.noreply.github.com>\n',
      err: '',
    });
  });

  it('footer prints the footer followed by the hidden marker', async () => {
    expect(await omni(['sign', 'footer'])).toEqual({
      code: 0,
      out: '🦸 Delivered by OmniMan, with Omni Loop <!-- omni-loop:signed -->\n',
      err: '',
    });
  });

  it('prints what the config names, when it overrides the default', async () => {
    const config = `${CONFIG}signature:\n  name: Robo\n  email: robo@example.com\n  footer: Made by Robo\n`;
    expect((await omni(['sign', 'trailer'], config)).out).toBe('Co-authored-by: Robo <robo@example.com>\n');
    expect((await omni(['sign', 'footer'], config)).out).toBe('Made by Robo <!-- omni-loop:signed -->\n');
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
