import { describe, expect, it } from 'vitest';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { generatedModule, readTokenFiles, readTokens, resolveTokens, writeTokens } from './build.ts';
import { tokensCss } from '../src/tokens.ts';

const committed = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

/** A colour as DTCG 2025.10 writes it: sRGB components with the hex beside them. */
const colour = (hex: string, alpha?: number) => {
  const components = [0, 1, 2].map((i) => parseInt(hex.slice(1 + 2 * i, 3 + 2 * i), 16) / 255);
  return alpha === undefined ? { colorSpace: 'srgb', components, hex } : { colorSpace: 'srgb', components, alpha, hex };
};

/** The smallest valid set of files: one palette colour, one space step, one role per theme. */
function files(over: Record<string, unknown> = {}): Record<string, unknown> {
  const theme = { color: { $type: 'color', canvas: { $value: '{void}' } } };
  return {
    'palette.tokens.json': { $type: 'color', void: { $value: colour('#07061c') } },
    'scale.tokens.json': { space: { $type: 'dimension', 1: { $value: { value: 4, unit: 'px' } } } },
    'omni.tokens.json': theme, 'light.tokens.json': theme, 'dark.tokens.json': theme,
    ...over,
  };
}

describe('the token generator', () => {
  it('writes tokens.css from the DTCG files exactly as committed: run `pnpm --filter @omni/design tokens` after a change', () => {
    expect(committed('tokens.css')).toBe(tokensCss(readTokens()));
  });

  it('writes src/tokens.generated.ts from the DTCG files exactly as committed', () => {
    expect(committed('src/tokens.generated.ts')).toBe(generatedModule(readTokens()));
  });

  it('writes both outputs beside the folder it reads', () => {
    const root = mkdtempSync(join(tmpdir(), 'omni-tokens-'));
    try {
      mkdirSync(join(root, 'tokens'));
      mkdirSync(join(root, 'src'));
      for (const name of Object.keys(readTokenFiles())) copyFileSync(new URL(name, import.meta.url), join(root, 'tokens', name));
      writeTokens(pathToFileURL(join(root, 'tokens/')));
      expect(readFileSync(join(root, 'tokens.css'), 'utf8')).toBe(committed('tokens.css'));
      expect(readFileSync(join(root, 'src/tokens.generated.ts'), 'utf8')).toBe(committed('src/tokens.generated.ts'));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('reads every *.tokens.json file of the folder, and nothing else', () => {
    expect(Object.keys(readTokenFiles()).sort()).toEqual([
      'dark.anti.tokens.json', 'dark.tokens.json', 'light.anti.tokens.json', 'light.tokens.json',
      'omni.anti.tokens.json', 'omni.tokens.json', 'palette.tokens.json', 'scale.tokens.json',
    ]);
  });

  it('resolves an alias to the token it names, and writes a colour with alpha as rgb()', () => {
    const set = resolveTokens(files({
      'scale.tokens.json': {
        elevation: { $type: 'shadow', raised: { $value: { color: colour('#000000', 0.24), offsetX: { value: 0, unit: 'px' }, offsetY: { value: 1, unit: 'px' }, blur: { value: 3, unit: 'px' }, spread: { value: 0, unit: 'px' } } } },
        motion: { 'ease-out': { $type: 'cubicBezier', $value: [0.2, 0, 0, 1] }, fast: { $type: 'duration', $value: { value: 120, unit: 'ms' } } },
        weight: { $type: 'fontWeight', medium: { $value: 500 } },
        line: { $type: 'number', $value: 1.6 },
      },
    }));
    expect(set.colours).toEqual({ void: '#07061c' });
    expect(set.themes.omni).toEqual({ canvas: '#07061c' });
    expect(set.scale).toEqual({
      'elevation-raised': '0px 1px 3px 0px rgb(0 0 0 / 0.24)',
      'motion-ease-out': 'cubic-bezier(0.2, 0, 0, 1)',
      'motion-fast': '120ms',
      'weight-medium': '500',
      line: '1.6',
    });
  });

  it('lays an anti-loop file over its theme, and keeps only the roles it remaps', () => {
    const set = resolveTokens(files({
      'palette.tokens.json': { $type: 'color', void: { $value: colour('#07061c') }, magenta: { $value: colour('#ff3ea5') } },
      'omni.tokens.json': { color: { $type: 'color', canvas: { $value: '{void}' }, signal: { $value: '{void}' } } },
      'light.tokens.json': { color: { $type: 'color', canvas: { $value: '{void}' }, signal: { $value: '{void}' } } },
      'dark.tokens.json': { color: { $type: 'color', canvas: { $value: '{void}' }, signal: { $value: '{void}' } } },
      'omni.anti.tokens.json': { color: { $type: 'color', signal: { $value: '{magenta}' } } },
    }));
    expect(set.anti).toEqual({ omni: { signal: '#ff3ea5' }, light: {}, dark: {} });
  });

  const refuses = (over: Record<string, unknown>, why: RegExp) => { expect(() => resolveTokens(files(over))).toThrow(why); };

  it('refuses a type it does not know', () => {
    refuses({ 'scale.tokens.json': { gradient: { $type: 'gradient', $value: [] } } }, /scale\.tokens\.json: gradient: \$type "gradient" is not one the generator writes/);
  });

  it('refuses a token with no type', () => {
    refuses({ 'scale.tokens.json': { gap: { $value: { value: 4, unit: 'px' } } } }, /gap: no \$type/);
  });

  it('refuses a colour whose hex and components disagree, or that is not sRGB', () => {
    refuses({ 'palette.tokens.json': { $type: 'color', void: { $value: { colorSpace: 'srgb', components: [1, 1, 1], hex: '#07061c' } } } }, /void: the hex #07061c is not its components/);
    refuses({ 'palette.tokens.json': { $type: 'color', void: { $value: { colorSpace: 'display-p3', components: [0, 0, 0], hex: '#000000' } } } }, /void: a colour is srgb/);
    refuses({ 'palette.tokens.json': { $type: 'color', void: { $value: '#07061c' } } }, /void: not a color value/);
  });

  it('refuses a dimension in a unit other than px or rem, and a weight out of range', () => {
    refuses({ 'scale.tokens.json': { space: { $type: 'dimension', 1: { $value: { value: 4, unit: 'em' } } } } }, /space\.1: not a dimension value/);
    refuses({ 'scale.tokens.json': { weight: { $type: 'fontWeight', heavy: { $value: 1200 } } } }, /weight\.heavy: not a fontWeight value/);
  });

  it('refuses an alias to nothing, to a token of another type, or in a cycle', () => {
    refuses({ 'omni.tokens.json': { color: { $type: 'color', canvas: { $value: '{nowhere}' } } } }, /color\.canvas: \{nowhere\} names no token/);
    refuses({ 'omni.tokens.json': { color: { $type: 'color', canvas: { $value: '{space.1}' } } } }, /color\.canvas: \{space\.1\} is a dimension, not a color/);
    refuses({
      'omni.tokens.json': { color: { $type: 'color', canvas: { $value: '{color.surface}' }, surface: { $value: '{color.canvas}' } } },
    }, /an alias cycle/);
  });

  it('refuses a name a CSS custom property cannot carry, and a property DTCG does not define', () => {
    refuses({ 'palette.tokens.json': { $type: 'color', Void: { $value: colour('#07061c') } } }, /Void: a name is lowercase words joined by hyphens/);
    refuses({ 'palette.tokens.json': { $type: 'color', $mode: 'dark', void: { $value: colour('#07061c') } } }, /\$mode is not a DTCG property/);
  });

  it('refuses a theme that misses a role another theme has, and an anti-loop role no theme has', () => {
    refuses({ 'dark.tokens.json': { color: { $type: 'color' } } }, /dark\.tokens\.json misses the role canvas/);
    refuses({ 'omni.anti.tokens.json': { color: { $type: 'color', glow: { $value: '{void}' } } } }, /omni\.anti\.tokens\.json: glow is no role of the theme/);
  });

  it('refuses a file it does not know, and a missing one', () => {
    refuses({ 'sepia.tokens.json': {} }, /sepia\.tokens\.json is no file the generator knows/);
    const rest = Object.fromEntries(Object.entries(files()).filter(([name]) => name !== 'scale.tokens.json'));
    expect(() => resolveTokens(rest)).toThrow(/scale\.tokens\.json is missing/);
  });
});
