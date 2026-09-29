import { describe, expect, it, vi } from 'vitest';
import { workspacesOwning } from './workspaces';

function fakeDb(rows: { id: string }[] | null, error: { message: string } | null = null) {
  const calls: unknown[][] = [];
  const query = {
    select: (...args: unknown[]) => (calls.push(['select', ...args]), query),
    ilike: (...args: unknown[]) => (calls.push(['ilike', ...args]), Promise.resolve({ data: rows, error })),
  };
  return { db: { from: vi.fn((table: string) => (calls.push(['from', table]), query)) }, calls };
}

describe('workspacesOwning', () => {
  it('finds the workspaces whose GitHub org is the repository’s owner, in any case', async () => {
    const { db, calls } = fakeDb([{ id: 'ws-1' }]);
    expect(await workspacesOwning(db as never, 'Acme/widgets')).toEqual(['ws-1']);
    expect(calls).toEqual([['from', 'workspaces'], ['select', 'id'], ['ilike', 'github_org', 'acme']]);
  });

  it('asks nothing for an owner that is not a GitHub login', async () => {
    const { db } = fakeDb([{ id: 'ws-1' }]);
    expect(await workspacesOwning(db as never, 'ac%me/widgets')).toEqual([]);
    expect(await workspacesOwning(db as never, 'a_b/widgets')).toEqual([]);
    expect(db.from).not.toHaveBeenCalled();
  });

  it('throws with Supabase’s reason when the read is refused', async () => {
    const { db } = fakeDb(null, { message: 'no' });
    await expect(workspacesOwning(db as never, 'acme/w')).rejects.toThrow('no');
  });
});
