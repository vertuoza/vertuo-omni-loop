import { faceOf, type Face } from '../people/face';

// Who is signed in, on HOME (PRD 1006): the pure decision of what the signed-in pill draws, in place
// of SIGN UP WITH GITHUB, beside CONTINUE YOUR GAME. HOME stays static: Controls reads the session in
// the browser (session-read.ts), calls this, and only draws what it returns. The face follows the app
// bar's order (src/nav/UserMenu.tsx), drawn by faceOf as every person's face is: the GitHub photo,
// else the initial of the name, then of the login. The session alone decides it, so it is drawn at
// once.

/** What the pill reads of a Supabase user: a narrow shape, so a fixture is easy to write. */
export interface SessionUser {
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
  identities?: ReadonlyArray<{ provider: string; identity_data?: Record<string, unknown> | null }> | null;
}

/** What the pill draws: the name it is announced with, and the face beside the label. */
export interface SignedInView {
  name: string;
  face: Face;
}

const text = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : null);

/** Their GitHub login: the linked identity's, else what the GitHub provider put in the metadata. */
function loginOf(user: SessionUser): string | null {
  const d = user.identities?.find((i) => i.provider === 'github')?.identity_data ?? null;
  const m = user.user_metadata ?? {};
  return text(d?.user_name) ?? text(d?.preferred_username) ?? text(m.user_name) ?? text(m.preferred_username);
}

/** The pill for the session's user, or null when nobody is signed in. */
export function signedIn(user: SessionUser | null): SignedInView | null {
  if (!user) return null;
  const m = user.user_metadata ?? {};
  const name = text(m.full_name) ?? text(m.name) ?? loginOf(user) ?? 'you';
  // No login: a person without a photo gets their initial, never the login's public photo.
  return { name, face: faceOf({ name, login: null, avatarUrl: text(m.avatar_url) }) };
}
