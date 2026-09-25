// The ask page's colours, as named tokens: the galaxy's hues turned into signals on a reading
// surface. Plasma marks the selected option, yellow the Recommended badge, cyan links and focus,
// green what is answered, red errors only. The light theme darkens the same hues on an off-white
// ground. This table is the only place a colour is written: the layout turns it into CSS custom
// properties (themeCss), ask.css only uses them, and theme-tokens.test.ts checks every pair below
// against WCAG AA in both themes.
import type { Theme } from './theme';

export type TokenName =
  | 'ground' | 'surface' | 'sunk' | 'line' | 'ink' | 'muted'
  | 'plasma' | 'plasmaSoft' | 'onPlasma' | 'yellow' | 'onYellow' | 'cyan' | 'green' | 'red';

export const TOKENS: Record<Theme, Record<TokenName, string>> = {
  light: {
    ground: '#f5f4fc',
    surface: '#ffffff',
    sunk: '#eceaf8',
    line: '#d9d6ee',
    ink: '#17153d',
    muted: '#4f5486',
    plasma: '#6a2fd0',
    plasmaSoft: '#efe7ff',
    onPlasma: '#ffffff',
    yellow: '#ffd84a',
    onYellow: '#3a2c00',
    cyan: '#0b6f86',
    green: '#15703f',
    red: '#b3122f',
  },
  dark: {
    ground: '#0e0d33',
    surface: '#16144a',
    sunk: '#1d1a58',
    line: '#2f2c78',
    ink: '#f2f4ff',
    muted: '#a9aee6',
    plasma: '#b37cff',
    plasmaSoft: '#2a1d66',
    onPlasma: '#0e0d33',
    yellow: '#ffd84a',
    onYellow: '#3a2c00',
    cyan: '#6ff0ff',
    green: '#4ee08a',
    red: '#ff6b86',
  },
};

type Pair = { text: TokenName; on: TokenName; where: string };

/** Every text colour on every background ask.css puts it on. Each must reach 4.5:1. */
export const TEXT_PAIRS: Pair[] = [
  { text: 'ink', on: 'ground', where: 'page text' },
  { text: 'ink', on: 'surface', where: 'an option, a card' },
  { text: 'ink', on: 'sunk', where: 'the preview panel' },
  { text: 'ink', on: 'plasmaSoft', where: 'the selected option' },
  { text: 'muted', on: 'ground', where: 'hints, history' },
  { text: 'muted', on: 'surface', where: 'an option\'s description' },
  { text: 'muted', on: 'sunk', where: 'the header chip, a key cap' },
  { text: 'muted', on: 'plasmaSoft', where: 'the selected option\'s description' },
  { text: 'plasma', on: 'ground', where: 'the wordmark' },
  { text: 'plasma', on: 'surface', where: 'Other, when chosen' },
  { text: 'onPlasma', on: 'plasma', where: 'Send, the pressed theme, a selected key cap' },
  { text: 'onYellow', on: 'yellow', where: 'the Recommended badge' },
  { text: 'cyan', on: 'ground', where: 'a link' },
  { text: 'cyan', on: 'surface', where: 'a link on a card' },
  { text: 'green', on: 'ground', where: 'answered, in the history' },
  { text: 'green', on: 'surface', where: 'answered, on a card' },
  { text: 'red', on: 'ground', where: 'an error' },
  { text: 'red', on: 'surface', where: 'an error on a card' },
];

/** Edges that tell a control's state (WCAG 1.4.11): 3:1 against what they sit on. */
export const UI_PAIRS: Pair[] = [
  { text: 'cyan', on: 'ground', where: 'the focus ring' },
  { text: 'cyan', on: 'surface', where: 'the focus ring on a card' },
  { text: 'plasma', on: 'surface', where: 'the selected option\'s edge' },
  { text: 'plasma', on: 'plasmaSoft', where: 'the selected option\'s edge, inside' },
  { text: 'muted', on: 'surface', where: 'an empty checkbox or radio' },
];

function luminance(hex: string) {
  const channel = (i: number) => {
    const c = parseInt(hex.slice(1 + 2 * i, 3 + 2 * i), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(0) + 0.7152 * channel(1) + 0.0722 * channel(2);
}

/** The WCAG 2 contrast ratio of two #rrggbb colours, from 1 to 21. */
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const variable = (name: string) => `--ask-${name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`;
const declarations = (theme: Theme) =>
  `color-scheme: ${theme}; ${Object.entries(TOKENS[theme]).map(([name, value]) => `${variable(name)}: ${value};`).join(' ')}`;

/** The tokens as CSS custom properties: on <html> once the theme script has run, and on the ask
 * root following the system when it has not. */
export function themeCss(): string {
  return [
    `html[data-ask-theme="light"] { ${declarations('light')} }`,
    `html[data-ask-theme="dark"] { ${declarations('dark')} }`,
    `html:not([data-ask-theme]) .ask { ${declarations('light')} }`,
    `@media (prefers-color-scheme: dark) { html:not([data-ask-theme]) .ask { ${declarations('dark')} } }`,
  ].join('\n');
}
