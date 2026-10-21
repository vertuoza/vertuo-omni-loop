import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../../../supabase/database.types.ts';

vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ unstable_cache: () => { throw new Error('the live cache is never reached in a test'); } }));

import { item } from '../ask/test/test-item';
import { loadGalaxy } from './load-galaxy';
import type { LogEntry } from 'omni-loop/kit/lib/log/log.ts';
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
        eqs: {} as Record<string, unknown>, nots: [] as [string, unknown][], gtes: [] as [string, string][], orders: [] as { column: string; ascending: boolean }[],
        counting: false, most: null as number | null, window: null as [number, number] | null, columns: [] as string[],
        select(columns: string, options: { count?: string } = {}) { q.columns = columns.split(',').map((c) => c.trim()); q.counting = Boolean(options.count); return q; },
        eq(column: string, value: unknown) { q.eqs[column] = value; return q; },
        not(column: string, _op: 'is', value: unknown) { q.nots.push([column, value]); return q; },
        gte(column: string, value: string) { q.gtes.push([column, value]); return q; },
        order(column: string, options: { ascending?: boolean } = {}) { q.orders.push({ column, ascending: options.ascending ?? true }); return q; },
        limit(n: number) { q.most = n; return q; },
        range(from: number, to: number) { q.window = [from, to]; return q; },
        then(done: (r: unknown) => unknown, failed?: (e: unknown) => unknown) {
          calls.push({ table, eq: { ...q.eqs }, count: q.counting, limit: q.most, range: q.window });
          const all = (member ? tables[table] ?? [] : [])
            .filter((row) => Object.entries(q.eqs).every(([c, v]) => row[c] === v))
            .filter((row) => q.nots.every(([c, v]) => (row[c] ?? null) !== v))
            .filter((row) => q.gtes.every(([c, v]) => String(row[c]) >= v))
            .sort((a, b) => {
              for (const { column, ascending } of q.orders) {
                const x = String(a[column]), y = String(b[column]);
                if (x !== y) return (x < y ? -1 : 1) * (ascending ? 1 : -1);
              }
              return 0;
            });
          const windowed = q.window ? all.slice(q.window[0], q.window[1] + 1) : all;
          const rows = (q.most === null ? windowed : windowed.slice(0, q.most))
            .map((row) => Object.fromEntries(q.columns.map((c) => [c, row[c]])));
          return Promise.resolve({ data: rows, error: null, ...(q.counting ? { count: all.length } : {}) }).then(done, failed);
        },
      };
      return q;
    },
  };
  return { db: client as unknown as SupabaseClient<Database>, calls, ledgerPages: () => calls.filter((c) => c.table === 'ledger_events' && c.range) };
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

/** How many seasons the cache holds: one per fold. */
const seasons = (store: Map<string, unknown>) => [...store.keys()].filter((k) => k.startsWith('["season",')).length;

