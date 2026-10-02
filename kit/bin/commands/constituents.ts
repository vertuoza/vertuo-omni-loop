// `omni constituents [--json]` (PRD 871) — the product's constituents, which every session reads first:
// its Statement (what the product is) and its Never list (what it must never become or do). The kit
// plugin's `SessionStart` hook runs it, so they print above the briefing.
//
// It reads `GET /api/constituents?repo=` for this repository with the terminal's sign-in, as
// `omni business show` reads the business, keeps the copy at `.omni-loop/local/constituents.json` of
// the main checkout (`../../lib/constituents/cache.ts`), and prints it under "synced just now".
// Offline or failing, it prints the cached copy with its age ("synced 3 d ago, offline"); with no
// cache, it prints one line ending "— agents carry on". A reply with no product, or a product with no
// constituent, is one line too, and is kept like any reply.
//
// It never holds up a session: every outcome exits 0, within a 3-second budget for the whole read
// (the sign-in's renewal included). Exit 2 is only for a usage error.
//
// `--json` prints `{ state, product, statement, never, syncedAt }`, `state` being:
//   ok           read just now, with a Statement or a Never line
//   none         read just now: no product for this repository, or no constituent yet
//   cached       the read failed; the rest is the last copy synced, `syncedAt` its time
//   no-sign-in   no Omni page set here (ask.url), no sign-in for it, or one it no longer honours
//   unreachable  the Omni page could not be reached in time
//   refused      the Omni page refused the read, or its reply is not constituents
//   no-kit       the kit is not set up in this checkout
// The last four come with no cache: `product` and `statement` null, `never` [], `syncedAt` null.
//
// It runs before a context exists, like `business`, so that a test can hand it `tokens` (the token
// store), `home`, `fetch`, `now` and `budgetMs`; it loads the context itself.
import { askClient, AskCallError } from '../../lib/ask/client.ts';
import type { Fetch, TokenStore } from '../../lib/ask/client.ts';
import { homeTokens } from '../../lib/ask/client-tokens.ts';
import { credentialsHost } from '../../lib/ask/credentials.ts';
import { readCache, writeCache } from '../../lib/constituents/cache.ts';
import { ageOf, constituentsOf, printed } from '../../lib/constituents/read.ts';
import type { Constituents } from '../../lib/constituents/read.ts';
import { loadContext } from '../../lib/context.ts';
import { mainCheckout } from '../../lib/dossier/local.ts';
import { parseArgs, println, usageError } from '../args.ts';
import type { Exec, FreeCommand, FreeIo } from '../io.ts';

/** What `--json` says of the read. */
type State = 'ok' | 'none' | 'cached' | 'no-sign-in' | 'unreachable' | 'refused' | 'no-kit';

/** The read as `--json` prints it. */
type Body = {
  state: State;
  product: Constituents['product'];
  statement: Constituents['statement'];
  never: Constituents['never'];
  syncedAt: string | null;
};

/** What a test hands `omni constituents` beyond `main()`'s own. */
type ConstituentsOptions = {
  tokens?: TokenStore | undefined;
  home?: string | undefined;
  fetch?: Fetch;
  now?: () => number;
  budgetMs?: number;
};

/** What the read is handed. */
type SyncIo = { cwd: string; exec: Exec; tokens: TokenStore | undefined; home: string | undefined; fetch: Fetch; now: () => number; budgetMs: number };

/** Where the read stopped, as a state and a few words. */
type Stop = { state: State; why: string };

/** This checkout's repository and where its cache lives, with the client to call or why there is none. */
type Reached = { repo: string | null; root: string } & ({ client: ReturnType<typeof askClient>; repo: string } | (Stop & { client?: undefined }));

const USAGE = 'usage: omni constituents [--json]';
/** The whole read's budget: a session's start never waits longer. */
export const CONSTITUENTS_BUDGET_MS = 3000;
const CARRY_ON = '— agents carry on';

/** `fetch` held to one deadline shared by every request of the read, the renewal included. */
function withDeadline(fetch: Fetch, signal: AbortSignal): Fetch {
  return (url, init) => fetch(url, { ...init, signal: init.signal ? AbortSignal.any([init.signal, signal]) : signal });
}

/** The read as `--json` prints it. */
const bodyOf = (state: State, read: Constituents | null = null, syncedAt: string | null = null): Body => ({
  state,
  product: read?.product ?? null,
  statement: read?.statement ?? null,
  never: read?.never ?? [],
  syncedAt: syncedAt ?? null,
});

