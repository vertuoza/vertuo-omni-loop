import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ unstable_cache: () => { throw new Error('the live cache is never reached in a test'); } }));

import { loadGalaxy } from './load-galaxy';
import { seasonKey, type SeasonCache } from './season-cache';

// PRD 657, s8: the season, cached per workspace. The viewer's own reads decide the key (the newest
// ledger event, how many events there are, the sectors and fleets, the UTC day); the cached read pages
// the ledger with the service client, and only on a miss.

const WS = '00000000-0000-4000-8000-00000000000a';
const OTHER = '00000000-0000-4000-8000-00000000000b';
const NOW = new Date('2026-09-26T10:00:00Z');

type Row = Record<string, unknown>;
type Call = { table: string; eq: Record<string, unknown>; count: boolean; limit: number | null; range: [number, number] | null };

const event = (id: string, at: string, planet = 12, data: Row = { title: 'Workspaces', captain: 'ada-gh' }) =>
  ({ workspace_id: WS, id, at, type: 'PLANET_CHARTED', planet, home: 'vertuoza/vertuo-omni-loop', region: null, contributor: null, team: null, data });

/** A PostgREST-shaped client over rows: `member` false stands for row-level security hiding them all. */
function fakeDb(tables: Record<string, Row[]>, member = true) {
  const calls: Call[] = [];
  const client = {
    from(table: string) {
      const q = {
        eqs: {} as Record<string, unknown>, nots: [] as [string, unknown][], orders: [] as { column: string; ascending: boolean }[],
        counting: false, most: null as number | null, window: null as [number, number] | null,
        select(_columns: string, options: { count?: string } = {}) { q.counting = Boolean(options.count); return q; },
        eq(column: string, value: unknown) { q.eqs[column] = value; return q; },
        not(column: string, _op: 'is', value: unknown) { q.nots.push([column, value]); return q; },
        order(column: string, options: { ascending?: boolean } = {}) { q.orders.push({ column, ascending: options.ascending ?? true }); return q; },
        limit(n: number) { q.most = n; return q; },
        range(from: number, to: number) { q.window = [from, to]; return q; },
        then(done: (r: unknown) => unknown, failed?: (e: unknown) => unknown) {
          calls.push({ table, eq: { ...q.eqs }, count: q.counting, limit: q.most, range: q.window });
          const all = (member ? tables[table] ?? [] : [])
            .filter((row) => Object.entries(q.eqs).every(([c, v]) => row[c] === v))
            .filter((row) => q.nots.every(([c, v]) => (row[c] ?? null) !== v))
            .sort((a, b) => {
              for (const { column, ascending } of q.orders) {
                const x = String(a[column]), y = String(b[column]);
                if (x !== y) return (x < y ? -1 : 1) * (ascending ? 1 : -1);
              }
              return 0;
            });
          const windowed = q.window ? all.slice(q.window[0], q.window[1] + 1) : all;
          const rows = q.most === null ? windowed : windowed.slice(0, q.most);
          return Promise.resolve({ data: rows, error: null, ...(q.counting ? { count: all.length } : {}) }).then(done, failed);
        },
      };
      return q;
    },
  };
  return { db: client as unknown as SupabaseClient, calls, ledgerPages: () => calls.filter((c) => c.table === 'ledger_events' && c.range) };
}

/** A data cache in memory, as Next's is: one value per key, computed on the first read. */
function memoryCache() {
  const store = new Map<string, unknown>();
  const keys: string[][] = [];
  const cache: SeasonCache = async (key, compute) => {
    keys.push(key);
    const k = JSON.stringify(key);
    if (!store.has(k)) store.set(k, await compute());
    return store.get(k) as Awaited<ReturnType<typeof compute>>;
  };
  return { cache, keys, store };
}

function world(ledger: Row[] = [event('planet:12:charted', '2026-09-20T10:00:00Z')]) {
  const tables = {
    ledger_events: ledger,
    sectors: [{ workspace_id: WS, name: 'core-belt', repos: ['vertuo-core'] }],
    teams: [{ workspace_id: WS, name: 'beaver', home: null, label: 'BEAVER', color: '#2fc6a4', motto: '', mascot: null, sort: 10, retired_at: null }],
  };
  return { tables, viewer: fakeDb(tables), service: fakeDb(tables), memory: memoryCache() };
}

