// `omni setup-token` (PRD 1628) through `main()` on a fixture repository: the browser is faked by one
// that does what the sign-in page does once a token is made, a plain GET on the loopback callback with
// the state it was given, the token and its expiry. The Omni page is faked by a `fetch` that notes
// every call: unreachable by default, so the loopback's device fallback is left out, or the device
// routes of PRD 1660 (`devicePage`). Every line the command prints is swept for the token.
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';
import { makeRepo } from '../../test/fixture.ts';
import { main } from '../omni.ts';

const ASK_URL = 'https://omni.example.com';
const TOKEN = 'omk_Zq9xW3vK7pL2mN8bR4tY6uJ1hG5fD0sA_-cE3iO9wQv';
const EXPIRES = '2027-01-09T10:00:00.000Z';
const TODAY = new Date('2026-10-11T08:30:00.000Z');
const PASTE = `Paste it as OMNI_TOKEN=${TOKEN} in your cloud environment's variables.`;

/** Every line the tests printed, with the lines meant to carry the token. */
const printed: { line: string; carries: boolean }[] = [];

const checkout = (url: string | null = ASK_URL) =>
  makeRepo({ git: true, files: { '.omni-loop/config.yml': `kit: 1\nrepo:\n  slug: acme/api\nask:\n  url: ${url ?? 'null'}\n` } }).root;

/** A browser that comes back to the loopback with `query(state)`, or never comes back with `null`. */
function fakeBrowser(query: ((state: string) => string) | null = (state) => new URLSearchParams({ state, token: TOKEN, expires_at: EXPIRES }).toString()) {
  const opened: string[] = [];
  const visits: Promise<number>[] = [];
  const open = (url: string) => {
    opened.push(url);
    if (!query) return;
    const page = new URL(url);
    const back = `http://127.0.0.1:${String(page.searchParams.get('port'))}/callback?${query(String(page.searchParams.get('state')))}`;
    visits.push(fetch(back).then((response) => response.status));
  };
  return { open, opened, visits };
}

type PollReply = { status: number; body: unknown } | 'unreachable';
const USER_CODE = 'WXYZ-4821';
const DEVICE_CODE = 'd'.repeat(43);
const DEVICE_LINK = `${ASK_URL}/ask/device?user_code=${USER_CODE}`;
const FALLBACK = `Browser didn't open, or it's on another machine? ${DEVICE_LINK}  (code ${USER_CODE})`;
const approved = (body: Record<string, unknown> = { token: TOKEN, expires_at: EXPIRES }): PollReply => ({ status: 200, body: { status: 'approved', ...body } });
const pending: PollReply = { status: 200, body: { status: 'pending' } };

/**
 * The Omni page's device routes (PRD 1660): the issue answers `issue` (a status, or `unreachable`),
 * each poll the next of `polls`, `pending` once they run out. Short intervals keep the tests fast.
 */
function devicePage({ issue = 200, issued = {}, polls = [] }: { issue?: number | 'unreachable'; issued?: Record<string, unknown>; polls?: PollReply[] } = {}) {
  const calls: { path: string; body: unknown }[] = [];
  const queue = [...polls];
  const fetch = (target: string, init?: RequestInit): Promise<Response> => {
    const path = new URL(target).pathname;
    calls.push({ path, body: JSON.parse(typeof init?.body === 'string' ? init.body : 'null') });
    if (path === '/api/ask/device') {
      if (issue === 'unreachable') return Promise.reject(new TypeError('fetch failed'));
      const body = issue === 200 ? { device_code: DEVICE_CODE, user_code: USER_CODE, url: `https://elsewhere.test/ask/device?user_code=${USER_CODE}`, interval: 0.01, expires_in: 600, ...issued } : { error: 'not found' };
      return Promise.resolve(Response.json(body, { status: issue }));
    }
    if (path !== '/api/ask/device/poll') return Promise.reject(new TypeError(`unexpected call to ${path}`));
    const next = queue.shift() ?? pending;
    if (next === 'unreachable') return Promise.reject(new TypeError('fetch failed'));
    return Promise.resolve(Response.json(next.body, { status: next.status }));
  };
  return { fetch, calls, polls: () => calls.filter((call) => call.path === '/api/ask/device/poll') };
}

/** A laptop: no remote session, not Linux, so `omni setup-token` takes the loopback whatever runs the tests. */
const LAPTOP = { env: {}, platform: 'darwin' };
/** A Claude Code cloud session: the terminal is on another machine than the person's browser. */
const CLOUD = { env: { CLAUDE_CODE_REMOTE: 'true' }, platform: 'linux' };

