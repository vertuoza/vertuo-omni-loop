// @ts-nocheck
// The one source of colour. The pixel palette and INK live in palette.mjs, where the sprites read
// them; this module adds the arcade's own colours (its cabinet, its dim text and the Game Boy's
// body), Ask's Omni, light and dark reading tokens, and the generator of tokens.css, the :root custom
// properties every stylesheet reads. Change a colour here, then run `pnpm --filter @omni/design
// tokens`: tokens.test.mjs fails while the committed tokens.css differs from what this writes.
import { INK } from './palette.ts';

/** The arcade's colours that are not INK: the cabinet, dim text, and the Game Boy's body. */
export const ARCADE = Object.freeze({
  cab: '#120f3a',
  dim: '#8a90d6',
  // The Game Boy's body: its shell runs from plasma through bodyMid to plasmaDark; A is red with
  // its shine, B plasma with its.
  bodyMid: '#8a45ee',
  bodyInk: '#1a1560',
  bodyInkSoft: '#2a1d78',
  bodyLens1: '#1d1a4a',
  bodyLens2: '#14123a',
  bodyLensText: '#9aa0e0',
  bodyLedOff: '#3a1030',
  bodyPad1: '#26224f',
  bodyPad2: '#15122f',
  bodyPadArrow: '#5a54a8',
  bodyPadDown1: '#151230',
  bodyPadDown2: '#0b0a1e',
  bodyAShine: '#ff7d94',
  bodyBShine: '#caa0ff',
  bodyPill1: '#3b2a86',
  bodyPill2: '#241a5a',
  bodyGrille: '#4a1fa6',
});

/** A JS colour name as its CSS custom property's name: `navyDark` → `navy-dark`, `bodyLens1` → `body-lens-1`. */
export function cssName(name) {
  return name.replace(/[A-Z]|\d+/g, (m) => `-${m.toLowerCase()}`);
}

/** Every colour tokens.css declares, by its CSS name (no `--`): INK, then the arcade's own. */
export const COLOURS = Object.freeze(Object.fromEntries(
  Object.entries({ ...INK, ...ARCADE }).map(([name, value]) => [cssName(name), value]),
));

/** tokens.css, as the generator writes it. */
export function tokensCss() {
  const lines = Object.entries(COLOURS).map(([name, value]) => `  --${name}: ${value};`);
  return [
    '/* Generated from @omni/design (src/tokens.ts): do not edit. Change a colour there and run',
    '   `pnpm --filter @omni/design tokens`. */',
    ':root {',
    ...lines,
    '}',
    '',
  ].join('\n');
}

// Ask's reading surface: the galaxy's hues turned into signals. Plasma marks the selected option,
// yellow the Recommended badge, cyan links and focus, green what is answered, red errors only. The
// light theme darkens the same hues on an off-white ground. Omni is HOME's own palette on the same
// surface (PRD 284): the void and the cabinet's navy, with comic yellow as the signal.
/** Ask's semantic tokens: Omni, light and dark. */
export const ASK = Object.freeze({
  omni: Object.freeze({
    ground: INK.void,
    surface: ARCADE.cab,
    sunk: INK.deep,
    line: INK.navyDark,
    // What outlines a chip, a card or a control (PRD 476): 3:1 on ground, surface and sunk, where
    // `line` stays the quiet divider.
    lineStrong: '#5a60c4',
    ink: INK.white,
    muted: ARCADE.dim,
    // The signal is comic yellow with the void's text on it, as HOME's PRESS START.
    plasma: INK.yellow,
    // Omni's own: a deep purple between the cabinet and the ad's purple, where the hint stays readable.
    plasmaSoft: '#2a2350',
    onPlasma: INK.void,
    // `yellow` holds magenta here: the Recommended badge must never read as a selection, and the
    // signal is already yellow. The token keeps its name so no stylesheet has to change.
    yellow: INK.magenta,
    onYellow: INK.void,
    cyan: INK.cyan,
    green: INK.green,
    red: '#ff6b86', // the dark theme's red
  }),
  light: Object.freeze({
    ground: '#f5f4fc',
    surface: '#ffffff',
    sunk: '#eceaf8',
    line: '#d9d6ee',
    lineStrong: '#85819f',
    ink: '#17153d',
    muted: '#4f5486',
    plasma: INK.plasmaDark,
    plasmaSoft: '#efe7ff',
    onPlasma: '#ffffff',
    yellow: INK.yellow,
    onYellow: '#3a2c00',
    cyan: '#0b6f86',
    green: '#15703f',
    red: '#b3122f',
  }),
  dark: Object.freeze({
    ground: INK.deep,
    surface: '#16144a',
    sunk: '#1d1a58',
    line: '#2f2c78',
    lineStrong: '#6d6acc',
    ink: INK.white,
    muted: '#a9aee6',
    plasma: '#b37cff',
    plasmaSoft: '#2a1d66',
    onPlasma: INK.deep,
    yellow: INK.yellow,
    onYellow: '#3a2c00',
    cyan: INK.cyan,
    green: INK.green,
    red: '#ff6b86',
  }),
});