describe('the season cache', () => {
  it('computes the season once, then an unchanged ledger reads it from the cache without paging the ledger', async () => {
    const w = world();
    const deps = { cache: w.memory.cache, service: w.service.db };
    const first = await loadGalaxy(w.viewer.db, WS, NOW, deps);
    expect(w.service.ledgerPages()).toHaveLength(1);
    const second = await loadGalaxy(w.viewer.db, WS, new Date('2026-09-26T18:00:00Z'), deps);
    expect(second).toEqual(first);
    expect(w.service.ledgerPages()).toHaveLength(1);
    // The viewer never pages the ledger: one newest-event read (with its count) per load.
    expect(w.viewer.ledgerPages()).toEqual([]);
    expect(w.viewer.calls.filter((c) => c.table === 'ledger_events')).toEqual([
      { table: 'ledger_events', eq: { workspace_id: WS }, count: true, limit: 1, range: null },
      { table: 'ledger_events', eq: { workspace_id: WS }, count: true, limit: 1, range: null },
    ]);
    expect(first.planets.map((p) => [p.prd, p.title])).toEqual([[12, 'Workspaces']]);
    expect(first.source).toBe('supabase');
  });

  it('gives the same season as an uncached read', async () => {
    const w = world();
    const cached = await loadGalaxy(w.viewer.db, WS, NOW, { cache: w.memory.cache, service: w.service.db });
    const plain = await loadGalaxy(w.viewer.db, WS, NOW, null);
    expect(cached).toEqual(plain);
  });

  it('recomputes on a new newest event', async () => {
    const w = world();
    const deps = { cache: w.memory.cache, service: w.service.db };
    await loadGalaxy(w.viewer.db, WS, NOW, deps);
    w.tables.ledger_events.push(event('planet:13:charted', '2026-09-26T09:00:00Z', 13, { title: 'Timings' }));
    const after = await loadGalaxy(w.viewer.db, WS, NOW, deps);
    expect(w.service.ledgerPages()).toHaveLength(2);
    expect(after.planets.map((p) => p.prd).sort()).toEqual([12, 13]);
  });

  it('recomputes on an event added behind the newest one (the count changes)', async () => {
    const w = world();
    const deps = { cache: w.memory.cache, service: w.service.db };
    await loadGalaxy(w.viewer.db, WS, NOW, deps);
    w.tables.ledger_events.push(event('planet:9:charted', '2026-09-01T09:00:00Z', 9, { title: 'Backfilled' }));
    const after = await loadGalaxy(w.viewer.db, WS, NOW, deps);
    expect(w.service.ledgerPages()).toHaveLength(2);
    expect(after.planets.map((p) => p.prd).sort()).toEqual([12, 9].sort());
  });

  it('recomputes on a new UTC day', async () => {
    const w = world();
    const deps = { cache: w.memory.cache, service: w.service.db };
    await loadGalaxy(w.viewer.db, WS, new Date('2026-09-26T23:59:00Z'), deps);
    await loadGalaxy(w.viewer.db, WS, new Date('2026-09-27T00:01:00Z'), deps);
    expect(w.service.ledgerPages()).toHaveLength(2);
  });

  it('recomputes when a fleet or a sector changes, though the ledger did not', async () => {
    const w = world();
    const deps = { cache: w.memory.cache, service: w.service.db };
    await loadGalaxy(w.viewer.db, WS, NOW, deps);
    w.tables.teams[0]!.color = '#ff0000';
    const after = await loadGalaxy(w.viewer.db, WS, NOW, deps);
    expect(w.service.ledgerPages()).toHaveLength(2);
    expect(after.teams.find((t) => t.name === 'beaver')?.color).toBe('#ff0000');
  });

  it('keys each workspace apart', () => {
    const newest = { id: 'e1', at: '2026-09-20T10:00:00Z', count: 1 };
    const projects = { sectors: {}, teams: {} };
    expect(seasonKey(WS, newest, projects, NOW)).not.toEqual(seasonKey(OTHER, newest, projects, NOW));
    expect(seasonKey(WS, newest, projects, NOW)).toContain(WS);
  });

  it('a viewer who is not a member gets the empty season, and neither the cache nor the service client is used', async () => {
    const w = world();
    const outsider = fakeDb(w.tables, false);
    const view = await loadGalaxy(outsider.db, WS, NOW, { cache: w.memory.cache, service: w.service.db });
    expect(view.planets).toEqual([]);
    expect(w.memory.keys).toEqual([]);
    expect(w.service.calls).toEqual([]);
  });

  it('a member of an empty ledger gets the empty season without the service client', async () => {
    const w = world([]);
    const view = await loadGalaxy(w.viewer.db, WS, NOW, { cache: w.memory.cache, service: w.service.db });
    expect(view.planets).toEqual([]);
    expect(view.sectors.map((s) => s.name)).toEqual(['core-belt']);
    expect(w.service.calls).toEqual([]);
  });

  it('with no service key, reads the whole ledger as the viewer, as before the cache', async () => {
    const w = world();
    const view = await loadGalaxy(w.viewer.db, WS, NOW, null);
    expect(w.viewer.ledgerPages()).toHaveLength(1);
    expect(view.planets.map((p) => p.prd)).toEqual([12]);
  });
});
