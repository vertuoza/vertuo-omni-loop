#!/usr/bin/env node
// node scripts/perf-prd.ts <base-url> <dossier-id> — how fast /prd and /prd/<id> arrive (PRD 2401).
// Requests each route 20 times, signed in as the person whose session cookie is in OMNI_PERF_COOKIE,
// and prints, per route, the median and the p95 of the time to the first byte and to the end of the
// response, and the median of each read the page names in its `server-timing` template
// (apps/galaxy/src/dossier/page/timing.tsx). It prints a markdown table, for a pull request's body.
//
// The cookie is read once, sent in a request header and never written anywhere: not to a file, not
// to the output, not to an error. Without it the script refuses to run before any request.
//
// Exit codes: 0 measured, 1 a bad argument, a missing cookie, or a request that failed.
import { pathToFileURL } from 'node:url';
import { processEnv } from '../kit/lib/env/read.ts';
import { timingsInPage } from '../apps/galaxy/src/dossier/page/timing.ts';

const USAGE = 'usage: OMNI_PERF_COOKIE=<cookie> node scripts/perf-prd.ts <base-url> <dossier-id>';
const REQUESTS = 20;

/** One request's clock: when the first byte of the body arrived and when it ended, in ms, and what the page named. */
export type Sample = { first: number; end: number; reads: { name: string; ms: number }[] };

/** The `p`th percentile (0 to 100) of `values`, nearest-rank; NaN for none. */
export function percentile(values: readonly number[], p: number): number {
  if (values.length === 0) return Number.NaN;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1))] ?? Number.NaN;
}

/** The median of `values`: the middle one, the mean of the two middle ones for an even count; NaN for none. */
export function median(values: readonly number[]): number {
  if (values.length === 0) return Number.NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length / 2;
  return sorted.length % 2 === 1 ? (sorted[Math.floor(mid)] ?? Number.NaN) : ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
}

/** One route's numbers: the median and p95 of the first byte and of the end, and each named read's median. */
export type Summary = { first: { median: number; p95: number }; end: { median: number; p95: number }; reads: { name: string; median: number }[] };

export function summarise(samples: readonly Sample[]): Summary {
  const names = [...new Set(samples.flatMap((s) => s.reads.map((r) => r.name)))];
  const first = samples.map((s) => s.first);
  const end = samples.map((s) => s.end);
  return {
    first: { median: median(first), p95: percentile(first, 95) },
    end: { median: median(end), p95: percentile(end, 95) },
    reads: names.map((name) => ({ name, median: median(samples.flatMap((s) => s.reads.filter((r) => r.name === name).map((r) => r.ms))) })),
  };
}

const ms = (value: number) => (Number.isNaN(value) ? 'n/a' : `${Math.round(value)} ms`);

/** The markdown table of each route's summary. */
export function table(routes: readonly { route: string; summary: Summary }[]): string {
  const rows = routes.map(({ route, summary: s }) => `| \`${route}\` | ${ms(s.first.median)} | ${ms(s.first.p95)} | ${ms(s.end.median)} | ${ms(s.end.p95)} |`);
  const reads = routes.flatMap(({ route, summary }) => summary.reads.map((r) => `| \`${route}\` | \`${r.name}\` | ${ms(r.median)} |`));
  return [
    '| route | first byte, median | first byte, p95 | end, median | end, p95 |', '|---|---|---|---|---|', ...rows,
    ...(reads.length > 0 ? ['', '| route | read | median |', '|---|---|---|', ...reads] : []),
  ].join('\n');
}

/** The session cookie to send, or null when `env` has none (unset or blank): the script then refuses to run. */
export function cookieOf(env: Readonly<Record<string, string | undefined>>): string | null {
  const cookie = env.OMNI_PERF_COOKIE?.trim() ?? '';
  return cookie === '' ? null : cookie;
}

/** What `sample` needs of `fetch`: injected so a test makes no request. */
export type Fetch = (url: string, init: { headers: Record<string, string> }) => Promise<Response>;

/** One timed request of `url` with `cookie`; throws, naming the status and never the cookie, on a response that is not 200. */
export async function sample(url: string, cookie: string, fetcher: Fetch = fetch, clock: () => number = () => performance.now()): Promise<Sample> {
  const start = clock();
  const response = await fetcher(url, { headers: { cookie } });
  if (response.status !== 200 || !response.body) throw new Error(`${url} answered ${response.status}: is the cookie a live session?`);
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let first = Number.NaN;
  let html = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (Number.isNaN(first)) first = clock() - start;
    html += decoder.decode(value, { stream: true });
  }
  return { first: Number.isNaN(first) ? clock() - start : first, end: clock() - start, reads: timingsInPage(html) };
}

/** Measures each route `requests` times, one after the other; the table to print. */
export async function measure(base: string, id: string, cookie: string, fetcher: Fetch = fetch, requests = REQUESTS): Promise<string> {
  const routes = ['/prd', `/prd/${encodeURIComponent(id)}`];
  const results: { route: string; summary: Summary }[] = [];
  for (const route of routes) {
    const samples: Sample[] = [];
    for (let i = 0; i < requests; i += 1) samples.push(await sample(new URL(route, base).href, cookie, fetcher));
    results.push({ route, summary: summarise(samples) });
  }
  return table(results);
}

async function main(argv: string[]): Promise<number> {
  const [base, id, ...rest] = argv;
  if (!base || !id || rest.length > 0 || !URL.canParse(base)) {
    console.error(USAGE);
    return 1;
  }
  const cookie = cookieOf(processEnv());
  if (cookie === null) {
    console.error(`OMNI_PERF_COOKIE is not set: it holds the session cookie of the person to measure as. ${USAGE}`);
    return 1;
  }
  try {
    console.log(await measure(base, id, cookie));
    return 0;
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'a request failed');
    return 1;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) process.exit(await main(process.argv.slice(2)));
