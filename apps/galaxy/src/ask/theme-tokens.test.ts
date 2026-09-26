import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { ASK, ASK_TEXT_PAIRS, ASK_UI_PAIRS } from '@omni/design';
import { TEXT_PAIRS, TOKENS, UI_PAIRS, themeCss, type TokenName } from './theme-tokens';

describe('the token table', () => {
  // Its values, its pairs and their WCAG AA test live in @omni/design (tokens.test.mjs).
  it('is @omni/design\'s', () => {
    expect(TOKENS).toBe(ASK);
    expect(TEXT_PAIRS).toBe(ASK_TEXT_PAIRS);
    expect(UI_PAIRS).toBe(ASK_UI_PAIRS);
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
      const declared = block(`:is(html:has(.ask[data-ask-theme="${theme}"]), .ask[data-ask-theme="${theme}"])`);
      expect(declared).toContain(`color-scheme: ${theme};`);
      for (const [name, value] of Object.entries(TOKENS[theme])) expect(declared).toContain(`${variable(name as TokenName)}: ${value};`);
    }
  });

  it('follows the system when no script ran', () => {
    expect(css).toContain('@media (prefers-color-scheme: dark)');
    expect(block('.ask:not([data-ask-theme])')).toContain(`--ask-ground: ${TOKENS.light.ground};`);
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

  it("gives the page back the scroll the arcade's body takes away", () => {
    // arcade.css is global and pins the body (height 100%, overflow hidden) for the game screen;
    // a page of several questions is taller than the window and must scroll.
    const body = rules.find((r) => r.selector === 'html:has(.ask) body');
    expect(body?.body).toContain('overflow: auto;');
    expect(body?.body).toContain('height: auto;');
  });

  it('puts the tabs beside the pane from 720 px, and above it below', () => {
    expect(css).toMatch(/@media \(min-width: 720px\) \{[^@]*?\.ask-page \{ grid-template-columns: minmax\(200px, 280px\) minmax\(0, 1fr\);/);
    expect(rules.find((r) => r.selector === '.ask-page')?.body).not.toContain('grid-template-columns');
  });

  it('folds the tabs into one row below 720 px, the list shown only once it is opened', () => {
    const narrow = css.match(/@media \(max-width: 719\.98px\) \{([\s\S]*?)\n\}/)?.[1] ?? '';
    expect(narrow).toMatch(/\.ask-tabs-fold \{[^}]*display: flex;/);
    expect(narrow).toMatch(/\.ask-tabs-head \{[^}]*display: none;/);
    expect(narrow).toMatch(/\.ask-tabs:not\(\[data-open\]\) \.ask-tab-list \{[^}]*display: none;/);
    // From 720 px the list always shows and the folded row does not.
    expect(rules.find((r) => r.selector === '.ask-tabs-fold')?.body).toContain('display: none;');
    expect(rules.filter((r) => r.selector === '.ask-tab-list').map((r) => r.body).join('')).not.toContain('display: none');
  });

  it('never pins the tabbed page to the window, so it scrolls', () => {
    for (const selector of ['.ask-page', '.ask-pane']) {
      const body = rules.filter((r) => r.selector === selector).map((r) => r.body).join('');
      expect(body, selector).not.toMatch(/overflow: hidden|height: 100(?:vh|dvh|%)/);
    }
  });

  it('puts the preview beside the options from 720 px, and under them below', () => {
    expect(css).toMatch(/@media \(min-width: 720px\) \{\s*\.ask-q-body\.has-preview \{ grid-template-columns: minmax\(0, 1fr\) minmax\(0, 1fr\);/);
    expect(rules.find((r) => r.selector === '.ask-q-body')?.body).not.toContain('grid-template-columns');
  });
});
