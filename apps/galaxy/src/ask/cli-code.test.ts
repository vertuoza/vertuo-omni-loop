import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  CODE_TTL_MS,
  cliCallbackPath,
  cliSignInPath,
  cliSignInReturn,
  exchangeToken,
  hashCode,
  loopbackUrl,
  newCode,
  readCliSignIn,
  type CliCallbackDeps,
  type CliSession,
  type TokenClient,
  type TokenDeps,
} from './cli-code';

const ADA = { id: '00000000-0000-4000-8000-0000000000a1', email: 'ada@vertuoza.com' };
const BOB = { id: '00000000-0000-4000-8000-0000000000b1', email: 'bob@vertuoza.com' };
const EVE = { id: '00000000-0000-4000-8000-0000000000e1', email: 'eve@example.com' };
type Account = typeof ADA;

const ORIGIN = 'https://ask.example';
const START = Date.parse('2026-09-26T09:00:00Z');
const STATE = 'Zm9vYmFyYmF6cXV4LXN0YXRlLW9mLXRoZS10ZXJtaW5hbA';
const SIGNIN = { port: 49152, state: STATE };

/**
 * The server's side of the terminal's sign-in, in memory: Google's codes, the sessions Supabase Auth
 * hands out (each refresh token good once, as with rotation), and the code table with its two
 * functions — `issue` as the callback's new sign-in, `redeem` deleting the row it returns.
 */
function world() {
  const clock = { now: START };
  const googleCodes = new Map<string, Account>();
  const refreshTokens = new Map<string, Account>();
  const codes = new Map<string, { owner: string; refresh_token: string; expires_at: string }>();
  const revoked: string[] = [];
  const calls = { exchange: [] as string[], issue: [] as string[], refresh: [] as string[], redeem: [] as string[] };
  let issued = 0;
  const state = { authDown: false, rpcFails: false, issueFails: false };

  function newSession(account: Account): CliSession & { expires_at: number } {
    issued += 1;
    const session = { access_token: `access-${issued}`, refresh_token: `refresh-${issued}`, expires_at: 1790000000 + issued, user: { ...account } };
    refreshTokens.set(session.refresh_token, account);
    return session;
  }

  const client: TokenClient = {
    auth: {
      async refreshSession({ refresh_token }) {
        calls.refresh.push(refresh_token);
        if (state.authDown) return { data: { session: null }, error: { status: 503, message: 'upstream' } };
        const account = refreshTokens.get(refresh_token);
        if (!account) return { data: { session: null }, error: { status: 400, message: 'Invalid Refresh Token: Already Used' } };
        refreshTokens.delete(refresh_token);
        return { data: { session: newSession(account) }, error: null };
      },
    },
    async rpc(fn, args) {
      if (state.rpcFails) return { data: null, error: { message: 'connection reset' } };
      if (fn !== 'ask_cli_code_redeem') return { data: null, error: { message: `no function ${fn}` } };
      const hash = String(args.p_code_hash);
      calls.redeem.push(hash);
      const row = codes.get(hash);
      codes.delete(hash);
      return { data: row ? [row] : [], error: null };
    },
  };

  const callbackDeps: CliCallbackDeps = {
    async exchange(code) {
      calls.exchange.push(code);
      const account = googleCodes.get(code);
      googleCodes.delete(code);
      if (!account) return { session: null, error: { message: 'invalid flow state, no valid flow state found' } };
      return { session: newSession(account), error: null };
    },
    async issue(session, codeHash) {
      calls.issue.push(codeHash);
      if (state.issueFails) return { error: { message: 'permission denied' } };
      codes.set(codeHash, { owner: session.user.id, refresh_token: session.refresh_token, expires_at: new Date(clock.now + CODE_TTL_MS).toISOString() });
      return { error: null };
    },
    async revoke(session) {
      revoked.push(session.access_token);
    },
  };

  const tokenDeps: TokenDeps = {
    connect: () => client,
    now: () => clock.now,
    async revoke(accessToken) {
      revoked.push(accessToken);
    },
  };

  /** Google signs `account` in, and the callback runs: where the browser goes next. */
  async function signIn(account: Account, query = `?next=ask-cli&port=${SIGNIN.port}&state=${STATE}`) {
    const google = `google-${account.id}-${issued}`;
    googleCodes.set(google, account);
    return new URL(await cliSignInReturn(new URL(`${ORIGIN}/auth/callback${query}&code=${google}`), ORIGIN, callbackDeps));
  }

  /** Signs `account` in and returns the one-time code the terminal receives. */
  async function codeFor(account: Account) {
    const back = await signIn(account);
    return back.searchParams.get('code')!;
  }

  const post = (body: unknown, headers: Record<string, string> = {}) =>
    new Request(`${ORIGIN}/api/ask/token`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    });
  const token = async (body: unknown, deps: TokenDeps = tokenDeps) => {
    const response = await exchangeToken(post(body), deps);
    return { status: response.status, headers: response.headers, body: await response.json() };
  };

  return { clock, codes, revoked, calls, state, client, callbackDeps, tokenDeps, signIn, codeFor, newSession, token, post };
}

