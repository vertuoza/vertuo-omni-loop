// The search eval store's reads (./store.ts), for `pnpm schemas:verify` (PRD 1030): the grouped searches it takes and
// the set's questions and answers, with the columns it selects, parsed with the schemas the store parses them with.
// Its other calls write, and are not run here.
import type { Boundary } from '../boundary.ts';
import { LogRowSchema } from './store.ts';

export const boundaries: Boundary[] = [
  {
    name: 'search-eval/store: mcp_search_log',
    read: (db) => db.from('mcp_search_log').select('group_id, product_id, workspace_id, category').eq('tool', 'search_knowledge').not('group_id', 'is', null).limit(5),
    schema: LogRowSchema,
    shape: 'rows',
  },
];