type RunOptions = {
  url?: string | null;
  browser?: ReturnType<typeof fakeBrowser>;
  env?: Record<string, string>;
  platform?: string;
  page?: ReturnType<typeof devicePage>;
};

async function run(argv: string[], { url, browser = fakeBrowser(), env = LAPTOP.env, platform = LAPTOP.platform, page }: RunOptions = {}) {
  const out: string[] = [];
  const err: string[] = [];
  const called: string[] = [];
  const fetchSpy = (target: string, init?: RequestInit) => {
    called.push(target);
    if (page) return page.fetch(target, init);
    return Promise.reject(new TypeError('no network in this test'));
  };
  const code = await main(['setup-token', ...argv], {
    cwd: checkout(url), env, platform, home: tmpdir(), stdout: { write: (s: string) => out.push(s) }, stderr: { write: (s: string) => err.push(s) },
    openBrowser: browser.open, fetch: fetchSpy, waitMs: 300, now: () => TODAY,
  });
  const text = out.join('');
  const errors = err.join('');
  for (const line of `${text}${errors}`.split('\n').filter(Boolean)) printed.push({ line, carries: line === TOKEN || line === PASTE });
  return { code, out: text, err: errors, opened: browser.opened, page: browser.opened[0] ? new URL(browser.opened[0]) : null, called };
}

describe('omni setup-token', () => {
  it('opens the token round trip with a default name and 90 days, and prints the token, its expiry and the paste line', async () => {
    const result = await run([]);
    expect(result.err).toBe('');
    expect(result.code).toBe(0);
    expect(result.opened).toHaveLength(1);
    const { page } = result;
    expect(`${page?.origin}${page?.pathname}`).toBe(`${ASK_URL}/ask/signin`);
    expect(page?.searchParams.get('purpose')).toBe('token');
    expect(page?.searchParams.get('name')).toBe('terminal 2026-10-11');
    expect(page?.searchParams.get('days')).toBe('90');
    expect(Number(page?.searchParams.get('port'))).toBeGreaterThan(0);
    expect(page?.searchParams.get('state')).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(result.out).toBe([`Make the token in your browser: ${String(page)}`, TOKEN, 'It expires on 2027-01-09.', PASTE, ''].join('\n'));
    expect(result.called).toEqual([`${ASK_URL}/api/ask/device`]);
  });

  it('asks for the name and the days given', async () => {
    const result = await run(['--name', 'claude cloud', '--days', '365']);
    expect(result.code).toBe(0);
    expect(result.page?.searchParams.get('name')).toBe('claude cloud');
    expect(result.page?.searchParams.get('days')).toBe('365');
    const thirty = await run(['--days', '30']);
    expect(thirty.page?.searchParams.get('days')).toBe('30');
  });

  it('takes a fresh state each run, and a token that comes back with another state is refused', async () => {
    const first = await run([]);
    const second = await run([]);
    expect(first.page?.searchParams.get('state')).not.toBe(second.page?.searchParams.get('state'));
    const planted = fakeBrowser(() => new URLSearchParams({ state: 'someone-else', token: TOKEN, expires_at: EXPIRES }).toString());
    const result = await run([], { browser: planted });
    expect(await Promise.all(planted.visits)).toEqual([400]);
    expect(result).toMatchObject({ code: 1, out: expect.not.stringContaining(TOKEN) as unknown, err: 'omni setup-token: no token came back within 300 ms.\n' });
  });

  it('accepts only 30, 90 or 365 days, and opens no browser otherwise', async () => {
    for (const days of ['7', '60', '90d', '0', '1e2']) {
      const result = await run(['--days', days]);
      expect(result).toMatchObject({ code: 2, out: '', opened: [] });
      expect(result.err).toBe(`omni setup-token: --days must be 30, 90 or 365, got "${days}".\n`);
    }
  });

  it('refuses a name that is empty, longer than 40 characters or not on one line', async () => {
    for (const name of [' ', 'x'.repeat(41), 'two\nlines']) {
      const result = await run(['--name', name]);
      expect(result).toMatchObject({ code: 2, out: '', opened: [], err: 'omni setup-token: --name must be 1 to 40 characters on one line.\n' });
    }
    expect((await run(['--name', 'x'.repeat(40)])).code).toBe(0);
  });

  it('refuses an argument or an unknown flag', async () => {
    expect(await run(['now'])).toMatchObject({ code: 2, opened: [], err: 'usage: omni setup-token [--name <name>] [--days 30|90|365] [--device | --loopback]\n' });
    expect(await run(['--forever'])).toMatchObject({ code: 2, opened: [], err: 'omni setup-token: unknown flag --forever.\n' });
    expect(await run(['--device', '--loopback'])).toMatchObject({ code: 2, opened: [], err: 'usage: omni setup-token [--name <name>] [--days 30|90|365] [--device | --loopback]\n' });
  });

  it('says ask mode is not set up when the config has no ask.url, and opens nothing', async () => {
    expect(await run([], { url: null })).toMatchObject({ code: 1, out: '', opened: [], err: 'ask mode is not set up for this repository (ask.url)\n' });
  });

  it('prints the link to open by hand when no browser opens, and still waits for the token', async () => {
    const opened: string[] = [];
    const browser = fakeBrowser();
    const result = await run([], { browser: { ...browser, open: (link: string) => { opened.push(link); browser.open(link); throw new Error('no browser here'); } } });
    expect(result.code).toBe(0);
    expect(result.out).toContain(`Make the token in your browser: ${String(opened[0])}\n`);
    expect(result.out).toContain(PASTE);
  });

  it('gives up after its wait with one line, when no token comes back', async () => {
    const result = await run([], { browser: fakeBrowser(null) });
    expect(result).toMatchObject({ code: 1, err: 'omni setup-token: no token came back within 300 ms.\n' });
    expect(result.out).toMatch(/^Make the token in your browser: /);
  });

  it('makes a new token with OMNI_TOKEN already set, without trading it', async () => {
    const result = await run([], { env: { OMNI_TOKEN: 'omk_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' } });
    expect(result).toMatchObject({ code: 0, called: [`${ASK_URL}/api/ask/device`] });
    expect(result.out).toContain(PASTE);
  });

  it('is listed by omni help, after omni signin, and explained by omni help setup-token', async () => {
    const out: string[] = [];
    const std = { stdout: { write: (s: string) => out.push(s) }, stderr: { write: () => {} }, env: {} };
    expect(await main(['help'], { cwd: checkout(), ...std })).toBe(0);
    const overview = out.join('');
    expect(overview).toMatch(/omni setup-token\s+make a token for a cloud session/);
    expect(overview.indexOf('omni setup-token')).toBeGreaterThan(overview.indexOf('omni signin'));
    out.length = 0;
    expect(await main(['help', 'setup-token'], { cwd: checkout(), ...std })).toBe(0);
    const entry = out.join('');
    expect(entry).toContain('omni setup-token [--name <name>] [--days 30|90|365]');
    expect(entry).toMatch(/OMNI_TOKEN=<token>/);
  });

});

