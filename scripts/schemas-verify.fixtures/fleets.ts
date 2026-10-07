// A fixture of `pnpm schemas:verify` (scripts/schemas-verify.test.ts): boundaries whose schemas match
// the database, laid out as a module's `*.boundary.ts` lays them out. Named otherwise, so the script
// never finds it on its own; it runs only when named (`pnpm schemas:verify --local <this file>`).
// It reads the fleets the demo seed makes, and the Jev calls it leaves empty.
import { z } from 'zod';
import type { Boundary } from '../../apps/galaxy/src/data/parse-rows.ts';

const Fleet = z.strictObject({ name: z.string(), label: z.string(), sort: z.number(), retired_at: z.string().nullable() });
const Call = z.strictObject({ id: z.number(), outcome: z.string() });

export const boundaries: Boundary[] = [
  { name: 'fixtures/fleets: teams', read: (db) => db.from('teams').select('name, label, sort, retired_at'), schema: Fleet, shape: 'rows' },
  { name: 'fixtures/fleets: jev_calls', read: (db) => db.from('jev_calls').select('id, outcome'), schema: Call, shape: 'rows' },
];
