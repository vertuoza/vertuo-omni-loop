// The sync's way into public.releases, on a recording client: it reads every row a page at a time,
// adds rows in one insert, and refreshes a row's title and description by its PRD, nothing else. A
// refusal carries Supabase's reason. No test reaches Supabase.
import { describe, it, expect } from 'vitest';
import type { ReleaseRow } from './row';
import { releasesTable } from './sync-table';

type Refusal = { message: string; code?: string } | null;

/** A client over `rows` that records each call, and refuses what `refuse` names. */
function recording(rows: unknown[], refuse: { select?: Refusal; insert?: Refusal; update?: Refusal } = {}) {
  const calls: unknown[][] = [];
  const from = (table: string) => ({
    select: (columns: string) => ({
      order: (column: string) => ({
        range: (first: number, last: number) => {
          calls.push(['select', table, columns, column, first, last]);
          return Promise.resolve(refuse.select ? { data: null, error: refuse.select } : { data: rows.slice(first, last + 1), error: null });
        },
      }),
    }),
    insert: (values: unknown[]) => {
      calls.push(['insert', table, values]);
      return Promise.resolve({ error: refuse.insert ?? null });
    },
    update: (values: Record<string, unknown>) => ({
      eq: (column: string, value: unknown) => {
        calls.push(['update', table, values, column, value]);
        return Promise.resolve({ error: refuse.update ?? null });
      },
    }),
  });
  return { calls, db: { from } as never };
}

const row = (prd: number, release = 1): ReleaseRow => ({ prd, release, released_at: '2026-09-27T10:00:00+00:00', title: `Title ${prd}`, description: '' });

describe('releasesTable — the sync\'s reads and writes', () => {
  it('reads every row, a page of 1000 at a time, by PRD number', async () => {
    const rows = Array.from({ length: 1001 }, (_, i) => row(i + 1, i + 1));
    const { calls, db } = recording(rows);
    expect(await releasesTable(db).rows()).toHaveLength(1001);
    expect(calls).toEqual([
      ['select', 'releases', 'prd,release,released_at,title,description', 'prd', 0, 999],
      ['select', 'releases', 'prd,release,released_at,title,description', 'prd', 1000, 1999],
    ]);
  });

  it('refuses a row it cannot read', async () => {
    const { db } = recording([{ ...row(3), release: 0 }]);
    await expect(releasesTable(db).rows()).rejects.toThrow(/row 1 is not a release/);
  });

  it('adds new rows in one insert, and writes nothing for none', async () => {
    const { calls, db } = recording([]);
    await releasesTable(db).insert([]);
    await releasesTable(db).insert([row(3), row(7)]);
    expect(calls).toEqual([['insert', 'releases', [row(3), row(7)]]]);
  });

  it('refreshes only a row\'s title and description, by its PRD', async () => {
    const { calls, db } = recording([]);
    await releasesTable(db).refresh({ prd: 262, title: 'New title', description: 'New line.' });
    expect(calls).toEqual([['update', 'releases', { title: 'New title', description: 'New line.' }, 'prd', 262]]);
  });

  it('says what Supabase refused, and why', async () => {
    const refusal = { message: 'duplicate key value violates unique constraint "releases_release_idx"', code: '23505' };
    await expect(releasesTable(recording([], { insert: refusal }).db).insert([row(3)]))
      .rejects.toThrow('Supabase refused to add 1 release: duplicate key value violates unique constraint "releases_release_idx" (23505)');
    await expect(releasesTable(recording([], { update: { message: 'permission denied for table releases' } }).db).refresh({ prd: 3, title: 't', description: '' }))
      .rejects.toThrow('Supabase refused to refresh the text of PRD 3: permission denied for table releases');
    await expect(releasesTable(recording([], { select: { message: 'JWT expired' } }).db).rows())
      .rejects.toThrow('Supabase refused to read the releases: JWT expired');
  });
});
