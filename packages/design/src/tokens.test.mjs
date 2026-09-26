import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { INK, PALETTE } from './palette.mjs';
import { ASK, ASK_TEXT_PAIRS, ASK_UI_PAIRS, COLOURS, contrast, cssName, tokensCss } from './tokens.mjs';

const committed = () => readFileSync(new URL('../tokens.css', import.meta.url), 'utf8');

describe('INK', () => {
  it('names the six colours of the logo and the print ad', () => {
    expect(INK).toMatchObject({
      highlight: '#fff3a8',
      ember: '#d9531a',
      magenta: '#ff3ea5',
      orange: '#ff9b30',
      adPurple: '#5b1a86',
      starfield: '#05040f',
    });
  });

  it('keeps every colour it held before', () => {
    expect(INK).toMatchObject({
      void: '#07061c', deep: '#0e0d33', navy: '#2f3fc4', navyDark: '#1a2170', white: '#f2f4ff',
      plasma: '#a45cff', plasmaDark: '#6a2fd0', yellow: '#ffd84a', gold: '#d99a14', red: '#ff3b5c',
      redDark: '#a8183a', cyan: '#6ff0ff', green: '#4ee08a', greenDark: '#1d8f55', slate: '#5b5f80',
    });
  });

  it('gives a colour the pixel palette names that character\'s value', () => {
    const named = { navy: 'n', navyDark: 'N', white: 'w', plasma: 'p', plasmaDark: 'P', yellow: 'y', gold: 'Y',
      red: 'r', redDark: 'R', cyan: 'c', green: 'z', greenDark: 'Z', slate: 'A', orange: 'o' };
    for (const [name, ch] of Object.entries(named)) expect(INK[name], name).toBe(PALETTE[ch]);
  });

  it('holds lowercase #rrggbb colours only', () => {
    for (const [name, value] of Object.entries(INK)) expect(value, name).toMatch(/^#[0-9a-f]{6}$/);
  });
});

describe('the CSS colours', () => {
  it('name each colour in kebab case, digits apart', () => {
    expect(cssName('navyDark')).toBe('navy-dark');
    expect(cssName('adPurple')).toBe('ad-purple');
    expect(cssName('bodyLens1')).toBe('body-lens-1');
    expect(cssName('bodyPadDown2')).toBe('body-pad-down-2');
    expect(cssName('void')).toBe('void');
  });

  it('hold every INK colour under its CSS name', () => {
    for (const [name, value] of Object.entries(INK)) expect(COLOURS[cssName(name)], name).toBe(value);
  });

  it('hold the arcade\'s own colours, as they were on its :root', () => {
    expect(COLOURS).toMatchObject({
      cab: '#120f3a', dim: '#8a90d6',
      'body-mid': '#8a45ee', 'body-ink': '#1a1560', 'body-ink-soft': '#2a1d78',
      'body-lens-1': '#1d1a4a', 'body-lens-2': '#14123a', 'body-lens-text': '#9aa0e0', 'body-led-off': '#3a1030',
      'body-pad-1': '#26224f', 'body-pad-2': '#15122f', 'body-pad-arrow': '#5a54a8',
      'body-pad-down-1': '#151230', 'body-pad-down-2': '#0b0a1e',
      'body-a-shine': '#ff7d94', 'body-b-shine': '#caa0ff',
      'body-pill-1': '#3b2a86', 'body-pill-2': '#241a5a', 'body-grille': '#4a1fa6',
    });
  });
});

describe('tokens.css', () => {
  it('declares every colour as a custom property on :root', () => {
    const css = tokensCss();
    const root = /:root\s*\{([^}]*)\}/.exec(css)?.[1] ?? '';
    for (const [name, value] of Object.entries(COLOURS)) expect(root).toContain(`--${name}: ${value};`);
  });

  it('is committed exactly as the generator writes it: run `pnpm --filter @omni/design tokens` after a change', () => {
    expect(committed()).toBe(tokensCss());
  });
});

describe('contrast', () => {
  it('is the WCAG ratio', () => {
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrast('#ffffff', '#ffffff')).toBeCloseTo(1, 5);
    expect(contrast('#777777', '#ffffff')).toBeCloseTo(4.48, 2);
    expect(contrast('#ffffff', '#777777')).toBeCloseTo(contrast('#777777', '#ffffff'), 10);
  });
});

describe('Ask\'s tokens', () => {
  const themes = Object.keys(ASK);

  it('have both themes, with the same tokens', () => {
    expect([...themes].sort()).toEqual(['dark', 'light']);
    expect(Object.keys(ASK.dark).sort()).toEqual(Object.keys(ASK.light).sort());
    for (const theme of themes) {
      for (const [name, value] of Object.entries(ASK[theme])) expect(value, `${theme} ${name}`).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it('pass WCAG AA for every text colour pair, in both themes', () => {
    const failures = [];
    for (const theme of themes) {
      for (const { text, on, where } of ASK_TEXT_PAIRS) {
        const ratio = contrast(ASK[theme][text], ASK[theme][on]);
        if (ratio < 4.5) failures.push(`${theme}: ${text} on ${on} (${where}) is ${ratio.toFixed(2)}:1`);
      }
    }
    expect(failures).toEqual([]);
  });

  it('give focus rings and the selected option\'s edge 3:1 against what they sit on', () => {
    const failures = [];
    for (const theme of themes) {
      for (const { text, on, where } of ASK_UI_PAIRS) {
        const ratio = contrast(ASK[theme][text], ASK[theme][on]);
        if (ratio < 3) failures.push(`${theme}: ${text} on ${on} (${where}) is ${ratio.toFixed(2)}:1`);
      }
    }
    expect(failures).toEqual([]);
  });

  it('name only tokens the table has', () => {
    const names = new Set(Object.keys(ASK.light));
    for (const { text, on } of [...ASK_TEXT_PAIRS, ...ASK_UI_PAIRS]) {
      expect(names.has(text), text).toBe(true);
      expect(names.has(on), on).toBe(true);
    }
  });
});
