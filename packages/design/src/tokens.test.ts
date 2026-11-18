import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { INK, PALETTE } from './palette.ts';
import {
  ASK, ASK_ANTI, ASK_ROLES, ASK_TEXT_PAIRS, ASK_UI_PAIRS, COLOURS, ROLE_TEXT_PAIRS, ROLE_UI_PAIRS, SCALE, THEME_ROLES,
  THEME_ROLES_ANTI, contrast, cssName, tokensCss,
} from './tokens.ts';
import type { AskTheme, AskToken, ColourRole, RolePair } from './tokens.ts';

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
    const ink: Record<string, string> = INK, palette: Record<string, string> = PALETTE;
    for (const [name, ch] of Object.entries(named)) expect(ink[name], name).toBe(palette[ch]);
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

  it('keeps the named colours in its first :root block, as they were, so the arcade reads them unchanged', () => {
    const first = /^[^{]*:root\s*\{([^}]*)\}/.exec(committed())?.[1] ?? '';
    expect(first.match(/--[\w-]+(?=:)/g)).toEqual(Object.keys(COLOURS).map((name) => `--${name}`));
  });

  it('declares the scale on :root, as --space-1 to --type-prose-line', () => {
    for (const [name, value] of Object.entries(SCALE)) expect(committed(), name).toContain(`  --${name}: ${value};`);
    expect(committed()).toContain('--space-1: 4px;');
    expect(committed()).toContain('--type-prose-line: 1.6;');
  });

  it('declares each theme\'s roles as --color-<role> where the theme script marks the ask root, Omni by default', () => {
    const css = committed();
    const block = (selector: string) => {
      const at = css.indexOf(`${selector} {`);
      expect(at, selector).toBeGreaterThan(-1);
      return css.slice(at, css.indexOf('}', at));
    };
    const marked = (theme: string, also = '') => `:is(html:has(.ask[data-ask-theme="${theme}"]${also}), .ask[data-ask-theme="${theme}"]${also})`;
    const omni = block(`:root, .ask:not([data-ask-theme]), ${marked('omni')}`);
    for (const [role, value] of Object.entries(THEME_ROLES.omni)) expect(omni, role).toContain(`--color-${role}: ${value};`);
    for (const theme of ['light', 'dark'] as const) {
      const rule = block(marked(theme));
      for (const [role, value] of Object.entries(THEME_ROLES[theme])) expect(rule, `${theme} ${role}`).toContain(`--color-${role}: ${value};`);
    }
    for (const theme of themesOf()) {
      const selector = theme === 'omni'
        ? `.ask[data-ask-mode="anti"]:not([data-ask-theme]), ${marked('omni', '[data-ask-mode="anti"]')}`
        : marked(theme, '[data-ask-mode="anti"]');
      const rule = block(selector);
      for (const [role, value] of Object.entries(THEME_ROLES_ANTI[theme])) expect(rule, `${theme} anti ${role}`).toContain(`--color-${role}: ${value};`);
    }
  });
});

/** The three themes, in their order. */
const themesOf = (): AskTheme[] => ['omni', 'light', 'dark'];

describe('the scale', () => {
  const family = (prefix: string) => Object.fromEntries(Object.entries(SCALE).filter(([name]) => name.startsWith(prefix)));

  it('spaces on the 4 px grid, from space-1 at 4 px to space-8 at 64 px', () => {
    expect(family('space-')).toEqual({
      'space-1': '4px', 'space-2': '8px', 'space-3': '12px', 'space-4': '16px',
      'space-5': '24px', 'space-6': '32px', 'space-7': '48px', 'space-8': '64px',
    });
  });

  it('rounds at 4 px, 8 px and full', () => {
    expect(family('radius-')).toEqual({ 'radius-1': '4px', 'radius-2': '8px', 'radius-full': '9999px' });
  });

  it('sets seven UI steps from 12 to 32 px, and prose at 17 px on 1.6', () => {
    const sizes = Object.entries(family('type-')).filter(([name]) => name.endsWith('-size')).map(([name, value]) => [name, value]);
    expect(sizes).toEqual([
      ['type-1-size', '12px'], ['type-2-size', '13px'], ['type-3-size', '14px'], ['type-4-size', '16px'],
      ['type-5-size', '20px'], ['type-6-size', '24px'], ['type-7-size', '32px'], ['type-prose-size', '17px'],
    ]);
    expect(SCALE['type-prose-line']).toBe('1.6');
    for (const step of ['1', '2', '3', '4', '5', '6', '7']) expect(Number(SCALE[`type-${step}-line`]), step).toBeGreaterThanOrEqual(1.2);
  });

  it('weighs 400, 500, 600 and 700', () => {
    expect(family('weight-')).toEqual({ 'weight-regular': '400', 'weight-medium': '500', 'weight-semibold': '600', 'weight-bold': '700' });
  });

  it('stacks in five named layers, from base 0 to toast 40', () => {
    expect(family('layer-')).toEqual({ 'layer-base': '0', 'layer-sticky': '10', 'layer-overlay': '20', 'layer-dialog': '30', 'layer-toast': '40' });
  });

  it('lifts in three elevations, and moves in two durations and one ease-out', () => {
    expect(Object.keys(family('elevation-'))).toEqual(['elevation-flat', 'elevation-raised', 'elevation-overlay']);
    expect(family('motion-')).toEqual({
      'motion-duration-fast': '120ms', 'motion-duration-slow': '240ms', 'motion-ease-out': 'cubic-bezier(0.2, 0, 0, 1)',
    });
  });
});

