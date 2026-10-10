// The product filter's reads from Supabase, for `pnpm schemas:verify` (PRD 1030,
// scripts/schemas-verify.ts): its storage's own selects (PRD 1364 s12), over every workspace. The
// repositories' workspace_id is read by its own select only.
import type { Boundary, BoundaryAnswer } from '../data/parse-rows';
import { filterProductsOf, productDossiersIn, productIdeasOf, StoredCarrier, StoredFilterProduct, type ProductFilterDb } from './product-filter.repository';

/** One of the storage's selects, as the script runs it: each builder is checked against the answer's shape
 * on its own here, so three builders in one list do not make the compiler compare their query types. */
const reading = (build: (db: ProductFilterDb) => PromiseLike<BoundaryAnswer>): Boundary['read'] => (db) => build(db);

export const boundaries: Boundary[] = [
  { name: 'product-filter/product-filter.repository: products', read: reading(filterProductsOf), schema: StoredFilterProduct, shape: 'rows' },
  { name: 'product-filter/product-filter.repository: dossiers', read: reading(productDossiersIn), schema: StoredCarrier, shape: 'rows' },
  { name: 'product-filter/product-filter.repository: ideas', read: reading(productIdeasOf), schema: StoredCarrier, shape: 'rows' },
];
