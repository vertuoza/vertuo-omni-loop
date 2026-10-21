import { createHash } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { exchangeToken, type CliSession, type TokenClient, type TokenDeps } from './cli-code';
import {
  KIT_TOKEN,
  MADE_COOKIE,
  kitBox,
  kitExchange,
  madeCookie,
  readMadeCookie,
  deviceTokenPort,
  deviceTokenReturn,
  readTokenRequest,
  takeMadeToken,
  tokenCallbackPath,
  tokenSignInPath,
  tokenSignInReturn,
  type KitBox,
  type KitMakeDeps,
  type KitStore,
  type TokenRequest,
} from './kit-token';
import { fakeStore } from './device.fake';
import { deviceService, type DeviceService } from './device.service';
import { present } from './test/test-item';

vi.mock('server-only', () => ({}));

// The kit token (PRD 1628, spec sections 2 and 3), from galaxy's side, on fakes: the sign-in round trip
// with `purpose=token` that makes one, and POST /api/ask/token {omni_token} that trades it for a short
// session. Supabase Auth rotates refresh tokens (each good once), and the token store follows
// 20261204090000_kit_tokens.sql: a claim takes a lease, `busy` while another exchange holds it.

const Body = z.looseObject({
  error: z.string().optional(),
  reason: z.string().optional(),
  access_token: z.string().optional(),
  refresh_token: z.string().nullable().optional(),
  expires_at: z.number().nullable().optional(),
});

type Account = { id: string; email?: string | null; user_metadata?: { user_name?: string } };
const ADA: Account = { id: '00000000-0000-4000-8000-0000000000a1', email: 'ada@example.com', user_metadata: { user_name: 'ada' } };
const BOB: Account = { id: '00000000-0000-4000-8000-0000000000b1', email: null, user_metadata: { user_name: 'bob' } };

const ORIGIN = 'https://ask.example';
const START = Date.parse('2026-12-04T09:00:00Z');
const DAY = 86_400_000;
const STATE = 'Zm9vYmFyYmF6cXV4LXN0YXRlLW9mLXRoZS10ZXJtaW5hbA';
const VERTUOZA = { slug: 'vertuoza', name: 'Vertuoza' };
/** A session's access token lives an hour, as Supabase's default jwt_expiry. */
const HOUR_S = 3600;

const sha256 = (text: string) => createHash('sha256').update(text).digest('hex');

/** A box that is plainly not the plain text, and refuses what it did not seal. */
const box: KitBox = {
  seal: (plain) => `sealed:${Buffer.from(plain).toString('base64url')}`,
  open(sealed) {
    if (!sealed.startsWith('sealed:')) throw new Error('The stored secret could not be opened with this master key.');
    return Buffer.from(sealed.slice('sealed:'.length), 'base64url').toString();
  },
};

type Row = {
  id: string; hash: string; lastFour: string; owner: string; name: string; workspace: string; scope: 'kit' | 'business';
  session: string | null; lease: string | null; leaseUntil: number; expiresAt: number; revoked: boolean; lastUsed: number | null;
};

