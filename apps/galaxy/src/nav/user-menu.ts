import { APP_CALLBACK } from '../dashboard/sign-in';
import { startGithubSignIn } from '../data/sign-in-github';

// The user menu's pure parts (PRD 438), the end of the app's top bar: the keys of the WAI-ARIA
// menu-button pattern, the top bar's GitHub sign-in (the one /app's card starts, back through
// /app/callback), and Sign out, which ends this browser's session only, as the arcade does, and
// lands on HOME. My profile (PRD 698) opens the viewer's own profile page.

type Supabase = { url: string; key: string };

/** Where Sign out lands: HOME. */
export const SIGN_OUT_HOME = '/';

/** What a key on the avatar button does: open the menu with an item focused, or nothing. */
export type ButtonMove = { kind: 'open'; index: number } | { kind: 'none' };

/** What a key inside the open menu does: focus an item, close (giving the focus back to the avatar,
 * or letting Tab move it on), or nothing. */
export type MenuMove = { kind: 'focus'; index: number } | { kind: 'close'; refocus: boolean } | { kind: 'none' };

export function buttonKey(key: string, count: number): ButtonMove {
  if (key === 'ArrowDown' || key === 'Enter' || key === ' ') return { kind: 'open', index: 0 };
  if (key === 'ArrowUp') return { kind: 'open', index: Math.max(0, count - 1) };
  return { kind: 'none' };
}

export function menuKey(key: string, current: number, count: number): MenuMove {
  const at = (index: number) => ({ kind: 'focus' as const, index: ((index % count) + count) % count });
  switch (key) {
    case 'ArrowDown': return at(current + 1);
    case 'ArrowUp': return at(current - 1);
    case 'Home': return at(0);
    case 'End': return at(count - 1);
    case 'Escape': return { kind: 'close', refocus: true };
    case 'Tab': return { kind: 'close', refocus: false };
    default: return { kind: 'none' };
  }
}

/** The browser client's one call Sign out makes. */
export interface SignsOut {
  auth: { signOut(options: { scope: 'local' }): Promise<unknown> };
}

/** Ends this browser's session (never the one `omni signin` keeps for ask mode), then goes to HOME.
 * With no database (the demo) there is nothing to end; a sign-out that fails still leaves. */
export async function signOutAndLeave(client: SignsOut | null, go: (to: string) => void): Promise<void> {
  try {
    await client?.auth.signOut({ scope: 'local' });
  } catch (error) {
    console.error(error);
  }
  go(SIGN_OUT_HOME);
}

/** The top bar's Sign in with GitHub: back through /app/callback to /app. Resolves with what to show
 * when it could not start, or null while the page leaves for GitHub. */
export async function signInFromBar(
  supabase: Supabase | null,
  origin: string,
  start: (supabase: Supabase, redirectTo: string) => Promise<string | null> = startGithubSignIn,
): Promise<string | null> {
  if (!supabase) return 'Sign-in is not open here.';
  return start(supabase, `${origin}${APP_CALLBACK}`);
}

/** Where My profile goes (PRD 698): the viewer's own profile, `/app/people/<login>` with the login in
 * lower case; null when they have no GitHub login, and the menu leaves the item out. */
export function profileHref(login: string | null): string | null {
  return login ? `/app/people/${encodeURIComponent(login.toLowerCase())}` : null;
}

/** What the avatar shows when the person has no picture. */
export function initialOf({ name, login }: { name: string | null; login: string | null }): string {
  return (name ?? login ?? '?').trim().charAt(0).toUpperCase() || '?';
}

/** The galaxy's Supabase, inlined into the browser bundle when the page is built; null on the demo. */
export function publicSupabase(): Supabase | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return url && key ? { url, key } : null;
}
