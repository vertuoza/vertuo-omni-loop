import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { ASK, ASK_TEXT_PAIRS, ASK_UI_PAIRS } from '@omni/design';
import { TEXT_PAIRS, TOKENS, UI_PAIRS, themeCss, type TokenName } from './theme-tokens';
import { item } from './test-item';

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

  /** The native controls' scheme each theme asks for: Omni is a dark world. */
  const SCHEME = { omni: 'dark', light: 'light', dark: 'dark' } as const;

  it('declares every token for the Omni, the light and the dark theme', () => {
    for (const theme of ['omni', 'light', 'dark'] as const) {
      const declared = block(`:is(html:has(.ask[data-ask-theme="${theme}"]), .ask[data-ask-theme="${theme}"])`);
      expect(declared, theme).toContain(`color-scheme: ${SCHEME[theme]};`);
      for (const [name, value] of Object.entries(TOKENS[theme])) expect(declared, theme).toContain(`${variable(name as TokenName)}: ${value};`);
    }
  });

  it('declares --ask-line-strong, the outline colour, for every theme (PRD 476)', () => {
    for (const theme of ['omni', 'light', 'dark'] as const) {
      const declared = block(`:is(html:has(.ask[data-ask-theme="${theme}"]), .ask[data-ask-theme="${theme}"])`);
      expect(declared, theme).toContain(`--ask-line-strong: ${TOKENS[theme].lineStrong};`);
    }
    expect(block('.ask:not([data-ask-theme])')).toContain(`--ask-line-strong: ${TOKENS.omni.lineStrong};`);
  });

  it('shows Omni when no script ran, whatever the system prefers', () => {
    const unmarked = block('.ask:not([data-ask-theme])');
    expect(unmarked).toContain('color-scheme: dark;');
    for (const [name, value] of Object.entries(TOKENS.omni)) expect(unmarked).toContain(`${variable(name as TokenName)}: ${value};`);
    expect(css).not.toContain('prefers-color-scheme');
  });
});

describe('the stylesheet', () => {
  const css = readFileSync(new URL('./ask.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  /** Every innermost rule, as its selector and its declarations. */
  const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({ selector: item(m, 1).trim(), body: item(m, 2) }));

  it('names no colour of its own: every colour comes from the token table', () => {
    expect(css).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(css).not.toMatch(/\b(?:rgba?|hsla?|oklch|color-mix)\(/i);
  });

  it('draws the pressed theme for Omni, light and dark, from the choice the root carries', () => {
    const pressed = rules.filter((r) => r.body.includes('background: var(--ask-plasma);') && r.body.includes('color: var(--ask-on-plasma);'))
      .flatMap((r) => r.selector.split(',').map((one) => one.trim()));
    for (const choice of ['omni', 'light', 'dark']) {
      expect(pressed, choice).toContain(`.ask[data-ask-choice='${choice}'] .ask-switch [data-choice='${choice}']`);
    }
    expect(css).not.toContain("'system'");
  });

  it('draws a link shaped as a button dark on plasma, not as a cyan underlined link (PRD 476)', () => {
    // `.ask a` (cyan, underlined) outranks `.ask-button`: without this rule Approve spec read cyan on yellow.
    const link = rules.find((r) => r.selector === '.ask a.ask-button');
    expect(link?.body).toContain('color: var(--ask-on-plasma);');
    expect(link?.body).toContain('text-decoration: none;');
    const states = rules.filter((r) => /\.ask a\.ask-button:(?:hover|focus-visible)/.test(r.selector));
    expect(states.map((r) => r.body).join('')).toContain('color: var(--ask-on-plasma);');
    // A quiet link keeps the ink on its card.
    expect(rules.find((r) => r.selector.split(',').map((one) => one.trim()).includes('.ask a.ask-button.quiet'))?.body)
      .toContain('color: var(--ask-ink);');
    // Focus keeps the cyan ring every control has.
    expect(rules.find((r) => r.selector === '.ask :focus-visible')?.body).toContain('outline: 2px solid var(--ask-cyan);');
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