describe('omni setup-token, by device code (PRD 1660)', () => {
  it('takes the device flow in a cloud session: prints the link and the code, opens no browser, and prints the token once approved', async () => {
    const browser = fakeBrowser();
    const page = devicePage({ polls: [pending, approved()] });
    const result = await run([], { ...CLOUD, browser, page });
    expect(result.err).toBe('');
    expect(result.code).toBe(0);
    expect(result.opened).toEqual([]);
    expect(result.out).toBe([`Sign in at ${DEVICE_LINK}`, `Check that the page shows ${USER_CODE}. Waiting (10 min)…`, TOKEN, 'It expires on 2027-01-09.', PASTE, ''].join('\n'));
    expect(page.calls[0]).toEqual({ path: '/api/ask/device', body: { purpose: 'token', name: 'terminal 2026-10-11', days: 90, workspace: null } });
    expect(page.polls()).toEqual([
      { path: '/api/ask/device/poll', body: { device_code: DEVICE_CODE } },
      { path: '/api/ask/device/poll', body: { device_code: DEVICE_CODE } },
    ]);
  });

  it('asks the device request for the name and the days given', async () => {
    const page = devicePage({ polls: [approved()] });
    expect((await run(['--name', 'claude cloud', '--days', '365'], { ...CLOUD, page })).code).toBe(0);
    expect(page.calls[0]).toEqual({ path: '/api/ask/device', body: { purpose: 'token', name: 'claude cloud', days: 365, workspace: null } });
  });

  it('takes the device flow on a laptop with --device, and on Linux with no display', async () => {
    const forced = await run(['--device'], { browser: fakeBrowser(null), page: devicePage({ polls: [approved()] }) });
    expect(forced).toMatchObject({ code: 0, opened: [] });
    expect(forced.out).toContain(`Sign in at ${DEVICE_LINK}\n`);
    const headless = await run([], { env: {}, platform: 'linux', browser: fakeBrowser(null), page: devicePage({ polls: [approved()] }) });
    expect(headless).toMatchObject({ code: 0, opened: [] });
    expect(headless.out).toContain(PASTE);
  });

  it('honours slow_down, polling at the longer interval it names', async () => {
    const page = devicePage({ polls: [pending, { status: 429, body: { status: 'slow_down', interval: 0.03 } }, pending, approved()] });
    const result = await run([], { ...CLOUD, page });
    expect(result.code).toBe(0);
    expect(page.polls()).toHaveLength(4);
  });

  const endings: [string, Parameters<typeof devicePage>[0], string][] = [
    ['refused', { polls: [{ status: 403, body: { status: 'denied' } }] }, 'omni setup-token: the sign-in was refused in the browser'],
    ['expired', { polls: [{ status: 410, body: { status: 'expired' } }] }, 'omni setup-token: the sign-in link expired: run omni setup-token again'],
    ['unreachable while polling', { polls: ['unreachable'] }, 'omni setup-token: unreachable'],
    ['unreachable on issue', { issue: 'unreachable' }, 'omni setup-token: unreachable'],
    ['approved without the token', { polls: [approved({ code: 'code-1' })] }, 'omni setup-token: unreachable'],
    ['approved without an expiry', { polls: [approved({ token: TOKEN })] }, 'omni setup-token: unreachable'],
  ];
  for (const [what, setup, line] of endings) {
    it(`ends with one line, exit 1, when the request is ${what}, and prints no token`, async () => {
      const result = await run([], { ...CLOUD, page: devicePage(setup) });
      expect(result).toMatchObject({ code: 1, err: `${line}\n`, opened: [] });
      expect(result.out).not.toContain(TOKEN);
    });
  }

  for (const status of [404, 503]) {
    it(`falls back to the browser on this machine when the page answers ${status} (no device sign-in there)`, async () => {
      const browser = fakeBrowser();
      const result = await run([], { ...CLOUD, browser, page: devicePage({ issue: status }) });
      expect(result.code).toBe(0);
      expect(result.err).toBe('this Omni page has no device sign-in yet: using the browser on this machine\n');
      expect(result.opened).toHaveLength(1);
      expect(result.out).toMatch(/^Make the token in your browser: /);
      expect(result.out).not.toContain(FALLBACK);
      expect(result.out).toContain(PASTE);
    });
  }
});

