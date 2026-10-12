// The service role's database, as the server event's readers take it (PRD 1548 s4 and s8): the targets
// of a product PRD (./targets.ts) and its outbox rows (../outbox-check/product-outbox.ts). The App has no
// person's session, so it reads as the service role (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`), and
// parses every answer where it comes in.
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import type { Database } from '../../../../supabase/database.types.ts';
import type { Connection } from '../approved-check/record.ts';

type Answer = { data: unknown; error: { message: string; code?: string } | null };

/** The database as the service role on `connection`, keeping no session. */
export function serviceDb({ url, key, fetch }: Connection) {
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    ...(fetch ? { global: { fetch } } : {}),
  });
}

/** An answer's rows through `schema`, or the refusal thrown. */
export function rowsOf<T>(schema: z.ZodType<T>, answer: Answer): T[] {
  if (answer.error) throw new Error(`the database refused: ${answer.error.message}${answer.error.code ? ` (${answer.error.code})` : ''}`);
  return z.array(schema).parse(answer.data ?? []);
}
