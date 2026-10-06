import 'server-only';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import type { Database } from '../../../../supabase/database.types.ts';
import { memberWorkspace } from '../data/workspace';
import { z } from 'zod';
import {
  CITATION_COLUMNS, CLAIM_COLUMNS, claimOf, OpenedBusiness, Product, PRODUCT_COLUMNS, RECEIPT_COLUMNS, StoredCitation, StoredClaim, StoredReceipt, type Claim,
} from './model';
import { DRAFT_COLUMNS, StoredDraft } from './draft-port';
import { PAGE_COLUMNS, WebPage, type DraftView } from './reveal';
import { PERSONA_COLUMNS, personaOf, StoredPersona, type Persona } from './personas';
import { orEmpty, orThrow, parseRow, parseRows } from '../data/parse-rows';
import { at, propertyOf } from 'vertuo-omni-plan/kit/lib/narrow.ts';
import type { RpcAnswer } from './answer';

// Settings → Business's read (PRD 748 s2), as the signed-in person, so row-level security decides what
// it returns: their workspace (the one joined first, as /app's); its business, opened with
// business_open(), which makes it (and its first product) the first time anyone opens the page and
// answers it as it is afterwards; its products, first first (PRD 748 s4: one tab each from the second
// on); every claim, of the business's region and of each product; and the citation log, counted per
// claim. The draft (PRD 774 s3): each claim's receipts, the web pages pasted on the business and its
// latest draft; any of these that cannot be read reads as none, so the page still opens.
// The personas (PRD 799 s3): every product's, oldest first; unreadable, they read as none.
// Nothing is seeded: an empty workspace reads no claim and no persona.

export type BusinessLoad =
  | { kind: 'no-workspace' }
  | { kind: 'unreadable' }
  | {
    kind: 'business';
    workspace: { id: string; name: string };
    /** The first product: the one a pick names when no tab says otherwise. */
    product: Product;
    /** Every product, first first (PRD 748 s4). */
    products: Product[];
    /** Every claim, of the business's region and of every product. */
    claims: Claim[];
    /** The business's latest draft, or null (PRD 774 s3). */
    draft: DraftView | null;
    /** The web pages pasted on the business. */
    pages: WebPage[];
    /** Every persona of every product, oldest first (PRD 799 s3). */
    personas: Persona[];
  };

const why = (err: unknown) => (err instanceof Error ? err.message : String(propertyOf(err, 'message') ?? err));

async function openBusiness(db: SupabaseClient, workspace: string): Promise<string> {
  const answer: RpcAnswer = await db.rpc('business_open', { p_workspace: workspace });
  const { data, error } = answer;
  if (error || !data) throw new Error(`Supabase: could not open the business (${error?.message ?? 'no business'})`);
  return orThrow(parseRow(OpenedBusiness, data, 'business/load: business_open')).id;
}

/** The business's products, first first; a business always has one. */
async function productsOf(db: SupabaseClient, business: string): Promise<Product[]> {
  const { data, error } = await db.from('products').select(PRODUCT_COLUMNS).eq('business_id', business).order('ordinal');
  if (error) throw new Error(`Supabase: could not read the products (${error.message})`);
  const products = orThrow(parseRows(Product, data, 'business/load: products'));
  if (products.length === 0) throw new Error('Supabase: could not read the products (none)');
  return products;
}

async function claimsOf(db: SupabaseClient, business: string): Promise<StoredClaim[]> {
  const { data, error } = await db.from('claims').select(CLAIM_COLUMNS).eq('business_id', business);
  if (error) throw new Error(`Supabase: could not read the claims (${error.message})`);
  return orThrow(parseRows(StoredClaim, data, 'business/load: claims'));
}

async function citationsOf(db: SupabaseClient, workspace: string): Promise<StoredCitation[]> {
  const { data, error } = await db.from('claim_citations').select(CITATION_COLUMNS).eq('workspace_id', workspace);
  if (error) throw new Error(`Supabase: could not read the citations (${error.message})`);
  return orThrow(parseRows(StoredCitation, data, 'business/load: claim_citations'));
}

/** Rows the page can do without, each parsed with `schema`: on an error or a row that does not
 * parse, logged, and read as none. */
async function optional<T>(what: string, table: string, read: PromiseLike<{ data: unknown; error: { message: string } | null }>, schema: z.ZodType<T>): Promise<T[]> {
  const { data, error } = await read;
  if (error) {
    console.error(`business: could not read ${what} (${error.message})`);
    return [];
  }
  return orEmpty(parseRows(schema, data, `business/load: ${table}`));
}

export async function loadBusinessPage(db: SupabaseClient<Database>, user: User): Promise<BusinessLoad> {
  try {
    const workspace = await memberWorkspace(db, user.id);
    if (!workspace) return { kind: 'no-workspace' };
    const business = await openBusiness(db, workspace.id);
    const [products, stored, citations, receipts, pages, drafts, cast] = await Promise.all([
      productsOf(db, business), claimsOf(db, business), citationsOf(db, workspace.id),
      optional('the receipts', 'claim_receipts', db.from('claim_receipts').select(RECEIPT_COLUMNS).eq('workspace_id', workspace.id), StoredReceipt),
      optional('the web pages', 'business_sources', db.from('business_sources').select(PAGE_COLUMNS).eq('business_id', business).order('added_at'), WebPage),
      optional('the latest draft', 'business_drafts', db.from('business_drafts').select(DRAFT_COLUMNS).eq('business_id', business).order('started_at', { ascending: false }).limit(1), StoredDraft),
      optional('the personas', 'personas', db.from('personas').select(PERSONA_COLUMNS).eq('workspace_id', workspace.id).order('ordinal'), StoredPersona),
    ]);
    const claims = stored.map((c) => claimOf(c, citations, receipts)).sort((a, b) => a.seq - b.seq);
    return {
      kind: 'business', workspace: { id: workspace.id, name: workspace.name }, product: at(products, 0, 'the first product'), products, claims,
      draft: drafts[0] ?? null,
      pages: pages.map(({ id, url }) => ({ id, url })),
      personas: cast.map(personaOf),
    };
  } catch (err) {
    console.error(`business: the page could not be read (${why(err)})`);
    return { kind: 'unreadable' };
  }
}
