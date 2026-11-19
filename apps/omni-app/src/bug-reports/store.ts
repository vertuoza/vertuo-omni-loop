// `omni_bug_reports` as the App reads and writes it (PRD 2980 s4), as the service role: nobody signed in reads or writes it
// (supabase/migrations/20270125140000_mission_repairs.sql). Every answer is parsed where it comes in.
import { IssueNumberSchema, PrNumberSchema } from 'omni-loop/kit/lib/ids.ts';
import { z } from 'zod';
import type { Connection } from '../approved-check/record.ts';
import { rowsOf, serviceDb } from '../server-event/service-db.ts';
import type { BugReportStore } from './file.ts';
import { BUG_STATES, type BugPatch, type BugState, type BugTeamStore, type TeamBug } from './follow.ts';

export const REPORT_COLUMNS = 'fingerprint, repo, issue, count';

/** A row of `omni_bug_reports`. */
export const ReportRowSchema = z.object({
  fingerprint: z.string().regex(/^[0-9a-f]{64}$/),
  repo: z.string().min(1),
  issue: IssueNumberSchema,
  count: z.number().int().positive(),
});

/** The columns the bug team's following reads. */
export const TEAM_COLUMNS = 'fingerprint, repo, issue, state, fix_pr, fixed_in';

/** A row of `omni_bug_reports` as the following reads it. */
export const TeamRowSchema = z.object({
  fingerprint: z.string().regex(/^[0-9a-f]{64}$/),
  repo: z.string().min(1),
  issue: IssueNumberSchema,
  state: z.enum(BUG_STATES),
  fix_pr: PrNumberSchema.nullable(),
  fixed_in: z.string().nullable(),
});

const teamBug = (row: z.infer<typeof TeamRowSchema>): TeamBug => ({
  fingerprint: row.fingerprint,
  repo: row.repo,
  issue: row.issue,
  state: row.state,
  fixPr: row.fix_pr,
  fixedIn: row.fixed_in,
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

/** The bug team's following of `omni_bug_reports`, on the service role of `connection`. */
export function bugTeamStore(connection: Connection): BugTeamStore {
  const db = serviceDb(connection);
  const one = async (query: PromiseLike<Parameters<typeof rowsOf>[1]>) => rowsOf(TeamRowSchema, await query).map(teamBug)[0] ?? null;
  return {
    byIssue: (repo, issue) => one(db.from('omni_bug_reports').select(TEAM_COLUMNS).eq('repo', repo).eq('issue', issue)),
    byFixPr: (repo, pr) => one(db.from('omni_bug_reports').select(TEAM_COLUMNS).eq('repo', repo).eq('fix_pr', pr)),
    inStates: async (states: readonly BugState[]) => rowsOf(TeamRowSchema, await db.from('omni_bug_reports').select(TEAM_COLUMNS).in('state', [...states])).map(teamBug),
    move: async (bug, patch: BugPatch) => {
      const set = {
        state: patch.state,
        ...(patch.fixPr === undefined ? {} : { fix_pr: patch.fixPr }),
        ...(patch.fixedIn === undefined ? {} : { fixed_in: patch.fixedIn }),
      };
      const { data, error } = await db.from('omni_bug_reports').update(set).eq('fingerprint', bug.fingerprint).eq('state', bug.state).select('fingerprint');
      if (error) throw new Error(`the database refused: ${error.message}${error.code ? ` (${error.code})` : ''}`);
      return Array.isArray(data) && data.length > 0;
    },
  };
}
