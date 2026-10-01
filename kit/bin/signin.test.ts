// `omni signin`, `omni signout` and `omni whoami`, seen from the outside: the browser is faked by a
// plain HTTP GET on the loopback callback, the sign-in server by the fake contract server, and the
// home folder by a temporary one — the real `~/.config/omni/` is never touched.
import { existsSync, mkdirSync, mkdtempSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { homeTokens } from '../lib/ask/client-tokens.ts';
import { startFakeAskServer } from '../test/fake-ask-server.ts';
import { makeRepo } from '../test/fixture.ts';
import { main } from './omni.ts';
import type { FakeAskServer } from '../test/fake-ask-server.ts';

const FILE = ['.config', 'omni', 'credentials.json'];

function io() {
  const out: string[] = [];
  const err: string[] = [];
  return { out, err, text: () => out.join(''), errors: () => err.join(''), stdout: { write: (s: string) => out.push(s) }, stderr: { write: (s: string) => err.push(s) } };
}

function freshHome(entries?: Record<string, Record<string, unknown>>) {
  const dir = mkdtempSync(join(tmpdir(), 'omni-home-'));
  if (entries) {
    mkdirSync(join(dir, '.config', 'omni'), { recursive: true });
    writeFileSync(join(dir, ...FILE), JSON.stringify(entries), { mode: 0o600 });
  }
  return dir;
}

const credentialsOf = (home: string) => JSON.parse(readFileSync(join(home, ...FILE), 'utf8'));
const repoWith = (url: string | null) => makeRepo({ git: true, files: { '.omni-loop/config.yml': `kit: 1\nask:\n  url: ${url === null ? 'null' : url}\n` } });

/**
 * A browser that does what the sign-in page does once the person has signed in: it comes back to the
 * loopback with the state it was given and a code — or with whatever `callbacks` says instead.
 */
function fakeBrowser({ code = 'code-1', callbacks }: { code?: string; callbacks?: (state: string | null) => string[] } = {}) {
  const opened: string[] = [];
  const visits: Promise<{ status: number; body: string }[]>[] = [];
  const open = (url: string) => {
    opened.push(url);
    const page = new URL(url);
    const port = page.searchParams.get('port');
    const state = page.searchParams.get('state');
    const queries = callbacks ? callbacks(state) : [`state=${encodeURIComponent(String(state))}&code=${code}`];
    const visit = (async () => {
      const results: { status: number; body: string }[] = [];
      for (const query of queries) {
        const response = await fetch(`http://127.0.0.1:${port}/callback?${query}`);
        results.push({ status: response.status, body: await response.text() });
      }
      return results;
    })();
    visits.push(visit);
  };
  return { open, opened, visits };
}

let server: FakeAskServer | undefined;
afterEach(async () => {
  await server?.close();
  server = undefined;
});

describe('omni signin', () => {
  it('opens <ask.url>/ask/signin with a port and a state, and keeps the sign-in at mode 0600 keyed by the host', async () => {
    server = await startFakeAskServer({ codes: ['code-1'], email: 'ada@example.com' });
    const { root } = repoWith(server.url);
    const home = freshHome({ 'other.example.com': { access_token: 'x' } });
    const browser = fakeBrowser();
    const std = io();

    const code = await main(['signin'], { cwd: root, ...std, home, openBrowser: browser.open });

    expect(std.errors()).toBe('');
    expect(code).toBe(0);
    expect(browser.opened).toHaveLength(1);
    const page = new URL(String(browser.opened[0]));
    expect(`${page.origin}${page.pathname}`).toBe(`${server.url}/ask/signin`);
    expect(Number(page.searchParams.get('port'))).toBeGreaterThan(0);
    expect(page.searchParams.get('state')).toMatch(/^[A-Za-z0-9_-]{32,}$/);
    expect(std.text()).toContain(browser.opened[0]);
    expect(std.text().trim().split('\n').at(-1)).toBe('signed in as ada@example.com');

    const [visit] = await Promise.all(browser.visits);
    expect(visit![0]).toMatchObject({ status: 200 });
    expect(server.calls.at(-1)).toMatchObject({ method: 'POST', path: '/api/ask/token', body: { code: 'code-1' } });
    expect(statSync(join(home, ...FILE)).mode & 0o777).toBe(0o600);
    const kept = credentialsOf(home);
    expect(Object.keys(kept).sort()).toEqual(['127.0.0.1:' + server.port, 'other.example.com'].sort());
    expect(kept[server.host]).toEqual({ access_token: 'access-2', refresh_token: 'refresh-2', expires_at: expect.any(Number), email: 'ada@example.com' });
    // The hooks read the very same entry.
    expect(homeTokens({ home }).read(server.host)).toEqual(kept[server.host]);
  });

  describe('names where the checkout\'s repository goes, and exits 0 on each (PRD 459)', () => {
    const INSTALL = 'https://github.com/apps/omni-loop/installations/new';
    const cases: [Record<string, unknown>, string][] = [
      [{ workspace: { slug: 'acme', name: 'Acme' } }, 'signed in as ned — acme/api goes to Acme'],
      [{ workspace: null, reason: `no workspace owns acme/api yet — install the Omni App: ${INSTALL}` }, `signed in as ned — no workspace owns acme/api yet — install the Omni App: ${INSTALL}`],
      [{ workspace: null, reason: 'you are not a member of Globex, which owns acme/api' }, 'signed in as ned — you are not a member of Globex, which owns acme/api'],
    ];
    for (const [where, line] of cases) {
      it(line, async () => {
        // The fake page, with the token reply the real one gives: the login, where the repository
        // goes, and no email (a GitHub account that keeps it private).
        server = await startFakeAskServer({ codes: ['code-1'] });
        const sent: unknown[] = [];
        const fetch = async (url: string, init: RequestInit) => {
          const response = await globalThis.fetch(url, init);
          if (!String(url).endsWith('/api/ask/token')) return response;
          sent.push(JSON.parse(String(init.body)));
          const { email: _hidden, ...tokens } = await response.json();
          return Response.json({ ...tokens, login: 'ned', ...where }, { status: response.status });
        };
        const { root } = makeRepo({ git: true, files: { '.omni-loop/config.yml': `kit: 1\nrepo:\n  slug: acme/api\nask:\n  url: ${server.url}\n` } });
        const home = freshHome();
        const std = io();

        expect(await main(['signin'], { cwd: root, ...std, home, openBrowser: fakeBrowser().open, fetch })).toBe(0);

        expect(std.errors()).toBe('');
        expect(std.text().trim().split('\n').at(-1)).toBe(line);
        expect(sent).toEqual([{ code: 'code-1', repo: 'acme/api' }]);
        expect(credentialsOf(home)[server.host]).toEqual({ access_token: 'access-2', refresh_token: 'refresh-2', expires_at: expect.any(Number), login: 'ned' });
      });
    }
  });

  it('opens a new state on every run', async () => {
    server = await startFakeAskServer({ codes: ['code-1', 'code-2'] });
    const { root } = repoWith(server.url);
    const home = freshHome();
    const first = fakeBrowser({ code: 'code-1' });
    const second = fakeBrowser({ code: 'code-2' });
    expect(await main(['signin'], { cwd: root, ...io(), home, openBrowser: first.open })).toBe(0);
    expect(await main(['signin'], { cwd: root, ...io(), home, openBrowser: second.open })).toBe(0);
    const stateOf = (url: string) => new URL(url).searchParams.get('state');
    expect(stateOf(String(first.opened[0]))).not.toBe(stateOf(String(second.opened[0])));
  });

  it('refuses a callback with another state, writes nothing for it, and takes the right one', async () => {
    server = await startFakeAskServer({ codes: ['code-1', 'planted'] });
    const { root } = repoWith(server.url);
    const home = freshHome();
    const browser = fakeBrowser({ callbacks: (state) => ['state=not-this-terminal&code=planted', `state=${state}&code=code-1`] });

    expect(await main(['signin'], { cwd: root, ...io(), home, openBrowser: browser.open })).toBe(0);

    const [visit] = await Promise.all(browser.visits);
    expect(visit!.map((v: { status: number }) => v.status)).toEqual([400, 200]);
    expect(server.calls.filter((c) => c.path === '/api/ask/token').map((c) => c.body)).toEqual([{ code: 'code-1' }]);
  });

  it('writes nothing when only a callback with another state comes back', async () => {
    server = await startFakeAskServer({ codes: ['planted'] });
    const { root } = repoWith(server.url);
    const home = freshHome();
    const browser = fakeBrowser({ callbacks: () => ['state=not-this-terminal&code=planted'] });
    const std = io();

    expect(await main(['signin'], { cwd: root, ...std, home, openBrowser: browser.open, waitMs: 300 })).toBe(1);

    expect(std.errors()).toMatch(/no sign-in came back/);
    expect(existsSync(join(home, ...FILE))).toBe(false);
    expect(server.calls.filter((c) => c.path === '/api/ask/token')).toEqual([]);
  });

  it('writes nothing, and says why, when the server refuses the code', async () => {
    server = await startFakeAskServer({ codes: [] });
    const { root } = repoWith(server.url);
    const home = freshHome();
    const std = io();

    expect(await main(['signin'], { cwd: root, ...std, home, openBrowser: fakeBrowser({ code: 'unknown' }).open })).toBe(1);

    expect(std.errors()).toMatch(/omni signin: the sign-in was refused: invalid grant/);
    expect(existsSync(join(home, ...FILE))).toBe(false);
  });

  it('still waits for the browser when it could not be opened: the link is printed to open by hand', async () => {
    server = await startFakeAskServer({ codes: ['code-1'] });
    const { root } = repoWith(server.url);
    const home = freshHome();
    const browser = fakeBrowser();
    const std = io();
    const failing = (url: string) => {
      browser.open(url);
      throw new Error('no browser here');
    };

    expect(await main(['signin'], { cwd: root, ...std, home, openBrowser: failing })).toBe(0);
    expect(std.text()).toContain(browser.opened[0]);
  });

  it('exits 1 with one line when ask.url is not set, and opens nothing', async () => {
    const { root } = repoWith(null);
    const home = freshHome();
    const browser = fakeBrowser();
    const std = io();

    expect(await main(['signin'], { cwd: root, ...std, home, openBrowser: browser.open })).toBe(1);

    expect(std.errors()).toBe('ask mode is not set up for this repository (ask.url)\n');
    expect(browser.opened).toEqual([]);
  });

  it('takes no arguments', async () => {
    const { root } = repoWith('https://ask.example.com');
    const std = io();
    expect(await main(['signin', 'now'], { cwd: root, ...std, home: freshHome() })).toBe(2);
    expect(await main(['signin', '--force'], { cwd: root, ...std, home: freshHome() })).toBe(2);
  });
});

describe('omni whoami', () => {
  it('prints the email of the sign-in kept for the host of ask.url, calling nothing while it is fresh', async () => {
    const { root } = repoWith('https://ask.example.com/');
    const later = Math.floor(Date.now() / 1000) + 3600;
    const home = freshHome({ 'ask.example.com': { access_token: 'a', refresh_token: 'r', expires_at: later, email: 'ada@example.com' } });
    const std = io();
    const fetch = () => { throw new Error('no call expected'); };
    expect(await main(['whoami'], { cwd: root, ...std, home, fetch })).toBe(0);
    expect(std.text()).toBe('ada@example.com\n');
  });

  it('renews an expired sign-in, keeps the new tokens and prints the email', async () => {
    server = await startFakeAskServer({ refreshToken: 'refresh-1', email: 'ada@example.com' });
    const { root } = repoWith(server.url);
    const home = freshHome({ [server.host]: { access_token: 'access-1', refresh_token: 'refresh-1', expires_at: 1, email: 'ada@example.com' } });
    const std = io();
    expect(await main(['whoami'], { cwd: root, ...std, home })).toBe(0);
    expect(std.text()).toBe('ada@example.com\n');
    expect(credentialsOf(home)[server.host]).toMatchObject({ access_token: 'access-2', refresh_token: 'refresh-2' });
  });

  it('says the sign-in is no longer valid when the renewal is refused', async () => {
    server = await startFakeAskServer({ refreshToken: 'refresh-1' });
    server.expireRefresh();
    const { root } = repoWith(server.url);
    const home = freshHome({ [server.host]: { access_token: 'access-1', refresh_token: 'refresh-1', expires_at: 1, email: 'ada@example.com' } });
    const std = io();
    expect(await main(['whoami'], { cwd: root, ...std, home })).toBe(1);
    expect(std.text()).toBe('');
    expect(std.errors()).toBe(`the sign-in of ada@example.com to ${server.host} is no longer valid: run \`omni signin\` again\n`);
  });

  it('still prints the email when an expired sign-in cannot be checked, and says why', async () => {
    const { root } = repoWith('https://ask.example.com');
    const home = freshHome({ 'ask.example.com': { access_token: 'a', refresh_token: 'r', expires_at: 1, email: 'ada@example.com' } });
    const std = io();
    const fetch = () => Promise.reject(new TypeError('fetch failed'));
    expect(await main(['whoami'], { cwd: root, ...std, home, fetch })).toBe(0);
    expect(std.text()).toBe('ada@example.com (not checked: ask.example.com is unreachable)\n');
  });

  it('prints "signed out" with no sign-in for that host', async () => {
    const { root } = repoWith('https://ask.example.com');
    for (const home of [freshHome(), freshHome({ 'other.example.com': { access_token: 'a', email: 'bob@example.com' } })]) {
      const std = io();
      expect(await main(['whoami'], { cwd: root, ...std, home })).toBe(0);
      expect(std.text()).toBe('signed out\n');
    }
  });

  it('exits 1 with one line when ask.url is not set', async () => {
    const std = io();
    expect(await main(['whoami'], { cwd: repoWith(null).root, ...std, home: freshHome() })).toBe(1);
    expect(std.errors()).toBe('ask mode is not set up for this repository (ask.url)\n');
  });
});

describe('omni signout', () => {
  it('deletes the host\'s entry, keeps every other host, and leaves the file at mode 0600', async () => {
    const { root } = repoWith('https://ask.example.com');
    const home = freshHome({
      'ask.example.com': { access_token: 'a', refresh_token: 'r', expires_at: 1, email: 'ada@example.com' },
      'other.example.com': { access_token: 'x' },
    });
    const std = io();

    expect(await main(['signout'], { cwd: root, ...std, home })).toBe(0);

    expect(std.text()).toBe('signed out of ask.example.com\n');
    expect(credentialsOf(home)).toEqual({ 'other.example.com': { access_token: 'x' } });
    expect(statSync(join(home, ...FILE)).mode & 0o777).toBe(0o600);
    const after = io();
    expect(await main(['whoami'], { cwd: root, ...after, home })).toBe(0);
    expect(after.text()).toBe('signed out\n');
  });

  it('says so, and exits 0, when there was nothing to sign out of', async () => {
    const std = io();
    expect(await main(['signout'], { cwd: repoWith('https://ask.example.com').root, ...std, home: freshHome() })).toBe(0);
    expect(std.text()).toBe('signed out\n');
  });

  it('exits 1 with one line when ask.url is not set', async () => {
    const std = io();
    expect(await main(['signout'], { cwd: repoWith(null).root, ...std, home: freshHome() })).toBe(1);
    expect(std.errors()).toBe('ask mode is not set up for this repository (ask.url)\n');
  });
});

describe('outside a repository', () => {
  it('each command is a configuration error, exit 2', async () => {
    const outside = mkdtempSync(join(tmpdir(), 'omni-bare-'));
    for (const command of ['signin', 'signout', 'whoami']) {
      const std = io();
      expect(await main([command], { cwd: outside, ...std, home: freshHome() })).toBe(2);
      expect(std.errors()).toMatch(/not inside a git repository/);
    }
  });
});
