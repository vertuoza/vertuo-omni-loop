// A product PRD's Outbox tab reads from Supabase, for `pnpm schemas:verify` (PRD 1030, scripts/schemas-verify.ts):
// each of its own selects (PRD 2011 s15).
import type { Boundary } from '../../data/parse-rows';
import { itemsOfDossier, prdKeyOf, PrdKey } from './outbox-product.repository';
import { StoredProductItem } from './outbox-product';

const WHERE = 'dossier/page/outbox-product.repository';
/** A dossier that is none: the select is read for its shape, not its rows. */
const NONE = '00000000-0000-4000-8000-000000000000';

export const boundaries: Boundary[] = [
  { name: `${WHERE}: dossiers`, read: (db) => prdKeyOf(db, NONE), schema: PrdKey, shape: 'rows' },
  { name: `${WHERE}: outbox_items`, read: (db) => itemsOfDossier(db, NONE), schema: StoredProductItem, shape: 'rows' },
];
