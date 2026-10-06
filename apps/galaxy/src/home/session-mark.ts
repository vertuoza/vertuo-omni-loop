import type { SignedInView } from './signed-in';

// No flash (PRD 1006): HOME is static, so a signed-in visitor would see SIGN UP WITH GITHUB painted,
// then replaced by the signed-in pill. Before anything paints, an inline script checks whether the
// browser holds a Supabase auth cookie (`sb-<ref>-auth-token`, possibly chunked as `.0`, `.1`) and, when
// it does, marks `<main class="home">` `data-session="pending"`: home.css then keeps each button's box
// but hides it. Controls settles the mark once the session read answers: `in` on a session, removed on
// none, a failed read, the demo, or no answer within SETTLE_MS. A visitor with no such cookie never
// gets the mark, and their page paints as it always did. The cookie is only a hint: the session read
// (session-read.ts) decides who is signed in.

/** The attribute on `<main class="home">` that holds the mark. */
export const SESSION_ATTR = 'data-session';

/** How long the buttons stay hidden without an answer, in milliseconds. */
export const SETTLE_MS = 3000;

/** A Supabase auth cookie, whole or one of its chunks, anywhere in `document.cookie`. */
const AUTH_COOKIE = /(?:^|;\s*)sb-[^=;\s]+-auth-token(?:\.\d+)?=/;

/** Whether a cookie string holds a Supabase auth cookie. */
export function hasAuthCookie(cookie: string): boolean {
  return AUTH_COOKIE.test(cookie);
}

/** The same rule, as the script HOME runs before its first paint, from inside `<main class="home">`. */
export const SESSION_MARK_SCRIPT =
  `if(${AUTH_COOKIE}.test(document.cookie))document.currentScript.parentElement.setAttribute('${SESSION_ATTR}','pending');`;

/** What settling needs: the session read (allowed to throw), the mark, and the pills. */
export interface SettlePorts {
  read: () => Promise<SignedInView | null>;
  /** `in` sets the mark to in; null removes it. */
  mark: (state: 'in' | null) => void;
  draw: (view: SignedInView) => void;
}

/**
 * Settles the pending mark from the session read. A session marks the page `in` and draws the pills,
 * even after the time is up; no session, a failed read or SETTLE_MS without an answer removes the
 * mark, once. Returns a cancel, for when the page goes away.
 */
export function settleSession(ports: SettlePorts, ms = SETTLE_MS): () => void {
  let live = true;
  let removed = false;
  const remove = () => {
    if (!live || removed) return;
    removed = true;
    ports.mark(null);
  };
  const timer = setTimeout(remove, ms);
  void ports.read().then(
    (view) => {
      clearTimeout(timer);
      if (!live) return;
      if (!view) { remove(); return; }
      ports.mark('in');
      ports.draw(view);
    },
    () => { clearTimeout(timer); remove(); },
  );
  return () => {
    live = false;
    clearTimeout(timer);
  };
}
