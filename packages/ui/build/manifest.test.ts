// The design manifest: the committed packages/design/design-system.json is what a fresh build writes
// (AC-1), a part added later is in it with no edit to the generator, and only a locked screen is a pattern.
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import { MANIFEST_VERSION, SURFACES, buildManifest, patternsOf, tokensOf } from './manifest.ts';

const COMMITTED = new URL('../../design/design-system.json', import.meta.url);

/** A src folder holding the parts named, each with its four files, and an empty library. */
function fixture(names: readonly string[]): { src: URL; screens: URL } {
  const root = mkdtempSync(join(tmpdir(), 'omni-manifest-'));
  mkdirSync(join(root, 'src'));
  mkdirSync(join(root, 'screens'));
  for (const name of names) {
    const stem = name.charAt(0).toLowerCase() + name.slice(1);
    writeFileSync(join(root, 'src', `${name}.tsx`), '');
    writeFileSync(join(root, 'src', `${name}.css`), '');
    writeFileSync(join(root, 'src', `${name}.specimen.tsx`), `export const ${stem}Specimen = () => null;\n`);
    const meta = { name, variants: { size: ['md', 'sm'] }, usage: `Use ${name}.`, do: ['Do.'], dont: ['Do not.'], replaces: [], example: `<${name} />` };
    writeFileSync(join(root, 'src', `${name}.meta.ts`), `export const ${stem}Meta = ${JSON.stringify(meta)};\n`);
  }
  return { src: pathToFileURL(join(root, 'src/')), screens: pathToFileURL(join(root, 'screens/')) };
}

describe('the design manifest', () => {
  it('AC-1: is what the committed design-system.json holds', async () => {
    const fresh = await buildManifest();
    // The file is generated: a sub-PR of a wave does not commit it, the wave rebuilds it once after
    // merging. Where it is absent there is nothing to compare; the fresh build must still be valid.
    if (!existsSync(COMMITTED)) {
      expect(JSON.parse(fresh)).toHaveProperty('omni-design', MANIFEST_VERSION);
      return;
    }
    expect(readFileSync(COMMITTED, 'utf8'), 'run `node packages/ui/build/manifest.ts` after changing a part, a token or a screen').toBe(fresh);
  });

  it('holds the version, the registered parts, the tokens in three themes and the surfaces', async () => {
    const manifest = JSON.parse(await buildManifest()) as Record<string, unknown>;
    expect(Object.keys(manifest)).toEqual(['components', 'omni-design', 'patterns', 'surfaces', 'tokens']);
    expect(manifest['omni-design']).toBe(1);
    expect(manifest.surfaces).toEqual(SURFACES);
    const components = manifest.components as { name: string; import: string }[];
    expect(components.find((c) => c.name === 'Button')).toMatchObject({ import: '@omni/ui', variants: { variant: ['primary', 'secondary', 'quiet', 'danger'] } });
    const tokens = manifest.tokens as { name: string; themes: Record<string, string> }[];
    expect(tokens.find((t) => t.name === 'color-canvas')?.themes.omni).toBe('#07061c');
    for (const token of tokens) expect(Object.keys(token.themes), token.name).toEqual(['dark', 'light', 'omni']);
  });

  it('lists a part added later with no edit to the generator', async () => {
    const { src, screens } = fixture(['Zebra', 'Apple']);
    const manifest = JSON.parse(await buildManifest(src, screens)) as { components: { name: string }[] };
    expect(manifest.components.map((c) => c.name)).toEqual(['Apple', 'Zebra']);
  });

  it('is stable: the same sources write the same bytes', async () => {
    expect(await buildManifest()).toBe(await buildManifest());
  });

  it('keeps the surfaces of the app and leaves the arcade and HOME out', () => {
    expect(SURFACES.include).toContain('apps/galaxy/app/**');
    expect(SURFACES.exclude).toEqual(expect.arrayContaining(['apps/galaxy/app/play/**', 'apps/galaxy/app/page.tsx']));
  });

  it('takes only locked screens as patterns, by library name', () => {
    const screen = (name: string, status: string) => `---\nscreen: ${name}\nstatus: ${status}\nmock: ${name}.html\nroutes: [/a, /b/<id>]\n---\n\n## Purpose\n`;
    expect(patternsOf({ 'b.md': screen('b', 'locked'), 'a.md': screen('a', 'locked'), 'c.md': screen('c', 'draft'), 'x.html': '<html>' })).toEqual([
      { name: 'a', routes: ['/a', '/b/<id>'], mock: 'a.html' },
      { name: 'b', routes: ['/a', '/b/<id>'], mock: 'b.html' },
    ]);
    expect(patternsOf({})).toEqual([]);
  });

  it('gives a colour role its value in each theme and a scale token the same value in all three', () => {
    const roles = { omni: { canvas: '#111' }, light: { canvas: '#fff' }, dark: { canvas: '#000' } };
    expect(tokensOf(roles, { 'space-1': '4px' })).toEqual([
      { name: 'color-canvas', group: 'color', role: 'canvas', themes: { omni: '#111', light: '#fff', dark: '#000' } },
      { name: 'space-1', group: 'space', role: 'space', themes: { omni: '4px', light: '4px', dark: '4px' } },
    ]);
  });
});
