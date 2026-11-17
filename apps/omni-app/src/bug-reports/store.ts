// `omni_bug_reports` as the App reads and writes it (PRD 2980 s4), as the service role: nobody signed in reads or writes it
// (supabase/migrations/20270125140000_mission_repairs.sql). Every answer is parsed where it comes in.
import { z } from 'zod';
import type { Connection } from '../approved-check/record.ts';
import { rowsOf, serviceDb } from '../server-event/service-db.ts';
import type { BugReportStore } from './file.ts';

export const REPORT_COLUMNS = 'fingerprint, repo, issue, count';

/** A row of `omni_bug_reports`. */
export const ReportRowSchema = z.object({
  fingerprint: z.string().regex(/^[0-9a-f]{64}$/),
  repo: z.string().min(1),
  issue: z.number().int().positive(),
  count: z.number().int().positive(),
});

/** The database's unique violation: the fingerprint already has its row. */
const UNIQUE_VIOLATION = '23505';

/** The store of the Omni Loop bug reports, on the service role of `connection`. */
export function bugReportStore(connection: Connection): BugReportStore {
  const db = serviceDb(connection);
  return {
    find: async (fingerprint) => rowsOf(ReportRowSchema, await db.from('omni_bug_reports').select(REPORT_COLUMNS).eq('fingerprint', fingerprint))[0] ?? null,

    record: async (row) => {
      const { error } = await db.from('omni_bug_reports').insert(row);
      if (error?.code === UNIQUE_VIOLATION) return false;
      if (error) throw new Error(`the database refused: ${error.message}${error.code ? ` (${error.code})` : ''}`);
      return true;
    },

    seen: async (fingerprint) => rowsOf(ReportRowSchema, await db.rpc('omni_bug_report_seen', { p_fingerprint: fingerprint }))[0] ?? null,
  };
}
