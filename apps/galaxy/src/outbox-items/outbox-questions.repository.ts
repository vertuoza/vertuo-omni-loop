import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { orThrow, parseRows } from '../data/parse-rows';
import { playersOf, productItemsOf, StoredItem, StoredPlayer, StoredProduct } from '../product-home/product-home.repository';

// The workspace's open outbox items, read for Work › Questions › Outbox (PRD 2011 s14; ADR-0095): as the
// signed-in person, so row-level security has the last word (a member reads the items of their workspaces'
// product PRDs, and no one else's). The items with whether each is settled (outbox_items,
// outbox_settlements), their PRDs (dossiers), the products (products) and the GitHub logins of the PRDs'
// authors (players), the items, products and players as the product home reads them. A failed read throws,
// and an answer out of shape too. No rule lives here: which items are open, whom they wait on and in what order is outbox-questions.ts's.

/** What the reads need: the tables. */
export type OutboxQuestionsDb = Pick<SupabaseClient, 'from'>;

const DOSSIER_COLUMNS = 'id, title, workspace_id, product_id, product_seq, opened_by';
/** The PRD an item belongs to: its title, its product and its number in the product. */
export const StoredItemPrd = z.object({
  id: z.string(),
  title: z.string(),
  workspace_id: z.string(),
  product_id: z.string().nullable(),
  product_seq: z.number().int().positive().nullable(),
  opened_by: z.string().nullable(),
});
export type StoredItemPrd = z.infer<typeof StoredItemPrd>;

const PRODUCT_COLUMNS = 'id, name, key';
/** A product: its id, its name and its key (`mobile`). */
export type QuestionProduct = z.infer<typeof StoredProduct>;

const WHERE = 'outbox-items/outbox-questions.repository';
const why = (error: { message: string }) => error.message;

/** Every PRD that carries a product number, or the PRDs `ids` among them. */
export const prdsOf = (db: OutboxQuestionsDb, ids?: readonly string[]) => {
  const read = db.from('dossiers').select(DOSSIER_COLUMNS).not('product_seq', 'is', null);
  return ids === undefined ? read : read.in('id', [...ids]);
};

/** Every product the caller reads, first first. */
export const productsOf = (db: OutboxQuestionsDb) => db.from('products').select(PRODUCT_COLUMNS).order('ordinal');

export function outboxQuestionsRepository(db: OutboxQuestionsDb) {
  return {
    /** Every outbox item of the caller's workspaces, oldest first. */
    async items(): Promise<StoredItem[]> {
      const { data, error } = await productItemsOf(db);
      if (error) throw new Error(`Supabase: could not read the outbox items (${why(error)})`);
      return orThrow(parseRows(StoredItem, data, `${WHERE}: outbox_items`));
    },

    /** The PRDs `ids`. */
    async prds(ids: readonly string[]): Promise<StoredItemPrd[]> {
      if (ids.length === 0) return [];
      const { data, error } = await prdsOf(db, ids);
      if (error) throw new Error(`Supabase: could not read the items' PRDs (${why(error)})`);
      return orThrow(parseRows(StoredItemPrd, data, `${WHERE}: dossiers`));
    },

    /** The products. */
    async products(): Promise<QuestionProduct[]> {
      const { data, error } = await productsOf(db);
      if (error) throw new Error(`Supabase: could not read the products (${why(error)})`);
      return orThrow(parseRows(StoredProduct, data, `${WHERE}: products`));
    },

    /** The players: their GitHub logins. */
    async authors(): Promise<StoredPlayer[]> {
      const { data, error } = await playersOf(db);
      if (error) throw new Error(`Supabase: could not read the PRDs' authors (${why(error)})`);
      return orThrow(parseRows(StoredPlayer, data, `${WHERE}: players`));
    },
  };
}
