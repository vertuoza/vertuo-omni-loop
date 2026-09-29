// Who is calling the ask API. Every call carries `Authorization: Bearer <access token>`: the
// Supabase access token `omni signin` got for the person. The Auth server checks the token (it is
// asked, not merely decoded, so a signed-out or deleted account is refused at once). Any signed-in
// account is let through, whatever its address, or none: what it may do is the database's call, by
// workspace membership (PRD 459), and a refusal carries the database's reason. Asking needs no player
// row and no GitHub link.

export type AskCaller = { id: string; email: string | null; token: string };

export type AskAuth =
  | { ok: true; caller: AskCaller }
  | { ok: false; status: 401 | 503; error: string };

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

/** Where the caller reached this app, behind Vercel's proxy too: the links an API hands back
 * (the ask page's, a dossier's) must use it. */
export function callerOrigin(request: Request): string {
  const url = new URL(request.url);
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? url.host;
  const proto = request.headers.get('x-forwarded-proto') ?? url.protocol.replace(':', '');
  return `${proto}://${host}`;
}

/** How the database's refusal for a repository no workspace owns ends (repo_workspace(), PRD 459). */
const INSTALL_HINT = 'install the Omni App';

/** The database's reason, with the App's install link after its install hint: the link is this
 * deployment's (GITHUB_APP_SLUG), not the database's. Any other reason, or no link, stays as it is. */
export function withInstallLink(reason: string, link: string | null | undefined): string {
  return link && reason.endsWith(INSTALL_HINT) ? `${reason}: ${link}` : reason;
}

/** A failure of the Auth server itself (unreachable: status 0, or 5xx), not a verdict on the token. */
function authDown(error: unknown) {
  const status = (error as { status?: unknown } | null)?.status;
  return typeof status === 'number' && (status === 0 || status >= 500);
}

/** The account behind an Authorization header, or why it is refused: 401 for no valid token, 503
 * when the Auth server cannot say. `connect` builds a client acting as that token. */
export async function authenticate(header: string | null, connect: (token: string) => TokenCheck): Promise<AskAuth> {
  const token = bearerToken(header);
  if (!token) return { ok: false, status: 401, error: 'Sign in first: this call needs an Authorization: Bearer token.' };
  const { data, error } = await connect(token).auth.getUser(token);
  if (authDown(error)) return { ok: false, status: 503, error: 'The sign-in service could not be reached. Try again.' };
  const user = data?.user;
  if (error || !user) return { ok: false, status: 401, error: 'This sign-in is not valid any more. Sign in again.' };
  return { ok: true, caller: { id: user.id, email: user.email ?? null, token } };
}
