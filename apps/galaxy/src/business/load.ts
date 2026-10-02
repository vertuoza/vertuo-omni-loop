import 'server-only';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { memberWorkspace } from '../data/workspace';
import { claimOf, type Claim, type Product, type StoredCitation, type StoredClaim, type StoredReceipt } from './model';
import { CLAIM_COLUMNS, DRAFT_COLUMNS, draftOf, RECEIPT_COLUMNS } from './draft-port';
import type { DraftView, WebPage } from './reveal';
import { PERSONA_COLUMNS, personaOf, type Persona, type StoredPersona } from './personas';

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

const why = (err: unknown) => (err instanceof Error ? err.message : String((err as { message?: unknown })?.message ?? err));

async function openBusiness(db: SupabaseClient, workspace: string): Promise<string> {
  const { data, error } = await db.rpc('business_open', { p_workspace: workspace });
  const id = (data as { id?: unknown } | null)?.id;
  if (error || typeof id !== 'string') throw new Error(`Supabase: could not open the business (${error?.message ?? 'no business'})`);
  return id;
}

/** The business's products, first first; a business always has one. */
async function productsOf(db: SupabaseClient, business: string): Promise<Product[]> {
  const { data, error } = await db.from('products').select('id, name').eq('business_id', business).order('ordinal');
  const products = ((data ?? []) as Product[]).map(({ id, name }) => ({ id, name }));
  if (error || products.length === 0) throw new Error(`Supabase: could not read the products (${error?.message ?? 'none'})`);
  return products;
}

async function claimsOf(db: SupabaseClient, business: string): Promise<StoredClaim[]> {
  const { data, error } = await db.from('claims').select(CLAIM_COLUMNS).eq('business_id', business);
  if (error) throw new Error(`Supabase: could not read the claims (${error.message})`);
  return (data ?? []) as StoredClaim[];
}

async function citationsOf(db: SupabaseClient, workspace: string): Promise<StoredCitation[]> {
  const { data, error } = await db.from('claim_citations').select('claim_id, cited_by, ref, cited_at').eq('workspace_id', workspace);
  if (error) throw new Error(`Supabase: could not read the citations (${error.message})`);
  return (data ?? []) as StoredCitation[];
}

/** A read the page can do without: logged, and read as `none`. */
async function optional<T>(what: string, read: PromiseLike<{ data: unknown; error: { message: string } | null }>, none: T): Promise<T> {
  const { data, error } = await read;
  if (error) {
    console.error(`business: could not read ${what} (${error.message})`);
    return none;
  }
  return (data ?? none) as T;
}

export async function loadBusinessPage(db: SupabaseClient, user: User): Promise<BusinessLoad> {
  try {
    const workspace = await memberWorkspace(db, user.id);
    if (!workspace) return { kind: 'no-workspace' };
    const business = await openBusiness(db, workspace.id);
    const [products, stored, citations, receipts, pages, drafts, cast] = await Promise.all([
      productsOf(db, business), claimsOf(db, business), citationsOf(db, workspace.id),
      optional<StoredReceipt[]>('the receipts', db.from('claim_receipts').select(RECEIPT_COLUMNS).eq('workspace_id', workspace.id), []),
      optional<WebPage[]>('the web pages', db.from('business_sources').select('id, url').eq('business_id', business).order('added_at'), []),
      optional<Array<Record<string, unknown>>>('the latest draft', db.from('business_drafts').select(DRAFT_COLUMNS).eq('business_id', business).order('started_at', { ascending: false }).limit(1), []),
      optional<StoredPersona[]>('the personas', db.from('personas').select(PERSONA_COLUMNS).eq('workspace_id', workspace.id).order('ordinal'), []),
    ]);
    const claims = stored.map((c) => claimOf(c, citations, receipts)).sort((a, b) => a.seq - b.seq);
    return {
      kind: 'business', workspace: { id: workspace.id, name: workspace.name }, product: products[0]!, products, claims,
      draft: drafts[0] ? draftOf(drafts[0]) : null,
      pages: pages.map(({ id, url }) => ({ id, url })),
      personas: cast.map(personaOf),
    };
  } catch (err) {
    console.error(`business: the page could not be read (${why(err)})`);
    return { kind: 'unreadable' };
  }
}
