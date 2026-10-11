// `OMNI_TOKEN` through the one door (PRD 1628): `signedInClient` signs in from the kit token when it
// is set, trades it for a short access token on first use, trades again when that is about to expire
// or a call answers 401, and never reads or writes `~/.config/omni/credentials.json`. The page is a
// fake `fetch`; the home folder is a temporary one.
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { AskCallError } from './client.ts';
import type { Fetch } from './client.ts';
import { homeTokens, omniTokenTail } from './client-tokens.ts';
import { signedInClient } from './credentials.ts';

const ASK_URL = 'https://omni.example.com';
const HOST = 'omni.example.com';
/** A kit token as `omni setup-token` prints it. */
const TOKEN = 'omk_Zq9xW3vK7pL2mN8bR4tY6uJ1hG5fD0sA_-cE3iO9wQv';
const FILE = ['.config', 'omni', 'credentials.json'];
const KEPT = { [HOST]: { access_token: 'laptop-access', refresh_token: 'laptop-refresh', expires_at: 4_000_000_000, login: 'laptop' } };
const NOW = 1_760_000_000_000;

/** A home folder holding the laptop's sign-in, as `omni signin` keeps it. */
function homeWithFile(): string {
  const dir = mkdtempSync(join(tmpdir(), 'omni-home-'));
  mkdirSync(join(dir, '.config', 'omni'), { recursive: true });
  writeFileSync(join(dir, ...FILE), JSON.stringify(KEPT), { mode: 0o600 });
  return dir;
}

type Sent = { url: string; method: string; authorization: string | null; body: unknown };

/**
 * The page, faked: each trade of `/api/ask/token` answers the next of `trades` (a reply, or `'down'`
 * for a network failure), and every other call answers `call(authorization)`.
 */
function fakePage({ trades, call = () => Response.json({ ok: true }) }: {
  trades: (Response | 'down')[];
  call?: (authorization: string | null) => Response;
}) {
  const sent: Sent[] = [];
  const fetch: Fetch = (url, init) => {
    const headers = new Headers(init.headers);
    const body: unknown = typeof init.body === 'string' ? JSON.parse(init.body) : null;
    sent.push({ url, method: init.method ?? 'GET', authorization: headers.get('authorization'), body });
    if (url.endsWith('/api/ask/token')) {
      const next = trades.shift();
      if (next === undefined) throw new Error('no trade left');
      if (next === 'down') return Promise.reject(new TypeError('fetch failed'));
      return Promise.resolve(next);
    }
    return Promise.resolve(call(headers.get('authorization')));
  };
  return { fetch, sent, trades: () => sent.filter((request) => request.url.endsWith('/api/ask/token')) };
}

/** The exchange's answer to a kit token (spec, section 3): an access token for up to an hour, no refresh token. */
const traded = (access: string, expiresAt = NOW / 1000 + 3600) =>
  Response.json({ access_token: access, refresh_token: null, expires_at: expiresAt, login: 'ada', email: null, workspace: { slug: 'acme', name: 'Acme' } });

const refused = (body: Record<string, unknown>) => Response.json({ error: 'the kit token was refused', ...body }, { status: 401 });

/** Every line the kit could print from `error`, swept for the token: nothing past its last four. */
function expectNoToken(text: string): void {
  for (let at = 0; at + 5 <= TOKEN.length; at += 1) expect(text).not.toContain(TOKEN.slice(at, at + 5));
}

async function failureOf(promise: Promise<unknown>): Promise<AskCallError> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof AskCallError) return error;
    throw error;
  }
  throw new Error('the call did not fail');
}

