import { lockedLine, type ProductPick, type ProductRef, type ProductRefusal } from './product.contract';
import { dossierProductRepository, type DossierProductRepository, type ProductDb } from './product.repository';

// The PRD page's Product picker's rules (PRD 1364 s7; ADR-0095), on its repository. What the picker
// shows: the PRD's product, its workspace's products, and the lock, `product is locked: PRD <n> is
// approved`, while an approval is in force, that is, its latest approval has no void (as
// dossier_set_product() decides it). What a change answers: the product the database set, or its refusal
// read as the picker shows it. The database has the last word on both: the lock read here only disables
// the picker, and dossier_set_product() refuses a change while an approval is in force.

/** A service answer: its value, or why it was refused, in plain words. */
type Served<T> = { ok: true; value: T } | { ok: false; kind: ProductRefusal; error: string };

export const SIGNED_OUT = 'Sign in first to change the PRD\'s product.';
const MISSING = 'No such PRD.';
const NOT_READ = 'The PRD\'s product could not be read. Try again.';
const NOT_CHANGED = 'The PRD\'s product was not changed. Try again.';
const LOCKED = 'The PRD\'s product is locked: it is approved.';

const refused = (kind: ProductRefusal, error: string): { ok: false; kind: ProductRefusal; error: string } => ({ ok: false, kind, error });

/** Whether the dossier's latest approval is in force (it has no void); undefined when it could not be read. */
async function approvalInForce(repo: DossierProductRepository, dossier: string): Promise<boolean | undefined> {
  const approval = await repo.latestApproval(dossier);
  if (!approval.ok) return undefined;
  if (approval.value === null) return false;
  const voided = await repo.voided(approval.value);
  return voided.ok ? !voided.value : undefined;
}

export function productService(repo: DossierProductRepository) {
  return {
    /** What the picker shows for the dossier. */
    async read(id: string): Promise<Served<ProductPick>> {
      const dossier = await repo.dossier(id);
      if (!dossier.ok) return refused('database', NOT_READ);
      if (!dossier.value) return refused('missing', MISSING);
      const { prd, workspace_id: workspace, product_id: productId } = dossier.value;
      const [products, locked] = [await repo.products(workspace), await approvalInForce(repo, id)];
      if (!products.ok || locked === undefined) return refused('database', NOT_READ);
      const product = products.value.find((p) => p.id === productId) ?? null;
      return { ok: true, value: { product, products: products.value, locked: locked && prd !== null ? lockedLine(prd) : null } };
    },

    /** Changes the dossier's product to `product`, or to none. */
    async change(id: string, product: string | null): Promise<Served<{ product: ProductRef | null }>> {
      const set = await repo.set(id, product);
      if (set.ok) return { ok: true, value: { product: set.value } };
      if (set.code === '55000') return refused('locked', set.message || LOCKED);
      if (set.code === 'P0002') return set.hint === 'product' ? refused('foreign-product', set.message || MISSING) : refused('missing', MISSING);
      if (set.code === '42501') return refused('signed-out', SIGNED_OUT);
      return refused('database', NOT_CHANGED);
    },
  };
}

export type ProductService = ReturnType<typeof productService>;

/** The service on a signed-in person's client. */
export const productServiceOf = (db: ProductDb): ProductService => productService(dossierProductRepository(db));
