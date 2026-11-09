import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import { parsePrd } from 'omni-loop/kit/lib/ids.ts';
import { readProductPrd } from './approval';

// #2671: the id a dossier with no repository number goes by on its product, read beside its approval.

const ID = '00000000-0000-4000-8000-0000000000e2';
type Reply = { data: unknown; error: { message: string } | null };

/** A database answering each table with its reply; records the tables read. */
function dbOf(replies: Record<string, Reply>) {
  const read: string[] = [];
  const db = {
    from(table: string) {
      read.push(table);
      const chain = { select: () => chain, eq: () => chain, maybeSingle: () => Promise.resolve(replies[table]) };
      return chain;
    },
  };
  return { db: db as unknown as Pick<SupabaseClient, 'from'>, read };
}

const ok = (data: unknown): Reply => ({ data, error: null });
const NO_NUMBER = { id: ID, prd: null };

describe('readProductPrd', () => {
  it('names a product PRD by its product key and its number', async () => {
    const { db } = dbOf({ dossiers: ok({ product_seq: 12, product_id: 'p1' }), products: ok({ key: 'mobile' }) });
    await expect(readProductPrd(db, NO_NUMBER)).resolves.toBe('mobile-12');
  });

  it('reads nothing for a dossier numbered in its repository', async () => {
    const { db, read } = dbOf({});
    await expect(readProductPrd(db, { id: ID, prd: parsePrd(7) })).resolves.toBeNull();
    expect(read).toEqual([]);
  });

  it('is null for a draft, which has no number on a product', async () => {
    const { db, read } = dbOf({ dossiers: ok({ product_seq: null, product_id: 'p1' }) });
    await expect(readProductPrd(db, NO_NUMBER)).resolves.toBeNull();
    expect(read).toEqual(['dossiers']);
  });

  it('is null for a draft of no product, and for a dossier it cannot find', async () => {
    await expect(readProductPrd(dbOf({ dossiers: ok({ product_seq: 3, product_id: null }) }).db, NO_NUMBER)).resolves.toBeNull();
    await expect(readProductPrd(dbOf({ dossiers: ok(null) }).db, NO_NUMBER)).resolves.toBeNull();
  });

  it('is null for a product it cannot find', async () => {
    const { db } = dbOf({ dossiers: ok({ product_seq: 12, product_id: 'p1' }), products: ok(null) });
    await expect(readProductPrd(db, NO_NUMBER)).resolves.toBeNull();
  });

  it('throws when the database fails', async () => {
    const failed: Reply = { data: null, error: { message: 'down' } };
    await expect(readProductPrd(dbOf({ dossiers: failed }).db, NO_NUMBER)).rejects.toThrow('down');
    await expect(readProductPrd(dbOf({ dossiers: ok({ product_seq: 12, product_id: 'p1' }), products: failed }).db, NO_NUMBER)).rejects.toThrow('down');
  });
});
