// `omni signin`, `omni whoami` and `omni signout` under `OMNI_TOKEN` (PRD 1628), through `main()` on
// a fixture repository: the page is a fake `fetch`, the browser one that only notes what it was
// asked to open, and the home folder a temporary one holding a laptop's sign-in, which no command
// reads or changes while the token is set. Every line the commands print is swept for the token.
import { existsSync, mkdirSync, mkdtempSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { makeRepo } from '../../test/fixture.ts';
import { main } from '../omni.ts';

const ASK_URL = 'https://omni.example.com';
const HOST = 'omni.example.com';
const TOKEN = 'omk_Zq9xW3vK7pL2mN8bR4tY6uJ1hG5fD0sA_-cE3iO9wQv';
const FILE = ['.config', 'omni', 'credentials.json'];
const KEPT = JSON.stringify({ [HOST]: { access_token: 'laptop-access', refresh_token: 'laptop-refresh', expires_at: 1, email: 'laptop@example.com' } });

/** Every line a test printed, swept at the end for the token: nothing past its last four. */
const printed: string[] = [];

function io() {
  const out: string[] = [];
  const err: string[] = [];
  const keep = (into: string[]) => ({ write: (s: string) => { into.push(s); printed.push(s); } });
  return { out: () => out.join(''), err: () => err.join(''), stdout: keep(out), stderr: keep(err) };
}

function homeWithFile(): string {
  const dir = mkdtempSync(join(tmpdir(), 'omni-home-'));
  mkdirSync(join(dir, '.config', 'omni'), { recursive: true });
  writeFileSync(join(dir, ...FILE), KEPT, { mode: 0o600 });
  return dir;
}

const checkout = (url: string | null = ASK_URL) =>
  makeRepo({ git: true, files: { '.omni-loop/config.yml': `kit: 1\nrepo:\n  slug: acme/api\nask:\n  url: ${url ?? 'null'}\n` } }).root;

/** The page, faked: the token exchange answers `reply` (or fails as a network does with `'down'`). */
function page(reply: Record<string, unknown> | Response | 'down' = {}) {
  const sent: { url: string; body: unknown }[] = [];
  const fetch = (url: string, init: RequestInit): Promise<Response> => {
    sent.push({ url, body: typeof init.body === 'string' ? JSON.parse(init.body) : null });
    if (reply === 'down') return Promise.reject(new TypeError('fetch failed'));
    if (reply instanceof Response) return Promise.resolve(reply);
    return Promise.resolve(Response.json({ access_token: 'cloud-access', refresh_token: null, expires_at: 4_000_000_000, login: 'ada', email: null, ...reply }));
  };
  return { fetch, sent };
}

async function run(argv: string[], { reply, env = { OMNI_TOKEN: TOKEN }, url }: { reply?: Parameters<typeof page>[0]; env?: Record<string, string>; url?: string | null } = {}) {
  const root = checkout(url);
  const home = homeWithFile();
  const mtime = statSync(join(home, ...FILE)).mtimeMs;
  const opened: string[] = [];
  const fake = page(reply);
  const std = io();
  const code = await main(argv, { cwd: root, ...std, env, home, fetch: fake.fetch, openBrowser: (link: string) => opened.push(link), waitMs: 50 });
  const untouched = existsSync(join(home, ...FILE)) && readFileSync(join(home, ...FILE), 'utf8') === KEPT && statSync(join(home, ...FILE)).mtimeMs === mtime;
  return { code, out: std.out(), err: std.err(), sent: fake.sent, opened, untouched };
}

const refused = (body: Record<string, unknown>) => Response.json({ error: 'the kit token was refused', ...body }, { status: 401 });

describe('omni signin under OMNI_TOKEN', () => {
  it('signs in by the token with the repository, opens no browser and keeps nothing', async () => {
    const result = await run(['signin'], { reply: { workspace: { slug: 'acme', name: 'Acme' } } });
    expect(result).toMatchObject({ code: 0, err: '', out: 'signed in by OMNI_TOKEN as ada — acme/api goes to Acme\n', opened: [], untouched: true });
    expect(result.sent).toEqual([{ url: `${ASK_URL}/api/ask/token`, body: { omni_token: TOKEN, repo: 'acme/api' } }]);
  });

  it('says the page\'s reason when no workspace takes the repository, and just who without either', async () => {
    const reason = 'no workspace owns acme/api yet — install the Omni App: https://github.com/apps/omni-loop/installations/new';
    expect((await run(['signin'], { reply: { workspace: null, reason } })).out).toBe(`signed in by OMNI_TOKEN as ada — ${reason}\n`);
    expect((await run(['signin'], { reply: { login: null, email: 'ada@example.com' } })).out).toBe('signed in by OMNI_TOKEN as ada@example.com\n');
  });

  it('opens the browser as it always has when OMNI_TOKEN is unset', async () => {
    const result = await run(['signin'], { env: {} });
    expect(result.opened).toHaveLength(1);
    expect(result.sent).toEqual([]);
  });
});

describe('omni whoami under OMNI_TOKEN', () => {
  it('prints the login and the token\'s last four, from a fresh trade', async () => {
    const result = await run(['whoami']);
    expect(result).toMatchObject({ code: 0, err: '', out: 'ada (OMNI_TOKEN ··9wQv)\n', untouched: true });
    expect(result.sent).toEqual([{ url: `${ASK_URL}/api/ask/token`, body: { omni_token: TOKEN } }]);
  });

  it('names the email when the page gives no login, and the host when it gives neither', async () => {
    expect((await run(['whoami'], { reply: { login: null, email: 'ada@example.com' } })).out).toBe('ada@example.com (OMNI_TOKEN ··9wQv)\n');
    expect((await run(['whoami'], { reply: { login: null } })).out).toBe(`signed in to ${HOST} (OMNI_TOKEN ··9wQv)\n`);
  });
});

describe('a token that does not work: one line, exit 1, for signin and whoami alike', () => {
  const cases: [string, () => Parameters<typeof page>[0], string][] = [
    ['expired', () => refused({ reason: 'expired', expires_at: 1_767_225_600 }), 'OMNI_TOKEN expired on 2026-01-01: make a new one with omni setup-token'],
    ['revoked', () => refused({ reason: 'revoked' }), 'OMNI_TOKEN was revoked: make a new one with omni setup-token'],
    ['not-a-member', () => refused({ reason: 'not-a-member', login: 'ada', workspace: { slug: 'acme', name: 'Acme' } }), 'OMNI_TOKEN: ada is no longer a member of Acme'],
    ['unreachable', () => 'down', `OMNI_TOKEN: cannot reach ${HOST}: allow it in your environment's network access`],
  ];
  for (const [name, reply, line] of cases) {
    for (const command of ['signin', 'whoami']) {
      it(`${command}: ${name}`, async () => {
        const result = await run([command], { reply: reply() });
        expect(result).toMatchObject({ code: 1, out: '', err: `${line}\n`, opened: [], untouched: true });
      });
    }
  }
});

describe('omni signout under OMNI_TOKEN', () => {
  it('deletes nothing, says to revoke the token on the profile page, and exits 1', async () => {
    const result = await run(['signout']);
    expect(result).toMatchObject({ code: 1, out: '', err: 'OMNI_TOKEN is set in this environment: revoke it on your profile page\n', sent: [], untouched: true });
  });

  it('forgets the kept sign-in as it always has when OMNI_TOKEN is unset', async () => {
    const result = await run(['signout'], { env: {} });
    expect(result).toMatchObject({ code: 0, out: `signed out of ${HOST}\n`, untouched: false });
  });
});

describe('the token\'s commands without ask.url, or with a malformed token', () => {
  it('says ask mode is not set up, as without a token', async () => {
    for (const command of ['signin', 'whoami', 'signout']) {
      const result = await run([command], { url: null });
      expect(result).toMatchObject({ code: 1, err: 'ask mode is not set up for this repository (ask.url)\n', sent: [] });
    }
  });

  it('stops every command on a malformed token with one line naming the variable', async () => {
    for (const command of ['signin', 'whoami', 'signout', 'statusline']) {
      const result = await run([command], { env: { OMNI_TOKEN: `${TOKEN.slice(0, -1)}=` } });
      expect(result.code).toBe(2);
      expect(result.err).toMatch(/^environment: OMNI_TOKEN is not valid: [^\n]+\n$/);
      expect(result.sent).toEqual([]);
    }
  });
});

describe('the sweep', () => {
  it('finds no token past its last four in any line these tests printed', () => {
    expect(printed.length).toBeGreaterThan(0);
    const text = printed.join('');
    for (let at = 0; at + 5 <= TOKEN.length; at += 1) expect(text).not.toContain(TOKEN.slice(at, at + 5));
  });
});
