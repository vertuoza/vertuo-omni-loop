// The guard of the design system (PRD 141): the look lives in @omni/design, once. This test fails
// when a copy creeps back into the galaxy: a stylesheet declaring its own colour on :root, a page
// linking Google Fonts instead of @omni/design/fonts.css, a file importing the old @omni/sprites,
// or the theme module's defaults drifting from the package's colours.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { COLOURS } from '@omni/design';
import { TOKENS, type Token } from './arcade/theme';

const REPO = fileURLToPath(new URL('../../../', import.meta.url));
/** This file: its detectors' samples name the old package on purpose. */
const SELF = fileURLToPath(import.meta.url);
const GALAXY = join(REPO, 'apps/galaxy');
/** Folders a build or an install writes: never the galaxy's own source. */
const SKIP = new Set(['node_modules', '.next', 'dist', 'shots', '.vercel', '.turbo']);

/** Every file under `dir` whose name ends in one of `ends`, skipping build and install output. */
function files(dir: string, ends: readonly string[]): string[] {
  return readdirSync(dir).flatMap((name) => {
    if (SKIP.has(name)) return [];
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return files(path, ends);
    return ends.some((end) => name.endsWith(end)) ? [path] : [];
  });
}

const uncommented = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '');

/** The colour custom properties a stylesheet declares on `:root`, as `--name: value`. */
function rootColours(css: string): string[] {
  const blocks = [...uncommented(css).matchAll(/:root\b[^{]*\{([^}]*)\}/g)].map(([, body]) => body);
  return blocks.flatMap((body) => [...body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);?/g)]
    .filter(([, , value]) => /#[0-9a-f]{3,8}\b|\b(rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(/i.test(value))
    .map(([, name, value]) => `${name}: ${value.trim()}`));
}

/** Whether a source links or imports a font from Google Fonts. */
const linksGoogleFonts = (source: string) => /fonts\.(googleapis|gstatic)\.com/.test(source);

/** Whether a source imports @omni/sprites: an import, a re-export, a require, a dynamic or CSS import. */
const importsOldPackage = (source: string) =>
  /(\bfrom\s*|\bimport\s*\(?\s*|\brequire\s*\(\s*|@import\s+(url\()?\s*)['"]@omni\/sprites(\/[^'"]*)?['"]/.test(source);

describe('the guard\'s detectors', () => {
  it('find a colour declared on :root, whatever its notation, and nothing else', () => {
    expect(rootColours(':root { --plasma: #a45cff; }')).toEqual(['--plasma: #a45cff']);
    expect(rootColours(':root{--glow:rgba(1, 2, 3, .5)}')).toEqual(['--glow: rgba(1, 2, 3, .5)']);
    expect(rootColours(':root, .x { --a: oklch(70% 0.1 200); --b: hsl(1 2% 3%) }')).toHaveLength(2);
    expect(rootColours(':root { color-scheme: dark; --px: \'Press Start 2P\', monospace; }')).toEqual([]);
    expect(rootColours('/* :root { --plasma: #a45cff; } */ .shell { --plasma: #a45cff; }')).toEqual([]);
  });

  it('find a Google Fonts link, and not a font served from the package', () => {
    expect(linksGoogleFonts('<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Jersey+10" />')).toBe(true);
    expect(linksGoogleFonts('<link rel="preconnect" href="https://fonts.gstatic.com" />')).toBe(true);
    expect(linksGoogleFonts('import \'@omni/design/fonts.css\';')).toBe(false);
  });

  it('find every way of importing @omni/sprites, and not a mention in prose', () => {
    expect(importsOldPackage('import { INK } from \'@omni/sprites\';')).toBe(true);
    expect(importsOldPackage('export * from "@omni/sprites/src/palette.mjs";')).toBe(true);
    expect(importsOldPackage('const m = await import(\'@omni/sprites\');')).toBe(true);
    expect(importsOldPackage('const m = require("@omni/sprites");')).toBe(true);
    expect(importsOldPackage('@import \'@omni/sprites/tokens.css\';')).toBe(true);
    expect(importsOldPackage('import { INK } from \'@omni/design\';')).toBe(false);
    expect(importsOldPackage('// renamed from @omni/sprites in PRD 141')).toBe(false);
  });
});

describe('the galaxy', () => {
  it('declares no colour on :root in any stylesheet: every colour comes from @omni/design/tokens.css', () => {
    const sheets = files(GALAXY, ['.css']);
    expect(sheets.length).toBeGreaterThan(0);
    const found = sheets.flatMap((path) =>
      rootColours(readFileSync(path, 'utf8')).map((c) => `${relative(REPO, path)}: ${c}`));
    expect(found).toEqual([]);
  });

  it('links no Google Fonts under app/: the fonts are served from @omni/design/fonts.css', () => {
    const pages = files(join(GALAXY, 'app'), ['.ts', '.tsx', '.js', '.mjs', '.css', '.html']);
    expect(pages.length).toBeGreaterThan(0);
    const found = pages.filter((path) => linksGoogleFonts(readFileSync(path, 'utf8'))).map((path) => relative(REPO, path));
    expect(found).toEqual([]);
  });

  it('shares its theme\'s defaults with the package: every token a stylesheet reads is @omni/design\'s colour', () => {
    // The mark's gradient is a workspace's (the Vertuoza V), and the stripes are the forge's: both
    // are drawn on the canvas, not declared by tokens.css.
    const read = (Object.keys(TOKENS) as Token[]).filter((t) => !/^(mark|stripe)-/.test(t));
    expect(read.length).toBeGreaterThan(0);
    for (const t of read) expect(TOKENS[t], t).toBe(COLOURS[t]);
  });
});

describe('the repository', () => {
  it('imports @omni/sprites nowhere, and names it in no package\'s dependencies', () => {
    const roots = ['apps', 'packages', 'game'].map((dir) => join(REPO, dir));
    const sources = roots.flatMap((root) => files(root, ['.ts', '.tsx', '.mts', '.cts', '.js', '.mjs', '.cjs', '.css']));
    expect(sources.length).toBeGreaterThan(0);
    const importing = sources.filter((path) => path !== SELF && importsOldPackage(readFileSync(path, 'utf8'))).map((path) => relative(REPO, path));
    expect(importing).toEqual([]);

    const manifests = [join(REPO, 'package.json'), ...roots.flatMap((root) => files(root, ['package.json']))];
    const depending = manifests.filter((path) => {
      const pkg = JSON.parse(readFileSync(path, 'utf8'));
      return ['name', 'dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']
        .some((key) => key === 'name' ? pkg.name === '@omni/sprites' : Object.hasOwn(pkg[key] ?? {}, '@omni/sprites'));
    }).map((path) => relative(REPO, path));
    expect(depending).toEqual([]);
  });
});
