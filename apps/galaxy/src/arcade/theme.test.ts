import { readdirSync, readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { COLOURS, FLAT, spritePixels, tokensCss } from '@omni/design';
import { markFor } from './mark';
import { DEFAULT_THEME, parseTheme, resolveTheme, stripesOf, themeVars, TOKENS, type Token } from './theme';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const uncommented = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '');

/** Today's colours, before any theme: the arcade as it looked when workspaces came. */
const TODAY: Record<Token, string> = {
  // arcade.css's :root
  void: '#07061c', deep: '#0e0d33', cab: '#120f3a', navy: '#2f3fc4', 'navy-dark': '#1a2170',
  white: '#f2f4ff', dim: '#8a90d6', plasma: '#a45cff', 'plasma-dark': '#6a2fd0',
  yellow: '#ffd84a', gold: '#d99a14', red: '#ff3b5c', cyan: '#6ff0ff', green: '#4ee08a',
  // the Game Boy's body, as #94 drew it in shell.css
  'body-mid': '#8a45ee', 'body-ink': '#1a1560', 'body-ink-soft': '#2a1d78',
  'body-lens-1': '#1d1a4a', 'body-lens-2': '#14123a', 'body-lens-text': '#9aa0e0', 'body-led-off': '#3a1030',
  'body-pad-1': '#26224f', 'body-pad-2': '#15122f', 'body-pad-arrow': '#5a54a8',
  'body-pad-down-1': '#151230', 'body-pad-down-2': '#0b0a1e',
  'body-a-shine': '#ff7d94', 'body-b-shine': '#caa0ff',
  'body-pill-1': '#3b2a86', 'body-pill-2': '#241a5a', 'body-grille': '#4a1fa6',
  // the mark's gradient and its shade (mark.ts)
  'mark-1': '#ff5f6d', 'mark-2': '#a45cff', 'mark-3': '#4a63ff',
  'mark-shade-1': '#a8183a', 'mark-shade-2': '#6a2fd0', 'mark-shade-3': '#2f3fc4',
  // the four stripes on every hero's suit (FLAT 1 to 4 in @omni/design)
  'stripe-1': '#ff3b5c', 'stripe-2': '#ff7aa8', 'stripe-3': '#b07cff', 'stripe-4': '#5b7bff',
};

