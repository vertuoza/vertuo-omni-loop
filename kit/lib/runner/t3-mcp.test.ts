// The runner's sign-in to T3's MCP endpoint and the stop of a running thread through it (PRD 2537, s4),
// against a fake T3 (an injected `fetch` and `exec`) replaying `fixtures/t3/`: the OAuth exchanges of
// T3 0.1.3 (`/oauth/mcp/register`, `/decision` with a pairing code, `/token`), the pairing code
// `t3 auth pairing create --json` prints, and the MCP answers to `initialize` and to
// `t3_thread_interrupt`, sent as server-sent events as T3 sends them. Built from T3 0.1.3's source
// (`apps/server/src/auth/McpOAuth.ts`, `mcpOAuthHttp.ts`, `cli/auth.ts`): the laptop trial recorded no
// sign-in. No test reaches a real T3.
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { field } from '../ask/schema.ts';
import type { ExecText } from '../context.ts';
import { readT3Credential, T3_SIGN_IN_MISSING, t3CredentialFile, t3Interrupt, t3SignIn, t3SignInNote } from './t3-mcp.ts';

const FIXTURES = join(import.meta.dirname, 'fixtures', 't3');
const fixture = (name: string): string => readFileSync(join(FIXTURES, name), 'utf8');
const ORIGIN = 'http://127.0.0.1:3799';
const NOW = Date.parse('2026-10-27T14:00:00.000Z');
const THREAD = 'mcp:fabd03d6-4537-4cfb-9d39-cc065784f406';

type Call = { url: string; method: string; headers: Record<string, string>; body: string };

/** A fake T3 answering each path with `answers[path]`, its calls kept. */
function fakeT3(answers: Record<string, (call: Call) => Response>) {
  const calls: Call[] = [];
  const fetch = (url: string, init: RequestInit): Promise<Response> => {
    const headers: Record<string, string> = {};
    new Headers(init.headers).forEach((value, key) => {
      headers[key] = value;
    });
    const call = { url, method: init.method ?? 'GET', headers, body: typeof init.body === 'string' ? init.body : '' };
    calls.push(call);
    const answer = answers[new URL(url).pathname];
    return Promise.resolve(answer === undefined ? new Response('not found', { status: 404 }) : answer(call));
  };
  return { fetch, calls };
}

const json = (value: unknown, status = 200): Response => new Response(typeof value === 'string' ? value : JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } });
const sse = (text: string, session?: string): Response => new Response(text, { status: 200, headers: { 'content-type': 'text/event-stream', ...(session === undefined ? {} : { 'mcp-session-id': session }) } });

/** The fake `t3 auth pairing create --json`, its arguments kept. */
function pairing(output = fixture('pairing-create.json')) {
  const asked: string[][] = [];
  const exec: ExecText = (file, args) => {
    asked.push([file, ...args]);
    return output;
  };
  return { exec, asked };
}

/** A T3 that signs a client in when the pairing code and PKCE hold. */
function signingT3({ decision }: { decision?: (call: Call) => Response } = {}) {
  let challenge = '';
  return fakeT3({
    '/oauth/mcp/register': () => json(fixture('oauth-register.json'), 201),
    '/oauth/mcp/decision': decision ?? ((call) => {
      const authorization = field(JSON.parse(call.body), 'authorization');
      challenge = String(field(authorization, 'code_challenge'));
      return json({ redirectTo: `http://127.0.0.1/omni-runner/t3-callback?code=code-1&state=${String(field(authorization, 'state'))}&iss=${encodeURIComponent(ORIGIN)}` });
    }),
    '/oauth/mcp/token': (call) => {
      const form = new URLSearchParams(call.body);
      const verifier = form.get('code_verifier') ?? '';
      const ok = form.get('code') === 'code-1' && createHash('sha256').update(verifier).digest('base64url') === challenge;
      return ok ? json(fixture('oauth-token.json')) : json({ error: 'invalid_grant', error_description: 'The authorization code is invalid or expired.' }, 400);
    },
  });
}

const homeDir = (): string => mkdtempSync(join(tmpdir(), 'omni-t3-mcp-'));

