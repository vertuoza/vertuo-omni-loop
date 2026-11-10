// The retro runner queue's reads (./runner-queue.ts), for `pnpm schemas:verify` (PRD 1030): the
// installation's workspace, a repository's removal and a job already queued, parsed with the schema
// the queue parses them with. Its insert is not here: it writes, and the check only reads.
import type { Boundary } from '../boundary.ts';
import { IdRowSchema, RemovedRowSchema } from './runner-queue.ts';

export const boundaries: Boundary[] = [
  {
    name: 'retro/runner-queue: workspaces',
    read: (db) => db.from('workspaces').select('id').not('github_installation_id', 'is', null).limit(1),
    schema: IdRowSchema,
    shape: 'rows',
  },
  {
    name: 'retro/runner-queue: repositories',
    read: (db) => db.from('repositories').select('removed_at').limit(1),
    schema: RemovedRowSchema,
    shape: 'rows',
  },
  {
    name: 'retro/runner-queue: runner_jobs',
    read: (db) => db.from('runner_jobs').select('id').order('queued_at').limit(1),
    schema: IdRowSchema,
    shape: 'rows',
  },
];
