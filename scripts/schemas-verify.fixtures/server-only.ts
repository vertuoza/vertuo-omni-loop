// A fixture of `pnpm schemas:verify` (scripts/schemas-verify.test.ts): a boundary file that loads one
// of the arcade's server-only modules, where the `server-only` package resolves to the module that
// throws outside a React server, so the script must strip the marker before it loads the file. The
// path is a value, so the root project's typecheck does not follow it into the arcade's sources.
import { z } from 'zod';
import type { Boundary } from '../../apps/galaxy/src/data/parse-rows.ts';

const LIVE = '../../apps/galaxy/src/outbox-waiting/live.ts';
const live: object = await import(LIVE);

export const boundaries: Boundary[] = [
  { name: `fixtures/server-only: ${String(Object.keys(live).length > 0)}`, read: (db) => db.from('teams').select('name'), schema: z.strictObject({ name: z.string() }), shape: 'rows' },
];
