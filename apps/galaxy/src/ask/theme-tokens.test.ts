import { readFileSync } from 'node:fs';
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

describe('the stylesheet', () => {
  const css = readFileSync(new URL('./ask.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  /** Every innermost rule, as its selector and its declarations. */
  const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({ selector: m[1].trim(), body: m[2] }));

  it('names no colour of its own: every colour comes from the token table', () => {
    expect(css).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(css).not.toMatch(/\b(?:rgba?|hsla?|oklch|color-mix)\(/i);
  });

  it('sets the page in Atkinson Hyperlegible Next', () => {
    const root = rules.find((r) => r.selector === '.ask');
    expect(root?.body).toContain('font-family: var(--ask-body);');
    expect(css).toMatch(/--ask-body: 'Atkinson Hyperlegible Next',/);
  });

  it('keeps the pixel face to the header wordmark', () => {
    const pixel = rules.filter((r) => r.body.includes('var(--ask-px)'));
    expect(pixel.map((r) => r.selector)).toEqual(['.ask-mark']);
    expect(css.match(/Press Start 2P|Jersey 10/g)).toHaveLength(1);
  });

  it('puts the preview beside the options from 720 px, and under them below', () => {
    expect(css).toMatch(/@media \(min-width: 720px\) \{\s*\.ask-q-body\.has-preview \{ grid-template-columns: minmax\(0, 1fr\) minmax\(0, 1fr\);/);
    expect(rules.find((r) => r.selector === '.ask-q-body')?.body).not.toContain('grid-template-columns');
  });
});
