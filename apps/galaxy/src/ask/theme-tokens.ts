// The ask page's colours, as named tokens: the galaxy's hues turned into signals on a reading
// surface. The values, the text and edge pairs, and their WCAG AA test live in @omni/design (its
// tokens module); this file names them for the ask page and turns them into CSS custom properties
// (themeCss) for the layout. ask.css only uses those properties, and theme-tokens.test.ts checks
// the stylesheet this becomes.
import { ASK, ASK_TEXT_PAIRS, ASK_UI_PAIRS, contrast, type AskPair, type AskToken } from '@omni/design';
import type { Theme } from './theme';

export type TokenName = AskToken;

export const TOKENS: Readonly<Record<Theme, Readonly<Record<TokenName, string>>>> = ASK;

type Pair = AskPair;

/** Every text colour on every background ask.css puts it on. Each must reach 4.5:1. */
export const TEXT_PAIRS: readonly Pair[] = ASK_TEXT_PAIRS;

/** Edges that tell a control's state (WCAG 1.4.11): 3:1 against what they sit on. */
export const UI_PAIRS: readonly Pair[] = ASK_UI_PAIRS;

export { contrast };

const variable = (name: string) => `--ask-${name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`;
const declarations = (theme: Theme) =>
  `color-scheme: ${theme}; ${Object.entries(TOKENS[theme]).map(([name, value]) => `${variable(name)}: ${value};`).join(' ')}`;

/** The tokens as CSS custom properties, on the ask root the theme script marked, and on <html>
 * too where :has() is known (so the page's own background follows); `:is()` forgives a browser
 * without it. An ask root the script never marked follows the system. */
export function themeCss(): string {
  const marked = (theme: Theme) => `:is(html:has(.ask[data-ask-theme="${theme}"]), .ask[data-ask-theme="${theme}"])`;
  return [
    `${marked('light')} { ${declarations('light')} }`,
    `${marked('dark')} { ${declarations('dark')} }`,
    `.ask:not([data-ask-theme]) { ${declarations('light')} }`,
    `@media (prefers-color-scheme: dark) { .ask:not([data-ask-theme]) { ${declarations('dark')} } }`,
  ].join('\n');
}