function world() {
  const clock = { now: START };
  const refreshTokens = new Map<string, Account>();
  const googleCodes = new Map<string, Account>();
  const rows = new Map<string, Row>();
  const members = new Set<string>([ADA.id, BOB.id]);
  const revoked: string[] = [];
  const calls = { refresh: [] as string[], make: [] as string[], join: [] as string[], claim: 0, sleep: 0 };
  const state = { authDown: false, joinFails: false, makeError: null as { message: string; code?: string } | null, claimFails: false, revokeWhileRenewing: false };
  let issued = 0;
  let leases = 0;

  function newSession(account: Account): CliSession & { expires_at: number } {
    issued += 1;
    const session = {
      access_token: `access-${issued}`, refresh_token: `refresh-${issued}`,
      expires_at: Math.floor(clock.now / 1000) + HOUR_S, user: { ...account },
    };
    refreshTokens.set(session.refresh_token, account);
    return session;
  }

  const client: TokenClient = {
    auth: {
      async refreshSession({ refresh_token }) {
        calls.refresh.push(refresh_token);
        // Auth answers later than the database: another exchange may run meanwhile.
        await new Promise((resolve) => setTimeout(resolve, 1));
        if (state.authDown) return { data: { session: null }, error: { status: 503, message: 'upstream' } };
        const account = refreshTokens.get(refresh_token);
        if (!account) return { data: { session: null }, error: { status: 400, message: 'Invalid Refresh Token: Already Used' } };
        refreshTokens.delete(refresh_token);
        return { data: { session: newSession(account) }, error: null };
      },
    },
    rpc: () => Promise.resolve({ data: null, error: { message: 'no code table in this test' } }),
  };

  /** Why kit_token_claim() would not hand over a kit token's session, in its order; null when it would. */
  function refusalOf(row: Row): object | null {
    const checks: [boolean, () => object][] = [
      [row.revoked || row.session === null, () => ({ state: 'revoked' })],
      [row.expiresAt <= clock.now, () => ({ state: 'expired', expiresAt: new Date(row.expiresAt).toISOString() })],
      [!members.has(row.owner), () => ({ state: 'not-a-member', login: 'ada', workspace: VERTUOZA })],
      [row.lease !== null && row.leaseUntil > clock.now, () => ({ state: 'busy' })],
    ];
    return checks.find(([refused]) => refused)?.[1]() ?? null;
  }

  // As kit_token_claim(), kit_token_renewed() and kit_token_release().
  const store: KitStore = {
    claim(hash) {
      calls.claim += 1;
      if (state.claimFails) return Promise.reject(new Error('kit_token_claim: connection reset'));
      const row = rows.get(hash);
      if (!row || row.scope !== 'kit') return Promise.resolve({ state: 'unknown' });
      const refused = refusalOf(row);
      if (refused) return Promise.resolve(refused);
      leases += 1;
      row.lease = `lease-${leases}`;
      row.leaseUntil = clock.now + 30_000;
      return Promise.resolve({
        state: 'ok', id: row.id, owner: row.owner, session: row.session, lease: row.lease,
        expiresAt: new Date(row.expiresAt).toISOString(), lastFour: row.lastFour,
      });
    },
    renewed(id, lease, sealed) {
      const row = [...rows.values()].find((r) => r.id === id);
      // Revoked on the profile page while Auth was renewing the session.
      if (row && state.revokeWhileRenewing) Object.assign(row, { revoked: true, session: null });
      if (!row || row.lease !== lease || row.revoked) return Promise.resolve(false);
      Object.assign(row, { session: sealed, lease: null, leaseUntil: 0, lastUsed: clock.now });
      return Promise.resolve(true);
    },
    release(id, lease) {
      const row = [...rows.values()].find((r) => r.id === id);
      if (row && row.lease === lease) Object.assign(row, { lease: null, leaseUntil: 0 });
      return Promise.resolve();
    },
  };

  const makeDeps: KitMakeDeps = {
    exchange(code) {
      const account = googleCodes.get(code);
      googleCodes.delete(code);
      if (!account) return Promise.resolve({ session: null, error: { message: 'invalid flow state' } });
      return Promise.resolve({ session: newSession(account), error: null });
    },
    join(session) {
      calls.join.push(session.user.id);
      return state.joinFails ? Promise.reject(new Error('GitHub is down')) : Promise.resolve();
    },
    make(session, made) {
      calls.make.push(made.hash);
      if (state.makeError) return Promise.resolve({ expiresAt: null, error: state.makeError });
      const expiresAt = clock.now + made.days * DAY;
      rows.set(made.hash, {
        id: `row-${rows.size + 1}`, hash: made.hash, lastFour: made.lastFour, owner: session.user.id, name: made.name,
        workspace: made.workspace ?? 'vertuoza', scope: 'kit', session: made.session, lease: null, leaseUntil: 0, expiresAt,
        revoked: false, lastUsed: null,
      });
      return Promise.resolve({ expiresAt: new Date(expiresAt).toISOString(), error: null });
    },
    box,
    revoke(session) {
      revoked.push(session.access_token);
      return Promise.resolve();
    },
  };

  const tokenDeps: TokenDeps = {
    connect: () => client,
    now: () => clock.now,
    revoke(accessToken) {
      revoked.push(accessToken);
      return Promise.resolve();
    },
    place: (_userId, repo) => Promise.resolve(repo === 'demo-org/api' ? { workspace: VERTUOZA, reason: null } : { workspace: null, reason: `no workspace owns ${repo} yet` }),
    kit: kitExchange({
      store,
      box,
      sleep: () => {
        calls.sleep += 1;
        return new Promise((resolve) => setTimeout(resolve, 1));
      },
    }),
  };

  /** The code GitHub sends back for `account`, good once. */
  function githubCode(account: Account) {
    const github = `github-${account.id}-${issued}`;
    googleCodes.set(github, account);
    return github;
  }

  /** The person signs in with GitHub on the token's round trip: where the callback sends the browser. */
  async function roundTrip(account: Account, request: string, deps: KitMakeDeps = makeDeps) {
    const github = githubCode(account);
    return tokenSignInReturn(new URL(`${ORIGIN}/auth/callback?next=ask-cli&purpose=token&${request}&code=${github}`), ORIGIN, deps);
  }

  /** A token made through the loopback, as `omni setup-token` would catch it. */
  async function tokenFor(account: Account, days = 90) {
    const back = new URL((await roundTrip(account, `name=laptop&days=${days}&port=49152&state=${STATE}`)).location);
    return present(back.searchParams.get('token'), 'the token on the loopback');
  }

  const post = (body: unknown) => new Request(`${ORIGIN}/api/ask/token`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  });
  const trade = async (body: unknown, deps: TokenDeps = tokenDeps) => {
    const response = await exchangeToken(post(body), deps);
    const text = await response.text();
    return { status: response.status, text, body: Body.parse(JSON.parse(text)) };
  };

  return { clock, rows, members, revoked, calls, state, store, makeDeps, tokenDeps, refreshTokens, githubCode, roundTrip, tokenFor, trade };
}

