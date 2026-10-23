import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import type { Database } from '../../../../supabase/database.types.ts';
import { orThrow, parseRows } from '../data/parse-rows';
import { settle } from '../stages/store';
import type { RewindFinding } from 'omni-loop/kit/lib/rewind/findings.ts';
import { PrdNumberSchema, type PrdNumber } from 'omni-loop/kit/lib/ids.ts';
import type { KnowledgeProposal } from './rewind.approval';
import { FindingStateSchema, type DecidableFinding, type DecisionRefusal, type FindingView } from './rewind.contract';

// The rewind's storage (PRD 2410, s5; ADR-0095): public.rewind_findings and the watch that says whose a
// PRD is (supabase/migrations/20261228090000_main_watch.sql). Reads run on the caller's client, as the
// signed-in member, so row-level security keeps each workspace's rows to its members; the Omni service
// role alone inserts a finding, and only the columns the rewind writes: a finding is proposed, never
// decided here (a decision is rewind_finding_approve()/reject(), s7). It holds no rule. A refusal throws
// with Supabase's reason; the unique key of a finding (its check, origin and evidence) is `duplicate`.

type Db = Pick<SupabaseClient<Database>, 'from'>;

const FINDING_COLUMNS = 'id, check_name, origin, happened, evidence, fix, state, reason, decided_by, decided_at';

/** A finding as FINDING_COLUMNS reads it. */
export const StoredFinding = z.strictObject({
  id: z.string(), check_name: z.string(), origin: z.string(), happened: z.string(), evidence: z.array(z.string()), fix: z.string(), state: z.string(), reason: z.string().nullable(),
  decided_by: z.string().nullable(), decided_at: z.string().nullable(),
});

/** Who decided a finding, as the workspace's players name them (PRD 2410, s7). */
export const StoredDecider = z.strictObject({ user_id: z.string(), github_login: z.string().nullable() });
/** The select that names the deciders; registered for `pnpm schemas:verify`. */
export const deciderRows = (db: Db) => db.from('players').select('user_id, github_login');

/** A finding a member may decide, as `DECIDABLE_COLUMNS` reads it: whose it is, and the card. */
export const StoredDecidable = StoredFinding.extend({ workspace_id: z.string(), repository: z.string(), prd: PrdNumberSchema });
/** The select of one finding to decide; registered for `pnpm schemas:verify`. */
export const decidableRows = (db: Db) => db.from('rewind_findings').select(`workspace_id, repository, prd, ${FINDING_COLUMNS}`);

/** The select as the repository makes it, before its filters; registered for `pnpm schemas:verify`. */
export const findingRows = (db: Db) => db.from('rewind_findings').select(FINDING_COLUMNS);

/** What says whose a PRD's watch is. */
export const StoredWatchWorkspace = z.strictObject({ workspace_id: z.string() });
/** The select that says whose a PRD's watch is; registered for `pnpm schemas:verify`. */
export const watchWorkspaceRows = (db: Db) => db.from('prd_main_watch').select('workspace_id');

const lower = (repository: string) => repository.toLowerCase();

function viewOf(row: z.infer<typeof StoredFinding>, logins: ReadonlyMap<string, string>): FindingView[] {
  const state = FindingStateSchema.safeParse(row.state);
  return state.success
    ? [{
      id: row.id, check: row.check_name, origin: row.origin, happened: row.happened, evidence: row.evidence, fix: row.fix, state: state.data, reason: row.reason,
      decidedBy: row.decided_by === null ? null : logins.get(row.decided_by) ?? null, decidedAt: row.decided_at,
    }]
    : [];
}

/** The GitHub logins of the members who decided `rows`, by their id, as the workspace's players name them. */
async function decidersOf(db: Db, workspace_id: string, rows: readonly z.infer<typeof StoredFinding>[]): Promise<Map<string, string>> {
  const ids = [...new Set(rows.flatMap((row) => (row.decided_by === null ? [] : [row.decided_by])))];
  if (ids.length === 0) return new Map();
  const { data, error } = await deciderRows(db).eq('workspace_id', workspace_id).in('user_id', ids);
  settle('read who decided the rewind findings', error);
  return new Map(orThrow(parseRows(StoredDecider, data, 'rewind/repository: players')).flatMap((p) => (p.github_login ? [[p.user_id, p.github_login] as const] : [])));
}

