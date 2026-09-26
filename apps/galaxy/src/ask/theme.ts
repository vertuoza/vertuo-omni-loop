// The ask page's theme: system, light or dark, chosen with the switch in the header and kept in
// the browser's localStorage. The choice is applied by a small inline script, the first thing
// inside the ask root, that runs as the page is parsed, before the first paint, so a reload never
// flashes the wrong theme. It marks the ask root (which the layout owns), not <html> (which the
// arcade's root layout owns). The switch re-applies it after React takes over. The script and
// resolveTheme() say the same thing: theme.test.ts runs one against the other.

export type ThemeChoice = 'system' | 'light' | 'dark';
export type Theme = 'light' | 'dark';

/** Where the choice is kept in localStorage. System is the key's absence. */
export const THEME_KEY = 'omni-ask-theme';
/** The attribute on the ask root that ask.css themes by: the resolved theme, light or dark. */
export const THEME_ATTR = 'data-ask-theme';
/** The attribute on the ask root that carries the choice, so the switch shows it before hydration. */
export const CHOICE_ATTR = 'data-ask-choice';

export const THEME_CHOICES: ThemeChoice[] = ['system', 'light', 'dark'];

/** A stored value as a choice; anything unknown (or nothing) is system. */
export const readChoice = (stored: string | null): ThemeChoice => (stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system');

/** The theme a choice shows, given whether the system prefers dark. */
export const resolveTheme = (choice: ThemeChoice, systemDark: boolean): Theme => (choice === 'system' ? (systemDark ? 'dark' : 'light') : choice);

/** Keeps the choice; storage that refuses (a private window, a blocked site) only loses the memory. */
export function storeChoice(storage: Pick<Storage, 'setItem' | 'removeItem'>, choice: ThemeChoice) {
  try {
    if (choice === 'system') storage.removeItem(THEME_KEY);
    else storage.setItem(THEME_KEY, choice);
  } catch {
    /* the theme still applies for this visit */
  }
}

/** The inline script, the first child of the ask root, which it marks: plain ES5, no imports. */
export const themeScript =
  `(function(){var c=null;try{c=localStorage.getItem(${JSON.stringify(THEME_KEY)})}catch(e){}` +
  `if(c!=="light"&&c!=="dark")c="system";` +
  `var d=c==="dark"||(c==="system"&&typeof matchMedia==="function"&&matchMedia("(prefers-color-scheme: dark)").matches);` +
  `var r=document.currentScript&&document.currentScript.parentElement;if(!r)return;` +
  `r.setAttribute(${JSON.stringify(THEME_ATTR)},d?"dark":"light");` +
  `r.setAttribute(${JSON.stringify(CHOICE_ATTR)},c)})()`;