describe('omni runner t3-signin', () => {
  it('registers the runner, approves Full access with a pairing code made on this machine, and keeps the credential for its user only', async () => {
    const home = homeDir();
    const t3 = signingT3();
    const code = pairing();
    expect(await t3SignIn({ home, origin: ORIGIN, exec: code.exec, fetch: t3.fetch, now: () => NOW })).toEqual({ expiresAt: '2026-11-26T14:00:00.000Z' });
    expect(code.asked).toEqual([['t3', 'auth', 'pairing', 'create', '--json', '--ttl', '5m', '--label', 'omni runner t3-signin']]);
    const [register, decision, token] = t3.calls;
    expect(register?.url).toBe(`${ORIGIN}/oauth/mcp/register`);
    expect(JSON.parse(register?.body ?? '')).toEqual({ client_name: 'Omni runner', redirect_uris: ['http://127.0.0.1/omni-runner/t3-callback'] });
    expect(JSON.parse(decision?.body ?? '')).toMatchObject({
      authorization: { response_type: 'code', code_challenge_method: 'S256', redirect_uri: 'http://127.0.0.1/omni-runner/t3-callback', resource: `${ORIGIN}/mcp` },
      decision: { _tag: 'pairing-code', access: 'full-access', code: 'FIXTUREPAIR1' },
    });
    expect(token?.headers['content-type']).toBe('application/x-www-form-urlencoded');
    expect(Object.fromEntries(new URLSearchParams(token?.body ?? ''))).toMatchObject({ grant_type: 'authorization_code', code: 'code-1', resource: `${ORIGIN}/mcp` });
    const file = t3CredentialFile(home);
    expect(statSync(file).mode & 0o777).toBe(0o600);
    expect(JSON.parse(readFileSync(file, 'utf8'))).toEqual({ origin: ORIGIN, token: 't3-fixture-access-token', expiresAt: '2026-11-26T14:00:00.000Z', signedInAt: '2026-10-27T14:00:00.000Z' });
    expect(readT3Credential(home, () => NOW)).toEqual({ origin: ORIGIN, token: 't3-fixture-access-token', expiresAt: '2026-11-26T14:00:00.000Z' });
  });

  it('says why when T3 refuses the pairing code, and keeps nothing', async () => {
    const home = homeDir();
    const t3 = signingT3({ decision: () => json({ _tag: 'AuthMcpApprovalError', message: 'That code is unknown or was already used.' }, 400) });
    expect(await t3SignIn({ home, origin: ORIGIN, exec: pairing().exec, fetch: t3.fetch, now: () => NOW })).toEqual({ refused: 'T3 refused the sign-in: That code is unknown or was already used.' });
    expect(readT3Credential(home, () => NOW)).toBeNull();
  });

  it('says why when T3 sends the sign-in back with an error, or the code back on another state', async () => {
    const denied = signingT3({ decision: () => json({ redirectTo: 'http://127.0.0.1/omni-runner/t3-callback?error=access_denied' }) });
    expect(await t3SignIn({ home: homeDir(), origin: ORIGIN, exec: pairing().exec, fetch: denied.fetch, now: () => NOW })).toEqual({ refused: 'T3 refused the sign-in: access_denied' });
    const forged = signingT3({ decision: () => json({ redirectTo: 'http://127.0.0.1/omni-runner/t3-callback?code=code-1&state=other' }) });
    expect(await t3SignIn({ home: homeDir(), origin: ORIGIN, exec: pairing().exec, fetch: forged.fetch, now: () => NOW })).toEqual({ refused: 'T3 sent the sign-in back for another request' });
  });

  it('says why when the pairing code cannot be made, or T3 cannot be reached', async () => {
    const failing: ExecText = () => {
      throw new Error('t3: not found');
    };
    expect(await t3SignIn({ home: homeDir(), origin: ORIGIN, exec: failing, fetch: signingT3().fetch, now: () => NOW })).toEqual({ refused: 't3 auth pairing create did not give a pairing code' });
    expect(await t3SignIn({ home: homeDir(), origin: ORIGIN, exec: pairing('not json').exec, fetch: signingT3().fetch, now: () => NOW })).toEqual({ refused: 't3 auth pairing create did not give a pairing code' });
    const unreachable = (): Promise<Response> => Promise.reject(new Error('connect ECONNREFUSED'));
    expect(await t3SignIn({ home: homeDir(), origin: ORIGIN, exec: pairing().exec, fetch: unreachable, now: () => NOW })).toEqual({ refused: `T3 cannot be reached at ${ORIGIN}` });
  });
});

