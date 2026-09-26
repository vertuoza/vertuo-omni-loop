import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FACES, ROLES, TYPE_SCALE, fontFaceCss, fontFiles, fontsCss } from './fonts.mjs';

const pkg = join(dirname(fileURLToPath(import.meta.url)), '..');
const committed = readFileSync(join(pkg, 'fonts.css'), 'utf8');

/** Every @font-face rule of a stylesheet: its family and the file its src points to. */
function declaredFaces(css) {
  return [...css.matchAll(/@font-face\s*{([^}]*)}/g)].map(([, body]) => ({
    family: body.match(/font-family:\s*'([^']+)'/)?.[1],
    url: body.match(/src:\s*url\('([^']+)'\)\s*format\('woff2'\)/)?.[1],
  }));
}

describe('fonts', () => {
  it('fonts.css, as committed, is what the generator writes', () => {
    expect(committed).toBe(fontsCss());
  });

  it('declares the five faces of the four roles', () => {
    const families = new Set(declaredFaces(committed).map((f) => f.family));
    expect([...families].sort()).toEqual(
      ['Anton', 'Atkinson Hyperlegible Next', 'Jersey 10', 'JetBrains Mono', 'Press Start 2P'],
    );
    expect(Object.keys(ROLES).sort()).toEqual(['body', 'display', 'mono', 'pixel']);
  });

  it('points every face it declares to a woff2 file in the package', () => {
    const faces = declaredFaces(committed);
    expect(faces.length).toBeGreaterThan(0);
    for (const { family, url } of faces) {
      expect(url, family).toMatch(/^\.\/fonts\/[a-z0-9-]+\.woff2$/);
      expect(existsSync(join(pkg, url)), url).toBe(true);
    }
  });

  it('ships no woff2 file it does not declare', () => {
    const declared = new Set(declaredFaces(committed).map((f) => f.url.replace('./fonts/', '')));
    const shipped = readdirSync(join(pkg, 'fonts')).filter((f) => f.endsWith('.woff2'));
    expect(shipped.sort()).toEqual([...declared].sort());
  });

  it('ships the licence of every face beside its files', () => {
    for (const face of FACES) {
      const licence = readFileSync(join(pkg, 'fonts', `OFL-${face.slug}.txt`), 'utf8');
      expect(licence, face.family).toContain('SIL Open Font License');
    }
  });

  it('names a declared face in every role and every step of the type scale', () => {
    const families = new Set(declaredFaces(committed).map((f) => f.family));
    for (const [role, faces] of Object.entries(ROLES)) {
      expect(faces.length, role).toBeGreaterThan(0);
      for (const family of faces) expect(families, `${role}: ${family}`).toContain(family);
    }
    for (const [step, s] of Object.entries(TYPE_SCALE)) {
      expect(families, step).toContain(s.face);
      expect(ROLES[s.role], step).toContain(s.face);
    }
  });

  it('gives every step of the type scale a role, a size, a line height and a slant', () => {
    expect(Object.keys(TYPE_SCALE)).toEqual([
      'display-xl', 'display-l', 'display-m', 'display-s',
      'pixel-l', 'pixel-m', 'pixel-s',
      'body-l', 'body-m', 'body-s',
      'mono',
    ]);
    for (const [step, s] of Object.entries(TYPE_SCALE)) {
      expect(step.startsWith(s.role), step).toBe(true);
      expect(s.size, step).toBeGreaterThan(0);
      expect(s.lineHeight, step).toBeGreaterThan(0);
      expect(s.slant, step).toBe(s.role === 'display' ? 12 : 0);
      expect(committed, step).toContain(`--type-${step}-size: ${s.size}px;`);
      expect(committed, step).toContain(`--type-${step}-line: ${s.lineHeight};`);
    }
  });

  it('writes the faces it is given with the url it is given, for a page that inlines them', () => {
    const pixel = fontFiles().filter((f) => f.role === 'pixel');
    const css = fontFaceCss(pixel, (file) => `data:font/woff2;base64,${file.length}`);
    const faces = declaredFaces(css);
    expect(faces).toHaveLength(pixel.length);
    expect(new Set(faces.map((f) => f.family))).toEqual(new Set(['Press Start 2P', 'Jersey 10']));
    for (const { url } of faces) expect(url).toMatch(/^data:font\/woff2;base64,\d+$/);
  });
});
