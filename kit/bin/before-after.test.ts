// PRD 2239, s2: `omni before-after new` through `main()` on a fixture repository.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { makeRepo } from '../test/fixture.ts';
import { main } from './omni.ts';

const CONFIG = { '.omni-loop/config.yml': 'kit: 1\nrepo:\n  slug: acme/widgets\n' };
const DIR = '.omni-loop/delivery/inbox/2239-two-tabs';
const PAGE = `${DIR}/before-after.html`;
const FILL = '<!-- FILL -->';

function repo(extra: Record<string, string> = { [`${DIR}/spec.md`]: '' }) {
  return makeRepo({ git: true, files: { ...CONFIG, ...extra } });
}

async function omni(root: string, argv: readonly string[]) {
  const out: string[] = [];
  const err: string[] = [];
  const code = await main(argv, { cwd: root, stdout: { write: (s) => out.push(s) }, stderr: { write: (s) => err.push(s) } });
  return { code, out: out.join(''), err: err.join('') };
}

describe('omni before-after new', () => {
  it('writes the two-tab page into the inbox folder, names it and exits 0', async () => {
    const { root } = repo();
    const result = await omni(root, ['before-after', 'new', '2239', '--services', 'kit,galaxy']);
    expect(result).toEqual({ code: 0, out: `wrote ${PAGE}\n`, err: '' });
    const html = readFileSync(join(root, PAGE), 'utf8');
    expect(html).toContain('<meta name="omni-before-after" content="2">');
    expect(html.match(/data-service="kit"/g)).toHaveLength(2);
    expect(html.match(/data-service="galaxy"/g)).toHaveLength(2);
    expect(html).toContain(FILL);
  });

  it('writes a page omni check inbox accepts once the FILL markers are replaced with a state', async () => {
    const { root } = repo({
      [`${DIR}/spec.md`]: '---\nprd: 2239\ntitle: Two tabs\nblocked-by: none\nspec: file\n---\n\n# Two tabs\n',
    });
    await omni(root, ['before-after', 'new', '2239', '--services', 'kit']);
    const raw = await omni(root, ['check', 'inbox']);
    expect(raw.code).toBe(1);
    expect(raw.err + raw.out).toContain('before-after.html: 8 <!-- FILL --> markers left');
    writeFileSync(join(root, PAGE), readFileSync(join(root, PAGE), 'utf8').replaceAll(FILL, 'N/A — nothing changes'));
    const filled = await omni(root, ['check', 'inbox']);
    expect(filled.err + filled.out).not.toContain('before-after.html');
    expect(filled.code).toBe(0);
  });

  it('refuses a PRD with no inbox folder, writing nothing, with one line and exit 1', async () => {
    const { root } = repo();
    const result = await omni(root, ['before-after', 'new', '7', '--services', 'kit']);
    expect(result).toEqual({ code: 1, out: '', err: 'omni before-after new: PRD 7 has no inbox folder.\n' });
  });

  it('refuses a PRD already shipped', async () => {
    const { root } = repo({ '.omni-loop/delivery/shipped/0007-old/spec.md': '' });
    const result = await omni(root, ['before-after', 'new', '7', '--services', 'kit']);
    expect(result.code).toBe(1);
    expect(result.err).toBe('omni before-after new: PRD 7 has no inbox folder.\n');
    expect(existsSync(join(root, '.omni-loop/delivery/shipped/0007-old/before-after.html'))).toBe(false);
  });

  it('refuses an existing page without --force, leaves it, and replaces it with --force', async () => {
    const { root } = repo({ [`${DIR}/spec.md`]: '', [PAGE]: 'mine' });
    const refused = await omni(root, ['before-after', 'new', '2239', '--services', 'kit']);
    expect(refused).toEqual({ code: 1, out: '', err: `omni before-after new: ${PAGE} already exists: pass --force to replace it.\n` });
    expect(readFileSync(join(root, PAGE), 'utf8')).toBe('mine');
    const forced = await omni(root, ['before-after', 'new', '2239', '--services', 'kit', '--force']);
    expect(forced.code).toBe(0);
    expect(readFileSync(join(root, PAGE), 'utf8')).toContain('omni-before-after');
  });

  it('refuses a missing, valueless or empty --services with one line and exit 1, writing nothing', async () => {
    const { root } = repo();
    for (const argv of [['2239'], ['2239', '--services'], ['2239', '--services', ''], ['2239', '--services', ' , ']]) {
      const result = await omni(root, ['before-after', 'new', ...argv]);
      expect(result.code, argv.join(' ')).toBe(1);
      expect(result.out).toBe('');
      expect(result.err).toMatch(/^omni before-after new: --services needs at least one service.*\n$/);
    }
    expect(existsSync(join(root, PAGE))).toBe(false);
  });

  it('refuses a service name the page cannot carry', async () => {
    const { root } = repo();
    const result = await omni(root, ['before-after', 'new', '2239', '--services', 'a"b']);
    expect(result.code).toBe(1);
    expect(result.err).toContain('"a"b" is not a service name');
  });

  it('is a usage error, exit 2, with no verb, an unknown verb, or a bad number', async () => {
    const { root } = repo();
    mkdirSync(join(root, DIR), { recursive: true });
    for (const argv of [['before-after'], ['before-after', 'old'], ['before-after', 'new'], ['before-after', 'new', 'x', '--services', 'kit'], ['before-after', 'new', '1', '2', '--services', 'kit']]) {
      const result = await omni(root, argv);
      expect(result.code, argv.join(' ')).toBe(2);
      expect(result.out).toBe('');
    }
  });

  it('says render is not in this version, exit 1', async () => {
    const { root } = repo();
    const result = await omni(root, ['before-after', 'render', '2239']);
    expect(result.code).toBe(1);
    expect(result.err).toBe('omni before-after render: not available in this version of the kit.\n');
  });
});
