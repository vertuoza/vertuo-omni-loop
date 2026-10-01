// A workspace's theme: the arcade's colours, as named tokens. Every token has a default, today's
// colour, read from @omni/design (whose tokens.css declares the same values on :root), so the theme
// `{}` is the arcade as it always looked; a workspace stores only the tokens it overrides
// (`workspaces.theme`), which `valid_theme()` checks in the database and `parseTheme()` checks here. The resolved theme is written as CSS custom properties on the arcade's root element
// (`themeVars`), the canvas scenes read the same values (`FrameState.theme`), the mark takes its
// gradient from `mark-*` (mark.ts) and the sprite forge its stripes from `stripe-*` (`stripesOf`).
// Adding a token means adding it to `valid_theme()` too, in a migration: theme.test.ts holds the two
// lists equal. Fonts are not tokens.
import { z } from 'zod';
import { COLOURS, FLAT, type Flat } from '@omni/design';

/** The arcade's colours the stylesheets read, named as @omni/design's tokens.css names them. */
const ARCADE_TOKENS = [
  // The arcade's own.
  'void', 'deep', 'cab', 'navy', 'navy-dark', 'white', 'dim', 'plasma', 'plasma-dark',
  'yellow', 'gold', 'red', 'cyan', 'green',
  // The Game Boy's body (shell.css). Its shell runs from plasma through body-mid to plasma-dark;
  // A is red with its shine, B plasma with its.
  'body-mid', 'body-ink', 'body-ink-soft', 'body-lens-1', 'body-lens-2', 'body-lens-text', 'body-led-off',
  'body-pad-1', 'body-pad-2', 'body-pad-arrow', 'body-pad-down-1', 'body-pad-down-2',
  'body-a-shine', 'body-b-shine', 'body-pill-1', 'body-pill-2', 'body-grille',
] as const;

function fromPackage<T extends string>(names: readonly T[]): Record<T, string> {
  return Object.fromEntries(names.map((name) => {
    const colour = COLOURS[name];
    if (!colour) throw new Error(`theme: @omni/design has no colour "${name}"`);
    return [name, colour];
  })) as Record<T, string>;
}

/** Every token and its default. The arcade's colours and the stripes come from @omni/design; the
 * mark's gradient is the Vertuoza mark's own (mark.ts), a workspace's colours, not the product's. */
export const TOKENS = Object.freeze({
  // The arcade's colours, declared on :root by @omni/design/tokens.css.
  ...fromPackage(ARCADE_TOKENS),
  // The mark's gradient, left to right, and its shade (mark.ts).
  'mark-1': '#ff5f6d',
  'mark-2': '#a45cff',
  'mark-3': '#4a63ff',
  'mark-shade-1': '#a8183a',
  'mark-shade-2': '#6a2fd0',
  'mark-shade-3': '#2f3fc4',
  // The four stripes on every hero's suit: the sprite forge's flat colours 1 to 4.
  'stripe-1': FLAT[1]!,
  'stripe-2': FLAT[2]!,
  'stripe-3': FLAT[3]!,
  'stripe-4': FLAT[4]!,
});

export type Token = keyof typeof TOKENS;
/** A theme resolved over the defaults: every token's colour. */
export type Theme = Readonly<Record<Token, string>>;
/** What a workspace stores: only the tokens it overrides. */
export type Overrides = Partial<Record<Token, string>>;

const NAMES = Object.keys(TOKENS) as [Token, ...Token[]];

/** A theme's colour: lowercase `#rrggbb` only, as `valid_theme()` asks (item s1-02). */
export const Colour = z.string().regex(/^#[0-9a-f]{6}$/, 'not a lowercase #rrggbb colour');
/** One override: a known token and its colour. */
export const Override = z.tuple([z.enum(NAMES), Colour]);
/** A stored theme: an object of overrides, any token left out. `valid_theme()` in the database, in zod. */
export const ThemeSchema = z.partialRecord(z.enum(NAMES), Colour);

/** Today's arcade: every token at its default. */
export const DEFAULT_THEME: Theme = TOKENS;

/**
 * The overrides a stored theme holds, read leniently so that a colour never breaks the arcade: an
 * entry that is not a known token with a lowercase `#rrggbb` colour is dropped with a warning, and
 * its default applies. A theme that is not an object is ignored whole, with a warning.
 */
export function parseTheme(raw: unknown, warn: (message: string) => void = console.warn): Overrides {
  const object = z.record(z.string(), z.unknown()).safeParse(raw);
  if (!object.success || Array.isArray(raw)) {
    warn(`theme: ignored ${JSON.stringify(raw)}: a theme is an object of token to colour`);
    return {};
  }
  const kept: Overrides = {};
  for (const [key, value] of Object.entries(object.data)) {
    const entry = Override.safeParse([key, value]);
    if (entry.success) kept[entry.data[0]] = entry.data[1];
    else warn(`theme: dropped "${key}": ${JSON.stringify(value)} (${key in TOKENS ? 'not a lowercase #rrggbb colour' : 'no such token'}); its default applies`);
  }
  return kept;
}

/** A stored theme over the defaults. */
export function resolveTheme(raw: unknown): Theme {
  return Object.freeze({ ...TOKENS, ...parseTheme(raw) });
}

/** The theme as CSS custom properties, one per token (`--plasma`), for the arcade's root element. */
export function themeVars(theme: Theme): Record<`--${Token}`, string> {
  return Object.fromEntries(NAMES.map((t) => [`--${t}`, theme[t]])) as Record<`--${Token}`, string>;
}

const STRIPES = new WeakMap<Theme, Flat>();

/** The sprite forge's stripe override: the flat colours 1 to 4 from `stripe-1` to `stripe-4`. */
export function stripesOf(theme: Theme): Flat {
  let flat = STRIPES.get(theme);
  if (!flat) {
    flat = Object.freeze({ 1: theme['stripe-1'], 2: theme['stripe-2'], 3: theme['stripe-3'], 4: theme['stripe-4'] });
    STRIPES.set(theme, flat);
  }
  return flat;
}
