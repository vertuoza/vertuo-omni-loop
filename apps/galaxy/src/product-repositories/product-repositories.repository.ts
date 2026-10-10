// The product links' reads (PRD 1364, s4; ADR-0095), on the client they are given: the caller's own,
// acting as their access token, so row-level security has the last word (a member reads their
// workspace's repositories, products and links). A failed read throws. No rule lives here: which
// product a name means and how a link reads as a target is product-repositories.service.ts's.
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { orThrow, parseRows } from '../data/parse-rows';

/** What the reads need: the tables. */
export type ProductRepositoriesDb = Pick<SupabaseClient, 'from'>;

/** A product of a workspace the caller reads. */
const StoredProduct = z.object({ id: z.string(), workspace_id: z.string(), name: z.string() });
export type StoredProductRow = z.infer<typeof StoredProduct>;

const LINK_COLUMNS = 'repository, role, knowledge, read_at, read_only, consumes';
/** One product link, as the table holds it. */
const StoredLink = z.object({
  repository: z.string(),
  role: z.string().nullable(),
  knowledge: z.enum(['own', 'imported', 'none']),
  read_at: z.string().nullable(),
  read_only: z.boolean(),
  consumes: z.array(z.string()),
});
export type StoredLinkRow = z.infer<typeof StoredLink>;

const Listing = z.object({ workspace_id: z.string() });

export function productRepositoriesRepository(db: ProductRepositoriesDb) {
  return {
    /** The workspaces the caller reads that list `repo` (owner/name, lower case). */
    async workspacesListing(repo: string): Promise<string[]> {
      const { data, error } = await db.from('repositories').select('workspace_id').eq('full_name', repo);
      if (error) throw new Error(`read the workspaces of ${repo}: ${error.message}`);
      return orThrow(parseRows(Listing, data, 'product-repositories: repositories')).map((row) => row.workspace_id);
    },

    /** The products of these workspaces. */
    async products(workspaces: string[]): Promise<StoredProductRow[]> {
      const { data, error } = await db.from('products').select('id, workspace_id, name').in('workspace_id', workspaces);
      if (error) throw new Error(`read the products: ${error.message}`);
      return orThrow(parseRows(StoredProduct, data, 'product-repositories: products'));
    },

    /** The links of one product, by repository. */
    async links(product: string): Promise<StoredLinkRow[]> {
      const { data, error } = await db.from('product_repositories').select(LINK_COLUMNS).eq('product_id', product).order('repository');
      if (error) throw new Error(`read the links of the product: ${error.message}`);
      return orThrow(parseRows(StoredLink, data, 'product-repositories: product_repositories'));
    },
  };
}

export type ProductRepositoriesRepository = ReturnType<typeof productRepositoriesRepository>;
