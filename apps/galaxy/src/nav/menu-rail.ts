// The menu's rail (PRD 733): on a computer, « folds the sidebar to a 56 px rail of sprites and »
// opens it again. The choice is kept per browser in a cookie, `omni-menu=rail` for a year; opening
// deletes it, so the open menu is the cookie's absence. A small inline script, the app shell's second
// child after the theme's (src/ask/theme.ts, the same pattern), reads the cookie while the page is
// parsed and marks the shell `data-menu="rail"`, so a load or a reload draws the rail from its first
// paint. sidebar.css draws the rail from that attribute, and only from 900 px: below it the phone
// drawer is unchanged. The script and readMenu() say the same thing: menu-rail.test.ts runs one
// against the other.

export type MenuState = 'open' | 'rail';

/** The cookie that keeps the choice. The open menu is its absence. */
export const MENU_COOKIE = 'omni-menu';
/** The attribute on the app shell that sidebar.css draws the rail from. */
export const MENU_ATTR = 'data-menu';
/** A year, in seconds. */
const MENU_MAX_AGE = 60 * 60 * 24 * 365;

/** The state a cookie header says: `rail` when `omni-menu=rail` is among its pairs, else open. */
export function readMenu(cookie: string | null | undefined): MenuState {
  if (!cookie) return 'open';
  for (const pair of cookie.split(';')) {
    const at = pair.indexOf('=');
    if (at > 0 && pair.slice(0, at).trim() === MENU_COOKIE) return pair.slice(at + 1).trim() === 'rail' ? 'rail' : 'open';
  }
  return 'open';
}

/** The `document.cookie` assignment that keeps a state: the rail for a year, open by deleting it. */
export function menuCookie(state: MenuState): string {
  return state === 'rail'
    ? `${MENU_COOKIE}=rail; Max-Age=${MENU_MAX_AGE}; Path=/; SameSite=Lax`
    : `${MENU_COOKIE}=; Max-Age=0; Path=/; SameSite=Lax`;
}

/** Marks the shell with a state and keeps it. A refused cookie only loses the memory: the menu still
 * folds or opens for this visit. */
export function setMenu(shell: Pick<Element, 'setAttribute' | 'removeAttribute'> | null, doc: { cookie: string } | null, state: MenuState) {
  if (state === 'rail') shell?.setAttribute(MENU_ATTR, 'rail');
  else shell?.removeAttribute(MENU_ATTR);
  try {
    if (doc) doc.cookie = menuCookie(state);
  } catch {
    /* the rail still applies for this visit */
  }
}

/** The inline script, a child of the app shell, which it marks: plain ES5, no imports, never throws. */
export const menuScript =
  `(function(){try{var c=document.cookie||"";` +
  `if(!/(?:^|;)\\s*${MENU_COOKIE}\\s*=\\s*rail\\s*(?:;|$)/.test(c))return;` +
  `var r=document.currentScript&&document.currentScript.parentElement;if(!r)return;` +
  `r.setAttribute(${JSON.stringify(MENU_ATTR)},"rail")}catch(e){}})()`;
