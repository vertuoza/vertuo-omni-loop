// @ts-nocheck
// The signed-in browser `/omni:prove` films with, made from the person's `omni signin` (PRD 798's
// `proof.setup`): the app signs in through Supabase, and so does the CLI, so the CLI's access token is
// written as the app's own auth cookie in a Playwright storageState. No browser login is needed, which
// Google refuses inside any browser Playwright drives.
//
// The cookie is the one @supabase/ssr writes: `sb-<project ref>-auth-token`, its value `base64-` and
// the session as base64url JSON, split into `.0`, `.1`… past 3180 characters. It carries the access
// token only: with an empty refresh token the browser can never rotate, and so never sign out, the
// CLI's own sign-in. The session ends with the access token, an hour after `omni signin` renewed it.

/** The longest value @supabase/ssr puts in one cookie before it splits the session. */
const CHUNK = 3180;

export class SessionRefused extends Error {}

/** The claims of a JWT, or null when `token` is not one. */
function claimsOf(token) {
  const parts = typeof token === 'string' ? token.split('.') : [];
  if (parts.length !== 3) return null;
  try {
    return JSON.parse(Buffer.from(parts[1], 'base64url').toString());
  } catch {
    return null;
  }
}

/** The Supabase project ref an access token was issued by, or null. */
function projectRef(claims) {
  try {
    const { hostname, pathname } = new URL(claims.iss);
    return pathname.startsWith('/auth/v1') ? hostname.split('.')[0] : null;
  } catch {
    return null;
  }
}

/** The session @supabase/ssr keeps, holding `token` and no refresh token. */
function sessionOf(token, claims, nowSeconds) {
  const user = { id: claims.sub, aud: claims.aud, role: claims.role, email: claims.email, app_metadata: claims.app_metadata ?? {}, user_metadata: claims.user_metadata ?? {} };
  return { access_token: token, refresh_token: '', token_type: 'bearer', expires_at: claims.exp, expires_in: claims.exp - nowSeconds, user };
}

/** The cookies the session is written as, split as @supabase/ssr splits them. */
function cookiesOf(name, value, host, expires) {
  const chunks = [];
  for (let at = 0; at < value.length; at += CHUNK) chunks.push(value.slice(at, at + CHUNK));
  return chunks.map((chunk, index) => ({
    name: chunks.length > 1 ? `${name}.${index}` : name,
    value: chunk,
    domain: host,
    path: '/',
    expires,
    httpOnly: false,
    secure: true,
    sameSite: 'Lax',
  }));
}

/**
 * @param {string} accessToken the `omni signin` access token
 * @param {{ host: string, now?: number }} options the app's host, and the time now in milliseconds
 * @returns {{ state: { cookies: object[], origins: [] }, email: string | undefined, expiresAt: number }}
 */
export function storageState(accessToken, { host, now = Date.now() }) {
  const claims = claimsOf(accessToken);
  const ref = claims && projectRef(claims);
  if (!ref) throw new SessionRefused('the sign-in is not a Supabase session');
  const nowSeconds = Math.floor(now / 1000);
  if (!(claims.exp > nowSeconds)) throw new SessionRefused('the sign-in has expired');
  const value = `base64-${Buffer.from(JSON.stringify(sessionOf(accessToken, claims, nowSeconds))).toString('base64url')}`;
  return { state: { cookies: cookiesOf(`sb-${ref}-auth-token`, value, host, claims.exp), origins: [] }, email: claims.email, expiresAt: claims.exp };
}
