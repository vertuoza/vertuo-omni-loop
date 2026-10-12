// The PRD page's Product picker's storage (PRD 1364 s7; ADR-0095): the only file of the picker that
// reaches Supabase, on the client it is given, as the signed-in person, so row-level security has the
// last word. It reads the dossier, its workspace's products and its latest approval and that approval's
// void, and calls dossier_set_product() (supabase/migrations/20261129100000_prd_product.sql). Every
// answer is parsed where it comes in; it holds no rule. A refusal comes back as the database's code,
// message and hint; an answer out of shape as the code `shape`.
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { PrdNumberSchema } from 'vertuo-omni-plan/kit/lib/ids.ts';
import { ProductRefSchema, UuidSchema } from './product.contract';

/** What the picker's reads need: the tables and the database's functions. */
export type ProductDb = Pick<SupabaseClient, 'from' | 'rpc'>;

/** A stored answer: its value, or why the database said no. */
export type Stored<T> = { ok: true; value: T } | { ok: false; code: string | null; message: string | null; hint: string | null };

const DOSSIER_COLUMNS = 'id, prd, workspace_id, product_id';

/** A dossier as the picker reads it. */
export const ProductDossierRow = z.object({ id: z.string(), prd: PrdNumberSchema.nullable(), workspace_id: z.string(), product_id: z.string().nullable() });
export type ProductDossier = z.infer<typeof ProductDossierRow>;

/** A product as the picker reads it. */
export const ProductRow = ProductRefSchema;

const ApprovalRow = z.object({ id: UuidSchema });
const VoidRows = z.array(z.object({ id: z.string() }));
const SetAnswer = z.object({ id: z.string(), product: ProductRefSchema.nullable() });

type Raw = { data: unknown; error: { code?: string; message?: string; hint?: string } | null };

async function parsed<T, V>(call: PromiseLike<Raw>, schema: z.ZodType<T>, what: string, take: (value: T) => V): Promise<Stored<V>> {
  const { data, error } = await call;
  if (error) return { ok: false, code: error.code ?? null, message: error.message ?? null, hint: error.hint ?? null };
  const read = schema.safeParse(data);
  return read.success ? { ok: true, value: take(read.data) } : { ok: false, code: 'shape', message: `${what} answered out of shape`, hint: null };
}

/** The workspace's products, by name: the read `pnpm schemas:verify` checks too. */
export const workspaceProducts = (db: Pick<SupabaseClient, 'from'>) => db.from('products').select('id, name');

/** The dossiers' rows the picker reads: the read `pnpm schemas:verify` checks too. */
export const productDossiers = (db: Pick<SupabaseClient, 'from'>) => db.from('dossiers').select(DOSSIER_COLUMNS);

export function dossierProductRepository(db: ProductDb) {
  return {
    /** The dossier, or null when the caller reads no such. */
    dossier: (id: string) =>
      parsed(productDossiers(db).eq('id', id).maybeSingle(), ProductDossierRow.nullable(), 'dossiers', (row) => row),

    /** The workspace's products, by name. */
    products: (workspace: string) =>
      parsed(workspaceProducts(db).eq('workspace_id', workspace).order('name'), z.array(ProductRow), 'products', (rows) => rows),

    /** The id of the dossier's latest approval, or null with none. */
    latestApproval: (dossier: string) =>
      parsed(
        db.from('approvals').select('id').eq('dossier_id', dossier)
          .order('approved_at', { ascending: false }).order('id', { ascending: false }).limit(1).maybeSingle(),
        ApprovalRow.nullable(), 'approvals', (row) => row?.id ?? null,
      ),

    /** Whether a void follows that approval. */
    voided: (approval: string) =>
      parsed(db.from('approval_voids').select('id').eq('approval_id', approval).limit(1), VoidRows, 'approval_voids', (rows) => rows.length > 0),

    /** Sets the dossier's product, or none: the product set. */
    set: (dossier: string, product: string | null) =>
      parsed(db.rpc('dossier_set_product', { p_dossier: dossier, p_product: product }), SetAnswer, 'dossier_set_product()', (answer) => answer.product),
  };
}

export type DossierProductRepository = ReturnType<typeof dossierProductRepository>;