/** Where the read stopped, as a state and a few words. */
function stopped(error: unknown): Stop {
  if (!(error instanceof AskCallError)) return { state: 'unreachable', why: 'offline' };
  if (error.status === null) return { state: 'unreachable', why: 'offline' };
  if (error.status === 401) return { state: 'no-sign-in', why: 'the sign-in was refused (omni signin)' };
  return { state: 'refused', why: `refused (${error.status})${error.reason ? `: ${error.reason}` : ''}` };
}

/** The reply within `ms`, or an `AskCallError` with no status when the budget runs out first. */
async function readWithin(client: ReturnType<typeof askClient>, repo: string, controller: AbortController, ms: number): Promise<unknown> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new AskCallError('GET /api/constituents: timed out'));
    }, ms);
  });
  try {
    return await Promise.race([client.readConstituents(repo), late]);
  } finally {
    clearTimeout(timer);
  }
}

/** This checkout's repository, where its cache lives and its Omni page's client, or why there is none. */
function reach({ cwd, exec, tokens, home, fetch, signal }: Pick<SyncIo, 'cwd' | 'exec' | 'tokens' | 'home' | 'fetch'> & { signal: AbortSignal }): Reached {
  const ctx = loadContext(cwd, { exec });
  const repo = ctx.config.repo.slug;
  const root = mainCheckout(cwd, exec) ?? ctx.root;
  if (!repo) return { repo, root, state: 'refused', why: 'no repository slug (repo.slug)' };
  const askUrl = ctx.config.ask.url;
  if (!askUrl) return { repo, root, state: 'no-sign-in', why: 'no Omni page is set here (ask.url)' };
  const host = credentialsHost(askUrl);
  const store = tokens ?? homeTokens(home ? { home } : undefined);
  if (!store.read(host)) return { repo, root, state: 'no-sign-in', why: 'no sign-in (omni signin)' };
  const client = askClient({ baseUrl: askUrl, host, tokens: store, fetch: withDeadline(fetch, signal) });
  return { repo, root, client };
}

/** What is printed when the read failed: the cached copy with its age, or one line. */
function fallback({ repo, root, state, why }: { repo: string | null; root: string } & Stop, now: number): [Body, string[]] {
  const cached = repo ? readCache(root, repo) : null;
  if (!repo || !cached) return [bodyOf(state), [`no constituents: ${why} ${CARRY_ON}`]];
  const synced = `synced ${ageOf(cached.syncedAt, now)}, ${why}`;
  return [bodyOf('cached', cached.read, cached.syncedAt), printed(cached.read, repo, synced)];
}

async function sync(env: SyncIo): Promise<[Body, string[]]> {
  const controller = new AbortController();
  let reached: Reached;
  try {
    reached = reach({ ...env, signal: controller.signal });
  } catch (error) {
    if (!(error instanceof Error) || error.name !== 'ConfigError') throw error;
    return [bodyOf('no-kit'), [`no constituents: ${error.message.split('\n')[0]} ${CARRY_ON}`]];
  }
  if (reached.client === undefined) return fallback(reached, env.now());
  const { client, repo, root } = reached;
  let reply: unknown;
  try {
    reply = await readWithin(client, repo, controller, env.budgetMs);
  } catch (error) {
    return fallback({ repo, root, ...stopped(error) }, env.now());
  }
  const read = constituentsOf(reply);
  if (!read) return fallback({ repo, root, state: 'refused', why: 'refused (the reply is not constituents)' }, env.now());
  const syncedAt = new Date(env.now()).toISOString();
  try {
    writeCache(root, { repo, syncedAt, read });
  } catch {
    // An unwritable cache costs the next offline start its copy, nothing more.
  }
  return [bodyOf(read.state, read, syncedAt), printed(read, repo, 'synced just now')];
}

export const constituents = {
  withoutContext: true,
  async run(
    args: string[],
    { cwd, stdout, exec, tokens, home, fetch = globalThis.fetch, now = Date.now, budgetMs = CONSTITUENTS_BUDGET_MS }: FreeIo & ConstituentsOptions,
  ) {
    const { positional, flags } = parseArgs('constituents', args, { booleans: ['json'] });
    if (positional.length > 0) throw usageError(USAGE);
    let body: Body;
    let lines: string[];
    try {
      [body, lines] = await sync({ cwd, exec, tokens, home, fetch, now, budgetMs });
    } catch {
      [body, lines] = [bodyOf('unreachable'), [`no constituents: the read failed ${CARRY_ON}`]];
    }
    if (flags.json === true) println(stdout, JSON.stringify(body));
    else for (const line of lines) println(stdout, line);
    return 0;
  },
} satisfies FreeCommand;
