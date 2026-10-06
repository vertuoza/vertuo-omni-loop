import { describe, expect, it } from 'vitest';
import { GithubDeferred, GithubPaused, githubClient, memoryGithubStore, type GithubClient, type Priority, type GithubStore } from './index.ts';

const T0 = Date.parse('2026-10-01T09:00:00Z');
const RESET = Math.floor(T0 / 1000) + 3600;
const ISSUE = 'https://api.github.com/repos/acme/widgets/issues/7';
const GRAPHQL = 'https://api.github.com/graphql';

type Answer = Response | ((url: string, init: RequestInit) => Response);

/** A stubbed GitHub: answers in order, every request it was sent kept. */
function stubGithub(...answers: Answer[]) {
  const sent: { url: string; init: RequestInit }[] = [];
  const fetch = (url: string, init: RequestInit = {}) => {
    sent.push({ url, init });
    const next = answers.shift();
    if (!next) return Promise.reject(new Error(`no answer stubbed for ${url}`));
    return Promise.resolve(typeof next === 'function' ? next(url, init) : next);
  };
  /** The request sent `index`-th; a test that reads one never sent fails here. */
  const request = (index: number) => {
    const found = sent[index];
    if (!found) throw new Error(`no request ${index} was sent, only ${sent.length}`);
    return found;
  };
  return { fetch, sent, request };
}

const limits = (remaining: number, { limit = 5000, resource = 'core', reset = RESET } = {}): Record<string, string> => ({
  'x-ratelimit-limit': String(limit), 'x-ratelimit-remaining': String(remaining),
  'x-ratelimit-reset': String(reset), 'x-ratelimit-resource': resource,
});
const ok = (body: unknown, headers: Record<string, string> = {}) => new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json', ...limits(4000), ...headers } });

function setup(...answers: Answer[]) {
  const github = stubGithub(...answers);
  const store = memoryGithubStore();
  const logs: string[] = [];
  let now = T0;
  const client = githubClient({ store, fetch: github.fetch, clock: () => now, log: (line) => { logs.push(line); } });
  return { ...github, store, logs, client, at: (t: number) => { now = t; } };
}

const call = (client: GithubClient, url = ISSUE, priority: Priority = 'interactive', init: RequestInit = {}) =>
  client.fetch(url, { headers: { authorization: 'Bearer t' }, ...init, installation: 42, priority });

describe('githubFetch: conditional requests', () => {
  it('stores an answer with an ETag and sends it back as If-None-Match; a 304 answers the stored body', async () => {
    const { client, request } = setup(ok({ number: 7 }, { etag: 'W/"abc"' }), new Response(null, { status: 304, headers: limits(4000) }));
    expect(await (await call(client)).json()).toEqual({ number: 7 });
    const second = await call(client);
    expect(second.status).toBe(200);
    expect(await second.json()).toEqual({ number: 7 });
    expect(new Headers(request(0).init.headers).get('if-none-match')).toBeNull();
    expect(new Headers(request(1).init.headers).get('if-none-match')).toBe('W/"abc"');
    expect(new Headers(request(1).init.headers).get('authorization')).toBe('Bearer t');
  });

  it('keeps the stored ETags per installation', async () => {
    const { client, request } = setup(ok({ n: 1 }, { etag: '"a"' }), ok({ n: 2 }));
    await call(client);
    await client.fetch(ISSUE, { installation: 43, priority: 'interactive' });
    expect(new Headers(request(1).init.headers).get('if-none-match')).toBeNull();
  });

  it('sends a GraphQL call without an ETag, and never stores one', async () => {
    const { client, store, request } = setup(ok({ data: {} }, { etag: '"g"', ...limits(4000, { resource: 'graphql' }) }));
    await call(client, GRAPHQL, 'interactive', { method: 'POST', body: '{}' });
    expect(new Headers(request(0).init.headers).get('if-none-match')).toBeNull();
    expect(await store.etag(42, GRAPHQL)).toBeNull();
  });

  it('marks a stored ETag read when it answers a 304', async () => {
    const { client, store, at } = setup(ok({ n: 1 }, { etag: '"a"' }), new Response(null, { status: 304 }));
    await call(client);
    at(T0 + 60_000);
    await call(client);
    expect(await store.etag(42, ISSUE)).toMatchObject({ readAt: T0 + 60_000 });
  });

  it('strips its own options before the request goes out', async () => {
    const { client, request } = setup(ok({}));
    await call(client);
    expect(request(0).init).not.toHaveProperty('installation');
    expect(request(0).init).not.toHaveProperty('priority');
  });
});

describe('githubFetch: the budget', () => {
  it('records each answer\'s limit, remaining and reset for its resource', async () => {
    const { client, store } = setup(ok({}, limits(4321)), ok({}, limits(4990, { resource: 'graphql' })));
    await call(client);
    await call(client, GRAPHQL, 'interactive', { method: 'POST', body: '{}' });
    expect(await store.budget(42, 'core')).toMatchObject({ limit: 5000, remaining: 4321, resetAt: RESET * 1000, pausedUntil: null });
    expect(await store.budget(42, 'graphql')).toMatchObject({ remaining: 4990 });
  });

  it('refuses a background call below 20% of the limit, without sending it; an interactive one is sent', async () => {
    const { client, sent } = setup(ok({}, limits(999)), ok({}, limits(998)));
    await call(client);
    await expect(call(client, ISSUE, 'background')).rejects.toEqual(new GithubDeferred(RESET * 1000));
    expect(sent).toHaveLength(1);
    await call(client, ISSUE, 'interactive');
    expect(sent).toHaveLength(2);
  });

  it('sends a background call at 20% of the limit, and once the window has reset', async () => {
    const { client, sent, at } = setup(ok({}, limits(1000)), ok({}, limits(999)), ok({}, limits(4999)));
    await call(client, ISSUE, 'background');
    await call(client, ISSUE, 'background');
    at(RESET * 1000 + 1);
    await call(client, ISSUE, 'background');
    expect(sent).toHaveLength(3);
  });

  it('reads the budget of the resource the call spends: GraphQL is not refused by a spent core', async () => {
    const { client, sent } = setup(ok({}, limits(10)), ok({ data: {} }, limits(4000, { resource: 'graphql' })));
    await call(client);
    await call(client, GRAPHQL, 'background', { method: 'POST', body: '{}' });
    expect(sent).toHaveLength(2);
  });
});

