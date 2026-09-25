import { describe, it, expect } from 'vitest';
import { TEXT_PAIRS, TOKENS, UI_PAIRS, contrast, themeCss, type TokenName } from './theme-tokens';

describe('contrast', () => {
  it('is the WCAG ratio', () => {
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrast('#ffffff', '#ffffff')).toBeCloseTo(1, 5);
    expect(contrast('#777777', '#ffffff')).toBeCloseTo(4.48, 2);
    expect(contrast('#ffffff', '#777777')).toBeCloseTo(contrast('#777777', '#ffffff'), 10);
  });
});

describe('the token table', () => {
  const themes = Object.keys(TOKENS) as Array<keyof typeof TOKENS>;

  it('has both themes, with the same tokens', () => {
    expect(themes.sort()).toEqual(['dark', 'light']);
    expect(Object.keys(TOKENS.dark).sort()).toEqual(Object.keys(TOKENS.light).sort());
    for (const theme of themes) {
      for (const [name, value] of Object.entries(TOKENS[theme])) expect(value, `${theme} ${name}`).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it('passes WCAG AA for every text colour pair, in both themes', () => {
    const failures: string[] = [];
    for (const theme of themes) {
      for (const { text, on, where } of TEXT_PAIRS) {
        const ratio = contrast(TOKENS[theme][text], TOKENS[theme][on]);
        if (ratio < 4.5) failures.push(`${theme}: ${text} on ${on} (${where}) is ${ratio.toFixed(2)}:1`);
      }
    }
    expect(failures).toEqual([]);
  });

  it("gives focus rings and the selected option's edge 3:1 against what they sit on", () => {
    const failures: string[] = [];
    for (const theme of themes) {
      for (const { text, on, where } of UI_PAIRS) {
        const ratio = contrast(TOKENS[theme][text], TOKENS[theme][on]);
        if (ratio < 3) failures.push(`${theme}: ${text} on ${on} (${where}) is ${ratio.toFixed(2)}:1`);
      }
    }
    expect(failures).toEqual([]);
  });

  it('names only tokens the table has', () => {
    const names = new Set(Object.keys(TOKENS.light));
    for (const { text, on } of [...TEXT_PAIRS, ...UI_PAIRS]) {
      expect(names.has(text), text).toBe(true);
      expect(names.has(on), on).toBe(true);
    }
  });
});

describe('the stylesheet the table becomes', () => {
  const css = themeCss();
  const block = (selector: string) => {
    const start = css.indexOf(`${selector} {`);
    expect(start, selector).toBeGreaterThanOrEqual(0);
    return css.slice(start, css.indexOf('}', start));
  };
  const variable = (name: TokenName) => `--ask-${name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`;

  it('declares every token for the light and the dark theme', () => {
    for (const theme of ['light', 'dark'] as const) {
      const declared = block(`html[data-ask-theme="${theme}"]`);
      expect(declared).toContain(`color-scheme: ${theme};`);
      for (const [name, value] of Object.entries(TOKENS[theme])) expect(declared).toContain(`${variable(name as TokenName)}: ${value};`);
    }
  });

  it('follows the system when no script ran', () => {
    expect(css).toContain('@media (prefers-color-scheme: dark)');
    expect(block('html:not([data-ask-theme]) .ask')).toContain(`--ask-ground: ${TOKENS.light.ground};`);
  });
});
