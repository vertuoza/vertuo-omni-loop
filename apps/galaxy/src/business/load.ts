import 'server-only';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { memberWorkspace } from '../data/workspace';
import { claimOf, type Claim, type StoredCitation, type StoredClaim } from './model';

// Settings → Business's read (PRD 748 s2), as the signed-in person, so row-level security decides what
// it returns: their workspace (the one joined first, as /app's); its business, opened with
// business_open(), which makes it (and its first product) the first time anyone opens the page and
// answers it as it is afterwards; the first product, the one the page shows while there is one; the
// claims of the business's region and of that product; and the citation log, counted per claim.
// Nothing is seeded: an empty workspace reads no claim.

export type BusinessLoad =
  | { kind: 'no-workspace' }
  | { kind: 'unreadable' }
  | { kind: 'business'; workspace: { id: string; name: string }; product: { id: string; name: string }; claims: Claim[] };

const why = (err: unknown) => (err instanceof Error ? err.message : String((err as { message?: unknown })?.message ?? err));

async function openBusiness(db: SupabaseClient, workspace: string): Promise<string> {
  const { data, error } = await db.rpc('business_open', { p_workspace: workspace });
  const id = (data as { id?: unknown } | null)?.id;
  if (error || typeof id !== 'string') throw new Error(`Supabase: could not open the business (${error?.message ?? 'no business'})`);
  return id;
}

async function firstProduct(db: SupabaseClient, business: string): Promise<{ id: string; name: string }> {
  const { data, error } = await db.from('products').select('id, name').eq('business_id', business).order('ordinal').limit(1);
  const first = ((data ?? []) as Array<{ id: string; name: string }>)[0];
  if (error || !first) throw new Error(`Supabase: could not read the products (${error?.message ?? 'none'})`);
  return first;
}

async function claimsOf(db: SupabaseClient, business: string): Promise<StoredClaim[]> {
  const { data, error } = await db.from('claims').select('id, seq, kind, value, source, state, product_id').eq('business_id', business);
  if (error) throw new Error(`Supabase: could not read the claims (${error.message})`);
  return (data ?? []) as StoredClaim[];
}

async function citationsOf(db: SupabaseClient, workspace: string): Promise<StoredCitation[]> {
  const { data, error } = await db.from('claim_citations').select('claim_id, cited_by, ref, cited_at').eq('workspace_id', workspace);
  if (error) throw new Error(`Supabase: could not read the citations (${error.message})`);
  return (data ?? []) as StoredCitation[];
}

export async function loadBusinessPage(db: SupabaseClient, user: User): Promise<BusinessLoad> {
  try {
    const workspace = await memberWorkspace(db, user.id);
    if (!workspace) return { kind: 'no-workspace' };
    const business = await openBusiness(db, workspace.id);
    const [product, stored, citations] = await Promise.all([firstProduct(db, business), claimsOf(db, business), citationsOf(db, workspace.id)]);
    const claims = stored
      .filter((c) => c.product_id == null || c.product_id === product.id)
      .map((c) => claimOf(c, citations))
      .sort((a, b) => a.seq - b.seq);
    return { kind: 'business', workspace: { id: workspace.id, name: workspace.name }, product, claims };
  } catch (err) {
    console.error(`business: the page could not be read (${why(err)})`);
    return { kind: 'unreadable' };
  }
}
