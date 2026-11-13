// The categorize store's read (./store.ts), for `pnpm schemas:verify` (PRD 1030): the searches it takes, with the
// columns it selects, parsed with the schema the store parses them with. Its other calls write, and are not run here.
import type { Boundary } from '../boundary.ts';
import { UngroupedRowSchema } from './store.ts';

export const boundaries: Boundary[] = [
  {
    name: 'search-categorize/store: mcp_search_log',
    read: (db) => db.from('mcp_search_log').select('id, product_id, workspace_id, query').is('group_id', null).eq('tool', 'search_knowledge').not('query', 'is', null).limit(5),
    schema: UngroupedRowSchema,
    shape: 'rows',
  },
];