describe('the credential', () => {
  const keep = (home: string, value: unknown): void => {
    mkdirSync(join(home, '.config', 'omni'), { recursive: true });
    writeFileSync(t3CredentialFile(home), typeof value === 'string' ? value : JSON.stringify(value));
  };

  it('is none when missing, expired, or not one: the account then reads the sign-in as missing', () => {
    const home = homeDir();
    expect(readT3Credential(home, () => NOW)).toBeNull();
    expect(t3SignInNote(home, () => NOW)).toBe(T3_SIGN_IN_MISSING);
    keep(home, { origin: ORIGIN, token: 'tok', expiresAt: '2026-10-27T13:59:59.000Z' });
    expect(readT3Credential(home, () => NOW)).toBeNull();
    keep(home, 'not json');
    expect(readT3Credential(home, () => NOW)).toBeNull();
    keep(home, { origin: ORIGIN, expiresAt: '2026-11-26T14:00:00.000Z' });
    expect(readT3Credential(home, () => NOW)).toBeNull();
  });

  it('is kept until it expires, and then the account says so', () => {
    const home = homeDir();
    keep(home, { origin: ORIGIN, token: 'tok', expiresAt: '2026-11-26T14:00:00.000Z' });
    expect(t3SignInNote(home, () => NOW)).toBeNull();
    expect(t3SignInNote(home, () => Date.parse('2026-11-26T14:00:00.000Z'))).toBe(T3_SIGN_IN_MISSING);
  });
});

describe("stopping a thread through T3's MCP endpoint", () => {
  it('opens a session, then calls t3_thread_interrupt on it with the credential', async () => {
    const t3 = fakeT3({
      '/mcp': (call) => {
        const method = field(JSON.parse(call.body), 'method');
        if (method === 'initialize') return sse(fixture('mcp-initialize.sse'), 'session-1');
        if (method === 'notifications/initialized') return new Response(null, { status: 202 });
        return sse(fixture('mcp-interrupt.sse'));
      },
    });
    expect(await t3Interrupt({ origin: ORIGIN, token: 'tok', threadId: THREAD, fetch: t3.fetch })).toEqual({ status: 'interrupt_requested' });
    expect(t3.calls.map((call) => call.url)).toEqual([`${ORIGIN}/mcp`, `${ORIGIN}/mcp`, `${ORIGIN}/mcp`]);
    expect(t3.calls.every((call) => call.headers.authorization === 'Bearer tok')).toBe(true);
    const last = t3.calls.at(-1);
    expect(last?.headers['mcp-session-id']).toBe('session-1');
    expect(JSON.parse(last?.body ?? '')).toMatchObject({ method: 'tools/call', params: { name: 't3_thread_interrupt', arguments: { threadId: THREAD } } });
  });

  it('says why when T3 refuses the call, refuses the credential, or cannot be reached', async () => {
    const refusing = fakeT3({ '/mcp': (call) => (call.body.includes('"initialize"') ? sse(fixture('mcp-initialize.sse'), 's') : sse(fixture('mcp-refused.sse'))) });
    expect(await t3Interrupt({ origin: ORIGIN, token: 'tok', threadId: THREAD, fetch: refusing.fetch })).toEqual({ refused: 'Your access does not allow t3_thread_interrupt.' });
    const expired = fakeT3({ '/mcp': () => json({ error: 'invalid_token' }, 401) });
    expect(await t3Interrupt({ origin: ORIGIN, token: 'tok', threadId: THREAD, fetch: expired.fetch })).toEqual({ refused: 'T3 refused the credential (401): run omni runner t3-signin again' });
    const unreachable = (): Promise<Response> => Promise.reject(new Error('connect ECONNREFUSED'));
    expect(await t3Interrupt({ origin: ORIGIN, token: 'tok', threadId: THREAD, fetch: unreachable })).toEqual({ refused: `T3 cannot be reached at ${ORIGIN}` });
  });

  it('reads an answer sent as plain JSON too', async () => {
    const plain = fakeT3({
      '/mcp': (call) => (call.body.includes('"initialize"')
        ? json({ jsonrpc: '2.0', id: 1, result: {} })
        : json({ jsonrpc: '2.0', id: 2, result: { structuredContent: { threadId: THREAD, runId: null, status: 'no_active_run' } } })),
    });
    expect(await t3Interrupt({ origin: ORIGIN, token: 'tok', threadId: THREAD, fetch: plain.fetch })).toEqual({ status: 'no_active_run' });
  });
});
