// Every token, read from the W3C DTCG files in ../tokens (the one source: palette, scale, and each
// theme's semantic roles), as tokens/build.ts generates them into tokens.generated.ts; this module
// names them, keeps Ask's names as aliases of the roles, lists the pairs each theme must pass, and
// writes tokens.css, the custom properties every stylesheet reads. Change a token in a
// *.tokens.json file, then run `pnpm --filter @omni/design tokens`: tokens/build.test.ts fails while
// a committed output differs from what the files generate.
import { INK } from './palette.ts';
import { TOKEN_COLOURS, TOKEN_SCALE, TOKEN_THEMES, TOKEN_THEMES_ANTI } from './tokens.generated.ts';

/** A JS colour name as its CSS custom property's name: `navyDark` → `navy-dark`, `bodyLens1` → `body-lens-1`. */
export function cssName(name: string): string {
  return name.replace(/[A-Z]|\d+/g, (m: string) => `-${m.toLowerCase()}`);
}

/** Every named colour tokens.css declares, by its CSS name (no `--`): INK, then the arcade's own. */
export const COLOURS: Readonly<Record<string, string>> = TOKEN_COLOURS;

const inkNames = new Set(Object.keys(INK).map(cssName));
const camelName = (name: string): string => name.replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase());
/** The arcade's colours that are not INK: the cabinet, dim text, and the Game Boy's body, by their JS name. */
export const ARCADE: Readonly<Record<string, string>> = Object.freeze(Object.fromEntries(
  Object.entries(COLOURS).filter(([name]) => !inkNames.has(name)).map(([name, value]) => [camelName(name), value]),
));

/**
 * The scale, by its CSS name (no `--`): `space-1`…`space-8` (4 to 64 px), `radius-1`, `radius-2`,
 * `radius-full`, the UI type steps `type-1`…`type-7` (12 to 32 px) and `type-prose` (17 px on 1.6),
 * each as `-size` and `-line`, `weight-regular`…`weight-bold`, `elevation-flat`, `-raised` and
 * `-overlay`, and the motion's two durations and its ease-out.
 */
export const SCALE: Readonly<Record<string, string>> = TOKEN_SCALE;

export type AskTheme = 'omni' | 'light' | 'dark';

/**
 * A semantic colour role, named by its job: the surfaces (canvas, surface, raised, sunken), the text
 * on them and on the filled colours, the borders (subtle on cards, strong on controls), the accent
 * that marks what is interactive and selected, the signal used once per view, the highlight (the
 * Recommended badge), and the status colours. `--color-<role>` in CSS.
 */
export type ColourRole = keyof (typeof TOKEN_THEMES)['omni'];

/** Each theme's roles: Omni (the default: HOME's palette on the reading surface), Light and Dark. */
export const THEME_ROLES: Readonly<Record<AskTheme, Readonly<Record<ColourRole, string>>>> = TOKEN_THEMES;

/** The roles the anti-loop mode remaps (Rewind Light): magenta takes the signal, the highlight takes yellow. */
export type AntiRole = keyof (typeof TOKEN_THEMES_ANTI)['omni'];
export const THEME_ROLES_ANTI: Readonly<Record<AskTheme, Readonly<Record<AntiRole, string>>>> = TOKEN_THEMES_ANTI;

/** The theme an ask root shows when the theme script never marked it. */
const DEFAULT_THEME: AskTheme = 'omni';
const THEME_ORDER: readonly AskTheme[] = ['omni', 'light', 'dark'];

/** The colours, the scale and each theme's roles, as the generator reads them from the DTCG files. */
export interface TokenSet {
  readonly colours: Readonly<Record<string, string>>;
  readonly scale: Readonly<Record<string, string>>;
  readonly themes: Readonly<Record<AskTheme, Readonly<Record<string, string>>>>;
  readonly anti: Readonly<Record<AskTheme, Readonly<Record<string, string>>>>;
}
const COMMITTED: TokenSet = { colours: COLOURS, scale: SCALE, themes: THEME_ROLES, anti: THEME_ROLES_ANTI };

const declare = (values: Readonly<Record<string, string>>, prefix = ''): string[] =>
  Object.entries(values).map(([name, value]) => `  --${prefix}${name}: ${value};`);

/**
 * tokens.css, as the generator writes it: the named colours and the scale on `:root`, then each
 * theme's roles where the theme script marks the ask root (and on <html> where :has() is known, so
 * the page's own background follows), Omni on `:root` and on an unmarked root, and the anti-loop
 * mode's after them, so they win.
 */