/** Every text colour on every background Ask puts it on. Each must reach 4.5:1. */
export const ASK_TEXT_PAIRS = Object.freeze([
  { text: 'ink', on: 'ground', where: 'page text' },
  { text: 'ink', on: 'surface', where: 'an option, a card' },
  { text: 'ink', on: 'sunk', where: 'the preview panel' },
  { text: 'ink', on: 'plasmaSoft', where: 'the selected option' },
  { text: 'muted', on: 'ground', where: 'hints, history' },
  { text: 'muted', on: 'surface', where: 'an option\'s description' },
  { text: 'muted', on: 'sunk', where: 'the header chip, a key cap' },
  { text: 'muted', on: 'plasmaSoft', where: 'the selected option\'s description' },
  { text: 'plasma', on: 'ground', where: 'the wordmark' },
  { text: 'plasma', on: 'surface', where: 'a pressed control on a card' },
  { text: 'plasma', on: 'plasmaSoft', where: 'Other, when chosen' },
  { text: 'onPlasma', on: 'plasma', where: 'Send, the pressed theme, a selected key cap' },
  { text: 'onYellow', on: 'yellow', where: 'the Recommended badge' },
  { text: 'cyan', on: 'ground', where: 'a link' },
  { text: 'cyan', on: 'surface', where: 'a link on a card' },
  { text: 'green', on: 'ground', where: 'answered, in the history' },
  { text: 'green', on: 'surface', where: 'answered, on a card' },
  { text: 'red', on: 'ground', where: 'an error' },
  { text: 'red', on: 'surface', where: 'an error on a card' },
]);

/** Edges that tell a control's state (WCAG 1.4.11): 3:1 against what they sit on. */
export const ASK_UI_PAIRS = Object.freeze([
  { text: 'cyan', on: 'ground', where: 'the focus ring' },
  { text: 'cyan', on: 'surface', where: 'the focus ring on a card' },
  { text: 'plasma', on: 'surface', where: 'the selected option\'s edge' },
  { text: 'plasma', on: 'plasmaSoft', where: 'the selected option\'s edge, inside' },
  { text: 'muted', on: 'surface', where: 'an empty checkbox or radio' },
  { text: 'lineStrong', on: 'ground', where: 'a chip, a badge, a control or the tab bar on the page' },
  { text: 'lineStrong', on: 'surface', where: 'a card or a control on a card' },
  { text: 'lineStrong', on: 'sunk', where: 'a chip or a key cap on the sunk panel' },
]);

function luminance(hex) {
  const channel = (i) => {
    const c = parseInt(hex.slice(1 + 2 * i, 3 + 2 * i), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(0) + 0.7152 * channel(1) + 0.0722 * channel(2);
}

/** The WCAG 2 contrast ratio of two #rrggbb colours, from 1 to 21. */
export function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
