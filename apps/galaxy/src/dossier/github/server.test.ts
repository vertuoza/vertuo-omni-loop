// The server's GitHub store (#2953): every GitHub read galaxy makes goes through it, so what it asks the
// database per read is what the database pays per GitHub request.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { githubClient, type GithubStore } from '@omni/github';

vi.mock('server-only', () => ({}));
const db = vi.hoisted((): { client: unknown } => ({ client: null }));
vi.mock('../../data/sign-in-live', () => ({ serviceDb: () => db.client }));

const ISSUE = 'https://api.github.com/repos/acme/widgets/issues/7';
const T0 = Date.parse('2026-11-16T09:00:00Z');
const RESET = String(Math.floor(T0 / 1000) + 3600);

type Row = Record<string, unknown>;
type Table = 'github_etags' | 'github_budget';

/** A supabase-js client in memory, the store's few calls on its two tables, each query counted. */
function fakeServiceDb() {
  const tables: Record<Table, Row[]> = { github_etags: [], github_budget: [] };
  const keys: Record<Table, string[]> = { github_etags: ['installation_id', 'url'], github_budget: ['installation_id', 'resource'] };
  const queries: string[] = [];
  function from(table: Table) {
    const filters: [string, unknown][] = [];
    let columns = '';
    const rows = () => tables[table].filter((row) => filters.every(([column, value]) => row[column] === value));
    const pick = (row: Row) => Object.fromEntries(columns.split(',').map((c) => c.trim()).map((c) => [c, row[c] ?? null]));
    const chain = (op: string, payload: Row = {}) => {
      const filtered = {
        eq(column: string, value: unknown) { filters.push([column, value]); return filtered; },
        maybeSingle() {
          queries.push(`${table} ${op}`);
          const first = rows()[0];
          return Promise.resolve({ data: first ? pick(first) : null, error: null });
        },
        select(names: string) {
          queries.push(`${table} ${op}`);
          columns = names;
          const hit = rows();
          hit.forEach((row) => Object.assign(row, payload));
          return Promise.resolve({ data: hit.map(pick), error: null });
        },
      };
      return filtered;
    };
    return {
      select(names: string) { columns = names; return chain('select'); },
      update(values: Row) { return chain('update', values); },
      upsert(values: Row) {
        queries.push(`${table} upsert`);
        const same = tables[table].find((row) => keys[table].every((key) => row[key] === values[key]));
        if (same) Object.assign(same, values); else tables[table].push({ ...values });
        return Promise.resolve({ data: null, error: null });
      },
    };
  }
  const count = (query: string) => queries.filter((q) => q === query).length;
  return { client: { from }, tables, queries, count };
}

/** A GitHub answering in order, every request it was sent kept. */
function stubGithub(...answers: ((init: RequestInit) => Response)[]) {
  const sent: RequestInit[] = [];
  const fetch = (_url: string, init: RequestInit) => {
    sent.push(init);
    const next = answers.shift();
    return next ? Promise.resolve(next(init)) : Promise.reject(new Error('no answer stubbed'));
  };
  return { fetch, sent };
}
const limits = { 'x-ratelimit-limit': '5000', 'x-ratelimit-remaining': '4000', 'x-ratelimit-reset': RESET, 'x-ratelimit-resource': 'core' };
const ok = (body: unknown, etag: string) => () => new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json', etag, ...limits } });
const notModified = () => () => new Response(null, { status: 304, headers: limits });
const ifNoneMatch = (init: RequestInit | undefined) => new Headers(init?.headers).get('if-none-match');

/** The server's store, made fresh with its module, over a fake service-role client. */
async function serverStore(): Promise<{ store: GithubStore; database: ReturnType<typeof fakeServiceDb> }> {
  const database = fakeServiceDb();
  db.client = database.client;
  vi.resetModules();
  const { githubStore } = await import('./server');
  return { store: githubStore(), database };
}

function clientOn(store: GithubStore, github: ReturnType<typeof stubGithub>) {
  let now = T0;
  const client = githubClient({ store, fetch: github.fetch, clock: () => now, log: () => {} });
  return { read: () => client.fetch(ISSUE, { installation: 42, priority: 'interactive' }), at: (t: number) => { now = t; } };
}

describe('githubStore: what a GitHub read costs the database (#2953)', () => {
  beforeEach(() => { db.client = null; });

  it('reads an ETag from the database once per server, then from memory', async () => {
    const { store, database } = await serverStore();
    const github = stubGithub(ok({ number: 7 }, 'W/"a"'), notModified(), notModified());
    const { read, at } = clientOn(store, github);
    expect(await (await read()).json()).toEqual({ number: 7 });
    at(T0 + 1000);
    expect(await (await read()).json()).toEqual({ number: 7 });
    at(T0 + 2000);
    expect(await (await read()).json()).toEqual({ number: 7 });
    expect(ifNoneMatch(github.sent[2])).toBe('W/"a"');
    expect(database.count('github_etags select')).toBe(1);
    expect(database.count('github_etags upsert')).toBe(1);
  });

  it('writes no ETag row for a 200 that repeats the stored body under a new token\'s ETag, and sends the new ETag next', async () => {
    const { store, database } = await serverStore();
    const github = stubGithub(ok({ number: 7 }, 'W/"a"'), ok({ number: 7 }, 'W/"b"'), notModified());
    const { read, at } = clientOn(store, github);
    await read();
    at(T0 + 1000);
    expect(await (await read()).json()).toEqual({ number: 7 });
    at(T0 + 2000);
    expect(await (await read()).json()).toEqual({ number: 7 });
    expect(ifNoneMatch(github.sent[2])).toBe('W/"b"');
    expect(database.count('github_etags upsert')).toBe(1);
  });
});