// Every line the server logs, kept to prove no token leaks into one.
let logged: string[] = [];
beforeEach(() => {
  logged = [];
  for (const level of ['error', 'warn', 'log', 'info'] as const) {
    vi.spyOn(console, level).mockImplementation((...args: unknown[]) => { logged.push(args.map(String).join(' ')); });
  }
});
afterEach(() => vi.restoreAllMocks());

describe('the box that seals a token\'s session', () => {
  it('seals with the server\'s key, differently each time, and opens only what that key sealed', () => {
    const sealer = present(kitBox(Buffer.alloc(32, 1)), 'box');
    const once = sealer.seal('refresh-secret');
    expect(once).not.toContain('refresh-secret');
    expect(once).toMatch(/^[A-Za-z0-9+/=]+\.[A-Za-z0-9+/=]+$/);
    expect(sealer.seal('refresh-secret')).not.toBe(once);
    expect(sealer.open(once)).toBe('refresh-secret');
    expect(() => present(kitBox(Buffer.alloc(32, 2)), 'other').open(once)).toThrow();
    expect(() => sealer.open('no-dot')).toThrow();
    expect(() => sealer.open(`${once}.x`)).toThrow();
    expect(kitBox(null)).toBeNull();
  });
});

describe('the token\'s round trip: what /ask/signin?purpose=token carries', () => {
  const read = (query: string) => readTokenRequest(new URLSearchParams(query), new Date(START));

  it('names the token, its expiry and where it goes back: the loopback, or a page of the app', () => {
    expect(read(`purpose=token&name=laptop&days=30&port=49152&state=${STATE}`)).toEqual({
      name: 'laptop', days: 30, workspace: null, to: { port: 49152, state: STATE },
    });
    expect(read('purpose=token&name=cloud&days=365&workspace=vertuoza&back=/app/people/ada')).toEqual({
      name: 'cloud', days: 365, workspace: 'vertuoza', to: { back: '/app/people/ada' },
    });
  });

  it('defaults the name to terminal <date> and the expiry to 90 days', () => {
    expect(read(`purpose=token&port=49152&state=${STATE}`)).toMatchObject({ name: 'terminal 2026-12-04', days: 90 });
    expect(read(`purpose=token&name=%20%20&port=49152&state=${STATE}`)).toMatchObject({ name: 'terminal 2026-12-04' });
  });

  it('is refused with another purpose, a bad expiry, a bad name, a bad workspace, or nowhere safe to go back to', () => {
    for (const query of [
      `name=laptop&port=49152&state=${STATE}`, `purpose=code&port=49152&state=${STATE}`,
      `purpose=token&days=7&port=49152&state=${STATE}`, `purpose=token&days=ninety&port=49152&state=${STATE}`,
      `purpose=token&name=${'n'.repeat(41)}&port=49152&state=${STATE}`, `purpose=token&name=a%0Ab&port=49152&state=${STATE}`,
      `purpose=token&workspace=Not%20A%20Slug&port=49152&state=${STATE}`,
      'purpose=token', 'purpose=token&port=80&state=x', 'purpose=token&back=https://evil.example/app',
      'purpose=token&back=//evil.example/app', 'purpose=token&back=/play', 'purpose=token&back=/app/../api/x',
      'purpose=token&back=/app/people/ada?x=1', `purpose=token&back=/app/a&port=49152&state=${STATE}`,
    ]) {
      expect(read(query), query).toBeNull();
    }
  });

  it('goes to GitHub and back through the auth callback\'s ask-cli branch, carrying the same request', () => {
    const request: TokenRequest = { name: 'cloud box', days: 365, workspace: 'vertuoza', to: { back: '/app/people/ada' } };
    const callback = new URL(`${ORIGIN}${tokenCallbackPath(request)}`);
    expect(callback.pathname).toBe('/auth/callback');
    expect(callback.searchParams.get('next')).toBe('ask-cli');
    expect(readTokenRequest(callback.searchParams, new Date(START))).toEqual(request);
    const page = new URL(`${ORIGIN}${tokenSignInPath(request, 'Not today')}`);
    expect(page.pathname).toBe('/ask/signin');
    expect(page.searchParams.get('signin_error')).toBe('Not today');
    expect(readTokenRequest(page.searchParams, new Date(START))).toEqual(request);
  });
});

