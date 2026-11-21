// The bug report store's read (./store.ts), for `pnpm schemas:verify` (PRD 1030): a row of `omni_bug_reports` with the columns
// it selects, parsed with the schema the store parses it with. Its insert and its count write, and are not run here.
import type { Boundary } from '../boundary.ts';
import { REPORT_COLUMNS, ReportRowSchema, TEAM_COLUMNS, TeamRowSchema } from './store.ts';

export const boundaries: Boundary[] = [
  {
    name: 'bug-reports/store: omni_bug_reports',
    read: (db) => db.from('omni_bug_reports').select(REPORT_COLUMNS).limit(5),
    schema: ReportRowSchema,
    shape: 'rows',
  },
  {
    name: 'bug-reports/store: omni_bug_reports, the bug team\'s columns',
    read: (db) => db.from('omni_bug_reports').select(TEAM_COLUMNS).limit(5),
    schema: TeamRowSchema,
    shape: 'rows',
  },
];
