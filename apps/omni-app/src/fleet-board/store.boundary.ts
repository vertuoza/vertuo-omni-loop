// The fleet board store's reads (./store.ts), for `pnpm schemas:verify` (PRD 1030): the tracking
// workspaces, a player's fleet and a fleet's board, parsed with the schemas the store parses them with.
// Its note is not here: it writes, and the check only reads.
import type { Boundary } from '../boundary.ts';
import { JOB, JobRowSchema, PLAYER, PlayerRowSchema, TEAM, TeamRowSchema, TRACKED, TrackedRowSchema } from './store.ts';

export const boundaries: Boundary[] = [
  {
    name: 'fleet-board/store: repositories',
    read: (db) => db.from('repositories').select(TRACKED).eq('tracked', true).is('removed_at', null).limit(5),
    schema: TrackedRowSchema,
    shape: 'rows',
  },
  {
    name: 'fleet-board/store: players',
    read: (db) => db.from('players').select(PLAYER).not('team', 'is', null).limit(5),
    schema: PlayerRowSchema,
    shape: 'rows',
  },
  {
    name: 'fleet-board/store: runner jobs',
    read: (db) => db.from('runner_jobs').select(JOB).limit(5),
    schema: JobRowSchema,
    shape: 'rows',
  },
  {
    name: 'fleet-board/store: teams',
    read: (db) => db.from('teams').select(TEAM).is('retired_at', null).limit(5),
    schema: TeamRowSchema,
    shape: 'rows',
  },
];
