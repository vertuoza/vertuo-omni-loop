// The budget-aware GitHub client (PRD 902, s1). Every call galaxy and omni-app make to GitHub with an
// installation token goes through `fetch` below, a `fetch` with two more options in its init:
// `installation`, whose budget the call spends, and `priority`, `interactive` (a person waits on the
// answer) or `background` (the sync, a recount, a refresh, a check).
//
// - A GET is sent with the stored ETag of its (installation, URL) as If-None-Match; a 304, which GitHub
//   does not count, answers the stored body. A 200 with an ETag is stored. GraphQL is never stored.
// - Every answer's x-ratelimit-* headers update the installation's budget for the answer's resource.
// - A background call is refused with GithubDeferred, unsent, while the resource's remaining is below
//   20% of its limit and its window has not reset. An interactive call may spend it to zero.
// - A 403 or 429 that says the limit is spent (nothing remaining, a retry-after, or the secondary-limit
//   message) pauses the installation's resource until its reset (or retry-after), logged once; until
//   then every call for it, at either priority and from either app, is refused with GithubPaused
//   without being sent. Nothing retries.
// - A store that cannot be read or written never blocks a read: the call goes out plain, logged once.
//
// It does not mint tokens nor make the App-JWT calls, and is not for calls made with a person's token.

export type Priority = 'interactive' | 'background';
/** The rate-limit resource an answer reports (`core`, `graphql`, `search`…). */
export type Resource = string;

/** The two options githubFetch adds to a fetch's init. */
export interface GithubCallOptions { installation: number; priority: Priority }
/** A fetch's init with the two options; `priority` is the budget's, never the browser's request priority. */
export type GithubInit = Omit<RequestInit, 'priority'> & GithubCallOptions;
export type GithubFetch = (url: string, init: GithubInit) => Promise<Response>;
/** What the client sends through, and what `bound` gives: a fetch called with a URL and an init. */
export type PlainFetch = (url: string, init: RequestInit) => Promise<Response>;

/** Times are epoch milliseconds. */
export interface StoredEtag { etag: string; body: string; contentType: string | null; readAt: number }
export interface StoredBudget { limit: number; remaining: number; resetAt: number; pausedUntil: number | null; updatedAt: number }
export interface GithubStore {
  etag(installation: number, url: string): Promise<StoredEtag | null>;
  saveEtag(installation: number, url: string, value: { etag: string; body: string; contentType?: string | null; at: number }): Promise<void>;
  touchEtag(installation: number, url: string, at: number): Promise<void>;
  budget(installation: number, resource: Resource): Promise<StoredBudget | null>;
  saveBudget(installation: number, resource: Resource, value: { limit: number; remaining: number; resetAt: number; at: number }): Promise<void>;
  pause(installation: number, resource: Resource, until: number, at: number): Promise<void>;
}

export interface GithubClient {
  fetch: GithubFetch;
  /** A plain fetch spending `installation`'s budget at `priority`, for Octokit's `request.fetch`. */
  bound(options: GithubCallOptions): PlainFetch;
}

export interface GithubClientDeps {
  store: GithubStore | null;
  fetch?: PlainFetch;
  clock?: () => number;
  log?: (line: string) => void;
}

/** Below this share of its limit, a resource refuses background calls. */
export const BACKGROUND_FLOOR = 0.2;
/** A pause when GitHub says the limit is spent but gives no time to wait. */
const DEFAULT_PAUSE_MS = 60_000;
const SECONDARY = /secondary rate limit/i;

/** A background call refused, unsent, because the budget is below its floor until `until` (epoch ms). */
export class GithubDeferred extends Error {
  readonly until: number;
  constructor(until: number) {
    super(`GitHub budget below its background floor until ${new Date(until).toISOString()}`);
    this.name = 'GithubDeferred';
    this.until = until;
  }
}

/** A call refused, unsent, because GitHub paused the installation until `until` (epoch ms). */
export class GithubPaused extends Error {
  readonly until: number;
  constructor(until: number) {
    super(`GitHub paused until ${new Date(until).toISOString()}`);
    this.name = 'GithubPaused';
    this.until = until;
  }
}

/** The rate-limit resource a call spends, guessed from its URL before it is sent. */
export function resourceOf(url: string): Resource {
  return new URL(url).pathname.replace(/\/+$/, '').endsWith('/graphql') ? 'graphql' : 'core';
}

/** The budget an answer's headers report; null when it carries none. */
function budgetOf(headers: Headers): { limit: number; remaining: number; resetAt: number } | null {
  const limit = Number(headers.get('x-ratelimit-limit'));
  const remaining = Number(headers.get('x-ratelimit-remaining'));
  const reset = Number(headers.get('x-ratelimit-reset'));
  if (!headers.has('x-ratelimit-limit') || !Number.isFinite(limit) || !Number.isFinite(remaining) || !Number.isFinite(reset)) return null;
  return { limit, remaining, resetAt: reset * 1000 };
}

