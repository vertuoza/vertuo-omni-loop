import 'server-only';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { memberWorkspace } from '../data/workspace';
import { PRODUCT_COLUMNS, rowOf, type ProductRow, type StoredProduct } from './model';

// Settings › Products's reads (PRD 859 s1), as the signed-in person, so row-level security decides
// what they return: their workspace (the one joined first, as /app's) and its products, first first,
// each with its pitch look; or one of them, by its id. The products are the ones Settings › Business
// already holds: reading them never opens the business. Whoever may edit Settings › Business may change
// a look: today that is any member of the workspace (business_member_only() of
// supabase/migrations/20261019090000_business_store.sql), so every member who reads the page edits it.

type Workspace = { id: string; name: string };

export type ProductsLoad =
  | { kind: 'no-workspace' }
  | { kind: 'unreadable' }
  | { kind: 'products'; workspace: Workspace; editable: boolean; products: ProductRow[] };

export type ProductLoad =
  | { kind: 'no-workspace' }
  | { kind: 'unreadable' }
  | { kind: 'not-found' }
  | { kind: 'product'; workspace: Workspace; editable: boolean; product: ProductRow };

const why = (err: unknown) => (err instanceof Error ? err.message : String((err as { message?: unknown })?.message ?? err));

/** Whether a member may change a product's look: whoever may edit Settings › Business, any member. */
const EDITABLE_BY_MEMBERS = true;

async function productsOf(db: SupabaseClient, workspace: string): Promise<ProductRow[]> {
  const { data, error } = await db.from('products').select(PRODUCT_COLUMNS).eq('workspace_id', workspace).order('ordinal');
  if (error) throw new Error(`Supabase: could not read the products (${why(error)})`);
  return ((data ?? []) as StoredProduct[]).map(rowOf);
}

export async function loadProducts(db: SupabaseClient, user: User): Promise<ProductsLoad> {
  try {
    const workspace = await memberWorkspace(db, user.id);
    if (!workspace) return { kind: 'no-workspace' };
    const products = await productsOf(db, workspace.id);
    return { kind: 'products', workspace: { id: workspace.id, name: workspace.name }, editable: EDITABLE_BY_MEMBERS, products };
  } catch (err) {
    console.error(`products: the page could not be read (${why(err)})`);
    return { kind: 'unreadable' };
  }
}

export async function loadProduct(db: SupabaseClient, user: User, id: string): Promise<ProductLoad> {
  const list = await loadProducts(db, user);
  if (list.kind !== 'products') return list;
  const product = list.products.find((p) => p.id === id);
  if (!product) return { kind: 'not-found' };
  return { kind: 'product', workspace: list.workspace, editable: list.editable, product };
}
