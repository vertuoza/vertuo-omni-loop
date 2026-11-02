// The runner's way to stop a T3 run (PRD 2537, s4, "Its MCP endpoint, to stop"): T3's command line can
// start and follow a thread, never stop one; stopping (`t3_thread_interrupt`) is open only to an MCP
// client signed in to T3, as T3's own outside agents are.
//
// `omni runner t3-signin` signs the runner in once per machine, the way T3 0.1.x signs any outside agent
// in, with no browser: it registers the runner as an OAuth client (`POST /oauth/mcp/register`), makes a
// pairing code itself on the same machine (`t3 auth pairing create --json`), approves Full access with
// it (`POST /oauth/mcp/decision`, PKCE S256), and trades the code for a bearer credential
// (`POST /oauth/mcp/token`). T3 issues it for 30 days; it is kept in `~/.config/omni/t3-mcp.json`,
// readable by its user only, and never printed. Without it, or once it expired, a T3 account hands
// off at its wall only, and says so: `T3 sign-in missing: planned handoffs off`.
//
// A stop opens an MCP session on `<origin>/mcp` (`initialize`, then `notifications/initialized`) and
// calls `t3_thread_interrupt` on it. T3 answers in server-sent events or in plain JSON; both are read.
import { createHash, randomBytes } from 'node:crypto';
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { Fetch } from '../ask/client.ts';
import { field } from '../ask/schema.ts';
import type { ExecText } from '../context.ts';

/** What a T3 account reads when the runner holds no sign-in to T3's MCP endpoint. */
export const T3_SIGN_IN_MISSING = 'T3 sign-in missing: planned handoffs off';

/** The runner's sign-in to T3's MCP endpoint: the origin it was given at, the bearer credential, and when it expires. */
export type T3Credential = { origin: string; token: string; expiresAt: string };

/** Where the credential is kept: `~/.config/omni/t3-mcp.json`. */
export const t3CredentialFile = (home: string): string => join(home, '.config', 'omni', 't3-mcp.json');

/** The address T3 sends the approval back to: never served, only read back from T3's answer. */
const REDIRECT_URI = 'http://127.0.0.1/omni-runner/t3-callback';
const CLIENT_NAME = 'Omni runner';
const PAIRING_TTL = '5m';
const PAIRING_LABEL = 'omni runner t3-signin';
const MCP_PROTOCOL = '2025-06-18';
const INTERRUPT_REASON = 'omni runner: a planned handoff';

const textOf = (value: unknown): string => (typeof value === 'string' ? value : '');

/** The credential kept under `home`, or `null` when there is none, it does not read, or it expired. */
export function readT3Credential(home: string, now: () => number = Date.now): T3Credential | null {
  let kept: unknown;
  try {
    kept = JSON.parse(readFileSync(t3CredentialFile(home), 'utf8'));
  } catch {
    return null;
  }
  const origin = textOf(field(kept, 'origin'));
  const token = textOf(field(kept, 'token'));
  const expiresAt = textOf(field(kept, 'expiresAt'));
  const expires = Date.parse(expiresAt);
  if (origin === '' || token === '' || Number.isNaN(expires) || expires <= now()) return null;
  return { origin, token, expiresAt };
}

/** What a T3 account says of its planned handoffs: `null` while the runner is signed in to T3, else why they are off. */
export function t3SignInNote(home: string, now: () => number = Date.now): string | null {
  return readT3Credential(home, now) === null ? T3_SIGN_IN_MISSING : null;
}

/** A call to T3 that did not go through, in one line. */
class T3Refused extends Error {}

/** `fetch(url, init)`, or the line saying T3 cannot be reached. */
async function reach(fetch: Fetch, origin: string, url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch {
    throw new T3Refused(`T3 cannot be reached at ${origin}`);
  }
}

/** A response's JSON body, `undefined` when it has none that parses. */
async function bodyOf(response: Response): Promise<unknown> {
  const text = await response.text();
  try {
    const value: unknown = JSON.parse(text);
    return value;
  } catch {
    return undefined;
  }
}