export function tokensCss(set: TokenSet = COMMITTED): string {
  const marked = (theme: string, also = '') => `:is(html:has(.ask[data-ask-theme="${theme}"]${also}), .ask[data-ask-theme="${theme}"]${also})`;
  const themes = THEME_ORDER;
  const rule = (selector: string, lines: readonly string[]) => [`${selector} {`, ...lines, '}'];
  return [
    '/* Generated from packages/design/tokens/*.tokens.json: do not edit. Change a token there and run',
    '   `pnpm --filter @omni/design tokens`. */',
    ...rule(':root', declare(set.colours)),
    '',
    '/* The scale: space, radius, type, weight, elevation and motion. */',
    ...rule(':root', declare(set.scale)),
    '',
    '/* The semantic roles of each theme, Omni by default. */',
    ...themes.flatMap((theme) => rule(
      theme === DEFAULT_THEME ? `:root, .ask:not([data-ask-theme]), ${marked(theme)}` : marked(theme),
      declare(set.themes[theme], 'color-'),
    )),
    '',
    '/* The anti-loop mode (data-ask-mode="anti"): the roles it remaps, after the theme\'s own. */',
    ...themes.flatMap((theme) => rule(
      theme === DEFAULT_THEME
        ? `.ask[data-ask-mode="anti"]:not([data-ask-theme]), ${marked(theme, '[data-ask-mode="anti"]')}`
        : marked(theme, '[data-ask-mode="anti"]'),
      declare(set.anti[theme], 'color-'),
    )),
    '',
  ].join('\n');
}

// Ask's names, kept as aliases of the roles so no stylesheet has to change: the galaxy's hues turned
// into signals. The signal (`plasma`) marks the selected option, the highlight (`yellow`) the
// Recommended badge, `cyan` links and focus, `green` what is answered, `red` errors only. In Omni the
// signal is comic yellow and the highlight magenta, so the badge never reads as a selection.
export type AskToken =
  | 'ground' | 'surface' | 'sunk' | 'line' | 'lineStrong' | 'ink' | 'muted'
  | 'plasma' | 'plasmaSoft' | 'onPlasma' | 'yellow' | 'onYellow' | 'cyan' | 'green' | 'red';
/** A text colour, the background it sits on, and where Ask puts the pair. */
export type AskPair = { readonly text: AskToken; readonly on: AskToken; readonly where: string };

/** The role each of Ask's names is an alias of. */
export const ASK_ROLES: Readonly<Record<AskToken, ColourRole>> = Object.freeze({
  ground: 'canvas',
  surface: 'surface',
  sunk: 'sunken',
  line: 'border-subtle',
  lineStrong: 'border-strong',
  ink: 'text-primary',
  muted: 'text-secondary',
  plasma: 'signal',
  plasmaSoft: 'signal-soft',
  onPlasma: 'text-on-signal',
  yellow: 'highlight',
  onYellow: 'text-on-highlight',
  cyan: 'info',
  green: 'success',
  red: 'danger',
});

const askOf = (roles: Readonly<Record<ColourRole, string>>): Readonly<Record<AskToken, string>> => {
  const of = (token: AskToken): string => roles[ASK_ROLES[token]];
  return Object.freeze({
    ground: of('ground'),
    surface: of('surface'),
    sunk: of('sunk'),
    line: of('line'),
    lineStrong: of('lineStrong'),
    ink: of('ink'),
    muted: of('muted'),
    plasma: of('plasma'),
    plasmaSoft: of('plasmaSoft'),
    onPlasma: of('onPlasma'),
    yellow: of('yellow'),
    onYellow: of('onYellow'),
    cyan: of('cyan'),
    green: of('green'),
    red: of('red'),
  });
};

/** Ask's tokens: Omni, light and dark, each an alias of its theme's role. In Omni, `yellow` holds magenta. */
export const ASK: Readonly<Record<AskTheme, Readonly<Record<AskToken, string>>>> = Object.freeze({
  omni: askOf(THEME_ROLES.omni),
  light: askOf(THEME_ROLES.light),
  dark: askOf(THEME_ROLES.dark),
});

/** The tokens the anti-loop mode remaps; every other token stays Ask's. */
export type AskAntiToken = 'line' | 'lineStrong' | 'plasma' | 'plasmaSoft' | 'onPlasma' | 'yellow' | 'onYellow';

const antiOf = (theme: AskTheme): Readonly<Record<AskAntiToken, string>> => {
  const roles: Readonly<Record<ColourRole, string>> = { ...THEME_ROLES[theme], ...THEME_ROLES_ANTI[theme] };
  const of = (token: AskAntiToken): string => roles[ASK_ROLES[token]];
  return Object.freeze({
    line: of('line'),
    lineStrong: of('lineStrong'),
    plasma: of('plasma'),
    plasmaSoft: of('plasmaSoft'),
    onPlasma: of('onPlasma'),
    yellow: of('yellow'),
    onYellow: of('onYellow'),
  });
};

