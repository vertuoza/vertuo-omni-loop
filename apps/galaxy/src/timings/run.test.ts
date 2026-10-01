// One run of `node apps/galaxy/scripts/timings.ts` (PRD 657), on a fake fetch and a fake clock: what
// it asks for, what it prints, and when it stops. No test reaches the network.
import { describe, expect, it } from 'vitest';
import { PAGES, parseArgs, timings, type Deps } from './run';

/** A clock that moves `step` ms each time it is read, and a fetch that answers `status` to every page. */
function fakes({ status = 200, cookie = 'sb-abc-auth-token=xyz', body = '<html></html>' }: { status?: number; cookie?: string | null; body?: string } = {}) {
  let t = 0;
  const calls: { url: string; init: RequestInit }[] = [];
  const out: string[] = [];
  const err: string[] = [];
  const deps: Deps = {
    fetch: async (url, init) => {
      calls.push({ url: String(url), init: init ?? {} });
      return new Response(body, { status, headers: status >= 300 && status < 400 ? { location: '/signin' } : {} });
    },
    readFile: (path) => {
      if (cookie === null) throw new Error(`ENOENT: ${path}`);
      return `${cookie}\n`;
    },
    now: () => (t += 10),
    out: (line) => out.push(line),
    err: (line) => err.push(line),
  };
  return { deps, calls, out, err };
}

describe('parseArgs', () => {
  it('reads the cookie file, the base and the run count', () => {
    expect(parseArgs(['--cookie', 'c.txt', '--base', 'https://example.test/', '--runs', '3'])).toEqual({
      cookie: 'c.txt', base: 'https://example.test', runs: 3,
    });
  });

  it('defaults to production and ten runs', () => {
    expect(parseArgs(['--cookie', 'c.txt'])).toEqual({ cookie: 'c.txt', base: 'https://vertuo-omni-loop-galaxy.vercel.app', runs: 10 });
  });
});

describe('timings', () => {
  it('stops without a cookie and says how to copy one from the browser', async () => {
    const { deps, calls, err } = fakes();
    expect(await timings([], deps)).toBe(1);
    expect(calls).toHaveLength(0);
    expect(err.join('\n')).toMatch(/--cookie/);
    expect(err.join('\n')).toMatch(/Request Headers/);
  });

  it('stops when the cookie file cannot be read or is empty', async () => {
    const missing = fakes({ cookie: null });
    expect(await timings(['--cookie', 'nope.txt'], missing.deps)).toBe(1);
    expect(missing.calls).toHaveLength(0);
    const empty = fakes({ cookie: '  ' });
    expect(await timings(['--cookie', 'c.txt'], empty.deps)).toBe(1);
    expect(empty.calls).toHaveLength(0);
  });

  it('loads each page the given number of times with the cookie and prints one row per page', async () => {
    const { deps, calls, out } = fakes();
    expect(await timings(['--cookie', 'c.txt', '--base', 'https://example.test', '--runs', '2'], deps)).toBe(0);
    expect(PAGES).toEqual(['/prd', '/app', '/app/workspace', '/app/fleet']);
    expect(calls.map((c) => c.url)).toEqual(PAGES.flatMap((p) => [`https://example.test${p}`, `https://example.test${p}`]));
    expect(new Headers(calls[0]!.init.headers).get('cookie')).toBe('sb-abc-auth-token=xyz');
    expect(calls[0]!.init.redirect).toBe('manual');
    const rows = out.filter((line) => line.startsWith('| /'));
    expect(rows).toHaveLength(4);
    // The clock moves 10 ms per read: start, first byte, end, so 10 ms to the first byte, 20 ms in all.
    expect(rows[0]).toBe('| /prd | 2 | 10 | 10 | 20 | 20 |');
  });

  it('stops on a redirect, which means the session cookie was not accepted', async () => {
    const { deps, err } = fakes({ status: 307 });
    expect(await timings(['--cookie', 'c.txt'], deps)).toBe(1);
    expect(err.join('\n')).toMatch(/\/prd answered 307/);
    expect(err.join('\n')).toMatch(/signed in/);
  });

  it('stops when a page answers with its sign-in card, which would time the signed-out page', async () => {
    const { deps, out, err } = fakes({ body: '<section aria-labelledby="dash-signin-title"><h1 id="dash-signin-title">Sign in</h1></section>' });
    expect(await timings(['--cookie', 'c.txt'], deps)).toBe(1);
    expect(err.join('\n')).toMatch(/\/prd showed its sign-in card/);
    expect(out.filter((line) => line.startsWith('| /'))).toHaveLength(0);
  });
});
