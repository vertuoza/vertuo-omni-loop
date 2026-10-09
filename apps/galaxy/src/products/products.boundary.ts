// The products module's reads of its Approvers list from Supabase, for `pnpm schemas:verify` (PRD 1030,
// scripts/schemas-verify.ts): the list's own select, over every product (no filter). workspace_roster()
// (members only, never the service role) and is_owner() are registered by the business module.
import type { Boundary } from '../data/parse-rows';
import { APPROVER_COLUMNS, StoredApprover } from './approvers';

export const boundaries: Boundary[] = [
  { name: 'products/approvers-load: product_approvers', read: (db) => db.from('product_approvers').select(APPROVER_COLUMNS), schema: StoredApprover, shape: 'rows' },
];
