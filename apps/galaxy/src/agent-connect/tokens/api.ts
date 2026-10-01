import { refuse, reply } from '../../business-api/reply';
import { mcpUrlOf, nameOf, NAME_MAX } from './model';
import { AgentTokenStoreError, type AgentTokenStore } from './store';
import type { MadeToken } from './token';

// Connect an agent's routes (PRD 855 s1), as plain functions of a Request so the route file stays one
// line each. Both act as the signed-in person: the database's functions decide who may.
//
//   POST   /api/agent-tokens {workspace, name}    201 {token, url, listed}: a new link, its token shown
//                                                 this once, galaxy's MCP address, and the link as listed
//   DELETE /api/agent-tokens {workspace, token}   200 {revoked}: the link revoked
//
// The token is drawn here and only its SHA-256 and last four characters reach the database (decision 9).
// Refusals, each `{error}` in plain words: 400 a malformed body, 401 signed out, 403 not a member (or,
// to revoke, not the maker or an owner), 404 a link the workspace does not hold, 422 a name taken or
// malformed, 429 the 21st live link, 500 the database failed.

export const ONLY_MEMBER = 'Only a member of the workspace can make or see its links.';
export const ONLY_MAKER = 'Only the person who made a link, or the workspace’s owner, can revoke it.';
export const TOO_MANY = 'You hold 20 links already: revoke one to make another.';
export const NAME_RULE = `A name: 1 to ${NAME_MAX} characters, on one line.`;
export const GONE = 'That link is no longer here. Reload the page.';
const COULD_NOT = 'The database could not answer. Try again.';

export interface TokenRouteDeps {
  /** The store as the signed-in person, or null when nobody is signed in (or no database). */
  store: () => Promise<Pick<AgentTokenStore, 'make' | 'revoke'> | null>;
  /** Draws a token (makeToken). */
  draw: () => Promise<MadeToken>;
}

const id = (value: unknown) => (typeof value === 'string' && value.length > 0 && value.length <= 64 ? value : null);

async function bodyOf(request: Request): Promise<Record<string, unknown> | null> {
  const sent: unknown = await request.json().catch(() => null);
  return sent && typeof sent === 'object' && !Array.isArray(sent) ? (sent as Record<string, unknown>) : null;
}

/** The origin the request reached galaxy at, as the browser saw it. */
export function originOf(request: Request): string {
  const url = new URL(request.url);
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? url.host;
  const proto = request.headers.get('x-forwarded-proto') ?? url.protocol.replace(/:$/, '');
  return `${proto}://${host}`;
}

/** What a 22023 on a name says: the name taken, or its rule. */
export const nameTaken = (name: string) => `You already have a link named “${name}”. Pick another name.`;

function refusal(error: unknown, what: string, forbidden: string, name = ''): Response {
  if (error instanceof AgentTokenStoreError) {
    if (error.code === '42501') return refuse(403, forbidden);
    if (error.code === '54000') return refuse(429, TOO_MANY);
    if (error.code === 'P0002') return refuse(404, GONE);
    if (error.code === '22023') return refuse(422, error.hint === 'name' && /already/.test(error.reason) ? nameTaken(name) : NAME_RULE);
  }
  console.error(`agent-tokens: ${what} failed (${error instanceof Error ? error.message : String(error)})`);
  return refuse(500, COULD_NOT);
}

export async function makeTokenRoute(request: Request, deps: TokenRouteDeps): Promise<Response> {
  const store = await deps.store();
  if (!store) return refuse(401, 'Sign in first.');
  const body = await bodyOf(request);
  const workspace = id(body?.workspace);
  if (!workspace) return refuse(400, 'Send the workspace and the link’s name.');
  const name = nameOf(body?.name);
  if (!name) return refuse(422, NAME_RULE);
  const made = await deps.draw();
  try {
    const listed = await store.make(workspace, name, made.hash, made.lastFour);
    return reply(201, { token: made.token, url: mcpUrlOf(originOf(request)), listed });
  } catch (error) {
    return refusal(error, 'making a link', ONLY_MEMBER, name);
  }
}

export async function revokeTokenRoute(request: Request, deps: Pick<TokenRouteDeps, 'store'>): Promise<Response> {
  const store = await deps.store();
  if (!store) return refuse(401, 'Sign in first.');
  const body = await bodyOf(request);
  const workspace = id(body?.workspace);
  const token = id(body?.token);
  if (!workspace || !token) return refuse(400, 'Send the workspace and the link to revoke.');
  try {
    return reply(200, { revoked: await store.revoke(workspace, token) });
  } catch (error) {
    return refusal(error, 'revoking a link', ONLY_MAKER);
  }
}
