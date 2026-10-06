// A fixture of `pnpm schemas:verify` (scripts/schemas-verify.test.ts): boundaries that no longer match
// the database, as a module's would after a column changed type or went away. Named otherwise, so the
// script never finds it on its own; it runs only when named.
import { z } from 'zod';
import type { Boundary } from '../../apps/galaxy/src/data/parse-rows.ts';

// `sort` is a number in the database: a schema that says text fails on every row.
const Fleet = z.strictObject({ name: z.string(), sort: z.string() });

export const boundaries: Boundary[] = [
  { name: 'fixtures/fleets-drifted: teams', read: (db) => db.from('teams').select('name, sort'), schema: Fleet, shape: 'rows' },
  { name: 'fixtures/fleets-drifted: the oldest fleet', read: (db) => db.from('teams').select('name, sort').order('sort').limit(1).maybeSingle(), schema: Fleet, shape: 'row' },
];