describe('the link omni signin opens', () => {
  it('carries the loopback port and the terminal\'s state', () => {
    const params = (query: string) => new URLSearchParams(query);
    expect(readCliSignIn(params(`port=49152&state=${STATE}`))).toEqual(SIGNIN);
    expect(readCliSignIn(params(`port=1024&state=${'a'.repeat(16)}`))).toEqual({ port: 1024, state: 'a'.repeat(16) });
    expect(readCliSignIn(params(`port=65535&state=${STATE}`))).toEqual({ port: 65535, state: STATE });
  });

  it('is refused with a port or a state missing, malformed or out of range', () => {
    for (const query of [
      '', `state=${STATE}`, 'port=49152', `port=80&state=${STATE}`, `port=65536&state=${STATE}`, `port=0&state=${STATE}`,
      `port=4e4&state=${STATE}`, `port=+4915&state=${STATE}`, `port=49152&state=short`, `port=49152&state=${'a'.repeat(257)}`,
      `port=49152&state=${encodeURIComponent('with/slash-and-more-than-16')}`, `port=49152&state=${encodeURIComponent('with space and more than 16')}`,
    ]) {
      expect(readCliSignIn(new URLSearchParams(query))).toBeNull();
    }
  });

  it('asks Google to come back through the auth callback\'s ask-cli branch', () => {
    const path = new URL(`${ORIGIN}${cliCallbackPath(SIGNIN)}`);
    expect(path.pathname).toBe('/auth/callback');
    expect(Object.fromEntries(path.searchParams)).toEqual({ next: 'ask-cli', port: '49152', state: STATE });
  });

  it('comes back to the sign-in page with the reason when it fails', () => {
    expect(cliSignInPath(SIGNIN)).toBe(`/ask/signin?port=49152&state=${STATE}`);
    const back = new URL(`${ORIGIN}${cliSignInPath(SIGNIN, 'Not today')}`);
    expect(back.searchParams.get('signin_error')).toBe('Not today');
    expect(back.searchParams.get('state')).toBe(STATE);
  });

  it('hands the code to the loopback address only, never to another host', () => {
    const url = new URL(loopbackUrl(SIGNIN, 'the-code'));
    expect(url.origin).toBe('http://127.0.0.1:49152');
    expect(url.pathname).toBe('/callback');
    expect(Object.fromEntries(url.searchParams)).toEqual({ state: STATE, code: 'the-code' });
  });
});