/**
 * Rewind Light (concept #1964, round 4): the anti-loop mode's overrides of `ASK`, per theme. Magenta
 * takes the signal, the Recommended badge takes yellow, errors stay red. Apply them over `ASK[theme]`.
 */
export const ASK_ANTI: Readonly<Record<AskTheme, Readonly<Record<AskAntiToken, string>>>> = Object.freeze({
  omni: antiOf('omni'),
  light: antiOf('light'),
  dark: antiOf('dark'),
});

/** A role's text or edge colour, the role it sits on, and where a page puts the pair. */
export type RolePair = { readonly text: ColourRole; readonly on: ColourRole; readonly where: string };

const onSurfaces = (text: ColourRole, where: string): RolePair[] =>
  (['canvas', 'surface', 'raised', 'sunken'] as const).map((on) => ({ text, on, where: `${where}, on the ${on}` }));

/** Every text role on every role it is read on. Each must reach 4.5:1 in every theme. */
export const ROLE_TEXT_PAIRS: readonly RolePair[] = Object.freeze<RolePair[]>([
  ...onSurfaces('text-primary', 'body text'),
  { text: 'text-primary', on: 'accent-soft', where: 'a selected row' },
  { text: 'text-primary', on: 'signal-soft', where: 'the selected option' },
  ...onSurfaces('text-secondary', 'a hint, a description'),
  ...onSurfaces('text-tertiary', 'a timestamp, a count'),
  { text: 'text-on-accent', on: 'accent', where: 'a filled accent control' },
  { text: 'text-on-signal', on: 'signal', where: 'the primary action' },
  { text: 'text-on-highlight', on: 'highlight', where: 'the Recommended badge' },
  ...onSurfaces('accent', 'a link'),
  { text: 'signal', on: 'canvas', where: 'the wordmark' },
  { text: 'signal', on: 'surface', where: 'a pressed control on a card' },
  ...(['success', 'warning', 'danger', 'info'] as const).flatMap((status) => onSurfaces(status, `a ${status} status`)),
]);

/** Edges that tell a control's state (WCAG 1.4.11): 3:1 against what they sit on. */
export const ROLE_UI_PAIRS: readonly RolePair[] = Object.freeze<RolePair[]>([
  ...onSurfaces('border-strong', 'a control\'s edge'),
  ...onSurfaces('focus-ring', 'the focus ring'),
  { text: 'accent', on: 'canvas', where: 'the focus ring' },
  { text: 'accent', on: 'surface', where: 'the focus ring on a card' },
  { text: 'accent', on: 'accent-soft', where: 'a selected row\'s edge' },
  { text: 'signal', on: 'surface', where: 'the selected option\'s edge' },
  { text: 'signal', on: 'signal-soft', where: 'the selected option\'s edge, inside' },
]);

/** Every text colour on every background Ask puts it on. Each must reach 4.5:1. */
export const ASK_TEXT_PAIRS: readonly AskPair[] = Object.freeze<AskPair[]>([
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
export const ASK_UI_PAIRS: readonly AskPair[] = Object.freeze<AskPair[]>([
  { text: 'cyan', on: 'ground', where: 'the focus ring' },
  { text: 'cyan', on: 'surface', where: 'the focus ring on a card' },
  { text: 'plasma', on: 'surface', where: 'the selected option\'s edge' },
  { text: 'plasma', on: 'plasmaSoft', where: 'the selected option\'s edge, inside' },
  { text: 'muted', on: 'surface', where: 'an empty checkbox or radio' },
  { text: 'lineStrong', on: 'ground', where: 'a chip, a badge, a control or the tab bar on the page' },
  { text: 'lineStrong', on: 'surface', where: 'a card or a control on a card' },
  { text: 'lineStrong', on: 'sunk', where: 'a chip or a key cap on the sunk panel' },
]);

function luminance(hex: string): number {
  const channel = (i: number): number => {
    const c = parseInt(hex.slice(1 + 2 * i, 3 + 2 * i), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(0) + 0.7152 * channel(1) + 0.0722 * channel(2);
}

/** The WCAG 2 contrast ratio of two #rrggbb colours, from 1 to 21. */
export function contrast(a: string, b: string): number {
  const la = luminance(a), lb = luminance(b);
  const hi = Math.max(la, lb), lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}
