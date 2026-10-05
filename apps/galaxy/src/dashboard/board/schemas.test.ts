import { describe, expect, it } from 'vitest';
import { brokenRows } from '../../data/broken-rows.fake';
import { fakeGalaxyDb, PEOPLE, twoWorkspaces, VERTUOZA } from '../../data/galaxy.fake';
import { ACTIVITY_COLUMNS, OPENER_COLUMNS, StoredActivity, StoredOpener, supabaseReads } from './load';

// The board's contribution schemas (PRD 1030): each parses the rows the galaxy fake's contributions
// give through its select, and refuses a copy with a column missing, of the wrong type, or null.

async function contributions(columns: string): Promise<unknown> {
  const { data } = await fakeGalaxyDb(twoWorkspaces()).client(PEOPLE.ada).from('contributions').select(columns).eq('workspace_id', VERTUOZA);
  return data;
}

describe('the board\'s contribution schemas', () => {
  it('parse every contribution as ACTIVITY_COLUMNS reads it, and refuse a broken one', async () => {
    const rows = StoredActivity.array().parse(await contributions(ACTIVITY_COLUMNS));
    expect(rows).toContainEqual({ kind: 'pr-merged', repo: 'vertuo-core', number: 101, login: 'ada-gh', at: '2026-09-22T09:30:00Z' });
    const [row] = rows;
    if (!row) throw new Error('the fixture holds a contribution');
    for (const [how, broken] of brokenRows(row, { missing: 'kind', wrongType: ['number', '101'], notNull: 'login' })) {
      expect(StoredActivity.safeParse(broken).success, how).toBe(false);
    }
  });

  it('parse who opened a PRD as OPENER_COLUMNS reads it, and refuse a broken one', async () => {
    const rows = StoredOpener.array().parse(await contributions(OPENER_COLUMNS));
    const [row] = rows;
    if (!row) throw new Error('the fixture holds a contribution');
    expect(row).toEqual({ repo: 'vertuo-core', number: 101, login: 'ada-gh' });
    for (const [how, broken] of brokenRows(row, { missing: 'repo', wrongType: ['login', 7], notNull: 'number' })) {
      expect(StoredOpener.safeParse(broken).success, how).toBe(false);
    }
  });

  it('fail the period\'s read when a page does not parse, as when it is refused', async () => {
    const page = { range: () => Promise.resolve({ data: [{ kind: 'pr-merged', repo: 'r', number: '1', login: 'a', at: 'x' }], error: null }) };
    const query: Record<string, unknown> = { ...page };
    for (const m of ['select', 'eq', 'gte', 'lt', 'order']) query[m] = () => query;
    const reads = supabaseReads({ from: () => query, rpc: () => Promise.resolve({ data: [], error: null }) } as never, VERTUOZA, () => Promise.reject(new Error('unused')));
    await expect(reads.activity(new Date('2026-09-01T00:00:00Z'), new Date('2026-10-01T00:00:00Z'))).rejects.toThrow('dashboard/board: contributions');
  });
});