describe('githubFetch: one pause for everyone', () => {
  const spent = () => new Response(JSON.stringify({ message: 'API rate limit exceeded for installation ID 42.' }), { status: 403, headers: limits(0) });

  it('pauses the installation\'s resource until the reset on a 403 with nothing remaining, and says so once', async () => {
    const { client, sent, store, logs } = setup(spent());
    await expect(call(client)).rejects.toEqual(new GithubPaused(RESET * 1000));
    expect(await store.budget(42, 'core')).toMatchObject({ pausedUntil: RESET * 1000 });
    await expect(call(client, ISSUE, 'interactive')).rejects.toEqual(new GithubPaused(RESET * 1000));
    await expect(call(client, ISSUE, 'background')).rejects.toBeInstanceOf(GithubPaused);
    expect(sent).toHaveLength(1);
    expect(logs).toEqual([`GitHub paused installation 42 (core) until ${new Date(RESET * 1000).toISOString()}: answered 403, rate limit spent`]);
  });

  it('pauses for retry-after seconds on a 429', async () => {
    const { client, store } = setup(new Response('', { status: 429, headers: { 'retry-after': '120' } }));
    await expect(call(client)).rejects.toEqual(new GithubPaused(T0 + 120_000));
    expect(await store.budget(42, 'core')).toMatchObject({ pausedUntil: T0 + 120_000 });
  });

  it('pauses on GitHub\'s secondary rate limit message', async () => {
    const { client } = setup(new Response(JSON.stringify({ message: 'You have exceeded a secondary rate limit. Please wait a few minutes before you try again.' }), {
      status: 403, headers: limits(3000),
    }));
    await expect(call(client)).rejects.toBeInstanceOf(GithubPaused);
  });

  it('sends again once the pause is over', async () => {
    const { client, sent, at } = setup(spent(), ok({}, limits(5000, { reset: RESET + 3600 })));
    await expect(call(client)).rejects.toBeInstanceOf(GithubPaused);
    at(RESET * 1000);
    expect((await call(client, ISSUE, 'background')).status).toBe(200);
    expect(sent).toHaveLength(2);
  });

  it('shares the pause through the store: another instance sends nothing either', async () => {
    const { client, store } = setup(spent());
    await expect(call(client)).rejects.toBeInstanceOf(GithubPaused);
    const other = stubGithub();
    const second = githubClient({ store, fetch: other.fetch, clock: () => T0, log: () => {} });
    await expect(call(second)).rejects.toBeInstanceOf(GithubPaused);
    expect(other.sent).toHaveLength(0);
  });

  it('passes a 403 that is not a rate limit through untouched', async () => {
    const { client, store } = setup(new Response(JSON.stringify({ message: 'Resource not accessible by integration' }), { status: 403, headers: limits(4000) }));
    const res = await call(client);
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ message: 'Resource not accessible by integration' });
    expect(await store.budget(42, 'core')).toMatchObject({ pausedUntil: null });
  });
});

describe('githubFetch: the store never blocks a read', () => {
  const broken = (): GithubStore => {
    const fail = () => Promise.reject(new Error('Supabase is down'));
    return { etag: fail, saveEtag: fail, touchEtag: fail, budget: fail, saveBudget: fail, pause: fail };
  };

  it('sends a plain request when the store cannot be read or written, and logs it once', async () => {
    const github = stubGithub(ok({ n: 1 }, { etag: '"a"' }), ok({ n: 2 }));
    const logs: string[] = [];
    const client = githubClient({ store: broken(), fetch: github.fetch, clock: () => T0, log: (l) => { logs.push(l); } });
    expect(await (await call(client)).json()).toEqual({ n: 1 });
    expect(await (await call(client, ISSUE, 'background')).json()).toEqual({ n: 2 });
    expect(logs).toEqual(['GitHub budget store failed, calling GitHub without it: Supabase is down']);
  });

  it('works with no store at all', async () => {
    const github = stubGithub(ok({ n: 1 }));
    const client = githubClient({ store: null, fetch: github.fetch, clock: () => T0, log: () => {} });
    expect((await call(client)).status).toBe(200);
  });

  it('refuses a call that names no real installation', async () => {
    const { client } = setup();
    await expect(client.fetch(ISSUE, { installation: 0, priority: 'interactive' })).rejects.toThrow(/installation/);
  });
});

describe('boundFetch', () => {
  it('is a plain fetch with the installation and priority fixed, for Octokit', async () => {
    const { client, sent, store } = setup(ok({}, limits(10)));
    const fetch = client.bound({ installation: 42, priority: 'background' });
    await fetch(ISSUE, { headers: { authorization: 'Bearer t' } });
    expect(sent).toHaveLength(1);
    expect(await store.budget(42, 'core')).toMatchObject({ remaining: 10 });
    await expect(fetch(ISSUE, {})).rejects.toBeInstanceOf(GithubDeferred);
  });
});
