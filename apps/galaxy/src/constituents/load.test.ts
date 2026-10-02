import { describe, expect, it } from 'vitest';
import { loadConstituents, type ConstituentsDb } from './load';

// The constituents' read for Settings › Business (PRD 871 s1): both tables, for the given products, as
// the signed-in person (stubbed: no test calls Supabase); unreadable, it says so.

const ROW = {
  id: 'c-1', product_id: 'p-1', kind: 'never', seq: 2, body: 'Holds business logic', created_by: 'u-1',
  created_at: '2026-10-01T09:00:00Z', updated_at: '2026-10-01T09:00:00Z', removed_at: '2026-10-01T10:00:00Z', removed_by: 'u-1',
};
const EVENT = {
  id: '7', product_id: 'p-1', constituent_id: 'c-1', action: 'removed', before: 'Holds business logic', after: null,
  note: null, claim_id: null, changed_by: 'u-1', changed_at: '2026-10-01T10:00:00Z',
};

function db(tables: Record<string, { data?: unknown[]; error?: { message: string } }>) {
  const asked: Array<[string, string, string[]]> = [];
  const client: ConstituentsDb = {
    from: (table) => ({
      select: (columns) => ({
        in: (_column, values) => {
          asked.push([table, columns, values]);
          return Promise.resolve({ data: tables[table]?.data ?? null, error: tables[table]?.error ?? null });
        },
      }),
    }),
  };
  return { asked, client };
}

describe('loadConstituents', () => {
  it('reads every constituent of the products, removed ones included, and their history', async () => {
    const d = db({ constituents: { data: [ROW] }, constituent_events: { data: [EVENT] } });
    expect(await loadConstituents(d.client, ['p-1', 'p-2'])).toEqual({
      ok: true,
      constituents: [{ id: 'c-1', product: 'p-1', kind: 'never', displayId: 'never#2', text: 'Holds business logic', removed: true, updatedAt: '2026-10-01T09:00:00Z' }],
      events: [{ id: 7, product: 'p-1', constituent: 'c-1', action: 'removed', before: 'Holds business logic', after: null, note: null, by: 'u-1', at: '2026-10-01T10:00:00Z' }],
    });
    expect(d.asked.map(([table, , values]) => [table, values])).toEqual([['constituents', ['p-1', 'p-2']], ['constituent_events', ['p-1', 'p-2']]]);
  });

  it('asks nothing for no product', async () => {
    const d = db({});
    expect(await loadConstituents(d.client, [])).toEqual({ ok: true, constituents: [], events: [] });
    expect(d.asked).toEqual([]);
  });

  it('says so when either table cannot be read', async () => {
    const d = db({ constituents: { data: [ROW] }, constituent_events: { error: { message: 'permission denied' } } });
    expect(await loadConstituents(d.client, ['p-1'])).toEqual({ ok: false, reason: 'Supabase: could not read the constituents (permission denied)' });
    const thrown: ConstituentsDb = { from: () => { throw new Error('offline'); } };
    expect(await loadConstituents(thrown, ['p-1'])).toEqual({ ok: false, reason: 'Supabase: could not read the constituents (offline)' });
  });
});