describe('the auth callback, for a token', () => {
  it('makes the kit token as the fresh sign-in and hands it once to the terminal\'s loopback address', async () => {
    const w = world();
    const back = await w.roundTrip(ADA, `name=laptop&days=90&port=49152&state=${STATE}`);
    expect(back.made).toBeNull();
    const url = new URL(back.location);
    expect(url.origin).toBe('http://127.0.0.1:49152');
    expect(url.pathname).toBe('/callback');
    expect(url.searchParams.get('state')).toBe(STATE);
    const token = present(url.searchParams.get('token'), 'token');
    expect(token).toMatch(KIT_TOKEN);
    expect(token).toMatch(/^omk_[A-Za-z0-9_-]{43}$/);
    expect(url.searchParams.get('expires_at')).toBe(new Date(START + 90 * DAY).toISOString());
    // Stored as its hash and last four, with the fresh session's refresh token sealed: never the token.
    const row = present(w.rows.get(sha256(token)), 'the made row');
    expect(row).toMatchObject({ owner: ADA.id, name: 'laptop', lastFour: token.slice(-4), session: box.seal('refresh-1') });
    expect(JSON.stringify([...w.rows.values()])).not.toContain(token);
    expect(w.calls.join).toEqual([ADA.id]);
    expect(w.revoked).toEqual([]);
  });

  it('comes back to the app page with the token kept for it once, in a cookie only the made-token route reads', async () => {
    const w = world();
    const back = await w.roundTrip(ADA, 'name=cloud&days=30&workspace=vertuoza&back=/app/people/ada');
    expect(back.location).toBe(`${ORIGIN}/app/people/ada`);
    const made = present(back.made, 'made');
    expect(made).toEqual({ token: expect.stringMatching(KIT_TOKEN) as unknown, name: 'cloud', expiresAt: new Date(START + 30 * DAY).toISOString() });
    expect(new URL(back.location).search).toBe('');
    const cookie = madeCookie(made, true);
    expect(cookie).toMatchObject({ name: MADE_COOKIE, options: { httpOnly: true, secure: true, sameSite: 'lax', path: '/api/ask/token/made', maxAge: 300 } });
    expect(readMadeCookie(cookie.value)).toEqual(made);
    expect(readMadeCookie('tampered')).toBeNull();
    expect(readMadeCookie(undefined)).toBeNull();
  });

  it('shows the kept token once: the made-token route answers it, then nothing', async () => {
    const w = world();
    const made = present((await w.roundTrip(ADA, 'name=cloud&days=30&back=/app/people/ada')).made, 'made');
    const first = takeMadeToken(madeCookie(made, false).value);
    expect(first.status).toBe(200);
    expect(first.headers.get('cache-control')).toBe('no-store');
    expect(await first.json()).toEqual({ token: made.token, name: 'cloud', expires_at: made.expiresAt });
    const none = takeMadeToken(undefined);
    expect(none.status).toBe(404);
  });

  it('makes the token even when joining the person\'s workspaces fails', async () => {
    const w = world();
    w.state.joinFails = true;
    expect(new URL((await w.roundTrip(ADA, `port=49152&state=${STATE}`)).location).origin).toBe('http://127.0.0.1:49152');
  });

  it('says kit tokens are not set up here, ending the new sign-in, when this deployment has no key', async () => {
    const w = world();
    const back = new URL((await w.roundTrip(ADA, `name=laptop&port=49152&state=${STATE}`, { ...w.makeDeps, box: null })).location);
    expect(back.origin).toBe(ORIGIN);
    expect(back.pathname).toBe('/ask/signin');
    expect(back.searchParams.get('purpose')).toBe('token');
    expect(back.searchParams.get('signin_error')).toMatch(/not set up/);
    expect(w.calls.make).toEqual([]);
    expect(w.revoked).toEqual(['access-1']);
  });

  it('comes back with the database\'s own words when the token is refused (the 20 limit, no workspace), ending the sign-in', async () => {
    const w = world();
    w.state.makeError = { message: 'You hold 20 tokens already: revoke one to make another.', code: '54000' };
    const full = new URL((await w.roundTrip(ADA, 'back=/app/people/ada')).location);
    expect(full.searchParams.get('signin_error')).toBe('You hold 20 tokens already: revoke one to make another.');
    expect(full.searchParams.get('back')).toBe('/app/people/ada');
    w.state.makeError = { message: 'connection reset', code: '08006' };
    const broken = new URL((await w.roundTrip(ADA, `port=49152&state=${STATE}`)).location);
    expect(broken.searchParams.get('signin_error')).toMatch(/could not be made/);
    expect(broken.searchParams.get('signin_error')).not.toContain('connection reset');
    expect(w.revoked).toEqual(['access-1', 'access-2']);
  });

  it('comes back with GitHub\'s reason, or when the code cannot be exchanged, making nothing', async () => {
    const w = world();
    const refused = await tokenSignInReturn(new URL(`${ORIGIN}/auth/callback?next=ask-cli&purpose=token&port=49152&state=${STATE}&error=access_denied`), ORIGIN, w.makeDeps);
    expect(new URL(refused.location).searchParams.get('signin_error')).toBe('access_denied');
    const stale = await tokenSignInReturn(new URL(`${ORIGIN}/auth/callback?next=ask-cli&purpose=token&port=49152&state=${STATE}&code=stale`), ORIGIN, w.makeDeps);
    expect(new URL(stale.location).searchParams.get('signin_error')).toMatch(/could not be finished/);
    expect(w.calls.make).toEqual([]);
  });

  it('never sends anything anywhere without a complete request', async () => {
    const w = world();
    const back = await tokenSignInReturn(new URL(`${ORIGIN}/auth/callback?next=ask-cli&purpose=token&back=https://evil.example&code=x`), ORIGIN, w.makeDeps);
    expect(back).toEqual({ location: `${ORIGIN}/ask/signin`, made: null });
  });
});

