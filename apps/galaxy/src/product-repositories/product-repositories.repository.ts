// The product links' reads and writes (PRD 1364, s4 and s5; ADR-0095), on the client they are given:
// the caller's own, acting as their access token, so row-level security and product_repository_link()
// have the last word (a member reads their workspace's repositories, products and links; only an owner
// writes a link). A failed read throws; a refused write answers the database's code and words. No rule
// lives here: which product a name means, how a link reads as a target and which links an import
// writes is product-repositories.service.ts's.
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { orThrow, parseRows } from '../data/parse-rows';

/** What the reads and writes need: the tables, and product_repository_link(). */
export type ProductRepositoriesDb = Pick<SupabaseClient, 'from' | 'rpc'>;

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
const Linking = z.object({ product_id: z.string() });

/** A write: done, or the database's refusal, by its code and in its words. */
export type LinkWritten = { ok: true } | { ok: false; code: string | null; message: string };

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
    /** The ids of the products of these workspaces that link `repo` (owner/name, lower case). */
    async productsLinking(repo: string, workspaces: string[]): Promise<string[]> {
      const { data, error } = await db.from('product_repositories').select('product_id').eq('repository', repo).in('workspace_id', workspaces);
      if (error) throw new Error(`read the products of ${repo}: ${error.message}`);
      return orThrow(parseRows(Linking, data, 'product-repositories: product_repositories')).map((row) => row.product_id);
    },
    /** Links a repository to the product, or sets every field of its link, through product_repository_link(). */
    async link(product: string, link: StoredLinkRow): Promise<LinkWritten> {
      const { error } = await db.rpc('product_repository_link', {
        p_product: product,
        p_repository: link.repository,
        p_role: link.role ?? undefined,
        p_knowledge: link.knowledge,
        p_read_at: link.read_at ?? undefined,
        p_read_only: link.read_only,
        p_consumes: link.consumes,
      });
      return error ? { ok: false, code: error.code || null, message: error.message } : { ok: true };
    },
  };
}

export type ProductRepositoriesRepository = ReturnType<typeof productRepositoriesRepository>;
