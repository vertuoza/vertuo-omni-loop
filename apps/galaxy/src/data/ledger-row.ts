// A stored ledger row as the galaxy reads it (PRD 1030): its columns and the schema they parse with.
// Apart from load-galaxy.ts, which is the server's alone (Next's cache), so `pnpm schemas:verify`
// (data.boundary.ts) can load it outside Next.js.
import { z } from 'zod';

/** The columns a page of the ledger reads. */
export const LEDGER_COLUMNS = 'id, at, type, planet, home, region, contributor, team, data';

/** A stored ledger row as LEDGER_COLUMNS reads it: the event the ledger projection wrote. */
export const LedgerRow = z.strictObject({
  id: z.string(),
  at: z.string(),
  type: z.string(),
  planet: z.number(),
  home: z.string().nullable(),
  region: z.string().nullable(),
  contributor: z.string().nullable(),
  team: z.string().nullable(),
  data: z.record(z.string(), z.unknown()).nullable(),
});
export type LedgerRow = z.infer<typeof LedgerRow>;
