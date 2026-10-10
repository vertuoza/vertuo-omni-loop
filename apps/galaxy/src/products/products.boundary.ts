// The products module's reads from Supabase, for `pnpm schemas:verify` (PRD 1030,
// scripts/schemas-verify.ts): the Approvers list's own select, over every product (no filter), and
// the products list's (PRD 1364 s8), through its storage's own selects, over every workspace.
// workspace_roster() (members only, never the service role) and is_owner() are registered by the
// business module.
import type { Boundary } from '../data/parse-rows';
import { APPROVER_COLUMNS, StoredApprover } from './approvers';
import { linksOf, productDossiersOf, productsOf, StoredLink, StoredProductDossier, StoredProductRow } from './products.repository';

export const boundaries: Boundary[] = [
  { name: 'products/approvers-load: product_approvers', read: (db) => db.from('product_approvers').select(APPROVER_COLUMNS), schema: StoredApprover, shape: 'rows' },
  { name: 'products/products.repository: products', read: (db) => productsOf(db), schema: StoredProductRow, shape: 'rows' },
  { name: 'products/products.repository: product_repositories', read: (db) => linksOf(db), schema: StoredLink, shape: 'rows' },
  { name: 'products/products.repository: dossiers', read: (db) => productDossiersOf(db), schema: StoredProductDossier, shape: 'rows' },
];
