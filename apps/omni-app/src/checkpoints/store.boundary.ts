// The checkpoints store's read (./store.ts), for `pnpm schemas:verify` (PRD 1030): the saves it pages through, with
// the columns it selects, parsed with the schema the store parses them with. Its other calls delete or write, and are
// not run here.
import type { Boundary } from '../boundary.ts';
import { KeptRowSchema } from './store.ts';

export const boundaries: Boundary[] = [
  {
    name: 'checkpoints/store: runner_checkpoints',
    read: (db) =>
      db.from('runner_checkpoints').select('id, job_id, storage_path, created_at, keep_until').eq('kind', 'portable').is('deleted_at', null).not('storage_path', 'is', null).order('created_at').limit(5),
    schema: KeptRowSchema,
    shape: 'rows',
  },
];