/** The pairing code `t3 auth pairing create --json` makes on this machine. */
function pairingCode(exec: ExecText): string {
  let printed: string;
  try {
    printed = exec('t3', ['auth', 'pairing', 'create', '--json', '--ttl', PAIRING_TTL, '--label', PAIRING_LABEL], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 30_000 });
  } catch {
    printed = '';
  }
  let credential = '';
  try {
    credential = textOf(field(JSON.parse(printed), 'credential'));
  } catch {
    credential = '';
  }
  if (credential === '') throw new T3Refused('t3 auth pairing create did not give a pairing code');
  return credential;
}

/** The client id T3 registers the runner under. */
async function register(fetch: Fetch, origin: string): Promise<string> {
  const response = await reach(fetch, origin, `${origin}/oauth/mcp/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ client_name: CLIENT_NAME, redirect_uris: [REDIRECT_URI] }),
  });
  const clientId = textOf(field(await bodyOf(response), 'client_id'));
  if (!response.ok || clientId === '') throw new T3Refused(`T3 refused to register the runner (${String(response.status)})`);
  return clientId;
}

/** The authorization code T3 gives for Full access, approved with `code`, the request checked by its `state`. */
async function approve(fetch: Fetch, origin: string, authorization: Record<string, string>, code: string): Promise<string> {
  const response = await reach(fetch, origin, `${origin}/oauth/mcp/decision`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ authorization, decision: { _tag: 'pairing-code', access: 'full-access', code } }),
  });
  const body = await bodyOf(response);
  if (!response.ok) throw new T3Refused(`T3 refused the sign-in: ${textOf(field(body, 'message')) || String(response.status)}`);
  let back: URL;
  try {
    back = new URL(textOf(field(body, 'redirectTo')));
  } catch {
    throw new T3Refused('T3 answered the sign-in with no address');
  }
  const error = back.searchParams.get('error');
  if (error !== null) throw new T3Refused(`T3 refused the sign-in: ${error}`);
  const given = back.searchParams.get('code');
  if (given === null || back.searchParams.get('state') !== authorization.state) throw new T3Refused('T3 sent the sign-in back for another request');
  return given;
}

/** The bearer credential and its lifetime in seconds, for the authorization code `code`. */
async function exchange(fetch: Fetch, origin: string, form: Record<string, string>): Promise<{ token: string; seconds: number }> {
  const response = await reach(fetch, origin, `${origin}/oauth/mcp/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(form).toString(),
  });
  const body = await bodyOf(response);
  const token = textOf(field(body, 'access_token'));
  const seconds = field(body, 'expires_in');
  if (!response.ok || token === '' || typeof seconds !== 'number') throw new T3Refused(`T3 refused the sign-in: ${textOf(field(body, 'error_description')) || String(response.status)}`);
  return { token, seconds };
}

/** Keeps the credential under `home`, readable by its user only. */
function keep(home: string, kept: T3Credential & { signedInAt: string }): void {
  const file = t3CredentialFile(home);
  mkdirSync(dirname(file), { recursive: true, mode: 0o700 });
  writeFileSync(file, `${JSON.stringify(kept, null, 2)}\n`, { mode: 0o600 });
  chmodSync(file, 0o600);
}

/**
 * Signs the runner in to the T3 server at `origin` with Full access, and keeps the credential under
 * `home`. Answers when the credential expires, or the one line saying why T3 refused.
 */
