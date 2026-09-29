import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { memberWorkspace } from './workspace';

// The member workspace is read once per client (PRD 657): the viewer, the layout and a page's own
// loader share one request's client, so they share one read. A failed read is not kept.

function fakeDb(fail = false) {
  let reads = 0;
  const db = {
    from: () => ({
      select: () => ({
        eq: async () => {
          reads += 1;
          if (fail && reads === 1) return { data: null, error: { message: 'down' } };
          return { data: [{ joined_at: '2026-09-01T00:00:00Z', workspace: { id: 'w-1', slug: 'acme', name: 'Acme', theme: {} } }], error: null };
        },
      }),
    }),
  };
  return { db: db as unknown as SupabaseClient, reads: () => reads };
}

describe('memberWorkspace', () => {
  it('reads once per client and person, however many ask', async () => {
    const { db, reads } = fakeDb();
    const [a, b] = await Promise.all([memberWorkspace(db, 'u-ada'), memberWorkspace(db, 'u-ada')]);
    expect(await memberWorkspace(db, 'u-ada')).toBe(a);
    expect(b).toBe(a);
    expect(a).toMatchObject({ id: 'w-1', name: 'Acme' });
    expect(reads()).toBe(1);
  });

  it('reads again for another client, or another person', async () => {
    const one = fakeDb();
    const two = fakeDb();
    await memberWorkspace(one.db, 'u-ada');
    await memberWorkspace(two.db, 'u-ada');
    await memberWorkspace(one.db, 'u-bob');
    expect(one.reads() + two.reads()).toBe(3);
  });

  it('keeps no failed read: the next ask reads again', async () => {
    const { db, reads } = fakeDb(true);
    await expect(memberWorkspace(db, 'u-ada')).rejects.toThrow(/could not read your workspaces/);
    expect(await memberWorkspace(db, 'u-ada')).toMatchObject({ id: 'w-1' });
    expect(reads()).toBe(2);
  });
});
