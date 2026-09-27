// The ask page's theme: Omni, light or dark, chosen with the switch in the header and kept in the
// browser's localStorage. Omni, HOME's palette, is the default, and it never follows the system's
// preference: the choice is the theme. The choice is applied by a small inline script, the first
// thing inside the ask root, that runs as the page is parsed, before the first paint, so a reload
// never flashes the wrong theme. It marks the ask root (which the layout owns), not <html> (which
// the arcade's root layout owns). The switch re-applies it after React takes over. The script and
// readChoice() say the same thing: theme.test.ts runs one against the other.

export type ThemeChoice = 'omni' | 'light' | 'dark';
export type Theme = ThemeChoice;

/** Where the choice is kept in localStorage. Omni is the key's absence. */
export const THEME_KEY = 'omni-ask-theme';
/** The attribute on the ask root that ask.css themes by: the theme shown. */
export const THEME_ATTR = 'data-ask-theme';
/** The attribute on the ask root that carries the choice, so the switch shows it before hydration. */
export const CHOICE_ATTR = 'data-ask-choice';

export const THEME_CHOICES: ThemeChoice[] = ['omni', 'light', 'dark'];

/** A stored value as a choice: light and dark are themselves; anything else (nothing, a stored
 * `system` from before Omni, an unknown value) is Omni. */
export const readChoice = (stored: string | null): ThemeChoice => (stored === 'light' || stored === 'dark' ? stored : 'omni');

/** Keeps the choice; storage that refuses (a private window, a blocked site) only loses the memory. */
export function storeChoice(storage: Pick<Storage, 'setItem' | 'removeItem'>, choice: ThemeChoice) {
  try {
    if (choice === 'omni') storage.removeItem(THEME_KEY);
    else storage.setItem(THEME_KEY, choice);
  } catch {
    /* the theme still applies for this visit */
  }
}

/** The inline script, the first child of the ask root, which it marks: plain ES5, no imports. */
export const themeScript =
  `(function(){var c=null;try{c=localStorage.getItem(${JSON.stringify(THEME_KEY)})}catch(e){}` +
  `if(c!=="light"&&c!=="dark")c="omni";` +
  `var r=document.currentScript&&document.currentScript.parentElement;if(!r)return;` +
  `r.setAttribute(${JSON.stringify(THEME_ATTR)},c);` +
  `r.setAttribute(${JSON.stringify(CHOICE_ATTR)},c)})()`;
