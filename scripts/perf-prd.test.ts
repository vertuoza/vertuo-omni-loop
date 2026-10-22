import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { cookieOf, measure, median, percentile, sample, summarise, table, type Fetch } from './perf-prd.ts';

const SCRIPT = fileURLToPath(new URL('./perf-prd.ts', import.meta.url));
const COOKIE = 'sb-session=SECRET-VALUE-123';

describe('the median and the p95', () => {
  it('takes the middle of an odd count and the mean of the middle two of an even one', () => {
    expect(median([5, 1, 3])).toBe(3);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(median([])).toBeNaN();
  });

  it('takes the p95 by nearest rank: the 19th of 20', () => {
    const twenty = Array.from({ length: 20 }, (_, i) => 20 - i);
    expect(percentile(twenty, 95)).toBe(19);
    expect(percentile([7], 95)).toBe(7);
    expect(percentile([], 95)).toBeNaN();
  });

  it('summarises the first byte, the end and each named read', () => {
    const samples = [10, 30, 20].map((n) => ({ first: n, end: n * 2, reads: [{ name: 'dossier_list', ms: n }] }));
    expect(summarise(samples)).toEqual({
      first: { median: 20, p95: 30 }, end: { median: 40, p95: 60 }, reads: [{ name: 'dossier_list', median: 20 }],
    });
  });

  it('prints a markdown table of the routes', () => {
    const summary = summarise([{ first: 10, end: 20, reads: [{ name: 'viewer', ms: 3 }] }]);
    expect(table([{ route: '/prd', summary }])).toContain('| `/prd` | 10 ms | 10 ms | 20 ms | 20 ms |');
    expect(table([{ route: '/prd', summary }])).toContain('| `/prd` | `viewer` | 3 ms |');
  });
});

describe('measuring a route', () => {
  const page = '<p>hi</p><template id="server-timing" data-value="viewer;dur=2, dossier_list;dur=40"></template>';
  const answer = (status = 200): Fetch => () => Promise.resolve(new Response(page, { status }));

  it('times a response and reads the reads it names', async () => {
    let t = 0;
    const got = await sample('https://omni.test/prd', COOKIE, answer(), () => (t += 5));
    expect(got.reads).toEqual([{ name: 'viewer', ms: 2 }, { name: 'dossier_list', ms: 40 }]);
    expect(got.end).toBeGreaterThanOrEqual(got.first);
  });

  it('sends the cookie, requests each route the asked number of times, and never prints the cookie', async () => {
    const seen: { url: string; cookie: string | undefined }[] = [];
    const out = await measure('https://omni.test', 'abc', COOKIE, (url, init) => {
      seen.push({ url, cookie: init.headers.cookie });
      return answer()(url, init);
    }, 20);
    expect(seen).toHaveLength(40);
    expect(new Set(seen.map((s) => s.url))).toEqual(new Set(['https://omni.test/prd', 'https://omni.test/prd/abc']));
    expect(seen.every((s) => s.cookie === COOKIE)).toBe(true);
    expect(out).not.toContain('SECRET-VALUE');
  });

  it('refuses a response that is not 200 without naming the cookie', async () => {
    const failure = await sample('https://omni.test/prd', COOKIE, answer(302)).catch((error: unknown) => error);
    expect(String(failure)).toContain('302');
    expect(String(failure)).not.toContain('SECRET-VALUE');
  });
});

describe('the cookie', () => {
  it('is the variable, trimmed; unset or blank is none', () => {
    expect(cookieOf({ OMNI_PERF_COOKIE: ' a=b ' })).toBe('a=b');
    expect(cookieOf({})).toBeNull();
    expect(cookieOf({ OMNI_PERF_COOKIE: '  ' })).toBeNull();
  });

  it('is required: the script refuses to run without it, before any request', () => {
    const env = Object.fromEntries(Object.entries(process.env).filter(([name]) => name !== 'OMNI_PERF_COOKIE'));
    const run = spawnSync(process.execPath, [SCRIPT, 'http://127.0.0.1:9', 'abc'], { env, encoding: 'utf8' });
    expect(run.status).toBe(1);
    expect(run.stderr).toContain('OMNI_PERF_COOKIE is not set');
  });

  it('never prints a cookie it was given, even when the request fails', () => {
    const run = spawnSync(process.execPath, [SCRIPT, 'http://127.0.0.1:9', 'abc'], { env: { ...process.env, OMNI_PERF_COOKIE: COOKIE }, encoding: 'utf8' });
    expect(run.status).toBe(1);
    expect(run.stdout + run.stderr).not.toContain('SECRET-VALUE');
  });
});
