// The job ledger's one read (./ledger.ts), for `pnpm schemas:verify` (PRD 1030): background_jobs_health(),
// called as a GET, parsed with the schema the ledger parses it with. Its other calls write, and are not run here.
import type { Boundary } from '../boundary.ts';
import { HealthSchema } from './ledger.ts';

export const boundaries: Boundary[] = [
  {
    name: 'jobs/ledger: background_jobs_health()',
    read: (db) => db.rpc('background_jobs_health', undefined, { get: true }),
    schema: HealthSchema,
    shape: 'row',
  },
];
