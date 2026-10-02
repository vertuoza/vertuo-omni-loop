import { describe, expect, it } from 'vitest';
import type { StoredClaim } from './model';
import { SuggestStoreError } from './suggest-api';
import { suggestStore } from './suggest-store';

// The rival suggestions' store over a fake Supabase client (PRD 748 s3): the claims of a workspace
// are read from `claims`, a suggestion is stored through claim_pick() with source `suggestion`, and
// each failure of the database is a SuggestStoreError carrying its code.

type Answer = { data: unknown; error: { code?: string; message: string } | null };

const RIVAL: StoredClaim = { id: 'c-9', seq: 9, kind: 'rival', value: 'Alpha', source: 'suggestion', state: 'proposed', product_id: 'p-1' };

function fakeDb({ read = { data: [RIVAL], error: null }, pick = { data: RIVAL, error: null } }: { read?: Answer; pick?: Answer } = {}) {
  const calls: unknown[] = [];
  const db = {
    from: (table: string) => ({
      select: (columns: string) => ({
        eq: (column: string, value: string) => {
          calls.push(['from', table, columns, column, value]);
          return Promise.resolve(read);
        },
      }),
    }),
    rpc: (fn: string, args: unknown) => {
      calls.push(['rpc', fn, args]);
      return Promise.resolve(pick);
    },
  };
  return { store: suggestStore(db as unknown as Parameters<typeof suggestStore>[0]), calls };
}

const failure = async (work: Promise<unknown>) => {
  const error = await work.catch((e: unknown) => e);
  expect(error).toBeInstanceOf(SuggestStoreError);
  return error as SuggestStoreError & { code: string | undefined };
};

describe('the rival suggestions store', () => {
  it('reads the claims of the workspace', async () => {
    const { store, calls } = fakeDb();
    expect(await store.claims('ws-1', 'p-1')).toEqual([RIVAL]);
    expect(calls).toEqual([['from', 'claims', 'id, seq, kind, value, source, state, product_id', 'workspace_id', 'ws-1']]);
  });

  it('reads no claim when the database answers none', async () => {
    expect(await fakeDb({ read: { data: null, error: null } }).store.claims('ws-1', 'p-1')).toEqual([]);
  });

  it('fails with the database code when the claims cannot be read', async () => {
    const error = await failure(fakeDb({ read: { data: null, error: { code: '42501', message: 'denied' } } }).store.claims('ws-1', 'p-1'));
    expect(error.code).toBe('42501');
    expect(error.message).toBe('Could not read the claims: denied');
  });

  it('stores a name as a suggested rival through claim_pick()', async () => {
    const { store, calls } = fakeDb();
    expect(await store.propose('ws-1', 'p-1', 'Alpha')).toEqual(RIVAL);
    expect(calls).toEqual([['rpc', 'claim_pick', { p_workspace: 'ws-1', p_product: 'p-1', p_kind: 'rival', p_value: 'Alpha', p_source: 'suggestion' }]]);
  });

  it('fails with the database code when claim_pick() refuses', async () => {
    const error = await failure(fakeDb({ pick: { data: null, error: { code: '22023', message: 'bad name' } } }).store.propose('ws-1', 'p-1', '!'));
    expect(error.code).toBe('22023');
    expect(error.message).toBe('Could not store a suggestion: bad name');
  });

  it('fails without a code when claim_pick() answers no row', async () => {
    const error = await failure(fakeDb({ pick: { data: null, error: null } }).store.propose('ws-1', 'p-1', 'Alpha'));
    expect(error.code).toBeUndefined();
    expect(error.message).toBe('Could not store a suggestion: no row');
  });
});
