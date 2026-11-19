// `omni design tokens` and `omni design pattern` (PRD omni-loop-13), from a fixture manifest, and the
// committed manifest against the kit's schema and caps. No network, no model.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { formatComponent, formatComponents, NO_MANIFEST, parseManifest } from '../lib/design/manifest.ts';
import { makeRepo } from '../test/fixture.ts';
import { main } from './omni.ts';

const HEAD = 'kit: 1\nrepo:\n  slug: acme/widgets\n';
const WITH = HEAD + 'design:\n  enabled: true\n  manifest: design-system.json\n';

const fixture = (patterns: unknown[]) => ({
  'omni-design': 1,
  tokens: [
    { group: 'color', name: 'color-canvas', role: 'canvas', themes: { omni: '#07061c', light: '#f5f4fc', dark: '#0e0d33' } },
    { group: 'color', name: 'color-surface', role: 'surface', themes: { omni: '#120f3a', light: '#ffffff', dark: '#16144a' } },
    { group: 'space', name: 'space-1', role: 'space', themes: { omni: '4px', light: '4px', dark: '4px' } },
  ],
  components: [{ name: 'Button', import: '@omni/ui', example: '<Button />' }],
  patterns,
  surfaces: { include: ['apps/galaxy/app/**'], exclude: ['apps/galaxy/app/play/**'] },
});

async function run(files: Record<string, string>, args: string[]) {
  const { root } = makeRepo({ git: true, files });
  const out: string[] = [];
  const code = await main(['design', ...args], { cwd: root, stdout: { write: (s: string) => out.push(s) }, stderr: { write: () => undefined } });
  return { code, out: out.join('') };
}

const files = (manifest: unknown, config = WITH) => ({ '.omni-loop/config.yml': config, 'design-system.json': JSON.stringify(manifest) });
const locked = { name: 'prd-page', routes: ['/prd/[id]'], mock: 'prd-page.html' };

describe('omni design tokens', () => {
  it('prints the groups and their counts', async () => {
    const r = await run(files(fixture([])), ['tokens']);
    expect(r.code).toBe(0);
    expect(r.out).toBe('color  2\nspace  1\n');
  });

  it('prints one group with its value in each theme', async () => {
    const r = await run(files(fixture([])), ['tokens', 'color']);
    expect(r.code).toBe(0);
    expect(r.out).toContain('color-canvas  omni #07061c  light #f5f4fc  dark #0e0d33');
    expect(r.out).not.toContain('space-1');
  });

  it('names the groups for an unknown one and exits 1', async () => {
    const r = await run(files(fixture([])), ['tokens', 'nope']);
    expect(r.code).toBe(1);
    expect(r.out).toBe('no token group named nope; groups: color, space\n');
  });

  it('says there is no manifest and exits 0', async () => {
    const r = await run({ '.omni-loop/config.yml': HEAD }, ['tokens']);
    expect(r.code).toBe(0);
    expect(r.out).toBe(`${NO_MANIFEST}\n`);
  });
});

describe('omni design pattern', () => {
  it('prints a locked screen card within 800 bytes', async () => {
    const r = await run(files(fixture([locked])), ['pattern', 'prd-page']);
    expect(r.code).toBe(0);
    expect(r.out).toContain('routes: /prd/[id]');
    expect(r.out).toContain('mockup: prd-page.html');
    expect(Buffer.byteLength(r.out)).toBeLessThanOrEqual(800);
  });

  it('says the library has no locked screen yet, exit 0', async () => {
    const r = await run(files(fixture([])), ['pattern', 'prd-page']);
    expect(r.code).toBe(0);
    expect(r.out).toBe('the library has no locked screen yet\n');
  });

  it('names the patterns for an unknown one and exits 1', async () => {
    const r = await run(files(fixture([locked])), ['pattern', 'zzz']);
    expect(r.code).toBe(1);
    expect(r.out).toContain('patterns: prd-page');
  });

  it('says there is no manifest and exits 0', async () => {
    const r = await run({ '.omni-loop/config.yml': HEAD }, ['pattern', 'x']);
    expect(r.code).toBe(0);
    expect(r.out).toBe(`${NO_MANIFEST}\n`);
  });

  it('is a usage mistake without a name', async () => {
    const r = await run(files(fixture([])), ['pattern']);
    expect(r.code).toBe(2);
  });
});

describe('the committed manifest', () => {
  const path = join(dirname(fileURLToPath(import.meta.url)), '../../packages/design/design-system.json');
  const read = parseManifest(JSON.parse(readFileSync(path, 'utf8')) as unknown);

  it('passes the kit schema, surfaces as { include, exclude } included', () => {
    expect(read.kind).toBe('ok');
    if (read.kind !== 'ok') return;
    const { surfaces } = read.manifest;
    expect(Array.isArray(surfaces)).toBe(false);
    expect('include' in surfaces && surfaces.include.length > 0).toBe(true);
  });

  it('keeps the index within 1536 bytes and every card within 800 bytes', () => {
    if (read.kind !== 'ok') throw new Error('the committed manifest is refused');
    const index = formatComponents(read.manifest).map((l) => `${l}\n`).join('');
    expect(Buffer.byteLength(index)).toBeLessThanOrEqual(1536);
    for (const c of read.manifest.components) {
      const card = (formatComponent(read.manifest, c.name) ?? []).map((l) => `${l}\n`).join('');
      expect(Buffer.byteLength(card), c.name).toBeLessThanOrEqual(800);
    }
  });
});
