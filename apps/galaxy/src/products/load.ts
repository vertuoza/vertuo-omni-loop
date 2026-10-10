import 'server-only';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { propertyOf } from 'vertuo-omni-plan/kit/lib/narrow.ts';
import type { Database } from '../../../../supabase/database.types.ts';
import { memberWorkspace } from '../data/workspace';
import type { Approvers } from './approvers';
import { approversDbOf, loadApprovers } from './approvers-load';
import { pitchedOf, rowOf, type PitchedProduct, type ProductRow, type StoredProduct } from './model';
import { productsRepository } from './products.repository';

// Settings › Products's reads (PRD 859 s1), as the signed-in person, so row-level security decides
// what they return: their workspace (the one joined first, as /app's) and its products, first first,
// each with its pitch look; or one of them, by its id, with its Pitch settings (PRD 1108 s2). The products are the ones Settings › Business
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
  | { kind: 'product'; workspace: Workspace; editable: boolean; product: PitchedProduct };

const why = (err: unknown) => (err instanceof Error ? err.message : String(propertyOf(err, 'message') ?? err));

/** Whether a member may change a product's Pitch settings: whoever may edit Settings › Business, any member. */
const EDITABLE_BY_MEMBERS = true;

/** The workspace's products, first first, through the products' storage (ADR-0095). */
const productsOf = (db: SupabaseClient<Database>, workspace: string): Promise<StoredProduct[]> =>
  productsRepository(db).products(workspace);

type StoredLoad = { kind: 'no-workspace' } | { kind: 'unreadable' } | { kind: 'stored'; workspace: Workspace; products: StoredProduct[] };

async function storedProducts(db: SupabaseClient<Database>, user: User): Promise<StoredLoad> {
  try {
    const workspace = await memberWorkspace(db, user.id);
    if (!workspace) return { kind: 'no-workspace' };
    return { kind: 'stored', workspace: { id: workspace.id, name: workspace.name }, products: await productsOf(db, workspace.id) };
  } catch (err) {
    console.error(`products: the page could not be read (${why(err)})`);
    return { kind: 'unreadable' };
  }
}

export async function loadProducts(db: SupabaseClient<Database>, user: User): Promise<ProductsLoad> {
  const read = await storedProducts(db, user);
  if (read.kind !== 'stored') return read;
  return { kind: 'products', workspace: read.workspace, editable: EDITABLE_BY_MEMBERS, products: read.products.map(rowOf) };
}

export async function loadProduct(db: SupabaseClient<Database>, user: User, id: string): Promise<ProductLoad> {
  const read = await storedProducts(db, user);
  if (read.kind !== 'stored') return read;
  const stored = read.products.find((p) => p.id === id);
  if (!stored) return { kind: 'not-found' };
  return { kind: 'product', workspace: read.workspace, editable: EDITABLE_BY_MEMBERS, product: pitchedOf(stored) };
}

/** One product's page: the product, and its Approvers list (PRD 1322 s1), null when that could not be read. */
export type ProductPageLoad =
  | Exclude<ProductLoad, { kind: 'product' }>
  | (Extract<ProductLoad, { kind: 'product' }> & { approvers: Approvers | null });

export async function loadProductPage(db: SupabaseClient<Database>, user: User, id: string): Promise<ProductPageLoad> {
  const read = await loadProduct(db, user, id);
  if (read.kind !== 'product') return read;
  return { ...read, approvers: await loadApprovers(approversDbOf(db), read.workspace.id, id) };
}
