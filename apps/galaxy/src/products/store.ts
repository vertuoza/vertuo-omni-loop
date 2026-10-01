import { rowOf, type PitchLook, type ProductRow, type StoredProduct } from './model';

// Settings › Products's one call (PRD 859 s1). In production, set_pitch_look() of
// supabase/migrations/20261029090000_products_pitch_look.sql, called as the signed-in person: whoever
// may edit Settings › Business may change a product's look, and it answers the products row it saved,
// or refuses. In the demo, the same rule kept in memory, so the page can be tried with no database.

export type Saved = { ok: true; product: ProductRow } | { ok: false; message: string };

export interface ProductsPort {
  /** Changes one product's pitch look; the workspace's other products keep theirs. */
  setLook(product: string, look: PitchLook): Promise<Saved>;
}

export const NOT_EDITOR = 'Only someone who may edit the business can change a product’s look.';
export const GONE = 'That product is no longer in this workspace. Reload the page.';
export const COULD_NOT_SAVE = 'Couldn’t save this. Try again in a moment.';

/** An error as PostgREST answers it, or anything thrown, as the page says it. */
export function refusalOf(error: unknown): string {
  const { code } = (error ?? {}) as { code?: unknown };
  if (code === '42501') return NOT_EDITOR;
  if (code === 'P0002') return GONE;
  return COULD_NOT_SAVE;
}

type Rpc = { rpc(fn: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: unknown }> };

export function databaseProducts(db: Rpc, workspace: string): ProductsPort {
  return {
    async setLook(product, look) {
      try {
        const { data, error } = await db.rpc('set_pitch_look', { p_workspace: workspace, p_product: product, p_look: look });
        if (error || !data) return { ok: false, message: refusalOf(error) };
        return { ok: true, product: rowOf(data as StoredProduct) };
      } catch (err) {
        return { ok: false, message: refusalOf(err) };
      }
    },
  };
}

/** set_pitch_look()'s rule on products kept in memory. */
export function demoProductsPort(initial: ProductRow[]): ProductsPort {
  let rows = [...initial];
  return {
    async setLook(id, look) {
      const kept = rows.find((r) => r.id === id);
      if (!kept) return { ok: false, message: GONE };
      const product = { ...kept, look };
      rows = rows.map((r) => (r === kept ? product : r));
      return { ok: true, product };
    },
  };
}