export async function t3SignIn({ home, origin, exec, fetch, now = Date.now }: {
  home: string;
  origin: string;
  exec: ExecText;
  fetch: Fetch;
  now?: () => number;
}): Promise<{ expiresAt: string } | { refused: string }> {
  try {
    const clientId = await register(fetch, origin);
    const verifier = randomBytes(32).toString('base64url');
    const resource = `${origin}/mcp`;
    const authorization = {
      response_type: 'code',
      client_id: clientId,
      redirect_uri: REDIRECT_URI,
      code_challenge: createHash('sha256').update(verifier).digest('base64url'),
      code_challenge_method: 'S256',
      state: randomBytes(16).toString('base64url'),
      resource,
    };
    const code = await approve(fetch, origin, authorization, pairingCode(exec));
    const { token, seconds } = await exchange(fetch, origin, { grant_type: 'authorization_code', code, redirect_uri: REDIRECT_URI, client_id: clientId, code_verifier: verifier, resource });
    const at = now();
    const expiresAt = new Date(at + seconds * 1000).toISOString();
    keep(home, { origin, token, expiresAt, signedInAt: new Date(at).toISOString() });
    return { expiresAt };
  } catch (error) {
    if (error instanceof T3Refused) return { refused: error.message };
    throw error;
  }
}

/** The JSON-RPC message an MCP answer carries: its last `data:` line as server-sent events, else its body. */
function rpcOf(text: string): unknown {
  const data = text.split('\n').filter((line) => line.startsWith('data:')).at(-1);
  try {
    const value: unknown = JSON.parse(data === undefined ? text : data.slice('data:'.length));
    return value;
  } catch {
    return undefined;
  }
}

/** One MCP call on `<origin>/mcp`: its answer and the session it names. */
async function mcp(fetch: Fetch, origin: string, token: string, session: string | null, message: Record<string, unknown>): Promise<{ rpc: unknown; session: string | null }> {
  const response = await reach(fetch, origin, `${origin}/mcp`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
      authorization: `Bearer ${token}`,
      ...(session === null ? {} : { 'mcp-session-id': session, 'mcp-protocol-version': MCP_PROTOCOL }),
    },
    body: JSON.stringify({ jsonrpc: '2.0', ...message }),
  });
  if (response.status === 401 || response.status === 403) throw new T3Refused(`T3 refused the credential (${String(response.status)}): run omni runner t3-signin again`);
  if (!response.ok) throw new T3Refused(`T3 answered ${String(response.status)}`);
  return { rpc: rpcOf(await response.text()), session: response.headers.get('mcp-session-id') ?? session };
}

/** What a tool call answered: its structured content, or the one line of its failure. */
function toolResult(rpc: unknown): unknown {
  const result = field(rpc, 'result');
  if (result === undefined) throw new T3Refused(textOf(field(field(rpc, 'error'), 'message')) || 'T3 answered no result');
  if (field(result, 'isError') !== true) return field(result, 'structuredContent');
  const content = field(result, 'content');
  const said = Array.isArray(content) ? textOf(field(content.find((part: unknown) => field(part, 'text') !== undefined), 'text')) : '';
  let message = said;
  try {
    message = textOf(field(JSON.parse(said), 'message')) || said;
  } catch {
    // The failure is plain words.
  }
  throw new T3Refused(message || 'T3 refused the call');
}

/** Stops the running thread `threadId` of the T3 server at `origin`: what T3 answered (`interrupt_requested`, `no_active_run`…), or why not. */
export async function t3Interrupt({ origin, token, threadId, fetch }: { origin: string; token: string; threadId: string; fetch: Fetch }): Promise<{ status: string } | { refused: string }> {
  try {
    const opened = await mcp(fetch, origin, token, null, { id: 1, method: 'initialize', params: { protocolVersion: MCP_PROTOCOL, capabilities: {}, clientInfo: { name: 'omni-runner', version: '1' } } });
    await mcp(fetch, origin, token, opened.session, { method: 'notifications/initialized' });
    const called = await mcp(fetch, origin, token, opened.session, { id: 2, method: 'tools/call', params: { name: 't3_thread_interrupt', arguments: { threadId, reason: INTERRUPT_REASON } } });
    return { status: textOf(field(toolResult(called.rpc), 'status')) || 'unknown' };
  } catch (error) {
    if (error instanceof T3Refused) return { refused: error.message };
    throw error;
  }
}
