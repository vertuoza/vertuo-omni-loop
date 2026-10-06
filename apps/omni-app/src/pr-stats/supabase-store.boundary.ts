// The collector's read of its store (./supabase-store.ts), for `pnpm schemas:verify` (PRD 1030): the
// tracked repositories and their installations, parsed with the schema the store parses them with.
// Its upserts and updates are not here: they write, and the check only reads.
import type { Boundary } from '../boundary.ts';
import { TrackedRowSchema } from './schema.ts';
import { TRACKED } from './supabase-store.ts';

export const boundaries: Boundary[] = [
  {
    name: 'pr-stats/supabase-store: repositories',
    read: (db) => db.from('repositories').select(TRACKED).eq('tracked', true).not('workspaces.github_installation_id', 'is', null),
    schema: TrackedRowSchema,
    shape: 'rows',
  },
];
