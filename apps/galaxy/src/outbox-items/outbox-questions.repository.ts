import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { orThrow, parseRows } from '../data/parse-rows';

// The workspace's open outbox items, read for Work › Questions › Outbox (PRD 2011 s14; ADR-0095): as the
// signed-in person, so row-level security has the last word (a member reads the items of their workspaces'
// product PRDs, and no one else's). The items with whether each is settled (outbox_items,
// outbox_settlements), their PRDs (dossiers), the products (products) and the GitHub logins of the PRDs'
// authors (players). A failed read throws, and an answer out of shape too. No rule lives here: which items are open, whom they wait on and in what order is outbox-questions.ts's.

/** What the reads need: the tables. */
export type OutboxQuestionsDb = Pick<SupabaseClient, 'from'>;

const ITEM_COLUMNS = 'dossier_id, item, rank, repository, body, outbox_settlements(id)';
/** An outbox item, with its settlements (none while it is open). */
export const StoredOpenItem = z.object({
  dossier_id: z.string(),
  item: z.string(),
  rank: z.enum(['medium', 'high', 'human-action']),
  repository: z.string().nullable(),
  body: z.string(),
  outbox_settlements: z.array(z.object({ id: z.string() })),
});
export type StoredOpenItem = z.infer<typeof StoredOpenItem>;

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
export const StoredQuestionProduct = z.object({ id: z.string(), name: z.string(), key: z.string().nullable() });
export type StoredQuestionProduct = z.infer<typeof StoredQuestionProduct>;

const AUTHOR_COLUMNS = 'user_id, github_login';
/** A PRD's author, by their GitHub login. */
export const StoredAuthor = z.object({ user_id: z.string(), github_login: z.string().nullable() });
export type StoredAuthor = z.infer<typeof StoredAuthor>;

const WHERE = 'outbox-items/outbox-questions.repository';
const why = (error: { message: string }) => error.message;

/** Every outbox item the caller reads, oldest first, each with its settlements. */
export const allItemsOf = (db: OutboxQuestionsDb) => db.from('outbox_items').select(ITEM_COLUMNS).order('raised_at').order('item');

/** The players the caller reads. */
export const authorsOf = (db: OutboxQuestionsDb) => db.from('players').select(AUTHOR_COLUMNS);

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
    async items(): Promise<StoredOpenItem[]> {
      const { data, error } = await allItemsOf(db);
      if (error) throw new Error(`Supabase: could not read the outbox items (${why(error)})`);
      return orThrow(parseRows(StoredOpenItem, data, `${WHERE}: outbox_items`));
    },

    /** The PRDs `ids`. */
    async prds(ids: readonly string[]): Promise<StoredItemPrd[]> {
      if (ids.length === 0) return [];
      const { data, error } = await prdsOf(db, ids);
      if (error) throw new Error(`Supabase: could not read the items' PRDs (${why(error)})`);
      return orThrow(parseRows(StoredItemPrd, data, `${WHERE}: dossiers`));
    },

    /** The products. */
    async products(): Promise<StoredQuestionProduct[]> {
      const { data, error } = await productsOf(db);
      if (error) throw new Error(`Supabase: could not read the products (${why(error)})`);
      return orThrow(parseRows(StoredQuestionProduct, data, `${WHERE}: products`));
    },

    /** The players: their GitHub logins. */
    async authors(): Promise<StoredAuthor[]> {
      const { data, error } = await authorsOf(db);
      if (error) throw new Error(`Supabase: could not read the PRDs' authors (${why(error)})`);
      return orThrow(parseRows(StoredAuthor, data, `${WHERE}: players`));
    },
  };
}