/** A PRD's findings, the oldest first, as the member reads them; one whose state this build does not know is left out. */
export async function findingsOf(db: Db, { workspace_id, repository, prd }: { workspace_id: string; repository: string; prd: PrdNumber }): Promise<FindingView[]> {
  const { data, error } = await findingRows(db).eq('workspace_id', workspace_id).eq('repository', lower(repository)).eq('prd', prd).order('proposed_at');
  settle(`read the rewind findings of PRD ${prd}`, error);
  const rows = orThrow(parseRows(StoredFinding, data, 'rewind/repository: rewind_findings'));
  const logins = await decidersOf(db, workspace_id, rows);
  return rows.flatMap((row) => viewOf(row, logins));
}

/** What the decision reads and writes on: the tables and the database's functions. */
type DecisionDb = Pick<SupabaseClient<Database>, 'from' | 'rpc'>;

/** A refusal of rewind_finding_approve()/reject(), by the code the database raised; null when it is another failure. */
function decisionRefusalOf(error: { code?: string; message: string }): DecisionRefusal | null {
  if (error.code === 'P0002') return 'missing';
  if (error.code === '42501') return error.message.startsWith('Finding:') ? 'decided' : 'not-member';
  return null;
}

const KnowledgeProduct = z.object({ id: z.string() });

/** The decision's storage (PRD 2410, s7), on the member's own client: the finding as they read it, the
 * decision through rewind_finding_approve()/reject(), and a product knowledge proposal through
 * knowledge_product_for_repo() and product_knowledge_propose(), so the database checks who may do each. A
 * refusal the member can act on is answered; any other failure throws, naming the call. */
export function decisionRepository(db: DecisionDb) {
  return {
    /** The finding, as the member reads it; null when they read none. */
    async finding(id: string): Promise<DecidableFinding | null> {
      const { data, error } = await decidableRows(db).eq('id', id);
      settle('read the rewind finding', error);
      const row = orThrow(parseRows(StoredDecidable, data, 'rewind/repository: rewind_findings to decide'))[0];
      if (!row) return null;
      const [view] = viewOf(row, await decidersOf(db, row.workspace_id, [row]));
      return view ? { ...view, workspace: row.workspace_id, repository: row.repository, prd: row.prd } : null;
    },

    /** Approves the finding as the member; why the database refused, or null. */
    async approve(workspace: string, id: string): Promise<DecisionRefusal | null> {
      const { error } = await db.rpc('rewind_finding_approve', { p_workspace: workspace, p_finding: id });
      if (!error) return null;
      const refusal = decisionRefusalOf(error);
      if (refusal) return refusal;
      throw new Error(`Supabase refused to approve the rewind finding: ${error.message}`);
    },

    /** Rejects the finding as the member, with its reason; why the database refused, or null. */
    async reject(workspace: string, id: string, reason: string | null): Promise<DecisionRefusal | null> {
      const { error } = await db.rpc('rewind_finding_reject', { p_workspace: workspace, p_finding: id, ...(reason === null ? {} : { p_reason: reason }) });
      if (!error) return null;
      const refusal = decisionRefusalOf(error);
      if (refusal) return refusal;
      throw new Error(`Supabase refused to reject the rewind finding: ${error.message}`);
    },

    /** Files `plan` as the member's proposal on the repository's product: the product's id, or the database's words. */
    async propose(repository: string, workspace: string, plan: KnowledgeProposal): Promise<{ ok: true; product: string } | { ok: false; error: string }> {
      const found = await db.rpc('knowledge_product_for_repo', { p_repo: lower(repository) });
      if (found.error) return { ok: false, error: found.error.message };
      const product = KnowledgeProduct.safeParse(found.data);
      if (!product.success) throw new Error('knowledge_product_for_repo() answered out of shape');
      const { error } = await db.rpc('product_knowledge_propose', {
        p_workspace: workspace, p_product: product.data.id, p_kind: plan.knowledge, p_action: 'add', p_fields: plan.fields,
      });
      return error ? { ok: false, error: error.message } : { ok: true, product: product.data.id };
    },
  };
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

