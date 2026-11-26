// The `runner-jobs-expire` job's database (PRD omni-loop-35 s3), as the service role (`SUPABASE_URL`,
// `SUPABASE_SERVICE_ROLE_KEY`): the App has no person's session. One call, `runner_jobs_expire(p_now)`
// (supabase/migrations/20270129200000_runner_jobs_expire.sql), which does the whole sweep in one transaction, is safe
// to run twice, and only the service role may call. It answers four counts, parsed here; nothing else is read.
// Throws when the database refuses or answers out of shape: the job's run fails, and its next try runs again.
import { z } from 'zod';
import type { Connection } from '../../approved-check/record.ts';
import { serviceDb } from '../../server-event/service-db.ts';

/** What one sweep did: queued jobs ended failed, waiting jobs expired, rounds closed, per-job findings grouped. */
export type ExpireCounts = { failed: number; expired: number; questions: number; grouped: number };

const ExpireCountsSchema = z.object({
  failed: z.number().int().nonnegative(),
  expired: z.number().int().nonnegative(),
  questions: z.number().int().nonnegative(),
  grouped: z.number().int().nonnegative(),
});

export type ExpireStore = { expire: (now: Date) => Promise<ExpireCounts> };

/** The store, as the service role on `connection`. */
export function expireStore(connection: Connection): ExpireStore {
  const db = serviceDb(connection);
  return {
    expire: async (now) => {
      const { data, error } = await db.rpc('runner_jobs_expire', { p_now: now.toISOString() });
      if (error) throw new Error(`the database refused: ${error.message}${error.code ? ` (${error.code})` : ''}`);
      return ExpireCountsSchema.parse(data);
    },
  };
}
