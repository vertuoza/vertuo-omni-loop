// A PRD's watch on main, read (PRD 2410, s3): the store's Supabase calls on a recording client, and the
// rows' schemas. No test reaches Supabase: that members read and nobody else does is proved by
// supabase/checks/main_watch.sql.
import { describe, expect, it } from 'vitest';
import { brokenRows } from '../data/broken-rows.fake';
import { mainWatchStore, StoredBreak, StoredWatch } from './store.repository';
import { parsePrd } from 'omni-loop/kit/lib/ids.ts';

const W = 'w-acme';
const key = { workspace_id: W, repository: 'Acme/Widgets', prd: parsePrd(7) };
const watch = { lane: 'acme/widgets', merge_sha: 'a'.repeat(40), merged_at: '2026-10-01T09:00:00Z', watch_until: '2026-10-08T09:00:00Z', status: 'watching', unread: [] };
const brk = { lane: 'acme/widgets', kind: 'ci-red', source: 'run-1', url: 'https://github.com/acme/widgets/actions/runs/1', title: 'build', parent: 'green', at: '2026-10-02T09:00:00Z' };

type Call = unknown[];

/** A client that records each select and answers the rows of its table, or refuses one table. */
function recording(rows: Record<string, unknown[]>, refuse: Record<string, { message: string; code?: string }> = {}) {
  const calls: Call[] = [];
  const from = (table: string) => ({
    select: (columns: string) => {
      const filters: Call = [];
      const chain = {
        eq: (column: string, value: unknown) => { filters.push([column, value]); return chain; },
        order: (column: string) => { filters.push(['order', column]); return chain; },
        then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => {
          calls.push(['select', table, columns, ...filters]);
          const error = refuse[table];
          return Promise.resolve(error ? { data: null, error } : { data: rows[table] ?? [], error: null }).then(resolve, reject);
        },
      };
      return chain;
    },
  });
  return { calls, db: { from } as never };
}

describe('the store, on Supabase', () => {
  it('reads a PRD\'s watches and breaks as the member, the repository in lower case, the breaks oldest first', async () => {
    const { calls, db } = recording({ prd_main_watch: [watch], prd_main_breaks: [brk] });
    expect(await mainWatchStore(db).mainWatchOf(key)).toEqual({ watches: [watch], breaks: [brk] });
    expect(calls).toEqual([
      ['select', 'prd_main_watch', 'lane, merge_sha, merged_at, watch_until, status, unread', ['workspace_id', W], ['repository', 'acme/widgets'], ['prd', 7]],
      ['select', 'prd_main_breaks', 'lane, kind, source, url, title, parent, at', ['workspace_id', W], ['repository', 'acme/widgets'], ['prd', 7], ['order', 'at']],
    ]);
  });

  it('answers nothing for a PRD nobody watched, and orders the lanes', async () => {
    expect(await mainWatchStore(recording({}).db).mainWatchOf(key)).toEqual({ watches: [], breaks: [] });
    const lanes = recording({ prd_main_watch: [{ ...watch, lane: 'b/two' }, { ...watch, lane: 'a/one' }] });
    expect((await mainWatchStore(lanes.db).mainWatchOf(key)).watches.map((w) => w.lane)).toEqual(['a/one', 'b/two']);
  });

  it('leaves out a status or a kind this build does not know, and a parent it does not know reads none', async () => {
    const { db } = recording({
      prd_main_watch: [watch, { ...watch, lane: 'x/y', status: 'paused' }],
      prd_main_breaks: [{ ...brk, kind: 'deploy' }, { ...brk, parent: 'maybe' }],
    });
    const read = await mainWatchStore(db).mainWatchOf(key);
    expect(read.watches).toHaveLength(1);
    expect(read.breaks).toEqual([{ ...brk, parent: null }]);
  });

  it('says what Supabase refused, and why', async () => {
    const watches = recording({}, { prd_main_watch: { message: 'permission denied', code: '42501' } });
    await expect(mainWatchStore(watches.db).mainWatchOf(key)).rejects.toThrow('Supabase refused to read the main watch of PRD 7: permission denied (42501)');
    const breaks = recording({}, { prd_main_breaks: { message: 'down' } });
    await expect(mainWatchStore(breaks.db).mainWatchOf(key)).rejects.toThrow('Supabase refused to read the breaks of PRD 7: down');
  });

  it('throws on a row that does not parse', async () => {
    const { db } = recording({ prd_main_watch: [{ ...watch, unread: 'none' }] });
    await expect(mainWatchStore(db).mainWatchOf(key)).rejects.toThrow('does not parse');
  });
});

describe('the rows\' schemas', () => {
  it('parses a watch and refuses a column missing, of the wrong type or null', () => {
    expect(StoredWatch.parse(watch)).toEqual(watch);
    for (const [how, broken] of brokenRows(watch, { missing: 'merged_at', wrongType: ['unread', 'none'], notNull: 'lane' })) {
      expect(StoredWatch.safeParse(broken).success, how).toBe(false);
    }
  });

  it('parses a break, its parent null for a revert, and refuses a column missing, of the wrong type or null', () => {
    expect(StoredBreak.parse(brk)).toEqual(brk);
    expect(StoredBreak.parse({ ...brk, parent: null }).parent).toBeNull();
    for (const [how, broken] of brokenRows(brk, { missing: 'url', wrongType: ['at', 5], notNull: 'title' })) {
      expect(StoredBreak.safeParse(broken).success, how).toBe(false);
    }
  });
});
