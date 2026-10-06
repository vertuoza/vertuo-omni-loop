// One read the App makes from Supabase, registered for `pnpm schemas:verify` (PRD 1030,
// scripts/schemas-verify.ts), which runs it against a real database and parses its answer with the
// schema the module parses it with. The App keeps its own copy of the shape the script loads (the
// arcade's `Boundary`, apps/galaxy/src/data/parse-rows.ts), so it imports nothing from the arcade.
//
// A module lists its reads in a file beside it named `*.boundary.ts`, exporting them as
// `boundaries`. `read` only reads: the script refuses any request but a GET, so a database function
// is called with `{ get: true }`. `shape` is `'rows'` for a list parsed row by row, `'row'` for one
// value.
import type { SupabaseClient } from '@supabase/supabase-js';
import type { z } from 'zod';
import type { Database } from '../../../supabase/database.types.ts';

export interface Boundary {
  name: string;
  read: (db: SupabaseClient<Database>) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
  schema: z.ZodType;
  shape: 'rows' | 'row';
}
