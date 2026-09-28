/** The arcade's colours that are not INK: the cabinet, dim text, and the Game Boy's body. */
export const ARCADE: Readonly<Record<string, string>>;
/** A JS colour name as its CSS custom property's name: `navyDark` → `navy-dark`. */
export function cssName(name: string): string;
/** Every colour tokens.css declares, by its CSS name (no `--`). */
export const COLOURS: Readonly<Record<string, string>>;
/** tokens.css, as the generator writes it. */
export function tokensCss(): string;

export type AskTheme = 'omni' | 'light' | 'dark';
export type AskToken =
  | 'ground' | 'surface' | 'sunk' | 'line' | 'lineStrong' | 'ink' | 'muted'
  | 'plasma' | 'plasmaSoft' | 'onPlasma' | 'yellow' | 'onYellow' | 'cyan' | 'green' | 'red';
export type AskPair = { readonly text: AskToken; readonly on: AskToken; readonly where: string };
/** Ask's semantic tokens: Omni, light and dark. In Omni, `yellow` holds magenta (the Recommended badge). */
export const ASK: Readonly<Record<AskTheme, Readonly<Record<AskToken, string>>>>;
/** Every text colour on every background Ask puts it on. Each must reach 4.5:1. */
export const ASK_TEXT_PAIRS: readonly AskPair[];
/** Edges that tell a control's state (WCAG 1.4.11): 3:1 against what they sit on. */
export const ASK_UI_PAIRS: readonly AskPair[];
/** The WCAG 2 contrast ratio of two #rrggbb colours, from 1 to 21. */
export function contrast(a: string, b: string): number;