describe('the one-time code', () => {
  it('is a fresh random value every time, stored as its SHA-256 only', () => {
    const a = newCode();
    const b = newCode();
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(a).not.toBe(b);
    expect(hashCode(a)).toBe(createHash('sha256').update(a).digest('hex'));
    expect(hashCode(a)).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('the auth callback, for omni signin', () => {
  it('turns a crew sign-in into a one-time code sent to the terminal\'s loopback address', async () => {
    const w = world();
    const back = await w.signIn(ADA);
    expect(back.origin).toBe('http://127.0.0.1:49152');
    expect(back.pathname).toBe('/callback');
    expect(back.searchParams.get('state')).toBe(STATE);
    const code = back.searchParams.get('code')!;
    expect(code).toMatch(/^[A-Za-z0-9_-]{43}$/);
    // Stored hashed, bound to the account, for two minutes, with the terminal's own refresh token.
    expect([...w.codes.keys()]).toEqual([hashCode(code)]);
    expect(w.codes.get(hashCode(code))).toEqual({ owner: ADA.id, refresh_token: 'refresh-1', expires_at: new Date(START + CODE_TTL_MS).toISOString() });
    expect(w.revoked).toEqual([]);
  });

  it('turns any account\'s sign-in into a code, whatever its address: no domain is refused (PRD 459)', async () => {
    const w = world();
    const back = await w.signIn(EVE);
    expect(back.origin).toBe('http://127.0.0.1:49152');
    const code = back.searchParams.get('code')!;
    expect([...w.codes.keys()]).toEqual([hashCode(code)]);
    expect(w.codes.get(hashCode(code))?.owner).toBe(EVE.id);
    expect(w.revoked).toEqual([]);
  });

  it('comes back to the sign-in page with Google\'s or Supabase\'s reason, exchanging nothing', async () => {
    const w = world();
    const url = new URL(`${ORIGIN}/auth/callback?next=ask-cli&port=49152&state=${STATE}&error=access_denied&error_description=OMNI+LOOP+is+for+%40vertuoza.com+accounts+only.`);
    const back = new URL(await cliSignInReturn(url, ORIGIN, w.callbackDeps));
    expect(back.pathname).toBe('/ask/signin');
    expect(back.searchParams.get('signin_error')).toBe('OMNI LOOP is for @vertuoza.com accounts only.');
    expect(w.calls.exchange).toEqual([]);
  });

  it('says so on the sign-in page when Google\'s code cannot be exchanged, or when there is no database', async () => {
    const w = world();
    const stale = new URL(`${ORIGIN}/auth/callback?next=ask-cli&port=49152&state=${STATE}&code=stale`);
    const back = new URL(await cliSignInReturn(stale, ORIGIN, w.callbackDeps));
    expect(back.pathname).toBe('/ask/signin');
    expect(back.searchParams.get('signin_error')).toMatch(/could not be finished/);
    const none = new URL(await cliSignInReturn(stale, ORIGIN, { ...w.callbackDeps, exchange: null }));
    expect(none.pathname).toBe('/ask/signin');
    expect(none.searchParams.get('signin_error')).toMatch(/could not be finished/);
    expect(w.calls.issue).toEqual([]);
  });

  it('ends the new sign-in and says so when the code cannot be stored', async () => {
    const w = world();
    w.state.issueFails = true;
    const back = await w.signIn(ADA);
    expect(back.origin).toBe(ORIGIN);
    expect(back.searchParams.get('signin_error')).toMatch(/omni signin/);
    expect(w.revoked).toEqual(['access-1']);
  });

  it('never sends anything anywhere without a valid port and state', async () => {
    const w = world();
    for (const query of ['?next=ask-cli', `?next=ask-cli&port=80&state=${STATE}`, '?next=ask-cli&port=49152&state=x']) {
      const back = await w.signIn(ADA, query);
      expect(back.origin).toBe(ORIGIN);
      expect(back.pathname).toBe('/ask/signin');
      expect(back.searchParams.has('code')).toBe(false);
    }
    expect(w.calls.exchange).toEqual([]);
  });
});

describe('POST /api/ask/token', () => {
  it('trades a code for the account\'s own sign-in: {access_token, refresh_token, expires_at, email}', async () => {
    const w = world();
    const code = await w.codeFor(ADA);
    const reply = await w.token({ code });
    expect(reply.status).toBe(200);
    expect(reply.headers.get('cache-control')).toBe('no-store');
    expect(reply.body).toEqual({ access_token: 'access-2', refresh_token: 'refresh-2', expires_at: 1790000002, email: ADA.email });
    // The code's refresh token was used once, for a sign-in only the terminal holds.
    expect(w.calls.refresh).toEqual(['refresh-1']);
    expect(w.codes.size).toBe(0);
  });

  it('works once: the same code again is refused', async () => {
    const w = world();
    const code = await w.codeFor(ADA);
    expect((await w.token({ code })).status).toBe(200);
    const again = await w.token({ code });
    expect(again.status).toBe(401);
    expect(again.body.error).toMatch(/not valid/);
    expect(w.calls.refresh).toEqual(['refresh-1']);
  });

  it('works within 2 minutes only', async () => {
    const w = world();
    const late = await w.codeFor(ADA);
    const inTime = await w.codeFor(ADA);
    w.clock.now += CODE_TTL_MS - 1;
    expect((await w.token({ code: inTime })).status).toBe(200);
    w.clock.now += 2;
    const expired = await w.token({ code: late });
    expect(expired.status).toBe(401);
    expect(expired.body.error).toMatch(/expired/);
    expect(w.codes.size).toBe(0);
    expect(w.calls.refresh).toEqual(['refresh-2']);
  });

  it('works only for the account that created it', async () => {
    const w = world();
    // A code whose row hands over another account's sign-in: planted, never issued by the callback.
    const bobs = w.newSession(BOB);
    const planted = newCode();
    w.codes.set(hashCode(planted), { owner: ADA.id, refresh_token: bobs.refresh_token, expires_at: new Date(START + CODE_TTL_MS).toISOString() });
    const reply = await w.token({ code: planted });
    expect(reply.status).toBe(401);
    expect(reply.body.error).toMatch(/another account/);
    expect(reply.body).not.toHaveProperty('access_token');
    expect(w.revoked).toEqual(['access-2']);
  });

  it('refuses an unknown or malformed code without asking Auth, and looks up a well-formed one only', async () => {
    const w = world();
    const unknown = newCode();
    for (const code of [unknown, 'short', 'x'.repeat(200), 'not/base64url+at/all===========']) {
      expect((await w.token({ code })).status).toBe(401);
    }
    expect(w.calls.redeem).toEqual([hashCode(unknown)]);
    expect(w.calls.refresh).toEqual([]);
  });

  it('hands any account its tokens, whatever its address: no domain is refused (PRD 459)', async () => {
    const w = world();
    const code = await w.codeFor(EVE);
    const reply = await w.token({ code });
    expect(reply.status).toBe(200);
    expect(reply.body).toMatchObject({ access_token: expect.any(String), refresh_token: expect.any(String), email: EVE.email });
    expect(w.revoked).toEqual([]);
  });

  it('trades a refresh token for a new sign-in, once', async () => {
    const w = world();
    const code = await w.codeFor(ADA);
    const first = await w.token({ code });
    const renewed = await w.token({ refresh_token: first.body.refresh_token });
    expect(renewed.status).toBe(200);
    expect(renewed.body).toEqual({ access_token: 'access-3', refresh_token: 'refresh-3', expires_at: 1790000003, email: ADA.email });
    const reused = await w.token({ refresh_token: first.body.refresh_token });
    expect(reused.status).toBe(401);
  });

  it('refuses a body that is not {code} or {refresh_token}', async () => {
    const w = world();
    for (const body of ['not json', '[]', '{}', { code: 'a', refresh_token: 'b' }, { code: 7 }, { refresh_token: '' }, { token: 'x' }]) {
      expect((await w.token(body)).status).toBe(400);
    }
    const huge = await exchangeToken(w.post({ refresh_token: 'x'.repeat(20_000) }), w.tokenDeps);
    expect(huge.status).toBe(413);
  });

  it('answers 503 with no database here, or with Auth down; 500 when the database fails', async () => {
    const w = world();
    expect((await w.token({ refresh_token: 'refresh-1' }, { connect: null })).status).toBe(503);
    const code = await w.codeFor(ADA);
    w.state.authDown = true;
    expect((await w.token({ refresh_token: 'refresh-1' })).status).toBe(503);
    w.state.authDown = false;
    w.state.rpcFails = true;
    expect((await w.token({ code })).status).toBe(500);
  });
});
