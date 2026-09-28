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

  it('have three themes, Omni, light and dark, with the same tokens', () => {
    expect([...themes].sort()).toEqual(['dark', 'light', 'omni']);
    for (const theme of themes) {
      expect(Object.keys(ASK[theme]).sort(), theme).toEqual(Object.keys(ASK.light).sort());
      for (const [name, value] of Object.entries(ASK[theme])) expect(value, `${theme} ${name}`).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it('give Omni the homepage\'s palette: the void, the cabinet, comic yellow for the signal, magenta for the badge', () => {
    expect(ASK.omni).toEqual({
      ground: INK.void,
      surface: '#120f3a',
      sunk: INK.deep,
      line: INK.navyDark,
      lineStrong: '#5a60c4',
      ink: INK.white,
      muted: '#8a90d6',
      plasma: INK.yellow,
      plasmaSoft: '#2a2350',
      onPlasma: INK.void,
      yellow: INK.magenta,
      onYellow: INK.void,
      cyan: INK.cyan,
      green: INK.green,
      red: ASK.dark.red,
    });
    expect(COLOURS).toMatchObject({ cab: ASK.omni.surface, dim: ASK.omni.muted });
  });

  it('keep light and dark as they were, token for token', () => {
    expect(ASK.light).toEqual({
      ground: '#f5f4fc', surface: '#ffffff', sunk: '#eceaf8', line: '#d9d6ee', lineStrong: '#85819f', ink: '#17153d', muted: '#4f5486',
      plasma: '#6a2fd0', plasmaSoft: '#efe7ff', onPlasma: '#ffffff', yellow: '#ffd84a', onYellow: '#3a2c00',
      cyan: '#0b6f86', green: '#15703f', red: '#b3122f',
    });
    expect(ASK.dark).toEqual({
      ground: '#0e0d33', surface: '#16144a', sunk: '#1d1a58', line: '#2f2c78', lineStrong: '#6d6acc', ink: '#f2f4ff', muted: '#a9aee6',
      plasma: '#b37cff', plasmaSoft: '#2a1d66', onPlasma: '#0e0d33', yellow: '#ffd84a', onYellow: '#3a2c00',
      cyan: '#6ff0ff', green: '#4ee08a', red: '#ff6b86',
    });
  });

  it('pass WCAG AA for every text colour pair, in all three themes', () => {
    const failures = [];
    for (const theme of themes) {
      for (const { text, on, where } of ASK_TEXT_PAIRS) {
        const ratio = contrast(ASK[theme][text], ASK[theme][on]);
        if (ratio < 4.5) failures.push(`${theme}: ${text} on ${on} (${where}) is ${ratio.toFixed(2)}:1`);
      }
    }
    expect(failures).toEqual([]);
  });

  it('give focus rings and the selected option\'s edge 3:1 against what they sit on, in all three themes', () => {
    const failures = [];
    for (const theme of themes) {
      for (const { text, on, where } of ASK_UI_PAIRS) {
        const ratio = contrast(ASK[theme][text], ASK[theme][on]);
        if (ratio < 3) failures.push(`${theme}: ${text} on ${on} (${where}) is ${ratio.toFixed(2)}:1`);
      }
    }
    expect(failures).toEqual([]);
  });

  it('outline chips, cards and controls with lineStrong at 3:1 on the ground, a card and the sunk panel (PRD 476)', () => {
    for (const on of ['ground', 'surface', 'sunk']) {
      expect(ASK_UI_PAIRS.some((p) => p.text === 'lineStrong' && p.on === on), on).toBe(true);
    }
  });

  it('name only tokens the table has', () => {
    const names = new Set(Object.keys(ASK.light));
    for (const { text, on } of [...ASK_TEXT_PAIRS, ...ASK_UI_PAIRS]) {
      expect(names.has(text), text).toBe(true);
      expect(names.has(on), on).toBe(true);
    }
  });
});