// The device sign-in's token (PRD 1660, s3): `omni setup-token` waiting where this browser cannot reach
// it. The request was issued with the token's name, days and workspace; the callback comes back with
// `device=<user code>&purpose=token` only, makes the token as the loopback branch does, and attaches it
// sealed to the pending request for the terminal's next poll.
describe('the auth callback, for a token by device', () => {
  const USER = 'WXTZ-4825';

  async function pending(w: ReturnType<typeof world>, purpose: 'token' | 'signin' = 'token') {
    const { store, rows, state } = fakeStore();
    const devices = deviceService(store, { now: () => w.clock.now, userCode: () => 'WXTZ4825', open: (sealed) => box.open(sealed) });
    const issued = await devices.issue(purpose === 'token' ? { purpose, name: 'cloud box', days: 30, workspace: 'vertuoza' } : { purpose });
    return { devices, issued, rows, state };
  }

  /** The person signs in with GitHub from the device page: where the callback sends the browser. */
  async function approveToken(w: ReturnType<typeof world>, account: Account, devices: DeviceService | null, device = USER, deps: KitMakeDeps = w.makeDeps) {
    const url = new URL(`${ORIGIN}/auth/callback?next=ask-cli&device=${encodeURIComponent(device)}&purpose=token&code=${w.githubCode(account)}`);
    return new URL(await deviceTokenReturn(url, ORIGIN, { ...deps, device: devices ? deviceTokenPort(devices) : null }));
  }

  it('makes the kit token as the fresh sign-in, attaches it sealed, and the poll hands it over once, unsealed', async () => {
    const w = world();
    const { devices, issued, rows } = await pending(w);
    const back = await approveToken(w, ADA, devices);
    expect(back.origin).toBe(ORIGIN);
    expect(`${back.pathname}${back.search}`).toBe('/ask/device?done=1');
    // Waiting, the token is held only sealed with the server's key.
    const waiting = present([...rows.values()][0], 'the approved request');
    expect(waiting).toMatchObject({ status: 'approved', purpose: 'token', payload_expires_at: new Date(START + 30 * DAY).toISOString() });
    const answer = await devices.poll(issued.device_code);
    const token = present('token' in answer ? answer.token : null, 'the polled token');
    expect(token).toMatch(KIT_TOKEN);
    expect(answer).toEqual({ status: 'approved', token, expires_at: new Date(START + 30 * DAY).toISOString() });
    expect(waiting.payload).toBe(box.seal(token));
    expect(waiting.payload).not.toContain(token);
    // The token row is the one the loopback branch makes: its name, days and workspace from the request.
    expect(present(w.rows.get(sha256(token)), 'the made row')).toMatchObject({ owner: ADA.id, name: 'cloud box', workspace: 'vertuoza', lastFour: token.slice(-4) });
    expect(w.calls.join).toEqual([ADA.id]);
    expect(w.revoked).toEqual([]);
    // Handed over once: the request is gone, and a later poll answers expired.
    expect(rows.size).toBe(0);
    expect(await devices.poll(issued.device_code)).toEqual({ status: 'expired' });
    // Never in a URL or a log line.
    expect(back.toString()).not.toContain(token);
    expect(logged.join('\n')).not.toContain(token);
  });

  it('reads the user code without case or dash', async () => {
    const w = world();
    const { devices } = await pending(w);
    expect((await approveToken(w, ADA, devices, 'wxtz4825')).searchParams.get('done')).toBe('1');
  });

  it('makes nothing for a request no longer pending, or one that asked for a sign-in, ending the new sign-in', async () => {
    const w = world();
    const { devices, issued } = await pending(w);
    expect(await devices.deny(USER)).toBe(true);
    const denied = await approveToken(w, ADA, devices);
    expect(`${denied.pathname}${denied.search}`).toBe(`/ask/device?user_code=${USER}`);
    expect(await devices.poll(issued.device_code)).toEqual({ status: 'denied' });

    const late = await pending(w);
    w.clock.now += 11 * 60_000;
    expect((await approveToken(w, ADA, late.devices)).searchParams.has('done')).toBe(false);

    const signin = await pending(w, 'signin');
    const wrong = await approveToken(w, ADA, signin.devices);
    expect(wrong.searchParams.get('user_code')).toBe(USER);
    expect(wrong.searchParams.has('done')).toBe(false);

    expect(w.calls.make).toEqual([]);
    expect(w.revoked).toEqual(['access-1', 'access-2', 'access-3']);
  });

  it('ends the new sign-in, leaving the token unusable, when the request stopped pending while it was made', async () => {
    const w = world();
    const { devices, issued } = await pending(w);
    const racing: DeviceService = { ...devices, approve: async (...args) => { await devices.deny(USER); return devices.approve(...args); } };
    const back = await approveToken(w, ADA, racing);
    expect(back.searchParams.get('user_code')).toBe(USER);
    expect(back.searchParams.has('done')).toBe(false);
    expect(w.calls.make).toHaveLength(1);
    expect(w.revoked).toEqual(['access-1']);
    expect(await devices.poll(issued.device_code)).toEqual({ status: 'denied' });
  });

  it('says kit tokens are not set up here when this deployment has no key, making nothing', async () => {
    const w = world();
    const { devices } = await pending(w);
    const back = await approveToken(w, ADA, devices, USER, { ...w.makeDeps, box: null });
    expect(Object.fromEntries(back.searchParams)).toMatchObject({ user_code: USER, yes: '1' });
    expect(back.searchParams.get('signin_error')).toMatch(/not set up/);
    expect(w.calls.make).toEqual([]);
    expect(w.revoked).toEqual(['access-1']);
  });

  it('comes back with the database\'s own words when the token is refused, ending the sign-in', async () => {
    const w = world();
    const { devices } = await pending(w);
    w.state.makeError = { message: 'You hold 20 tokens already: revoke one to make another.', code: '54000' };
    const back = await approveToken(w, ADA, devices);
    expect(back.searchParams.get('signin_error')).toBe('You hold 20 tokens already: revoke one to make another.');
    expect(back.searchParams.get('yes')).toBe('1');
    expect(w.revoked).toEqual(['access-1']);
  });

  it('says so and ends the sign-in when the request cannot be reached, or this deployment has no device sign-in', async () => {
    const w = world();
    const { devices, state } = await pending(w);
    state.fails = true;
    const down = await approveToken(w, ADA, devices);
    expect(down.searchParams.get('signin_error')).toMatch(/omni setup-token/);
    state.fails = false;
    const attachDown: DeviceService = { ...devices, approve: () => Promise.reject(new Error('ask_cli_device: the database is down')) };
    const failed = await approveToken(w, ADA, attachDown);
    expect(failed.searchParams.get('signin_error')).toMatch(/omni setup-token/);
    const none = await approveToken(w, ADA, null);
    expect(none.searchParams.get('signin_error')).toMatch(/omni setup-token/);
    expect(w.calls.make).toHaveLength(1);
    expect(w.revoked).toEqual(['access-1', 'access-2', 'access-3']);
    expect(logged.join('\n')).not.toMatch(/omk_/);
  });

  it('comes back with GitHub\'s reason, exchanging nothing, and goes nowhere for a malformed user code', async () => {
    const w = world();
    const { devices } = await pending(w);
    const refused = new URL(await deviceTokenReturn(
      new URL(`${ORIGIN}/auth/callback?next=ask-cli&device=${USER}&purpose=token&error=access_denied&error_description=Not+today`),
      ORIGIN, { ...w.makeDeps, device: deviceTokenPort(devices) },
    ));
    expect(Object.fromEntries(refused.searchParams)).toEqual({ user_code: USER, yes: '1', signin_error: 'Not today' });
    for (const device of ['', 'WXTZ-48', 'AEIO-4825', 'http://evil.example']) {
      const back = await approveToken(w, ADA, devices, device);
      expect(`${back.origin}${back.pathname}${back.search}`).toBe(`${ORIGIN}/ask/device`);
    }
    expect(w.calls.make).toEqual([]);
    expect(w.revoked).toEqual([]);
  });
});