function world(ledger: Row[] = [event('planet:12:charted', '2026-09-20T10:00:00Z')]) {
  const tables = {
    ledger_events: ledger,
    sectors: [{ workspace_id: WS, name: 'core-belt', repos: ['nimbus-core'] }],
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

  it('after a new event, reads only the events after the ledger it already read, not the whole ledger again (#1844)', async () => {
    const day = (i: number) => `2026-09-${String(1 + Math.floor(i / 100)).padStart(2, '0')}T${String(Math.floor((i % 100) / 6)).padStart(2, '0')}:${String((i % 6) * 10).padStart(2, '0')}:00Z`;
    const w = world(Array.from({ length: 2500 }, (_, i) => event(`planet:${String(i + 1)}:charted`, day(i), i + 1, { title: `Planet ${String(i + 1)}` })));
    const deps = { cache: w.memory.cache, service: w.service.db };
    await loadGalaxy(w.viewer.db, WS, NOW, deps);
    const before = w.service.ledgerPages().length;
    expect(before).toBe(3);
    w.tables.ledger_events.push(event('planet:3000:charted', '2026-09-26T09:00:00Z', 3000, { title: 'Timings' }));
    const after = await loadGalaxy(w.viewer.db, WS, NOW, deps);
    expect(w.service.ledgerPages().length - before).toBe(1);
    expect(after).toEqual(await loadGalaxy(w.viewer.db, WS, NOW, null));
    expect(after.planets.some((p) => p.prd === 3000)).toBe(true);
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

  it('reads the whole ledger again when an event was backfilled behind the read one as a new one came', async () => {
    const w = world();
    const deps = { cache: w.memory.cache, service: w.service.db };
    await loadGalaxy(w.viewer.db, WS, NOW, deps);
    w.tables.ledger_events.push(event('planet:9:charted', '2026-09-01T09:00:00Z', 9, { title: 'Backfilled' }));
    w.tables.ledger_events.push(event('planet:13:charted', '2026-09-26T09:00:00Z', 13, { title: 'Timings' }));
    const after = await loadGalaxy(w.viewer.db, WS, NOW, deps);
    // One page past the tail, which misses the backfill, then the whole ledger.
    expect(w.service.ledgerPages().map((c) => c.range)).toEqual([[0, 999], [0, 999], [0, 999]]);
    expect(after).toEqual(await loadGalaxy(w.viewer.db, WS, NOW, null));
    expect(after.planets.map((p) => p.prd).sort()).toEqual([12, 13, 9].sort());
  });

  it('reads the whole ledger again when an event came at the read tail\'s own instant', async () => {
    const w = world();
    const deps = { cache: w.memory.cache, service: w.service.db };
    await loadGalaxy(w.viewer.db, WS, NOW, deps);
    // Sorted by its id, it comes before the read tail: appended after it, the fold would see it out of order.
    w.tables.ledger_events.push(event('planet:10:charted', '2026-09-20T10:00:00Z', 10, { title: 'Same instant' }));
    w.tables.ledger_events.push(event('planet:13:charted', '2026-09-26T09:00:00Z', 13, { title: 'Timings' }));
    const after = await loadGalaxy(w.viewer.db, WS, NOW, deps);
    expect(w.service.ledgerPages()).toHaveLength(3);
    expect(after).toEqual(await loadGalaxy(w.viewer.db, WS, NOW, null));
  });

  it('folds only up to the viewer\'s newest event when the service reads a newer ledger', async () => {
    const w = world();
    const ahead = fakeDb({ ...w.tables, ledger_events: [...w.tables.ledger_events, event('planet:13:charted', '2026-09-26T09:00:00Z', 13, { title: 'Timings' })] });
    const view = await loadGalaxy(w.viewer.db, WS, NOW, { cache: w.memory.cache, service: ahead.db });
    expect(view).toEqual(await loadGalaxy(w.viewer.db, WS, NOW, null));
    expect(ahead.ledgerPages()).toHaveLength(1);
  });

  it('recomputes on a new UTC day', async () => {
    const w = world();
    const deps = { cache: w.memory.cache, service: w.service.db };
    await loadGalaxy(w.viewer.db, WS, new Date('2026-09-26T23:59:00Z'), deps);
    await loadGalaxy(w.viewer.db, WS, new Date('2026-09-27T00:01:00Z'), deps);
    expect(seasons(w.memory.store)).toBe(2);
    // The ledger did not change: the fold reads it from the cache (#1844).
    expect(w.service.ledgerPages()).toHaveLength(1);
  });

  it('recomputes when a fleet or a sector changes, though the ledger did not', async () => {
    const w = world();
    const deps = { cache: w.memory.cache, service: w.service.db };
    await loadGalaxy(w.viewer.db, WS, NOW, deps);
    item(w.tables.teams, 0).color = '#ff0000';
    const after = await loadGalaxy(w.viewer.db, WS, NOW, deps);
    expect(seasons(w.memory.store)).toBe(2);
    expect(w.service.ledgerPages()).toHaveLength(1);
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

  describe('its log line (ADR-0102: one per load)', () => {
    const STAGE = '\\d+ ms';
    it('says a miss, and what each stage of it took', async () => {
      const w = world();
      const lines: LogEntry[] = [];
      await loadGalaxy(w.viewer.db, WS, NOW, { cache: w.memory.cache, service: w.service.db, log: (entry) => { lines.push(entry); } });
      w.tables.ledger_events.push(event('planet:13:charted', '2026-09-26T09:00:00Z', 13, { title: 'Timings' }));
      await loadGalaxy(w.viewer.db, WS, NOW, { cache: w.memory.cache, service: w.service.db, log: (entry) => { lines.push(entry); } });
      expect(lines.map((l) => [l.event, l.outcome, typeof l.ms])).toEqual([['galaxy-season', 'ok', 'number'], ['galaxy-season', 'ok', 'number']]);
      expect(lines[0]?.message).toMatch(new RegExp(`^miss · viewer ${STAGE} · ledger cache miss: whole ledger, 1 row ${STAGE} · fold 1 event ${STAGE} · season ${STAGE}$`));
      expect(lines[1]?.message).toMatch(new RegExp(`^miss · viewer ${STAGE} · ledger cache ${STAGE} · after its tail, 1 new row ${STAGE} · fold 2 events ${STAGE} · season ${STAGE}$`));
    });

    it('says a hit, and says why the whole ledger was read again', async () => {
      const w = world();
      const lines: LogEntry[] = [];
      const deps = { cache: w.memory.cache, service: w.service.db, log: (entry: LogEntry) => { lines.push(entry); } };
      await loadGalaxy(w.viewer.db, WS, NOW, deps);
      await loadGalaxy(w.viewer.db, WS, NOW, deps);
      expect(lines[1]?.message).toMatch(new RegExp(`^hit · viewer ${STAGE} · season ${STAGE}$`));
      w.tables.ledger_events.push(event('planet:9:charted', '2026-09-01T09:00:00Z', 9, { title: 'Backfilled' }));
      await loadGalaxy(w.viewer.db, WS, NOW, deps);
      expect(lines[2]?.message).toContain('· whole ledger again (an event behind its tail), 2 rows ');
    });

    it('logs a load that fails as failed, and still throws', async () => {
      const w = world();
      const lines: LogEntry[] = [];
      const broken = { from: () => { throw new Error('down'); } } as unknown as typeof w.service.db;
      await expect(loadGalaxy(w.viewer.db, WS, NOW, { cache: w.memory.cache, service: broken, log: (entry) => { lines.push(entry); } })).rejects.toThrow('down');
      expect(lines).toMatchObject([{ event: 'galaxy-season', outcome: 'failed', error: new Error('down') }]);
    });
  });
});