describe('omni setup-token, the loopback with the device link as its fallback (PRD 1660)', () => {
  it('prints the device link under the browser link, gets the token by the browser, and ends the polling', async () => {
    const browser = fakeBrowser();
    const page = devicePage();
    const result = await run([], { browser, page });
    expect(result.code).toBe(0);
    expect(result.out).toBe([`Make the token in your browser: ${String(browser.opened[0])}`, FALLBACK, TOKEN, 'It expires on 2027-01-09.', PASTE, ''].join('\n'));
    expect(page.calls[0]).toEqual({ path: '/api/ask/device', body: { purpose: 'token', name: 'terminal 2026-10-11', days: 90, workspace: null } });
    const polled = page.polls().length;
    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(page.polls()).toHaveLength(polled);
  });

  it('gets the token by the device link when the browser never comes back, and stops the listener', async () => {
    const browser = fakeBrowser(null);
    const page = devicePage({ polls: [pending, approved()] });
    const result = await run([], { browser, page });
    expect(result).toMatchObject({ code: 0, err: '' });
    expect(result.out).toContain(`${FALLBACK}\n`);
    expect(result.out).toContain(PASTE);
    const port = String(result.page?.searchParams.get('port'));
    await expect(fetch(`http://127.0.0.1:${port}/callback`)).rejects.toThrow();
  });

  it('takes the loopback, with its fallback, in a cloud session with --loopback', async () => {
    const browser = fakeBrowser();
    const result = await run(['--loopback'], { ...CLOUD, browser, page: devicePage() });
    expect(result.code).toBe(0);
    expect(result.opened).toHaveLength(1);
    expect(result.out).toContain(`${FALLBACK}\n`);
  });

  for (const issue of [404, 'unreachable'] as const) {
    it(`leaves the fallback out and runs the loopback alone when the device request answers ${issue}`, async () => {
      const result = await run([], { page: devicePage({ issue }) });
      expect(result).toMatchObject({ code: 0, err: '' });
      expect(result.out).not.toContain(FALLBACK);
      expect(result.out).toContain(PASTE);
    });
  }
});

describe('omni setup-token, the token kept out of every line', () => {
  it('prints the token only on its own line and in the paste line, never anywhere else', () => {
    expect(printed.length).toBeGreaterThan(0);
    expect(printed.filter(({ line, carries }) => !carries && line.includes(TOKEN.slice(4, -4)))).toEqual([]);
  });
});
