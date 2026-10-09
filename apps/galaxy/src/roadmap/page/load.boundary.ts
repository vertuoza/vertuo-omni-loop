// The Roadmaps pages' own read (PRD 1162, s5), registered for `pnpm schemas:verify`
// (scripts/schemas-verify.ts): the workspace's products, parsed with the schema the loader parses them
// with. The roadmaps' reads are the store's, registered beside it (../store.boundary.ts).
import type { Boundary } from '../../data/parse-rows';
import { PRODUCT_COLUMNS, ProductRow } from './load';

export const boundaries: Boundary[] = [
  { name: 'roadmap/page/load: products', read: (db) => db.from('products').select(PRODUCT_COLUMNS), schema: ProductRow, shape: 'rows' },
];
