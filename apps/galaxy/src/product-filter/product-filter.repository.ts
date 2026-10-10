import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { orThrow, parseRows } from '../data/parse-rows';

// The product filter's storage (PRD 1364 s12; ADR-0095): the reads behind the product filter of /prd,
// /ideas, /bugs and /visual, as the signed-in person, so row-level security has the last word. The
// products of the listed workspaces, which of their dossiers carry a product (dossiers.product_id,
// s2), the workspaces a board's repository belongs to, and which of the board's ideas carry one
// (ideas.product_id). A row with no product is never read: having none is not being listed. A failed
// read throws, and an answer out of shape too. No rule lives here: product-filter.service.ts's.

/** What the reads need: the tables. */
export type ProductFilterDb = Pick<SupabaseClient, 'from'>;

const PRODUCT_COLUMNS = 'id, name, workspace_id';
/** A product a list can be filtered by: its id, its name and its workspace. */
export const StoredFilterProduct = z.object({ id: z.string(), name: z.string(), workspace_id: z.string() });
type StoredFilterProduct = z.infer<typeof StoredFilterProduct>;

const CARRIER_COLUMNS = 'id, product_id';
/** A dossier or an idea that carries a product: its id and its product. */
export const StoredCarrier = z.object({ id: z.string(), product_id: z.string() });

/** A workspace a repository belongs to. */
const StoredRepositoryWorkspace = z.object({ workspace_id: z.string() });

/** Every product the caller reads, first first; the repository narrows it to the listed workspaces. */
export const filterProductsOf = (db: ProductFilterDb) => db.from('products').select(PRODUCT_COLUMNS).order('ordinal');

/** Every dossier the caller reads that carries a product; the repository narrows it to the listed workspaces. */
export const productDossiersIn = (db: ProductFilterDb) => db.from('dossiers').select(CARRIER_COLUMNS).not('product_id', 'is', null);

/** Every idea the caller reads that carries a product; the repository narrows it to one board. */
export const productIdeasOf = (db: ProductFilterDb) => db.from('ideas').select(CARRIER_COLUMNS).not('product_id', 'is', null);

const why = (error: { message: string }) => error.message;

const byId = (rows: readonly z.infer<typeof StoredCarrier>[]) => new Map(rows.map((r): [string, string] => [r.id, r.product_id]));

export function productFilterRepository(db: ProductFilterDb) {
  return {
    /** The products of these workspaces, first first. */
    async products(workspaces: readonly string[]): Promise<StoredFilterProduct[]> {
      const { data, error } = await filterProductsOf(db).in('workspace_id', [...workspaces]);
      if (error) throw new Error(`Supabase: could not read the products (${why(error)})`);
      return orThrow(parseRows(StoredFilterProduct, data, 'product-filter/product-filter.repository: products'));
    },

    /** The product of each dossier of these workspaces that carries one, by dossier id. */
    async dossierProducts(workspaces: readonly string[]): Promise<Map<string, string>> {
      const { data, error } = await productDossiersIn(db).in('workspace_id', [...workspaces]);
      if (error) throw new Error(`Supabase: could not read the dossiers' products (${why(error)})`);
      return byId(orThrow(parseRows(StoredCarrier, data, 'product-filter/product-filter.repository: dossiers')));
    },

    /** The workspaces whose repositories hold `repo` (`owner/name`). */
    async boardWorkspaces(repo: string): Promise<string[]> {
      const { data, error } = await db.from('repositories').select('workspace_id').eq('full_name', repo);
      if (error) throw new Error(`Supabase: could not read the board's workspace (${why(error)})`);
      return orThrow(parseRows(StoredRepositoryWorkspace, data, 'product-filter/product-filter.repository: repositories')).map((r) => r.workspace_id);
    },

    /** The product of each idea of `repo`'s board that carries one, by idea id. */
    async ideaProducts(repo: string): Promise<Map<string, string>> {
      const { data, error } = await productIdeasOf(db).eq('repo', repo);
      if (error) throw new Error(`Supabase: could not read the ideas' products (${why(error)})`);
      return byId(orThrow(parseRows(StoredCarrier, data, 'product-filter/product-filter.repository: ideas')));
    },
  };
}

export type ProductFilterRepository = ReturnType<typeof productFilterRepository>;
