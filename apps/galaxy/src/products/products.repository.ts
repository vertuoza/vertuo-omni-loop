import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { orThrow, parseRows } from '../data/parse-rows';
import { PRODUCT_COLUMNS } from './model';

// The products' storage (PRD 1364 s8; ADR-0095): the reads behind /app/products, as the signed-in person,
// so row-level security has the last word. The workspace's products (the same read Settings › Products
// makes, src/products/load.ts), their links to repositories (product_repositories, PRD 1364 s1), the
// workspace's repositories, the dossiers that carry a product (dossiers.product_id, s2), and the approval
// requests that wait on the caller (approval_requests_waiting(), PRD 1322). A failed read throws, and an
// answer out of shape too. No rule lives here: which repository is shared and what waits on whom is
// products.service.ts's.

/** What the products reads need: the tables and the database's functions. */
export type ProductsDb = Pick<SupabaseClient, 'from' | 'rpc'>;

/** A public.products row, as PostgREST answers it. */
export const StoredProductRow = z.object({
  id: z.string(),
  name: z.string(),
  pitch_look: z.string().nullable(),
  pitch: z.unknown().optional(),
});
type StoredProductRow = z.infer<typeof StoredProductRow>;

const LINK_COLUMNS = 'product_id, repository';
/** A product's link to a repository, as the list reads it: which product, which repository. */
export const StoredLink = z.object({ product_id: z.string(), repository: z.string() });
export type StoredLink = z.infer<typeof StoredLink>;

const REPOSITORY_COLUMNS = 'full_name';
/** A repository of the workspace, by its `owner/name`. */
const StoredRepository = z.object({ full_name: z.string() });

const DOSSIER_COLUMNS = 'id, kind, product_id';
/** A dossier that carries a product: its id, its kind (`prd`, `bug`, `visual`, `concept`) and its product. */
export const StoredProductDossier = z.object({ id: z.string(), kind: z.string(), product_id: z.string() });
export type StoredProductDossier = z.infer<typeof StoredProductDossier>;

/** One request waiting on the caller, as approval_requests_waiting() lists it: only its dossier is read. */
const WaitingRequest = z.object({ dossier: z.string() });

/** The workspace's products, first first: the read `pnpm schemas:verify` checks too. */
export const productsOf = (db: Pick<SupabaseClient, 'from'>, workspace?: string) => {
  const read = db.from('products').select(PRODUCT_COLUMNS);
  return (workspace === undefined ? read : read.eq('workspace_id', workspace)).order('ordinal');
};

/** Every product's links, or the workspace's. */
export const linksOf = (db: Pick<SupabaseClient, 'from'>, workspace?: string) => {
  const read = db.from('product_repositories').select(LINK_COLUMNS);
  return workspace === undefined ? read : read.eq('workspace_id', workspace);
};

/** Every dossier that carries a product, or the workspace's. */
export const productDossiersOf = (db: Pick<SupabaseClient, 'from'>, workspace?: string) => {
  const read = db.from('dossiers').select(DOSSIER_COLUMNS).not('product_id', 'is', null);
  return workspace === undefined ? read : read.eq('workspace_id', workspace);
};

const why = (error: { message: string }) => error.message;

/** What a function call answers: its body, unparsed, or its error. */
type RpcAnswer = { data: unknown; error: { message: string } | null };

export function productsRepository(db: ProductsDb) {
  return {
    /** The workspace's products, first first. */
    async products(workspace: string): Promise<StoredProductRow[]> {
      const { data, error } = await productsOf(db, workspace);
      if (error) throw new Error(`Supabase: could not read the products (${why(error)})`);
      return orThrow(parseRows(StoredProductRow, data, 'products/products.repository: products'));
    },

    /** Every link of the workspace's products to a repository. */
    async links(workspace: string): Promise<StoredLink[]> {
      const { data, error } = await linksOf(db, workspace);
      if (error) throw new Error(`Supabase: could not read the products' repositories (${why(error)})`);
      return orThrow(parseRows(StoredLink, data, 'products/products.repository: product_repositories'));
    },

    /** The workspace's repositories, by `owner/name`. */
    async repositories(workspace: string): Promise<string[]> {
      const { data, error } = await db.from('repositories').select(REPOSITORY_COLUMNS).eq('workspace_id', workspace);
      if (error) throw new Error(`Supabase: could not read the repositories (${why(error)})`);
      return orThrow(parseRows(StoredRepository, data, 'products/products.repository: repositories')).map((r) => r.full_name);
    },

    /** The workspace's dossiers that carry a product. */
    async productDossiers(workspace: string): Promise<StoredProductDossier[]> {
      const { data, error } = await productDossiersOf(db, workspace);
      if (error) throw new Error(`Supabase: could not read the products' PRDs (${why(error)})`);
      return orThrow(parseRows(StoredProductDossier, data, 'products/products.repository: dossiers'));
    },

    /** The dossiers whose latest approval request asks the caller, with no approval since. */
    async waitingDossiers(): Promise<string[]> {
      const answer: RpcAnswer = await db.rpc('approval_requests_waiting');
      const { data, error } = answer;
      if (error) throw new Error(`Supabase: could not read what waits on you (${why(error)})`);
      return orThrow(parseRows(WaitingRequest, data, 'products/products.repository: approval_requests_waiting')).map((r) => r.dossier);
    },
  };
}

export type ProductsRepository = ReturnType<typeof productsRepository>;
