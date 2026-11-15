// The ready check store's reads (./store.ts), for `pnpm schemas:verify` (PRD 1030): the installation's
// workspace, a live mission's scope and a roadmap's row of a PRD, each parsed with the schema the store parses
// it with. Its save is not here: it writes, and the check only reads.
import type { Boundary } from '../boundary.ts';
import { IdRowSchema } from '../retro/runner-queue.ts';
import { LIVE_MISSIONS, MissionScopeRowSchema, RoadmapRowOfSchema } from './store.ts';

export const boundaries: Boundary[] = [
  {
    name: 'ready-check/store: missions',
    read: (db) => db.from('missions').select('scope').in('status', [...LIVE_MISSIONS]).limit(5),
    schema: MissionScopeRowSchema,
    shape: 'rows',
  },
  {
    name: 'ready-check/store: roadmaps',
    read: (db) => db.from('roadmaps').select('id').limit(1),
    schema: IdRowSchema,
    shape: 'rows',
  },
  {
    name: 'ready-check/store: roadmap_prds',
    read: (db) => db.from('roadmap_prds').select('roadmap_id').limit(1),
    schema: RoadmapRowOfSchema,
    shape: 'rows',
  },
  {
    name: 'ready-check/store: ready_verdicts',
    read: (db) => db.from('ready_verdicts').select('id').limit(1),
    schema: IdRowSchema,
    shape: 'rows',
  },
];