describe('POST /api/ask/token {omni_token}', () => {
  it('trades a kit token for a short session of its maker\'s, with no refresh token, renewing the stored one', async () => {
    const w = world();
    const token = await w.tokenFor(ADA);
    w.clock.now += 5 * DAY;
    const reply = await w.trade({ omni_token: token, repo: 'demo-org/api' });
    expect(reply.status).toBe(200);
    expect(reply.body).toEqual({
      access_token: 'access-2', refresh_token: null, expires_at: Math.floor(w.clock.now / 1000) + HOUR_S,
      login: 'ada', email: ADA.email, workspace: VERTUOZA,
    });
    // The server renewed the stored session itself, and only it holds the new refresh token.
    expect(w.calls.refresh).toEqual(['refresh-1']);
    const row = present(w.rows.get(sha256(token)), 'row');
    expect(row).toMatchObject({ session: box.seal('refresh-2'), lease: null, lastUsed: w.clock.now });
    expect(reply.text).not.toContain('refresh-2');
    // And again, from another container: the renewed session renews again.
    const again = await w.trade({ omni_token: token });
    expect(again.body).toMatchObject({ access_token: 'access-3', refresh_token: null, workspace: null });
    expect(w.calls.refresh).toEqual(['refresh-1', 'refresh-2']);
  });

  it('never answers an expiry past the token\'s own, nor more than an hour ahead', async () => {
    const w = world();
    const token = await w.tokenFor(ADA, 30);
    w.clock.now = START + 30 * DAY - 10 * 60_000;
    const reply = await w.trade({ omni_token: token });
    expect(reply.status).toBe(200);
    expect(reply.body.expires_at).toBe(Math.floor((START + 30 * DAY) / 1000));
  });

  it('refuses a revoked, an expired and an ex-member\'s token with its reason, never asking Auth', async () => {
    const w = world();
    const revokedToken = await w.tokenFor(ADA);
    const expiredToken = await w.tokenFor(ADA, 30);
    const leaverToken = await w.tokenFor(BOB);
    Object.assign(present(w.rows.get(sha256(revokedToken)), 'row'), { revoked: true, session: null });
    w.members.delete(BOB.id);
    w.clock.now = START + 31 * DAY;

    const revoked = await w.trade({ omni_token: revokedToken });
    expect(revoked).toMatchObject({ status: 401, body: { reason: 'revoked' } });
    expect(revoked.body.error).toMatch(/revoked/);
    const expired = await w.trade({ omni_token: expiredToken });
    expect(expired).toMatchObject({ status: 401, body: { reason: 'expired', expires_at: Math.floor((START + 30 * DAY) / 1000) } });
    expect(expired.body.error).toContain('2027-01-03');
    const leaver = await w.trade({ omni_token: leaverToken });
    expect(leaver).toMatchObject({ status: 401, body: { reason: 'not-a-member', login: 'ada', workspace: VERTUOZA } });
    expect(leaver.body.error).toContain('Vertuoza');
    for (const reply of [revoked, expired, leaver]) expect(reply.body).not.toHaveProperty('access_token');
    expect(w.calls.refresh).toEqual([]);
  });

  it('refuses an unknown or malformed token, and a business link, as unknown, looking up a well-formed one only', async () => {
    const w = world();
    const business = `omb_${'B'.repeat(43)}`;
    w.rows.set(sha256(business), { ...present(w.rows.get(sha256(await w.tokenFor(ADA))), 'row'), hash: sha256(business), scope: 'business' });
    for (const omni of [`omk_${'A'.repeat(43)}`, 'omk_short', business, `omk_${'A'.repeat(42)}!`]) {
      const reply = await w.trade({ omni_token: omni });
      expect(reply, omni).toMatchObject({ status: 401, body: { reason: 'unknown' } });
      expect(reply.body.error).toMatch(/omni setup-token/);
    }
    expect(w.calls.claim).toBe(1);
    expect(w.calls.refresh).toEqual([]);
  });

  it('holds no token in any answer and any log line', async () => {
    const w = world();
    const good = await w.tokenFor(ADA);
    const gone = await w.tokenFor(ADA);
    Object.assign(present(w.rows.get(sha256(gone)), 'row'), { revoked: true });
    const answers = [await w.trade({ omni_token: good }), await w.trade({ omni_token: gone }), await w.trade({ omni_token: `omk_${'Z'.repeat(43)}` })];
    w.state.claimFails = true;
    answers.push(await w.trade({ omni_token: good }));
    w.state.claimFails = false;
    w.state.authDown = true;
    answers.push(await w.trade({ omni_token: good }));
    expect(answers.map((answer) => answer.status)).toEqual([200, 401, 401, 500, 503]);
    expect(logged.length).toBeGreaterThan(0);
    for (const text of [...answers.map((answer) => answer.text), ...logged]) {
      for (const token of [good, gone, `omk_${'Z'.repeat(43)}`]) {
        expect(text).not.toContain(token);
        expect(text).not.toContain(token.slice(4, 20));
      }
    }
  });

  it('answers that kit tokens are not set up here when this deployment has no key', async () => {
    const w = world();
    const reply = await w.trade({ omni_token: `omk_${'A'.repeat(43)}` }, { ...w.tokenDeps, kit: null });
    expect(reply.status).toBe(503);
    expect(reply.body.error).toMatch(/not set up here/);
  });

  it('puts two exchanges at once one after the other: each renews once, in order', async () => {
    const w = world();
    const token = await w.tokenFor(ADA);
    const [one, two] = await Promise.all([w.trade({ omni_token: token }), w.trade({ omni_token: token })]);
    expect([one.status, two.status]).toEqual([200, 200]);
    expect(new Set([one.body.access_token, two.body.access_token])).toEqual(new Set(['access-2', 'access-3']));
    expect(w.calls.refresh).toEqual(['refresh-1', 'refresh-2']);
    expect(w.calls.sleep).toBeGreaterThan(0);
    expect(present(w.rows.get(sha256(token)), 'row')).toMatchObject({ session: box.seal('refresh-3'), lease: null });
  });

  it('gives up with 503 while another exchange still holds the token, renewing nothing', async () => {
    const w = world();
    const token = await w.tokenFor(ADA);
    Object.assign(present(w.rows.get(sha256(token)), 'row'), { lease: 'held', leaseUntil: START + 30_000 });
    const reply = await w.trade({ omni_token: token });
    expect(reply.status).toBe(503);
    expect(w.calls.refresh).toEqual([]);
  });

  it('releases the token when Auth is down (503), and says revoked when its stored session has ended', async () => {
    const w = world();
    const token = await w.tokenFor(ADA);
    w.state.authDown = true;
    expect((await w.trade({ omni_token: token })).status).toBe(503);
    expect(present(w.rows.get(sha256(token)), 'row').lease).toBeNull();
    w.state.authDown = false;
    w.refreshTokens.clear();
    const ended = await w.trade({ omni_token: token });
    expect(ended).toMatchObject({ status: 401, body: { reason: 'revoked' } });
    expect(present(w.rows.get(sha256(token)), 'row').lease).toBeNull();
  });

  it('says revoked, and ends the new session, when the token was revoked during the exchange', async () => {
    const w = world();
    const token = await w.tokenFor(ADA);
    w.state.revokeWhileRenewing = true;
    const reply = await w.trade({ omni_token: token });
    expect(reply).toMatchObject({ status: 401, body: { reason: 'revoked' } });
    expect(w.revoked).toEqual(['access-2']);
  });

  it('says revoked when the stored session cannot be opened with this key', async () => {
    const w = world();
    const token = await w.tokenFor(ADA);
    Object.assign(present(w.rows.get(sha256(token)), 'row'), { session: 'sealed under another key' });
    expect(await w.trade({ omni_token: token })).toMatchObject({ status: 401, body: { reason: 'revoked' } });
    expect(w.calls.refresh).toEqual([]);
    expect(present(w.rows.get(sha256(token)), 'row').lease).toBeNull();
  });

  it('refuses a body carrying a token beside a code or a refresh token, or a token that is not text', async () => {
    const w = world();
    for (const body of [{ omni_token: 'omk_x', code: 'c' }, { omni_token: 'omk_x', refresh_token: 'r' }, { omni_token: 7 }, { omni_token: '' }, { omni_token: 'omk_x', repo: 'nope' }]) {
      expect((await w.trade(body)).status, JSON.stringify(body)).toBe(400);
    }
  });
});
