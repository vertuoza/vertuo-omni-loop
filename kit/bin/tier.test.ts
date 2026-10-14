// PRD 1934, s1: `omni tier <tier> --agent <agent>`, through `main()` on a fixture repository.
import { describe, expect, it } from 'vitest';
import { makeRepo } from '../test/fixture.ts';
import { main } from './omni.ts';

const MAPPED = 'kit: 1\ntiers:\n  claude:\n    light: { model: haiku, effort: low }\n    build: { model: sonnet }\n';

async function omni(argv: readonly string[], config = MAPPED) {
  const { root } = makeRepo({ git: true, files: { '.omni-loop/config.yml': config } });
  const out: string[] = [];
  const err: string[] = [];
  const code = await main(argv, { cwd: root, stdout: { write: (s) => out.push(s) }, stderr: { write: (s) => err.push(s) } });
  return { code, out: out.join(''), err: err.join('') };
}

describe('omni tier', () => {
  it('prints the model and the effort of a mapped tier, and exits 0', async () => {
    expect(await omni(['tier', 'light', '--agent', 'claude'])).toEqual({ code: 0, out: 'model: haiku\neffort: low\n', err: '' });
  });

  it('prints the model alone when the tier sets no effort', async () => {
    expect(await omni(['tier', 'build', '--agent', 'claude'])).toEqual({ code: 0, out: 'model: sonnet\n', err: '' });
  });

  it('prints inherit for a tier nothing maps, and exits 0', async () => {
    expect(await omni(['tier', 'deep', '--agent', 'claude'])).toEqual({ code: 0, out: 'inherit\n', err: '' });
    expect(await omni(['tier', 'light', '--agent', 'codex'])).toEqual({ code: 0, out: 'inherit\n', err: '' });
    expect(await omni(['tier', 'light', '--agent', 'claude'], 'kit: 1\n')).toEqual({ code: 0, out: 'inherit\n', err: '' });
  });

  it('refuses an unknown tier with exit 2, naming it', async () => {
    const { code, out, err } = await omni(['tier', 'fast', '--agent', 'claude']);
    expect(code).toBe(2);
    expect(out).toBe('');
    expect(err).toMatch(/fast/);
    expect(err).toMatch(/deep, build, light/);
  });

  it('refuses an unknown agent, a missing --agent or a wrong count of tiers with exit 2', async () => {
    const unknown = await omni(['tier', 'light', '--agent', 'copilot']);
    expect(unknown.code).toBe(2);
    expect(unknown.err).toMatch(/copilot/);
    for (const argv of [['tier', 'light'], ['tier', '--agent', 'claude'], ['tier', 'light', 'deep', '--agent', 'claude']]) {
      const { code, err } = await omni(argv);
      expect(code, argv.join(' ')).toBe(2);
      expect(err).toMatch(/usage: omni tier <deep\|build\|light> --agent <agent>/);
    }
  });
});