describe('the semantic roles', () => {
  const roles: ColourRole[] = [
    'canvas', 'surface', 'raised', 'sunken',
    'text-primary', 'text-secondary', 'text-tertiary', 'text-on-accent', 'text-on-signal', 'text-on-highlight',
    'border-subtle', 'border-strong', 'accent', 'accent-soft', 'signal', 'signal-soft', 'highlight',
    'success', 'warning', 'danger', 'info', 'focus-ring', 'scrim',
  ];
  /** The one see-through role: the cover behind a dialog or a drawer, drawn over the page, never read as text. */
  const SEE_THROUGH: ReadonlySet<string> = new Set(['scrim']);
  const anti = (theme: AskTheme): Readonly<Record<ColourRole, string>> => ({ ...THEME_ROLES[theme], ...THEME_ROLES_ANTI[theme] });
  const below = (pairs: readonly RolePair[], floor: number, colours: (theme: AskTheme) => Readonly<Record<ColourRole, string>>) =>
    themesOf().flatMap((theme) => pairs.flatMap(({ text, on, where }) => {
      const ratio = contrast(colours(theme)[text], colours(theme)[on]);
      return ratio < floor ? [`${theme}: ${text} on ${on} (${where}) is ${ratio.toFixed(2)}:1`] : [];
    }));

  it('are named by their job, the same in Omni, Light and Dark', () => {
    for (const theme of themesOf()) {
      expect(Object.keys(THEME_ROLES[theme]), theme).toEqual(roles);
      for (const [role, value] of Object.entries(THEME_ROLES[theme])) {
        expect(value, `${theme} ${role}`).toMatch(SEE_THROUGH.has(role) ? /^rgb\(\d+ \d+ \d+ \/ 0\.\d+\)$/ : /^#[0-9a-f]{6}$/);
      }
    }
  });

  it('give the focus ring 3:1 on every surface, and keep the scrim see-through, in all three themes', () => {
    for (const on of ['canvas', 'surface', 'raised', 'sunken'] as const) {
      expect(ROLE_UI_PAIRS.some((p) => p.text === 'focus-ring' && p.on === on), on).toBe(true);
    }
    for (const theme of themesOf()) expect(THEME_ROLES[theme].scrim, theme).not.toMatch(/\/ 1\)$/);
  });

  it('pass WCAG AA for every text pair, in all three themes and in the anti-loop mode', () => {
    expect(below(ROLE_TEXT_PAIRS, 4.5, (theme) => THEME_ROLES[theme])).toEqual([]);
    expect(below(ROLE_TEXT_PAIRS, 4.5, anti)).toEqual([]);
  });

  it('give the strong border, the accent and the signal 3:1 against what they sit on, in all three themes and in the anti-loop mode', () => {
    expect(below(ROLE_UI_PAIRS, 3, (theme) => THEME_ROLES[theme])).toEqual([]);
    expect(below(ROLE_UI_PAIRS, 3, anti)).toEqual([]);
  });

  it('test every text role on every surface it is read on', () => {
    for (const text of ['text-primary', 'text-secondary', 'text-tertiary'] as const) {
      for (const on of ['canvas', 'surface', 'raised', 'sunken'] as const) {
        expect(ROLE_TEXT_PAIRS.some((p) => p.text === text && p.on === on), `${text} on ${on}`).toBe(true);
      }
    }
    for (const on of ['canvas', 'surface', 'raised', 'sunken'] as const) {
      expect(ROLE_UI_PAIRS.some((p) => p.text === 'border-strong' && p.on === on), on).toBe(true);
    }
  });

  it('keep every ASK name as an alias of one role, at the same colour as before', () => {
    expect(Object.keys(ASK_ROLES).sort()).toEqual(Object.keys(ASK.light).sort());
    for (const theme of themesOf()) {
      for (const [token, role] of Object.entries(ASK_ROLES) as [AskToken, ColourRole][]) {
        expect(ASK[theme][token], `${theme} ${token}`).toBe(THEME_ROLES[theme][role]);
      }
      for (const [token, value] of Object.entries(ASK_ANTI[theme]) as [AskToken, string][]) {
        expect(value, `${theme} anti ${token}`).toBe(THEME_ROLES_ANTI[theme][ASK_ROLES[token] as keyof typeof THEME_ROLES_ANTI[AskTheme]]);
      }
    }
  });

  it('remap in the anti-loop mode only the roles behind the seven ASK names it overrides', () => {
    for (const theme of themesOf()) {
      expect(Object.keys(THEME_ROLES_ANTI[theme]).sort(), theme).toEqual(
        Object.keys(ASK_ANTI[theme]).map((token) => ASK_ROLES[token as AskToken]).sort(),
      );
    }
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
  const themes = Object.keys(ASK) as AskTheme[];

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
    const failures: string[] = [];
    for (const theme of themes) {
      for (const { text, on, where } of ASK_TEXT_PAIRS) {
        const ratio = contrast(ASK[theme][text], ASK[theme][on]);
        if (ratio < 4.5) failures.push(`${theme}: ${text} on ${on} (${where}) is ${ratio.toFixed(2)}:1`);
      }
    }
    expect(failures).toEqual([]);
  });

  it('give focus rings and the selected option\'s edge 3:1 against what they sit on, in all three themes', () => {
    const failures: string[] = [];
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

  describe('anti-loop (Rewind Light)', () => {
    const anti = (theme: AskTheme) => ({ ...ASK[theme], ...ASK_ANTI[theme] });

    it('override the seven tokens of the concept in each theme and nothing else', () => {
      for (const theme of themes) {
        expect(Object.keys(ASK_ANTI[theme]).sort(), theme).toEqual(['line', 'lineStrong', 'onPlasma', 'onYellow', 'plasma', 'plasmaSoft', 'yellow']);
        for (const value of Object.values(ASK_ANTI[theme])) expect(value).toMatch(/^#[0-9a-f]{6}$/);
      }
      expect(ASK_ANTI.omni.plasma).toBe('#ff3ea5');
      expect(ASK_ANTI.light.plasma).toBe('#b0127a');
      expect(ASK_ANTI.dark.plasma).toBe('#ff5fb4');
    });

    it('pass 4.5:1 for every text pair in all three themes', () => {
      const failures: string[] = [];
      for (const theme of themes) {
        for (const { text, on, where } of ASK_TEXT_PAIRS) {
          const ratio = contrast(anti(theme)[text], anti(theme)[on]);
          if (ratio < 4.5) failures.push(`${theme}: ${text} on ${on} (${where}) is ${ratio.toFixed(2)}:1`);
        }
      }
      expect(failures).toEqual([]);
    });

    it('pass 3:1 for every edge pair in all three themes', () => {
      const failures: string[] = [];
      for (const theme of themes) {
        for (const { text, on, where } of ASK_UI_PAIRS) {
          const ratio = contrast(anti(theme)[text], anti(theme)[on]);
          if (ratio < 3) failures.push(`${theme}: ${text} on ${on} (${where}) is ${ratio.toFixed(2)}:1`);
        }
      }
      expect(failures).toEqual([]);
    });
  });

  it('name only tokens the table has', () => {
    const names = new Set(Object.keys(ASK.light));
    for (const { text, on } of [...ASK_TEXT_PAIRS, ...ASK_UI_PAIRS]) {
      expect(names.has(text), text).toBe(true);
      expect(names.has(on), on).toBe(true);
    }
  });
});
