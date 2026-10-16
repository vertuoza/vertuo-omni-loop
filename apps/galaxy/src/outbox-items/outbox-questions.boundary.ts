// The workspace Outbox's reads from Supabase, for `pnpm schemas:verify` (PRD 1030, scripts/schemas-verify.ts):
// each of its storage's own selects (PRD 2011 s14), over every workspace.
import type { Boundary } from '../data/parse-rows';
import {
  allItemsOf, authorsOf, prdsOf, productsOf, StoredAuthor, StoredItemPrd, StoredOpenItem, StoredQuestionProduct,
} from './outbox-questions.repository';

const WHERE = 'outbox-items/outbox-questions.repository';

export const boundaries: Boundary[] = [
  { name: `${WHERE}: outbox_items`, read: (db) => allItemsOf(db), schema: StoredOpenItem, shape: 'rows' },
  { name: `${WHERE}: dossiers`, read: (db) => prdsOf(db), schema: StoredItemPrd, shape: 'rows' },
  { name: `${WHERE}: products`, read: (db) => productsOf(db), schema: StoredQuestionProduct, shape: 'rows' },
  { name: `${WHERE}: players`, read: (db) => authorsOf(db), schema: StoredAuthor, shape: 'rows' },
];
