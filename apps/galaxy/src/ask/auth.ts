// Who is calling the ask API. Every call carries `Authorization: Bearer <access token>`: the
// Supabase access token `omni signin` got for the person. The Auth server checks the token (it is
// asked, not merely decoded, so a signed-out or deleted account is refused at once), and the account
// must be crew: a @vertuoza.com address, as public.is_crew() says, which every ask policy checks
// again. Asking needs no player row and no GitHub link.

export type AskCaller = { id: string; email: string; token: string };

export type AskAuth =
  | { ok: true; caller: AskCaller }
  | { ok: false; status: 401 | 403 | 503; error: string };

/** The one thing this module asks of a Supabase client: the Auth server's verdict on a token. */
export type TokenCheck = {
  auth: {
    getUser(jwt: string): Promise<{ data: { user: { id: string; email?: string | null } | null }; error: unknown }>;
  };
};

/** The token of an `Authorization: Bearer <token>` header, or null for anything else. */
export function bearerToken(header: string | null | undefined): string | null {
  const match = /^Bearer +(\S+)$/i.exec((header ?? '').trim());
  return match ? match[1] : null;
}

/** Only @vertuoza.com accounts are crew; the database says the same (public.is_crew()). */
export const isCrewEmail = (email: string | null | undefined) => Boolean(email && email.toLowerCase().endsWith('@vertuoza.com'));

/** A failure of the Auth server itself (unreachable: status 0, or 5xx), not a verdict on the token. */
function authDown(error: unknown) {
  const status = (error as { status?: unknown } | null)?.status;
  return typeof status === 'number' && (status === 0 || status >= 500);
}

/** The crew account behind an Authorization header, or why it is refused: 401 for no valid token,
 * 403 for an account outside the crew, 503 when the Auth server cannot say. `connect` builds a
 * client acting as that token. */
export async function authenticate(header: string | null, connect: (token: string) => TokenCheck): Promise<AskAuth> {
  const token = bearerToken(header);
  if (!token) return { ok: false, status: 401, error: 'Sign in first: this call needs an Authorization: Bearer token.' };
  const { data, error } = await connect(token).auth.getUser(token);
  if (authDown(error)) return { ok: false, status: 503, error: 'The sign-in service could not be reached. Try again.' };
  const user = data?.user;
  if (error || !user) return { ok: false, status: 401, error: 'This sign-in is not valid any more. Sign in again.' };
  if (!isCrewEmail(user.email)) return { ok: false, status: 403, error: 'Ask mode is for @vertuoza.com accounts only.' };
  return { ok: true, caller: { id: user.id, email: user.email!, token } };
}
