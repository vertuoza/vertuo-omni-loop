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

const REPO_PRD_COLUMNS = 'id, title, workspace_id, home_repo, prd, opened_by';
/** A repository PRD (no product number): its dossier, where it lives and who opened it. */
export const StoredRepoPrd = z.object({
  id: z.string(),
  title: z.string(),
  workspace_id: z.string(),
  home_repo: z.string(),
  prd: z.number().int().positive(),
  opened_by: z.string().nullable(),
});
export type StoredRepoPrd = z.infer<typeof StoredRepoPrd>;

const WAITING_COLUMNS = 'workspace_id, repository, prd, waiting, synced_at';
/** What a repository PRD's stored outbox holds waiting on a person (prd_outbox, PRD 657), and when it was read. */
export const StoredRepoWaiting = z.object({
  workspace_id: z.string(),
  repository: z.string(),
  prd: z.number().int().positive(),
  waiting: z.array(z.object({ id: z.string(), rank: z.enum(['human-action', 'high']), question: z.string() })),
  synced_at: z.string(),
});
export type StoredRepoWaiting = z.infer<typeof StoredRepoWaiting>;

const LINK_COLUMNS = 'product_id, workspace_id, repository';
/** A repository's link to a product (product_repositories); a repository may hold several. */
export const StoredRepoLink = z.object({ product_id: z.string(), workspace_id: z.string(), repository: z.string() });
export type StoredRepoLink = z.infer<typeof StoredRepoLink>;

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

/** Every repository PRD the caller reads: a numbered PRD of kind `prd` with no product number. */
export const repoPrdsOf = (db: OutboxQuestionsDb) =>
  db.from('dossiers').select(REPO_PRD_COLUMNS).eq('kind', 'prd').not('prd', 'is', null).is('product_seq', null);

/** The stored outboxes of the caller's workspaces that hold something waiting on a person. */
export const repoWaitingOf = (db: OutboxQuestionsDb) => db.from('prd_outbox').select(WAITING_COLUMNS).neq('waiting', '[]');

/** The links of every repository the caller reads to its products. */
export const repoLinksOf = (db: OutboxQuestionsDb) => db.from('product_repositories').select(LINK_COLUMNS);

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

    /** The repository PRDs. */
    async repoPrds(): Promise<StoredRepoPrd[]> {
      const { data, error } = await repoPrdsOf(db);
      if (error) throw new Error(`Supabase: could not read the repository PRDs (${why(error)})`);
      return orThrow(parseRows(StoredRepoPrd, data, `${WHERE}: dossiers (repository PRDs)`));
    },

    /** The repository PRDs' stored outboxes that hold waiting items. */
    async repoWaiting(): Promise<StoredRepoWaiting[]> {
      const { data, error } = await repoWaitingOf(db);
      if (error) throw new Error(`Supabase: could not read the repository outboxes (${why(error)})`);
      return orThrow(parseRows(StoredRepoWaiting, data, `${WHERE}: prd_outbox`));
    },

    /** The repositories' product links. */
    async repoLinks(): Promise<StoredRepoLink[]> {
      const { data, error } = await repoLinksOf(db);
      if (error) throw new Error(`Supabase: could not read the repositories' products (${why(error)})`);
      return orThrow(parseRows(StoredRepoLink, data, `${WHERE}: product_repositories`));
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