/** When a refused answer says the limit is spent, until when to pause; null when it is not a rate limit. */
async function pauseOf(res: Response, now: number): Promise<number | null> {
  if (res.status !== 403 && res.status !== 429) return null;
  const retryAfter = Number(res.headers.get('retry-after'));
  if (res.headers.has('retry-after') && Number.isFinite(retryAfter)) return now + retryAfter * 1000;
  const reset = Number(res.headers.get('x-ratelimit-reset')) * 1000;
  const until = Number.isFinite(reset) && reset > now ? reset : now + DEFAULT_PAUSE_MS;
  if (res.headers.get('x-ratelimit-remaining') === '0') return until;
  const text = await res.clone().text().catch(() => '');
  if (SECONDARY.test(text)) return until;
  return res.status === 429 ? until : null;
}

export function githubClient({ store, fetch: send = (url, init) => globalThis.fetch(url, init), clock = Date.now, log = (line) => { console.error(line); } }: GithubClientDeps): GithubClient {
  let storeDown = false;
  /** A store operation; on failure, `fallback`, logged once until the store answers again. */
  async function stored<T>(run: (s: GithubStore) => Promise<T>): Promise<T | null> {
    if (!store) return null;
    try {
      const value = await run(store);
      storeDown = false;
      return value;
    } catch (error) {
      if (!storeDown) log(`GitHub budget store failed, calling GitHub without it: ${error instanceof Error ? error.message : String(error)}`);
      storeDown = true;
      return null;
    }
  }

  async function githubFetch(url: string, init: GithubInit): Promise<Response> {
    const { installation, priority, ...rest } = init;
    if (!Number.isInteger(installation) || installation < 1) throw new Error(`githubFetch needs the installation whose budget it spends, not ${JSON.stringify(installation)}`);
    const method = (rest.method ?? 'GET').toUpperCase();
    const resource = resourceOf(url);
    const now = clock();

    const budget = await stored((s) => s.budget(installation, resource));
    if (budget?.pausedUntil && budget.pausedUntil > now) throw new GithubPaused(budget.pausedUntil);
    if (priority === 'background' && budget && budget.resetAt > now && budget.remaining < budget.limit * BACKGROUND_FLOOR) {
      throw new GithubDeferred(budget.resetAt);
    }

    const conditional = method === 'GET' && resource === 'core';
    const kept = conditional ? await stored((s) => s.etag(installation, url)) : null;
    // The caller's headers go out as given; a stored ETag adds one, as a plain object of lowercase names.
    const headers = kept
      ? { ...Object.fromEntries(new Headers(rest.headers)), 'if-none-match': kept.etag }
      : rest.headers;
    const res = await send(url, headers === undefined ? rest : { ...rest, headers });

    const answered = clock();
    const reported = budgetOf(res.headers);
    const spent = reported?.limit ? reported : null;
    const pauseUntil = await pauseOf(res, answered);
    const answeredResource = res.headers.get('x-ratelimit-resource') || resource;
    if (spent) await stored((s) => s.saveBudget(installation, answeredResource, { ...spent, at: answered }));
    if (pauseUntil !== null) {
      await stored((s) => s.pause(installation, answeredResource, pauseUntil, answered));
      log(`GitHub paused installation ${installation} (${answeredResource}) until ${new Date(pauseUntil).toISOString()}: answered ${res.status}, rate limit spent`);
      throw new GithubPaused(pauseUntil);
    }

    if (res.status === 304 && kept) {
      await stored((s) => s.touchEtag(installation, url, answered));
      const out = new Headers(res.headers);
      out.set('content-type', kept.contentType ?? 'application/json');
      out.set('etag', kept.etag);
      return new Response(kept.body, { status: 200, headers: out });
    }
    const etag = res.headers.get('etag');
    if (conditional && res.status === 200 && etag) {
      const body = await res.clone().text();
      await stored((s) => s.saveEtag(installation, url, { etag, body, contentType: res.headers.get('content-type'), at: answered }));
    }
    return res;
  }

  /** A plain init without the browser's own `priority`, which the budget's takes the place of. */
  const stripPriority = (init: RequestInit): Omit<RequestInit, 'priority'> => {
    const rest = { ...init };
    delete rest.priority;
    return rest;
  };

  return {
    fetch: githubFetch,
    /** A plain `fetch(url, init)` spending `installation`'s budget at `priority`: Octokit's `request.fetch`. */
    bound({ installation, priority }) {
      return (url, init) => githubFetch(url, { ...stripPriority(init), installation, priority });
    },
  };
}
