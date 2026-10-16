// The workspace Outbox's reads from Supabase, for `pnpm schemas:verify` (PRD 1030, scripts/schemas-verify.ts):
// each of its storage's own selects (PRD 2011 s14), over every workspace.
import type { Boundary } from '../data/parse-rows';
import { prdsOf, productsOf, StoredItemPrd } from './outbox-questions.repository';
import { StoredProduct } from '../product-home/product-home.repository';

const WHERE = 'outbox-items/outbox-questions.repository';

// Its items and players are the product home's own reads, registered there.
export const boundaries: Boundary[] = [
  { name: `${WHERE}: dossiers`, read: (db) => prdsOf(db), schema: StoredItemPrd, shape: 'rows' },
  { name: `${WHERE}: products`, read: (db) => productsOf(db), schema: StoredProduct, shape: 'rows' },
];