describe('signedInClient with OMNI_TOKEN', () => {
  it('trades the token on first use, carries the access token it gets, and leaves credentials.json untouched', async () => {
    const home = homeWithFile();
    const before = { text: readFileSync(join(home, ...FILE), 'utf8'), mtime: statSync(join(home, ...FILE)).mtimeMs };
    const page = fakePage({ trades: [traded('cloud-access-1')] });

    const client = signedInClient({ askUrl: ASK_URL, tokens: undefined, home, omniToken: TOKEN, fetch: page.fetch, callMs: undefined, now: () => NOW });
    expect(client).not.toBeNull();
    await client?.readBusiness('acme/api');
    await client?.readBusiness('acme/api');

    expect(page.trades()).toEqual([{ url: `${ASK_URL}/api/ask/token`, method: 'POST', authorization: null, body: { omni_token: TOKEN } }]);
    expect(page.sent.filter((request) => !request.url.endsWith('/api/ask/token')).map((request) => request.authorization)).toEqual([
      'Bearer cloud-access-1',
      'Bearer cloud-access-1',
    ]);
    expect(readFileSync(join(home, ...FILE), 'utf8')).toBe(before.text);
    expect(statSync(join(home, ...FILE)).mtimeMs).toBe(before.mtime);
  });

  it('writes no file in a home that holds none', async () => {
    const home = mkdtempSync(join(tmpdir(), 'omni-home-'));
    const page = fakePage({ trades: [traded('cloud-access-1')] });
    await signedInClient({ askUrl: ASK_URL, tokens: undefined, home, omniToken: TOKEN, fetch: page.fetch, callMs: undefined })?.readBusiness('acme/api');
    expect(readdirSync(home)).toEqual([]);
  });

  it('trades again when the access token is about to expire', async () => {
    let now = NOW;
    const page = fakePage({ trades: [traded('cloud-access-1', NOW / 1000 + 3600), traded('cloud-access-2', NOW / 1000 + 7200)] });
    const client = signedInClient({ askUrl: ASK_URL, tokens: undefined, home: homeWithFile(), omniToken: TOKEN, fetch: page.fetch, callMs: undefined, now: () => now });

    await client?.readBusiness('acme/api');
    now = NOW + 3500 * 1000; // a hundred seconds before it expires: still good
    await client?.readBusiness('acme/api');
    now = NOW + 3560 * 1000; // under a minute left: traded again first
    await client?.readBusiness('acme/api');

    expect(page.trades()).toHaveLength(2);
    expect(page.sent.filter((request) => !request.url.endsWith('/api/ask/token')).map((request) => request.authorization)).toEqual([
      'Bearer cloud-access-1',
      'Bearer cloud-access-1',
      'Bearer cloud-access-2',
    ]);
  });

  it('trades again on a 401 and retries the call once', async () => {
    const page = fakePage({
      trades: [traded('cloud-access-1'), traded('cloud-access-2')],
      call: (authorization) => (authorization === 'Bearer cloud-access-1' ? Response.json({ error: 'expired' }, { status: 401 }) : Response.json({ ok: true })),
    });
    const client = signedInClient({ askUrl: ASK_URL, tokens: undefined, home: homeWithFile(), omniToken: TOKEN, fetch: page.fetch, callMs: undefined, now: () => NOW });

    await expect(client?.readBusiness('acme/api')).resolves.toEqual({ ok: true });
    expect(page.trades().map((request) => request.body)).toEqual([{ omni_token: TOKEN }, { omni_token: TOKEN }]);
  });

  it('fails the call when the fresh access token is refused too', async () => {
    const page = fakePage({ trades: [traded('cloud-access-1'), traded('cloud-access-2')], call: () => Response.json({ error: 'no' }, { status: 401 }) });
    const client = signedInClient({ askUrl: ASK_URL, tokens: undefined, home: undefined, omniToken: TOKEN, fetch: page.fetch, callMs: undefined, now: () => NOW });
    const error = await failureOf(client?.readBusiness('acme/api') ?? Promise.resolve());
    expect(error.status).toBe(401);
    expect(page.trades()).toHaveLength(2);
  });

  describe('a token that does not work stops with its one line, naming the variable and never its value', () => {
    const cases: [string, Response | 'down', string, number | null][] = [
      ['expired', refused({ reason: 'expired', expires_at: 1_767_225_600 }), 'OMNI_TOKEN expired on 2026-01-01: make a new one with omni setup-token', 401],
      ['revoked', refused({ reason: 'revoked' }), 'OMNI_TOKEN was revoked: make a new one with omni setup-token', 401],
      ['not-a-member', refused({ reason: 'not-a-member', login: 'ada', workspace: { slug: 'acme', name: 'Acme' } }), 'OMNI_TOKEN: ada is no longer a member of Acme', 401],
      ['unknown', refused({ reason: 'unknown' }), `OMNI_TOKEN is not known to ${HOST}: make a new one with omni setup-token`, 401],
      ['unreachable', 'down', `OMNI_TOKEN: cannot reach ${HOST}: allow it in your environment's network access`, null],
    ];
    for (const [name, reply, line, status] of cases) {
      it(name, async () => {
        const page = fakePage({ trades: [reply] });
        const client = signedInClient({ askUrl: ASK_URL, tokens: undefined, home: homeWithFile(), omniToken: TOKEN, fetch: page.fetch, callMs: undefined, now: () => NOW });
        const error = await failureOf(client?.readBusiness('acme/api') ?? Promise.resolve());
        expect(error.message).toBe(line);
        expect(error.status).toBe(status);
        expect(page.sent).toHaveLength(1);
        expectNoToken(`${error.message} ${error.reason ?? ''}`);
      });
    }

    it('reads an expiry given as a date, and says so without one', async () => {
      for (const [expiresAt, line] of [
        ['2026-03-04T10:00:00Z', 'OMNI_TOKEN expired on 2026-03-04: make a new one with omni setup-token'],
        [1_767_225_600_000, 'OMNI_TOKEN expired on 2026-01-01: make a new one with omni setup-token'],
        [undefined, 'OMNI_TOKEN expired: make a new one with omni setup-token'],
        ['not a date', 'OMNI_TOKEN expired: make a new one with omni setup-token'],
      ] as const) {
        const page = fakePage({ trades: [refused({ reason: 'expired', expires_at: expiresAt })] });
        const client = signedInClient({ askUrl: ASK_URL, tokens: undefined, home: undefined, omniToken: TOKEN, fetch: page.fetch, callMs: undefined });
        expect((await failureOf(client?.readBusiness('acme/api') ?? Promise.resolve())).message).toBe(line);
      }
    });

    it('names the workspace and the login as the page gives them, or plainly without', async () => {
      for (const [body, line] of [
        [{ login: 'ada', workspace: 'Acme' }, 'OMNI_TOKEN: ada is no longer a member of Acme'],
        [{}, 'OMNI_TOKEN: its maker is no longer a member of its workspace'],
      ] as const) {
        const page = fakePage({ trades: [refused({ reason: 'not-a-member', ...body })] });
        const client = signedInClient({ askUrl: ASK_URL, tokens: undefined, home: undefined, omniToken: TOKEN, fetch: page.fetch, callMs: undefined });
        expect((await failureOf(client?.readBusiness('acme/api') ?? Promise.resolve())).message).toBe(line);
      }
    });

    it('says what the page answered when it is no refusal, and when it hands back no access token', async () => {
      const down = fakePage({ trades: [Response.json({ error: 'kit tokens are not set up here' }, { status: 503 })] });
      const first = signedInClient({ askUrl: ASK_URL, tokens: undefined, home: undefined, omniToken: TOKEN, fetch: down.fetch, callMs: undefined });
      const error = await failureOf(first?.readBusiness('acme/api') ?? Promise.resolve());
      expect(error.message).toBe(`OMNI_TOKEN: ${HOST} answered 503: kit tokens are not set up here`);
      expect(error.status).toBe(503);

      const empty = fakePage({ trades: [Response.json({ refresh_token: null })] });
      const second = signedInClient({ askUrl: ASK_URL, tokens: undefined, home: undefined, omniToken: TOKEN, fetch: empty.fetch, callMs: undefined });
      expect((await failureOf(second?.readBusiness('acme/api') ?? Promise.resolve())).message).toBe(`OMNI_TOKEN: ${HOST} answered with no access token`);
    });
  });

  it('renews by trading the token: renewed, refused or unreachable', async () => {
    const outcomes = [];
    for (const reply of [traded('cloud-access-1'), refused({ reason: 'revoked' }), Response.json({}, { status: 403 }), Response.json({}, { status: 500 }), 'down'] as const) {
      const page = fakePage({ trades: [reply] });
      const client = signedInClient({ askUrl: ASK_URL, tokens: undefined, home: undefined, omniToken: TOKEN, fetch: page.fetch, callMs: undefined });
      outcomes.push(await client?.renew());
    }
    expect(outcomes).toEqual(['renewed', 'refused', 'refused', 'unreachable', 'unreachable']);
  });

  it('signs in with the repository, answering who and where it goes', async () => {
    const page = fakePage({ trades: [traded('cloud-access-1')] });
    const client = signedInClient({ askUrl: ASK_URL, tokens: undefined, home: undefined, omniToken: TOKEN, fetch: page.fetch, callMs: undefined, now: () => NOW });
    await expect(client?.tradeToken({ repo: 'acme/api' })).resolves.toEqual({ login: 'ada', email: null, workspace: { slug: 'acme', name: 'Acme' }, reason: null });
    expect(page.trades().map((request) => request.body)).toEqual([{ omni_token: TOKEN, repo: 'acme/api' }]);
    // The access token it got serves the next call.
    await client?.readBusiness('acme/api');
    expect(page.trades()).toHaveLength(1);
  });

  it('is the file sign-in, unchanged, when OMNI_TOKEN is unset', async () => {
    const page = fakePage({ trades: [] });
    const client = signedInClient({ askUrl: ASK_URL, tokens: undefined, home: homeWithFile(), omniToken: null, fetch: page.fetch, callMs: undefined });
    await client?.readBusiness('acme/api');
    expect(page.sent.map((request) => request.authorization)).toEqual(['Bearer laptop-access']);
    expect(signedInClient({ askUrl: ASK_URL, tokens: undefined, home: mkdtempSync(join(tmpdir(), 'omni-home-')), fetch: page.fetch, callMs: undefined })).toBeNull();
  });
});

describe('the token store OMNI_TOKEN builds', () => {
  it('keeps the access token in memory only, and reads as signed in before the first trade', () => {
    const store = homeTokens({ home: homeWithFile(), omniToken: TOKEN });
    expect(store.omniToken).toBe(TOKEN);
    expect(store.read(HOST)).toBeTruthy();
    store.write(HOST, { access_token: 'cloud-access-1', expires_at: 1 });
    expect(store.read(HOST)).toEqual({ access_token: 'cloud-access-1', expires_at: 1 });
    expect(homeTokens({ home: homeWithFile(), omniToken: null }).read(HOST)).toEqual(KEPT[HOST]);
  });

  it('shows the last four characters, never more', () => {
    expect(omniTokenTail(TOKEN)).toBe('9wQv');
    expect(omniTokenTail(TOKEN)).toHaveLength(4);
  });
});
