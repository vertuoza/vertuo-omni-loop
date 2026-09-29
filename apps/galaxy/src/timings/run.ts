// One run of `node apps/galaxy/scripts/timings.mjs` (PRD 657): load each slow page a number of times
// with a session cookie a person pasted into a file, and print a Markdown table of the median and p75
// time to first byte and to the full document, ready for the PRD's timings.md. Requests run one after
// another, so each timing is one page load, not a share of a burst.
//
// The script calls timings() with the real fetch, file reader and clock; the test passes fakes. It
// runs on plain Node, so this module's imports name their extension.
import { summarise, type Sample } from './summarise.ts';

/** The pages PRD 657 set out to make fast, in the order the table lists them. */
export const PAGES = ['/prd', '/app', '/app/workspace', '/app/fleet'] as const;

const PRODUCTION = 'https://vertuo-omni-loop-galaxy.vercel.app';
const RUNS = 10;
/** The heading every signed-out card carries (DashboardSignIn, DossierSignIn…): a signed-out page
 * answers 200 too, and timing it would measure the wrong page. */
const SIGN_IN_CARD = /id="[a-z-]*signin-title"/;

export type Deps = {
  fetch: (url: string, init?: RequestInit) => Promise<Response>;
  readFile: (path: string) => string;
  now: () => number;
  out: (line: string) => void;
  err: (line: string) => void;
};

export type Args = { cookie: string | null; base: string; runs: number };

const HOW_TO_COPY = [
  'timings: give a session cookie with --cookie <file>.',
  'To copy one: sign in on the site in your browser, open the developer tools, Network tab, reload the',
  'page, click the first (document) request, and under Request Headers copy the whole value of',
  '"cookie" into a file, on one line. Keep that file out of the repository: it signs in as you.',
  'Then: node apps/galaxy/scripts/timings.mjs --cookie <file> [--base <url>] [--runs <n>]',
];

export function parseArgs(argv: readonly string[]): Args {
  const value = (flag: string) => {
    const at = argv.indexOf(flag);
    return at >= 0 ? argv[at + 1] ?? null : null;
  };
  const runs = Number(value('--runs') ?? RUNS);
  return {
    cookie: value('--cookie'),
    base: (value('--base') ?? PRODUCTION).replace(/\/+$/, ''),
    runs: Number.isInteger(runs) && runs > 0 ? runs : RUNS,
  };
}

const ms = (n: number) => String(Math.round(n));

/** Loads every page `runs` times and prints the table; the exit code: 0 done, 1 stopped. */
export async function timings(argv: readonly string[], deps: Deps): Promise<number> {
  const args = parseArgs(argv);
  if (!args.cookie) {
    for (const line of HOW_TO_COPY) deps.err(line);
    return 1;
  }
  let cookie: string;
  try {
    cookie = deps.readFile(args.cookie).trim();
  } catch (error) {
    deps.err(`timings: cannot read ${args.cookie}: ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  }
  if (!cookie) {
    deps.err(`timings: ${args.cookie} is empty`);
    for (const line of HOW_TO_COPY.slice(1)) deps.err(line);
    return 1;
  }

  deps.out(`${args.base} · ${args.runs} loads per page · ms`);
  deps.out('');
  deps.out('| page | runs | first byte, median | first byte, p75 | full load, median | full load, p75 |');
  deps.out('| --- | --- | --- | --- | --- | --- |');
  for (const page of PAGES) {
    const samples: Sample[] = [];
    for (let run = 0; run < args.runs; run++) {
      const start = deps.now();
      const response = await deps.fetch(`${args.base}${page}`, {
        headers: { cookie, 'cache-control': 'no-cache' },
        redirect: 'manual',
      });
      const firstByte = deps.now();
      const body = await response.text();
      const end = deps.now();
      const refused = response.status !== 200
        ? `answered ${response.status}${response.headers.get('location') ? ` (to ${response.headers.get('location')})` : ''}`
        : SIGN_IN_CARD.test(body) ? 'showed its sign-in card' : null;
      if (refused) {
        deps.err(`timings: ${page} ${refused}.`);
        deps.err('The cookie is not a signed in session (expired, or copied from another site): copy a fresh one and run again.');
        return 1;
      }
      samples.push({ ttfb: firstByte - start, total: end - start });
    }
    const s = summarise(samples);
    deps.out(`| ${page} | ${s.runs} | ${ms(s.ttfb.median)} | ${ms(s.ttfb.p75)} | ${ms(s.total.median)} | ${ms(s.total.p75)} |`);
  }
  return 0;
}
