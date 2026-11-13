// The Categories view's reads (PRD omni-loop-7 s4), registered for `pnpm schemas:verify` (scripts/schemas-verify.ts):
// the searches with their category and group, and the groups' first questions, each parsed with the module's schema.
import type { Boundary } from '../../../data/parse-rows';
import { COLUMNS, StoredGroup, StoredSearch } from './categories.repository';

export const boundaries: Boundary[] = [
  { name: 'product-knowledge/categories.repository: mcp_search_log', read: (db) => db.from('mcp_search_log').select(COLUMNS).eq('tool', 'search_knowledge').limit(5), schema: StoredSearch, shape: 'rows' },
  { name: 'product-knowledge/categories.repository: mcp_search_groups', read: (db) => db.from('mcp_search_groups').select('id, question').limit(5), schema: StoredGroup, shape: 'rows' },
];
