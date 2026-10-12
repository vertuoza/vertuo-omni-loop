// `omni setup-token` (PRD 1628) through `main()` on a fixture repository: the browser is faked by one
// that does what the sign-in page does once a token is made, a plain GET on the loopback callback with
// the state it was given, the token and its expiry. Nothing calls the Omni page: the fake `fetch`
// only notes that it was never asked. Every line the command prints is swept for the token.
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

async function run(argv: string[], { url, browser = fakeBrowser(), env = {} }: { url?: string | null; browser?: ReturnType<typeof fakeBrowser>; env?: Record<string, string> } = {}) {
  const out: string[] = [];
  const err: string[] = [];
  const called: string[] = [];
  const fetchSpy = (target: string) => {
    called.push(target);
    return Promise.reject(new TypeError('no network in this test'));
  };
  const code = await main(['setup-token', ...argv], {
    cwd: checkout(url), env, home: tmpdir(), stdout: { write: (s: string) => out.push(s) }, stderr: { write: (s: string) => err.push(s) },
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
    expect(result.called).toEqual([]);
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
    expect(await run(['now'])).toMatchObject({ code: 2, opened: [], err: 'usage: omni setup-token [--name <name>] [--days 30|90|365]\n' });
    expect(await run(['--forever'])).toMatchObject({ code: 2, opened: [], err: 'omni setup-token: unknown flag --forever.\n' });
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
    expect(result).toMatchObject({ code: 0, called: [] });
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

  it('prints the token only on its own line and in the paste line, never anywhere else', () => {
    expect(printed.length).toBeGreaterThan(0);
    expect(printed.filter(({ line, carries }) => !carries && line.includes(TOKEN.slice(4, -4)))).toEqual([]);
  });
});
