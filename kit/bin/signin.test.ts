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

const credentialsOf = (home: string) => JSON.parse(readFileSync(join(home, ...FILE), 'utf8')) as Record<string, unknown>;
/** Matches any number, inside an expected object. */
const anyNumber: unknown = expect.any(Number);
/** A laptop: no remote session, not Linux, so `omni signin` takes the loopback whatever runs the tests. */
const LAPTOP = { env: {}, platform: 'darwin' };
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

let server: FakeAskServer;
/** Every server a test started, each closed after it: the next test starts its own. */
const started: FakeAskServer[] = [];
afterEach(async () => {
  for (const running of started.splice(0)) await running.close();
});

/** Starts a fake server, closed after the test. */
async function startServer(options: Parameters<typeof startFakeAskServer>[0]) {
  const fake = await startFakeAskServer(options);
  started.push(fake);
  return fake;
}

describe('omni signin', () => {
  it('opens <ask.url>/ask/signin with a port and a state, and keeps the sign-in at mode 0600 keyed by the host', async () => {
    server = await startServer({ codes: ['code-1'], email: 'ada@example.com' });
    const { root } = repoWith(server.url);
    const home = freshHome({ 'other.example.com': { access_token: 'x' } });
    const browser = fakeBrowser();
    const std = io();

    const code = await main(['signin'], { ...LAPTOP, cwd: root, ...std, home, openBrowser: browser.open });

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
    expect(visit?.[0]).toMatchObject({ status: 200 });
    expect(server.calls.at(-1)).toMatchObject({ method: 'POST', path: '/api/ask/token', body: { code: 'code-1' } });
    expect(statSync(join(home, ...FILE)).mode & 0o777).toBe(0o600);
    const kept = credentialsOf(home);
    expect(Object.keys(kept).sort()).toEqual([`127.0.0.1:${server.port}`, 'other.example.com'].sort());
    expect(kept[server.host]).toEqual({ access_token: 'access-2', refresh_token: 'refresh-2', expires_at: anyNumber, email: 'ada@example.com' });
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
        server = await startServer({ codes: ['code-1'] });
        const sent: unknown[] = [];
        const fetch = async (url: string, init: RequestInit) => {
          const response = await globalThis.fetch(url, init);
          if (!url.endsWith('/api/ask/token')) return response;
          sent.push(JSON.parse(typeof init.body === 'string' ? init.body : ''));
          const reply = (await response.json()) as object;
          const tokens = Object.fromEntries(Object.entries(reply).filter(([key]) => key !== 'email'));
          return Response.json({ ...tokens, login: 'ned', ...where }, { status: response.status });
        };
        const { root } = makeRepo({ git: true, files: { '.omni-loop/config.yml': `kit: 1\nrepo:\n  slug: acme/api\nask:\n  url: ${server.url}\n` } });
        const home = freshHome();
        const std = io();

        expect(await main(['signin'], { ...LAPTOP, cwd: root, ...std, home, openBrowser: fakeBrowser().open, fetch })).toBe(0);

        expect(std.errors()).toBe('');
        expect(std.text().trim().split('\n').at(-1)).toBe(line);
        expect(sent).toEqual([{ code: 'code-1', repo: 'acme/api' }]);
        expect(credentialsOf(home)[server.host]).toEqual({ access_token: 'access-2', refresh_token: 'refresh-2', expires_at: anyNumber, login: 'ned' });
      });
    }
  });

  it('opens a new state on every run', async () => {
    server = await startServer({ codes: ['code-1', 'code-2'] });
    const { root } = repoWith(server.url);
    const home = freshHome();
    const first = fakeBrowser({ code: 'code-1' });
    const second = fakeBrowser({ code: 'code-2' });
    expect(await main(['signin'], { ...LAPTOP, cwd: root, ...io(), home, openBrowser: first.open })).toBe(0);
    expect(await main(['signin'], { ...LAPTOP, cwd: root, ...io(), home, openBrowser: second.open })).toBe(0);
    const stateOf = (url: string) => new URL(url).searchParams.get('state');
    expect(stateOf(String(first.opened[0]))).not.toBe(stateOf(String(second.opened[0])));
  });

  it('refuses a callback with another state, writes nothing for it, and takes the right one', async () => {
    server = await startServer({ codes: ['code-1', 'planted'] });
    const { root } = repoWith(server.url);
    const home = freshHome();
    const browser = fakeBrowser({ callbacks: (state) => ['state=not-this-terminal&code=planted', `state=${state}&code=code-1`] });

    expect(await main(['signin'], { ...LAPTOP, cwd: root, ...io(), home, openBrowser: browser.open })).toBe(0);

    const [visit] = await Promise.all(browser.visits);
    expect(visit?.map((v) => v.status)).toEqual([400, 200]);
    expect(server.calls.filter((c) => c.path === '/api/ask/token').map((c): unknown => c.body)).toEqual([{ code: 'code-1' }]);
  });

  it('writes nothing when only a callback with another state comes back', async () => {
    server = await startServer({ codes: ['planted'] });
    const { root } = repoWith(server.url);
    const home = freshHome();
    const browser = fakeBrowser({ callbacks: () => ['state=not-this-terminal&code=planted'] });
    const std = io();

    expect(await main(['signin'], { ...LAPTOP, cwd: root, ...std, home, openBrowser: browser.open, waitMs: 300 })).toBe(1);

    expect(std.errors()).toMatch(/no sign-in came back/);
    expect(existsSync(join(home, ...FILE))).toBe(false);
    expect(server.calls.filter((c) => c.path === '/api/ask/token')).toEqual([]);
  });

  it('writes nothing, and says why, when the server refuses the code', async () => {
    server = await startServer({ codes: [] });
    const { root } = repoWith(server.url);
    const home = freshHome();
    const std = io();

    expect(await main(['signin'], { ...LAPTOP, cwd: root, ...std, home, openBrowser: fakeBrowser({ code: 'unknown' }).open })).toBe(1);

    expect(std.errors()).toMatch(/omni signin: the sign-in was refused: invalid grant/);
    expect(existsSync(join(home, ...FILE))).toBe(false);
  });

  it('still waits for the browser when it could not be opened: the link is printed to open by hand', async () => {
    server = await startServer({ codes: ['code-1'] });
    const { root } = repoWith(server.url);
    const home = freshHome();
    const browser = fakeBrowser();
    const std = io();
    const failing = (url: string) => {
      browser.open(url);
      throw new Error('no browser here');
    };

    expect(await main(['signin'], { ...LAPTOP, cwd: root, ...std, home, openBrowser: failing })).toBe(0);
    expect(std.text()).toContain(browser.opened[0]);
  });

  it('exits 1 with one line when ask.url is not set, and opens nothing', async () => {
    const { root } = repoWith(null);
    const home = freshHome();
    const browser = fakeBrowser();
    const std = io();

    expect(await main(['signin'], { ...LAPTOP, cwd: root, ...std, home, openBrowser: browser.open })).toBe(1);

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

/** A Claude Code cloud session: the terminal is on another machine than the person's browser. */
const CLOUD = { env: { CLAUDE_CODE_REMOTE: 'true' }, platform: 'linux' };
const USER_CODE = 'WXYZ-4821';
const DEVICE_CODE = 'd'.repeat(43);

type PollReply = { status: number; body: unknown } | 'unreachable';

/**
 * The Omni page's device routes in front of the fake server (which answers the token exchange): the
 * issue answers `issue` (a status, or `unreachable`), each poll the next of `polls`, `pending` once
 * they run out. Short intervals keep the tests fast; every device call is kept.
 */
function devicePage({ issue = 200, issued = {}, polls = [] }: { issue?: number | 'unreachable'; issued?: Record<string, unknown>; polls?: PollReply[] } = {}) {
  const calls: { path: string; body: unknown }[] = [];
  const queue = [...polls];
  const fetch = (url: string, init: RequestInit): Promise<Response> => {
    const path = new URL(url).pathname;
    if (!path.startsWith('/api/ask/device')) return globalThis.fetch(url, init);
    calls.push({ path, body: JSON.parse(typeof init.body === 'string' ? init.body : 'null') });
    if (path === '/api/ask/device') {
      if (issue === 'unreachable') return Promise.reject(new TypeError('fetch failed'));
      const body = issue === 200 ? { device_code: DEVICE_CODE, user_code: USER_CODE, url: `https://elsewhere.test/ask/device?user_code=${USER_CODE}`, interval: 0.01, expires_in: 600, ...issued } : { error: 'not found' };
      return Promise.resolve(Response.json(body, { status: issue }));
    }
    const next = queue.shift() ?? { status: 200, body: { status: 'pending' } };
    if (next === 'unreachable') return Promise.reject(new TypeError('fetch failed'));
    return Promise.resolve(Response.json(next.body, { status: next.status }));
  };
  return { fetch, calls, polls: () => calls.filter((call) => call.path === '/api/ask/device/poll') };
}

const approved = (code = 'code-1'): PollReply => ({ status: 200, body: { status: 'approved', code } });
const pending: PollReply = { status: 200, body: { status: 'pending' } };

describe('omni signin, by device code (PRD 1660)', () => {
  it('in a cloud session prints the link and the code, opens no browser, polls, trades the code and signs in', async () => {
    server = await startServer({ codes: ['code-1'], email: 'ada@example.com' });
    const { root } = makeRepo({ git: true, files: { '.omni-loop/config.yml': `kit: 1\nrepo:\n  slug: acme/api\nask:\n  url: ${server.url}\n` } });
    const home = freshHome();
    const browser = fakeBrowser();
    const page = devicePage({ polls: [pending, approved()] });
    const std = io();

    const code = await main(['signin'], { ...CLOUD, cwd: root, ...std, home, openBrowser: browser.open, fetch: page.fetch });

    expect(std.errors()).toBe('');
    expect(code).toBe(0);
    expect(browser.opened).toEqual([]);
    const lines = std.text().trim().split('\n');
    expect(lines.slice(0, 2)).toEqual([
      `Sign in at ${server.url}/ask/device?user_code=${USER_CODE}`,
      `Check that the page shows ${USER_CODE}. Waiting (10 min)…`,
    ]);
    expect(lines.at(-1)).toBe('signed in as ada@example.com');
    expect(page.calls[0]).toEqual({ path: '/api/ask/device', body: { purpose: 'signin' } });
    expect(page.polls()).toEqual([
      { path: '/api/ask/device/poll', body: { device_code: DEVICE_CODE } },
      { path: '/api/ask/device/poll', body: { device_code: DEVICE_CODE } },
    ]);
    expect(server.calls.at(-1)).toMatchObject({ method: 'POST', path: '/api/ask/token', body: { code: 'code-1', repo: 'acme/api' } });
    expect(credentialsOf(home)[server.host]).toEqual({ access_token: 'access-2', refresh_token: 'refresh-2', expires_at: anyNumber, email: 'ada@example.com' });
    expect(statSync(join(home, ...FILE)).mode & 0o777).toBe(0o600);
  });

  it('takes the device flow on a laptop with --device', async () => {
    server = await startServer({ codes: ['code-1'] });
    const { root } = repoWith(server.url);
    const browser = fakeBrowser();
    const page = devicePage({ polls: [approved()] });
    const std = io();

    expect(await main(['signin', '--device'], { ...LAPTOP, cwd: root, ...std, home: freshHome(), openBrowser: browser.open, fetch: page.fetch })).toBe(0);

    expect(browser.opened).toEqual([]);
    expect(std.text()).toContain(`Sign in at ${server.url}/ask/device?user_code=${USER_CODE}`);
  });

  it('takes the device flow on Linux with no display, and the loopback with one', async () => {
    server = await startServer({ codes: ['code-1', 'code-2'] });
    const { root } = repoWith(server.url);
    const headless = devicePage({ polls: [approved('code-1')] });
    const noBrowser = fakeBrowser();
    expect(await main(['signin'], { env: {}, platform: 'linux', cwd: root, ...io(), home: freshHome(), openBrowser: noBrowser.open, fetch: headless.fetch })).toBe(0);
    expect(noBrowser.opened).toEqual([]);
    expect(headless.polls()).toHaveLength(1);

    const desktop = devicePage();
    const browser = fakeBrowser({ code: 'code-2' });
    expect(await main(['signin'], { env: { DISPLAY: ':0' }, platform: 'linux', cwd: root, ...io(), home: freshHome(), openBrowser: browser.open, fetch: desktop.fetch })).toBe(0);
    expect(browser.opened).toHaveLength(1);
    expect(server.calls.filter((c) => c.path === '/api/ask/token').map((c): unknown => c.body)).toEqual([{ code: 'code-1' }, { code: 'code-2' }]);
  });

  it('honours a slow_down and keeps polling until approved', async () => {
    server = await startServer({ codes: ['code-1'] });
    const { root } = repoWith(server.url);
    const page = devicePage({ polls: [pending, { status: 429, body: { status: 'slow_down', interval: 0.03 } }, pending, approved()] });
    const std = io();

    expect(await main(['signin'], { ...CLOUD, cwd: root, ...std, home: freshHome(), fetch: page.fetch })).toBe(0);

    expect(page.polls()).toHaveLength(4);
    expect(std.text().trim().split('\n').at(-1)).toBe('signed in as person@example.com');
  });

  const endings: [string, Parameters<typeof devicePage>[0], string][] = [
    ['refused in the browser', { polls: [pending, { status: 403, body: { status: 'denied' } }] }, 'omni signin: the sign-in was refused in the browser'],
    ['expired on the page', { polls: [{ status: 410, body: { status: 'expired' } }] }, 'omni signin: the sign-in link expired: run omni signin again'],
    ['past its own wait', { issued: { expires_in: 0.05 } }, 'omni signin: the sign-in link expired: run omni signin again'],
    ['unreachable while polling', { polls: [pending, 'unreachable'] }, 'omni signin: unreachable'],
    ['unreachable when issuing', { issue: 'unreachable' }, 'omni signin: unreachable'],
    ['failing when issuing', { issue: 500 }, 'omni signin: unreachable'],
  ];
  for (const [what, setup, line] of endings) {
    it(`ends with one line, exit 1, and writes nothing when ${what}`, async () => {
      server = await startServer({ codes: ['code-1'] });
      const { root } = repoWith(server.url);
      const home = freshHome();
      const browser = fakeBrowser();
      const std = io();

      expect(await main(['signin'], { ...CLOUD, cwd: root, ...std, home, openBrowser: browser.open, fetch: devicePage(setup).fetch })).toBe(1);

      expect(std.errors()).toBe(`${line}\n`);
      expect(browser.opened).toEqual([]);
      expect(existsSync(join(home, ...FILE))).toBe(false);
      expect(server.calls.filter((c) => c.path === '/api/ask/token')).toEqual([]);
    });
  }

  it('says why when the page refuses the code it handed over', async () => {
    server = await startServer({ codes: [] });
    const { root } = repoWith(server.url);
    const home = freshHome();
    const std = io();

    expect(await main(['signin'], { ...CLOUD, cwd: root, ...std, home, fetch: devicePage({ polls: [approved('unknown')] }).fetch })).toBe(1);

    expect(std.errors()).toMatch(/omni signin: the sign-in was refused: invalid grant/);
    expect(existsSync(join(home, ...FILE))).toBe(false);
  });

  for (const status of [404, 503]) {
    it(`falls back to the browser on this machine when the page answers ${status} (no device sign-in there)`, async () => {
      server = await startServer({ codes: ['code-1'], email: 'ada@example.com' });
      const { root } = repoWith(server.url);
      const browser = fakeBrowser();
      const page = devicePage({ issue: status });
      const std = io();

      expect(await main(['signin'], { ...CLOUD, cwd: root, ...std, home: freshHome(), openBrowser: browser.open, fetch: page.fetch })).toBe(0);

      expect(std.errors()).toBe('this Omni page has no device sign-in yet: using the browser on this machine\n');
      expect(browser.opened).toHaveLength(1);
      expect(std.text()).toContain(`Sign in in your browser: ${String(browser.opened[0])}`);
      expect(std.text()).not.toContain('Sign in at');
      expect(std.text().trim().split('\n').at(-1)).toBe('signed in as ada@example.com');
      expect(page.polls()).toEqual([]);
    });
  }

  it('takes no flag but --device or --loopback, never both, and no argument', async () => {
    const { root } = repoWith('https://ask.example.com');
    for (const args of [['signin', '--device', 'now'], ['signin', '--browser'], ['signin', '--device', '--loopback'], ['signin', '--loopback', 'now']]) {
      const std = io();
      expect(await main(args, { ...CLOUD, cwd: root, ...std, home: freshHome() }), args.join(' ')).toBe(2);
    }
  });
});

/** The fallback line the loopback flow prints under its own link, for the device request the page issued. */
const fallbackLine = (askUrl: string) => `Browser didn't open, or it's on another machine? ${askUrl}/ask/device?user_code=${USER_CODE}  (code ${USER_CODE})`;

/** Whether the loopback listener on `port` still answers. */
async function listening(port: string | null): Promise<boolean> {
  try {
    await fetch(`http://127.0.0.1:${String(port)}/callback?state=x&code=y`);
    return true;
  } catch {
    return false;
  }
}

/** Waits long enough for several device polls at the fake page's 10 ms interval. */
const severalPolls = () => new Promise<void>((resolve) => setTimeout(resolve, 80));

describe('omni signin, the loopback with the device link as its fallback (PRD 1660)', () => {
  it('prints the device link under the browser link, signs in by the browser, and ends the polling', async () => {
    server = await startServer({ codes: ['code-1'], email: 'ada@example.com' });
    const { root } = repoWith(server.url);
    const home = freshHome();
    const browser = fakeBrowser();
    const page = devicePage();
    const std = io();

    expect(await main(['signin'], { ...LAPTOP, cwd: root, ...std, home, openBrowser: browser.open, fetch: page.fetch })).toBe(0);

    expect(std.errors()).toBe('');
    const lines = std.text().trim().split('\n');
    expect(lines).toEqual([`Sign in in your browser: ${String(browser.opened[0])}`, fallbackLine(server.url), 'signed in as ada@example.com']);
    expect(page.calls[0]).toEqual({ path: '/api/ask/device', body: { purpose: 'signin' } });
    expect(server.calls.filter((c) => c.path === '/api/ask/token').map((c): unknown => c.body)).toEqual([{ code: 'code-1' }]);
    const polled = page.polls().length;
    await severalPolls();
    expect(page.polls()).toHaveLength(polled);
  });

  it('signs in by the device link when the browser never comes back, and stops the listener', async () => {
    server = await startServer({ codes: ['code-1'], email: 'ada@example.com' });
    const { root } = repoWith(server.url);
    const home = freshHome();
    const opened: string[] = [];
    const page = devicePage({ polls: [pending, approved()] });
    const std = io();

    expect(await main(['signin'], { ...LAPTOP, cwd: root, ...std, home, openBrowser: (url: string) => opened.push(url), fetch: page.fetch })).toBe(0);

    expect(std.errors()).toBe('');
    expect(std.text()).toContain(fallbackLine(server.url));
    expect(std.text().trim().split('\n').at(-1)).toBe('signed in as ada@example.com');
    expect(page.polls()).toHaveLength(2);
    expect(credentialsOf(home)[server.host]).toMatchObject({ access_token: 'access-2', email: 'ada@example.com' });
    expect(await listening(new URL(String(opened[0])).searchParams.get('port'))).toBe(false);
  });

  it('keeps waiting for the browser when the device link is refused, and signs in by it', async () => {
    server = await startServer({ codes: ['code-1'] });
    const { root } = repoWith(server.url);
    const page = devicePage({ polls: [{ status: 403, body: { status: 'denied' } }] });
    const std = io();
    const browser = fakeBrowser();
    const later = (url: string) => {
      setTimeout(() => browser.open(url), 60);
    };

    expect(await main(['signin'], { ...LAPTOP, cwd: root, ...std, home: freshHome(), openBrowser: later, fetch: page.fetch })).toBe(0);

    expect(std.errors()).toBe('');
    expect(page.polls()).toHaveLength(1);
    expect(std.text().trim().split('\n').at(-1)).toBe('signed in as person@example.com');
  });

  it('ends with the last way back to fail when neither comes back', async () => {
    server = await startServer({ codes: [] });
    const { root } = repoWith(server.url);
    const home = freshHome();
    const page = devicePage({ issued: { expires_in: 0.2 } });
    const std = io();

    expect(await main(['signin'], { ...LAPTOP, cwd: root, ...std, home, openBrowser: () => {}, fetch: page.fetch, waitMs: 50 })).toBe(1);

    expect(std.errors()).toBe('omni signin: the sign-in link expired: run omni signin again\n');
    expect(existsSync(join(home, ...FILE))).toBe(false);
  });

  for (const issue of [404, 'unreachable'] as const) {
    it(`leaves the fallback out and runs the loopback alone when the device request answers ${issue}`, async () => {
      server = await startServer({ codes: ['code-1'], email: 'ada@example.com' });
      const { root } = repoWith(server.url);
      const browser = fakeBrowser();
      const page = devicePage({ issue });
      const std = io();

      expect(await main(['signin'], { ...LAPTOP, cwd: root, ...std, home: freshHome(), openBrowser: browser.open, fetch: page.fetch })).toBe(0);

      expect(std.errors()).toBe('');
      expect(std.text().trim().split('\n')).toEqual([`Sign in in your browser: ${String(browser.opened[0])}`, 'signed in as ada@example.com']);
      expect(page.polls()).toEqual([]);
    });
  }

  it('takes the loopback, with its fallback, in a cloud session with --loopback', async () => {
    server = await startServer({ codes: ['code-1'] });
    const { root } = repoWith(server.url);
    const browser = fakeBrowser();
    const page = devicePage();
    const std = io();

    expect(await main(['signin', '--loopback'], { ...CLOUD, cwd: root, ...std, home: freshHome(), openBrowser: browser.open, fetch: page.fetch })).toBe(0);

    expect(browser.opened).toHaveLength(1);
    expect(std.text()).toContain(`Sign in in your browser: ${String(browser.opened[0])}`);
    expect(std.text()).toContain(fallbackLine(server.url));
    expect(std.text()).not.toContain('Sign in at');
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
    server = await startServer({ refreshToken: 'refresh-1', email: 'ada@example.com' });
    const { root } = repoWith(server.url);
    const home = freshHome({ [server.host]: { access_token: 'access-1', refresh_token: 'refresh-1', expires_at: 1, email: 'ada@example.com' } });
    const std = io();
    expect(await main(['whoami'], { cwd: root, ...std, home })).toBe(0);
    expect(std.text()).toBe('ada@example.com\n');
    expect(credentialsOf(home)[server.host]).toMatchObject({ access_token: 'access-2', refresh_token: 'refresh-2' });
  });

  it('says the sign-in is no longer valid when the renewal is refused', async () => {
    server = await startServer({ refreshToken: 'refresh-1' });
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
