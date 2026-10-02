// SIGN UP WITH GITHUB on HOME (PRD 359, s5): the GitHub sign-in every surface starts
// (src/data/sign-in-github.ts), coming back to the galaxy's callback, which joins the workspaces of
// the person's GitHub orgs and sends them on (app/auth/callback/route.ts). HOME stays static: the
// button is a plain button marked with SIGN_UP_ATTR, and Controls answers a click on it. The browser
// is reached through small ports, so the order is tested on its own.
// SELECT YOUR APP (PRD 932): the sign-up carries the app the person picked. The Omni app puts
// `next=app` on the callback address, and the callback lands them on /app; the Arcade adds nothing,
// and lands on /play as before (appLanding() in src/data/sign-in.ts).
import { PLAY_HREF } from './start';

/** Marks an element SIGN UP WITH GITHUB: `Controls` makes a click on it start the sign-in. */
export const SIGN_UP_ATTR = 'data-sign-up';

/** Where GitHub sends the visitor back, on the galaxy's own origin. */
export const CALLBACK_PATH = '/auth/callback';

/** The two apps a person can pick at sign-up: the Omni app (the board, on /app) or the Arcade. */
export type AppPick = 'app' | 'arcade';

/** The Omni app's own address, where its pick lands. */
export const APP_HREF = '/app';

export interface SignUpPorts {
  /** The galaxy's Supabase, as the browser reads it; null on the demo, which has none. */
  supabase: { url: string; key: string } | null;
  /** The page's origin, as the browser sees it: the session cookie is bound to it. */
  origin: string;
  /** Leaves for GitHub; resolves with what to show when it could not start, or null. */
  start: (supabase: { url: string; key: string }, redirectTo: string) => Promise<string | null>;
  go: (href: string) => void;
}

/**
 * Starts the sign-up for the app picked: the GitHub sign-in, back to the callback, with `next=app`
 * for the Omni app. Resolves with what to show when it could not start, or null while the page
 * leaves. Without Supabase there is nobody to sign up with: the picked app opens instead, the game
 * as PRESS START would. With no pick, it is the Arcade, as before the pick existed.
 */
export async function signUp(ports: SignUpPorts, pick: AppPick = 'arcade'): Promise<string | null> {
  if (!ports.supabase) {
    ports.go(pick === 'app' ? APP_HREF : PLAY_HREF);
    return null;
  }
  const back = pick === 'app' ? `${CALLBACK_PATH}?next=app` : CALLBACK_PATH;
  return ports.start(ports.supabase, `${ports.origin}${back}`);
}
