// The main watch store's answers (./store.ts), for `pnpm schemas:verify` (PRD 1030): the rows its
// writes return, read here as a select, parsed with the schema the store parses them with. The
// installation's workspace is read as the retro's runner queue reads it, and registered there.
import type { Boundary } from '../boundary.ts';
import { LaneRowSchema, SourceRowSchema } from './store.ts';

export const boundaries: Boundary[] = [
  {
    name: 'main-watch/store: prd_main_watch',
    read: (db) => db.from('prd_main_watch').select('lane').limit(1),
    schema: LaneRowSchema,
    shape: 'rows',
  },
  {
    name: 'main-watch/store: prd_main_breaks',
    read: (db) => db.from('prd_main_breaks').select('source').limit(1),
    schema: SourceRowSchema,
    shape: 'rows',
  },
];
