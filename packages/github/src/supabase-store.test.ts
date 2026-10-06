import { describe, expect, it } from 'vitest';
import { supabaseGithubStore, type GithubDb } from './index.ts';

type Row = Record<string, unknown>;
type Table = 'github_etags' | 'github_budget';
type Result = { data: unknown; error: { message: string } | null };

/** A supabase-js client in memory: the few calls the store makes, on two keyed tables. */
function fakeDb({ fail = null }: { fail?: string | null } = {}) {
  const tables: Record<Table, Row[]> = { github_etags: [], github_budget: [] };
  const keys: Record<Table, string[]> = { github_etags: ['installation_id', 'url'], github_budget: ['installation_id', 'resource'] };
  const calls: { table: Table; op: string | null }[] = [];
  function from(table: Table) {
      const filters: [string, string | number][] = [];
      let op: 'select' | 'update' | 'upsert' | null = null;
      let payload: Row = {};
      let returning = false;
      /** Only the columns a select names, as PostgREST answers them. */
      const picked = (names: string) => (row: Row) => Object.fromEntries(names.split(',').map((c) => c.trim()).map((c) => [c, row[c] ?? null]));
      let columns = '';
      const rows = () => tables[table].filter((r) => filters.every(([c, v]) => r[c] === v));
      const run = (): Result => {
        calls.push({ table, op });
        if (fail) return { data: null, error: { message: fail } };
        if (op === 'select') return { data: rows(), error: null };
        if (op === 'update') {
          const hit = rows();
          hit.forEach((r) => Object.assign(r, payload));
          return { data: returning ? hit.map(picked(columns)) : null, error: null };
        }
        const same = tables[table].find((r) => keys[table].every((k) => r[k] === payload[k]));
        if (same) Object.assign(same, payload); else tables[table].push({ ...payload });
        return { data: null, error: null };
      };
      const chain = {
        eq(column: string, value: string | number) { filters.push([column, value]); return chain; },
        maybeSingle() {
          const { data, error } = run();
          const first = Array.isArray(data) ? data.map(picked(columns))[0] : undefined;
          return Promise.resolve({ data: first ?? null, error });
        },
        select(names: string) { returning = true; columns = names; return Promise.resolve(run()); },
      };
      return {
        select(names: string) { op = 'select'; columns = names; return chain; },
        update(values: Row) { op = 'update'; payload = values; return chain; },
        upsert(values: Row) { op = 'upsert'; payload = values; return Promise.resolve(run()); },
      };
  }
  const db: GithubDb = { etags: () => from('github_etags'), budget: () => from('github_budget') };
  return { ...db, tables, calls };
}

const AT = Date.parse('2026-10-01T09:00:00Z');

describe('supabaseGithubStore', () => {
  it('stores an ETag per installation and URL, reads it back and marks it read', async () => {
    const db = fakeDb();
    const store = supabaseGithubStore(db);
    await store.saveEtag(42, 'https://api.github.com/repos/a/b', { etag: '"a"', body: '{}', contentType: 'application/json', at: AT });
    await store.saveEtag(42, 'https://api.github.com/repos/a/b', { etag: '"b"', body: '[]', contentType: 'application/json', at: AT });
    expect(db.tables.github_etags).toHaveLength(1);
    await store.touchEtag(42, 'https://api.github.com/repos/a/b', AT + 1000);
    expect(await store.etag(42, 'https://api.github.com/repos/a/b')).toEqual({ etag: '"b"', body: '[]', contentType: 'application/json', readAt: AT + 1000 });
    expect(await store.etag(43, 'https://api.github.com/repos/a/b')).toBeNull();
  });

  it('keeps a pause when an answer updates the budget, and pauses a resource it never saw', async () => {
    const db = fakeDb();
    const store = supabaseGithubStore(db);
    await store.saveBudget(42, 'core', { limit: 5000, remaining: 10, resetAt: AT + 3_600_000, at: AT });
    await store.pause(42, 'core', AT + 3_600_000, AT);
    await store.saveBudget(42, 'core', { limit: 5000, remaining: 0, resetAt: AT + 3_600_000, at: AT + 5 });
    expect(await store.budget(42, 'core')).toEqual({ limit: 5000, remaining: 0, resetAt: AT + 3_600_000, pausedUntil: AT + 3_600_000, updatedAt: AT + 5 });
    await store.pause(42, 'graphql', AT + 60_000, AT);
    expect(await store.budget(42, 'graphql')).toMatchObject({ pausedUntil: AT + 60_000, remaining: 0 });
    expect(await store.budget(7, 'core')).toBeNull();
  });

  it('throws when Supabase refuses, naming what it was doing', async () => {
    const store = supabaseGithubStore(fakeDb({ fail: 'permission denied' }));
    await expect(store.budget(42, 'core')).rejects.toThrow('Supabase refused to read the GitHub budget: permission denied');
    await expect(store.saveEtag(42, 'u', { etag: 'e', body: '', at: AT })).rejects.toThrow(/store an ETag/);
  });
});
