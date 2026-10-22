// The milestone store's reads (PRD 2370, s1), registered for `pnpm schemas:verify` (scripts/schemas-verify.ts):
// each of its selects, every PRD's rows, parsed with the schema the store parses them with.
import type { Boundary } from '../data/parse-rows';
import { milestoneRows, StoredMilestone, StoredWorkspaceMilestone, workspaceMilestoneRows } from './store.repository';

export const boundaries: Boundary[] = [
  { name: 'timeline/store: prd_milestones', read: (db) => milestoneRows(db), schema: StoredMilestone, shape: 'rows' },
  { name: 'timeline/store: prd_milestones of a workspace', read: (db) => workspaceMilestoneRows(db), schema: StoredWorkspaceMilestone, shape: 'rows' },
];