/** The colour custom properties declared on a stylesheet's `:root`, name (without `--`) to value. */
function rootColours(css: string): Record<string, string> {
  const root = /:root\s*\{([^}]*)\}/.exec(uncommented(css))?.[1] ?? '';
  return Object.fromEntries([...root.matchAll(/--([a-z0-9-]+)\s*:\s*([^;]+);/g)]
    .map(([, name, value]) => [name, value.trim()])
    .filter(([, value]) => /^(#|rgba?\(|hsla?\()/.test(value)));
}

/** The token names `valid_theme()` accepts, in the latest migration that defines it. */
function databaseTokens(): string[] {
  const dir = new URL('../../../../supabase/migrations/', import.meta.url);
  const latest = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()
    .map((f) => readFileSync(new URL(f, dir), 'utf8'))
    .filter((sql) => /function\s+public\.valid_theme\s*\(/.test(sql))
    .at(-1)!;
  const body = latest.slice(latest.search(/function\s+public\.valid_theme\s*\(/));
  const list = /array\[([^\]]*)\]/.exec(body)![1];
  return [...list.matchAll(/'([^']+)'/g)].map(([, name]) => name);
}

afterEach(() => { vi.restoreAllMocks(); });

describe('the theme\'s tokens', () => {
  it('default to today\'s colours, every one', () => {
    expect(TOKENS).toEqual(TODAY);
    expect(DEFAULT_THEME).toEqual(TODAY);
    expect(resolveTheme({})).toEqual(TODAY);
  });

  it('take the stripes\' defaults from the sprite forge, and the mark\'s from the mark as it was', () => {
    expect(stripesOf(DEFAULT_THEME)).toEqual({ 1: FLAT[1], 2: FLAT[2], 3: FLAT[3], 4: FLAT[4] });
    const { stops, shade } = markFor('Vertuoza');
    expect(stops).toEqual([[0, '#ff5f6d'], [0.55, '#a45cff'], [1, '#4a63ff']]);
    expect(shade).toEqual([[0, '#a8183a'], [0.55, '#6a2fd0'], [1, '#2f3fc4']]);
  });

  it('take the arcade\'s colours from @omni/design: every token the stylesheets read, at the package\'s value', () => {
    // The mark and the stripes are drawn on the canvas, not read by a stylesheet.
    const drawnOnCanvas = (t: string) => /^(mark|stripe)-/.test(t);
    const read = (Object.keys(TOKENS) as Token[]).filter((t) => !drawnOnCanvas(t));
    for (const t of read) expect(TOKENS[t], t).toBe(COLOURS[t]);
  });

  it('are declared by @omni/design/tokens.css at their defaults, and arcade.css declares no colour of its own on :root', () => {
    const arcade = uncommented(read('./arcade.css'));
    expect(rootColours(arcade)).toEqual({});
    expect(arcade).toMatch(/^\s*@import ['"]@omni\/design\/tokens\.css['"];/);
    const root = rootColours(tokensCss());
    const drawnOnCanvas = (t: string) => /^(mark|stripe)-/.test(t);
    for (const t of (Object.keys(TOKENS) as Token[]).filter((t) => !drawnOnCanvas(t))) {
      expect(root[t], `--${t}`).toBe(TOKENS[t]);
    }
  });

  it('let a workspace\'s override win over tokens.css: it is written on the arcade\'s root element, below :root', () => {
    const vars = themeVars(resolveTheme({ plasma: '#2fc6a4' }));
    expect(vars['--plasma']).toBe('#2fc6a4');
    expect(rootColours(tokensCss()).plasma).toBe(TOKENS.plasma);
  });

  it('are exactly the names valid_theme() accepts, in the latest migration that defines it', () => {
    expect(databaseTokens().sort()).toEqual(Object.keys(TOKENS).sort());
  });

  it('colour the Game Boy\'s body: shell.css writes no colour of its own, only tokens and shading', () => {
    const shell = uncommented(read('./shell.css'));
    expect(shell.match(/#[0-9a-f]{3,8}\b/gi) ?? []).toEqual([]);
    for (const [, name] of shell.matchAll(/var\(--([a-z0-9-]+)/g)) {
      const layout = /^(gutter|safe-(top|right|bottom|left)|lens-[xy])$/.test(name);
      expect(layout || name in TOKENS, `--${name} is a token or a length`).toBe(true);
    }
  });

  it('are what the canvas scenes draw with: no scene writes a token\'s colour but through the theme', () => {
    const dir = new URL('./scenes/', import.meta.url);
    const defaults = new Set<string>(Object.values(TOKENS));
    for (const file of readdirSync(dir).filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'))) {
      const literals = readFileSync(new URL(file, dir), 'utf8').match(/#[0-9a-f]{6}\b/gi) ?? [];
      expect(literals.filter((c) => defaults.has(c.toLowerCase())), file).toEqual([]);
    }
  });
});

describe('a workspace\'s theme', () => {
  it('overrides only the tokens it names', () => {
    const theme = resolveTheme({ plasma: '#2fc6a4', 'plasma-dark': '#178a80' });
    expect(theme).toEqual({ ...TODAY, plasma: '#2fc6a4', 'plasma-dark': '#178a80' });
  });

  it('is written as CSS custom properties, one per token', () => {
    const vars = themeVars(resolveTheme({ plasma: '#2fc6a4', 'body-mid': '#22a890' }));
    expect(Object.keys(vars).sort()).toEqual(Object.keys(TOKENS).map((t) => `--${t}`).sort());
    expect(vars['--plasma']).toBe('#2fc6a4');
    expect(vars['--body-mid']).toBe('#22a890');
    expect(vars['--void']).toBe(TODAY.void);
  });

  it('colours the mark from mark-1 to mark-3 and its shade from mark-shade-1 to mark-shade-3', () => {
    const theme = resolveTheme({
      'mark-1': '#000001', 'mark-2': '#000002', 'mark-3': '#000003',
      'mark-shade-1': '#000011', 'mark-shade-2': '#000012', 'mark-shade-3': '#000013',
    });
    const mark = markFor('Acme', theme);
    expect(mark.stops).toEqual([[0, '#000001'], [0.55, '#000002'], [1, '#000003']]);
    expect(mark.shade).toEqual([[0, '#000011'], [0.55, '#000012'], [1, '#000013']]);
    expect(mark.runs).toEqual(markFor('Acme').runs);
  });

  it('recolours the heroes\' stripes through stripe-1 to stripe-4, and nothing else', () => {
    const stripes = { 'stripe-1': '#010101', 'stripe-2': '#020202', 'stripe-3': '#030303', 'stripe-4': '#040404' };
    const flat = stripesOf(resolveTheme(stripes));
    expect(flat).toEqual({ 1: '#010101', 2: '#020202', 3: '#030303', 4: '#040404' });
    const was = spritePixels('hero-girl').pixels;
    const now = spritePixels('hero-girl', { flat }).pixels;
    const back = { [FLAT[1]]: '#010101', [FLAT[2]]: '#020202', [FLAT[3]]: '#030303', [FLAT[4]]: '#040404' } as Record<string, string>;
    // A stripe's colour can be a shaded material's too (stripe-3 is the plasma ramp's base), so a
    // pixel either keeps its colour or was a stripe and takes that stripe's override.
    expect(now.some((c, i) => c !== was[i])).toBe(true);
    now.forEach((c, i) => { if (c !== was[i]) expect(c, `pixel ${i}`).toBe(back[was[i]!]); });
  });

  it('drops an unknown token, or a colour that is not lowercase #rrggbb, with a warning, and keeps its default', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const theme = resolveTheme({
      plasma: '#2fc6a4', purple: '#a45cff', red: '#FF0000', cyan: '#0ff', green: 'green', gold: 42, void: null,
    });
    expect(theme).toEqual({ ...TODAY, plasma: '#2fc6a4' });
    expect(warn).toHaveBeenCalledTimes(6);
    for (const key of ['purple', 'red', 'cyan', 'green', 'gold', 'void']) {
      expect(warn.mock.calls.some(([m]) => String(m).includes(`"${key}"`)), key).toBe(true);
    }
  });

  it('is ignored whole, with a warning, when it is not an object', () => {
    for (const raw of ['#a45cff', ['plasma', '#2fc6a4'], 42, null]) {
      const warn = vi.fn();
      expect(parseTheme(raw, warn), JSON.stringify(raw)).toEqual({});
      expect(warn, JSON.stringify(raw)).toHaveBeenCalledTimes(1);
    }
    const warn = vi.fn();
    expect(parseTheme({}, warn)).toEqual({});
    expect(warn).not.toHaveBeenCalled();
  });
});
