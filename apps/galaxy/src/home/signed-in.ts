import { faceOf, type Face } from '../people/face';

// Who is signed in, on HOME (PRD 1006): the pure decision of what the signed-in pill draws, in place
// of SIGN UP WITH GITHUB, beside CONTINUE YOUR GAME. HOME stays static: Controls reads the session in
// the browser (session-read.ts), calls this, and only draws what it returns. The face follows the app
// bar's order (src/nav/UserMenu.tsx), drawn by faceOf as every person's face is: the player's hero,
// tinted in their fleet's colour, when their player row holds one (s3); else the GitHub photo, else
// the initial of the name, then of the login. The session alone decides the photo or the initial, so
// it is drawn at once; the hero replaces it once the workspace and player reads return.

/** What the pill reads of a Supabase user: a narrow shape, so a fixture is easy to write. */
export interface SessionUser {
  id?: string | null;
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
  identities?: ReadonlyArray<{ provider: string; identity_data?: Record<string, unknown> | null }> | null;
}

/** What the pill draws: the name it is announced with, and the face beside the label. */
export interface SignedInView {
  name: string;
  face: Face;
}

/** What the pill reads of the player row: its stored hero, unchecked, and their fleet's colour. */
export interface PlayerFace {
  hero: unknown;
  color: string | null;
}

const text = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : null);

/** Their GitHub login: the linked identity's, else what the GitHub provider put in the metadata. */
function loginOf(user: SessionUser): string | null {
  const d = user.identities?.find((i) => i.provider === 'github')?.identity_data ?? null;
  const m = user.user_metadata ?? {};
  return text(d?.user_name) ?? text(d?.preferred_username) ?? text(m.user_name) ?? text(m.preferred_username);
}

/**
 * The pill for the session's user, or null when nobody is signed in. `player` is their player row in
 * their workspace: null before it is read, when they have none, or when its read failed.
 */
export function signedIn(user: SessionUser | null, player: PlayerFace | null = null): SignedInView | null {
  if (!user) return null;
  const m = user.user_metadata ?? {};
  const name = text(m.full_name) ?? text(m.name) ?? loginOf(user) ?? 'you';
  // No login: a person without a photo gets their initial, never the login's public photo.
  return { name, face: faceOf({ name, login: null, avatarUrl: text(m.avatar_url), hero: player?.hero, color: player?.color }) };
}
