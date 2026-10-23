import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import type { Database } from '../../../../supabase/database.types.ts';
import { orThrow, parseRows } from '../data/parse-rows';
import { settle } from '../stages/store';
import type { RewindFinding } from 'omni-loop/kit/lib/rewind/findings.ts';
import type { PrdNumber } from 'omni-loop/kit/lib/ids.ts';
import { FindingStateSchema, type FindingView } from './rewind.contract';

// The rewind's storage (PRD 2410, s5; ADR-0095): public.rewind_findings and the watch that says whose a
// PRD is (supabase/migrations/20261228090000_main_watch.sql). Reads run on the caller's client, as the
// signed-in member, so row-level security keeps each workspace's rows to its members; the Omni service
// role alone inserts a finding, and only the columns the rewind writes: a finding is proposed, never
// decided here (a decision is rewind_finding_approve()/reject(), s7). It holds no rule. A refusal throws
// with Supabase's reason; the unique key of a finding (its check, origin and evidence) is `duplicate`.

type Db = Pick<SupabaseClient<Database>, 'from'>;

const FINDING_COLUMNS = 'id, check_name, origin, happened, evidence, fix, state, reason';

/** A finding as FINDING_COLUMNS reads it. */
export const StoredFinding = z.strictObject({
  id: z.string(), check_name: z.string(), origin: z.string(), happened: z.string(), evidence: z.array(z.string()), fix: z.string(), state: z.string(), reason: z.string().nullable(),
});

/** The select as the repository makes it, before its filters; registered for `pnpm schemas:verify`. */
export const findingRows = (db: Db) => db.from('rewind_findings').select(FINDING_COLUMNS);

/** What says whose a PRD's watch is. */
export const StoredWatchWorkspace = z.strictObject({ workspace_id: z.string() });
/** The select that says whose a PRD's watch is; registered for `pnpm schemas:verify`. */
export const watchWorkspaceRows = (db: Db) => db.from('prd_main_watch').select('workspace_id');

const lower = (repository: string) => repository.toLowerCase();

function viewOf(row: z.infer<typeof StoredFinding>): FindingView[] {
  const state = FindingStateSchema.safeParse(row.state);
  return state.success
    ? [{ id: row.id, check: row.check_name, origin: row.origin, happened: row.happened, evidence: row.evidence, fix: row.fix, state: state.data, reason: row.reason }]
    : [];
}

/** A PRD's findings, the oldest first, as the member reads them; one whose state this build does not know is left out. */
export async function findingsOf(db: Db, { workspace_id, repository, prd }: { workspace_id: string; repository: string; prd: PrdNumber }): Promise<FindingView[]> {
  const { data, error } = await findingRows(db).eq('workspace_id', workspace_id).eq('repository', lower(repository)).eq('prd', prd).order('proposed_at');
  settle(`read the rewind findings of PRD ${prd}`, error);
  return orThrow(parseRows(StoredFinding, data, 'rewind/repository: rewind_findings')).flatMap(viewOf);
}

export type InsertService = () => Db;

export function rewindRepository(caller: Db, service: InsertService) {
  return {
    /** The workspace that holds the PRD's watch in `repository`, as the caller reads it; null when they see none. */
    async workspaceOf(repository: string, prd: PrdNumber): Promise<string | null> {
      const { data, error } = await watchWorkspaceRows(caller).eq('repository', lower(repository)).eq('prd', prd);
      settle(`read the watch of PRD ${prd}`, error);
      return orThrow(parseRows(StoredWatchWorkspace, data, 'rewind/repository: prd_main_watch'))[0]?.workspace_id ?? null;
    },

    findings: (workspace_id: string, repository: string, prd: PrdNumber) => findingsOf(caller, { workspace_id, repository, prd }),

    /** Proposes `findings` as the service role; `duplicate` when one of them is already there. */
    async insert(workspace_id: string, repository: string, prd: PrdNumber, findings: readonly RewindFinding[]): Promise<'ok' | 'duplicate'> {
      const rows = findings.map((f) => ({
        workspace_id, repository: lower(repository), prd, check_name: f.check, origin: f.origin, happened: f.happened, evidence: f.evidence, fix: f.fix,
      }));
      const { error } = await service().from('rewind_findings').insert(rows);
      if (error?.code === '23505') return 'duplicate';
      settle(`propose ${rows.length} rewind finding(s) of PRD ${prd}`, error);
      return 'ok';
    },
  };
}

