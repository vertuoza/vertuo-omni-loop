import { describe, expect, it } from 'vitest';
import { fleetsRepository, type FleetsDb } from './fleets.repository';

// The fleets an owner may pick (PRD 1830 s3), on a fake client: the workspace's teams not retired, in
// their order, parsed; a refusal throws, naming the table.

type Call = [string, ...unknown[]];

function fakeDb(answer: { data: unknown; error: { message: string } | null }) {
  const calls: Call[] = [];
  const chain = {
    select: (...args: unknown[]) => { calls.push(['select', ...args]); return chain; },
    eq: (...args: unknown[]) => { calls.push(['eq', ...args]); return chain; },
    is: (...args: unknown[]) => { calls.push(['is', ...args]); return chain; },
    order: (...args: unknown[]) => { calls.push(['order', ...args]); return Promise.resolve(answer); },
  };
  const db = { from: (table: string) => { calls.push(['from', table]); return chain; } } as unknown as FleetsDb;
  return { db, calls };
}

describe('fleetsRepository', () => {
  it('reads the workspace\'s teams that are not retired, in their order', async () => {
    const { db, calls } = fakeDb({ data: [{ name: 'comets', label: 'Comets' }], error: null });
    expect(await fleetsRepository(db).fleets('w1')).toEqual([{ name: 'comets', label: 'Comets' }]);
    expect(calls).toEqual([['from', 'teams'], ['select', 'name, label'], ['eq', 'workspace_id', 'w1'], ['is', 'retired_at', null], ['order', 'sort']]);
  });

  it('throws on a refusal, naming the table', async () => {
    const { db } = fakeDb({ data: null, error: { message: 'denied' } });
    await expect(fleetsRepository(db).fleets('w1')).rejects.toThrow('teams: denied');
  });

  it('throws on rows out of shape', async () => {
    const { db } = fakeDb({ data: [{ name: 'comets' }], error: null });
    await expect(fleetsRepository(db).fleets('w1')).rejects.toThrow();
  });
});
