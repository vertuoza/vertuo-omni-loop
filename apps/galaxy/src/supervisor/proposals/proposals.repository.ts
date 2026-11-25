import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

// The storage of an owner's press and dismissal (PRD omni-loop-34 s7; ADR-0095), over
// supabase/migrations/20270129160000_supervisor.sql. Two sides:
//
// - `proposalsRepository(db)`, on the service role's client: the suggestion pressed, the job, mission or runner it names
//   (in the workspace only, BR-PRODUCT-63), whether a lost job's automatic resume exists (BR-PRODUCT-136), the press's
//   result row, the finding closed, the result posted in the finding's thread, and an Omni Loop bug report queued on the
//   App's ledger (the `bug-report` kind of apps/omni-app/src/bug-reports/job.ts, whose handler files it through
//   apps/omni-app/src/bug-reports/file.ts).
// - `proposalActsRepository(db)`, on the signed-in person's client: the owner-checked functions
//   supervisor_proposal_approve() and supervisor_finding_dismiss(), which refuse anyone but an owner (42501) and a value
//   they do not take (22023), in their words.
//
// It holds no rule. A refusal of the database, or an answer out of shape, throws, naming the call.

export type ProposalsDb = Pick<SupabaseClient, 'from' | 'rpc'>;
export type ProposalActsDb = Pick<SupabaseClient, 'rpc'>;

type Raw = { data: unknown; error: { code?: string; message?: string } | null };

/** The answer of one call, parsed by `schema`; a refusal of the database, or a shape it does not expect, is thrown naming `what`. */
async function parsed<T>(call: PromiseLike<Raw>, schema: z.ZodType<T>, what: string): Promise<T> {
  const answer = await call;
  const shaped = answer.error === null ? schema.safeParse(answer.data) : null;
  if (shaped?.success) return shaped.data;
  const why = answer.error === null ? 'answered out of shape' : `refused: ${answer.error.message ?? answer.error.code ?? 'no reason given'}`;
  throw new Error(`proposals ${what} ${why}`);
}

const PressRow = z.object({
  id: z.string(), workspace_id: z.string(), finding_id: z.string(), kind: z.enum(['suggestion', 'press', 'result', 'dismiss']),
  action: z.string().nullable(), label: z.string().nullable(), target: z.record(z.string(), z.unknown()).nullable(),
  reply_to: z.string().nullable(), author_login: z.string().nullable(), outcome: z.enum(['done', 'refused', 'failed']).nullable(),
  note: z.string().nullable(), created_at: z.string(),
});
export type PressRow = z.infer<typeof PressRow>;
const PROPOSAL = 'id, workspace_id, finding_id, kind, action, label, target, reply_to, author_login, outcome, note, created_at';

const FindingState = z.enum(['open', 'acted', 'dismissed', 'resolved']);
type FindingState = z.infer<typeof FindingState>;

const JobRow = z.object({
  id: z.string(), line: z.string(), repo: z.string(), status: z.string(), cancel_requested: z.boolean(),
  to_runner: z.string().nullable(), to_fleet: z.string().nullable(),
});
export type JobRow = z.infer<typeof JobRow>;

/** A job on the App's ledger, in apps/omni-app/src/jobs/ledger.ts's shape. */
export type LedgerJob = { kind: string; key: string; subject: string; payload: Record<string, unknown>; lane: string };

export function proposalsRepository(db: ProposalsDb) {
  return {
    /** The member's role in the workspace, or null. */
    role: async (workspace: string, user: string): Promise<string | null> =>
      (await parsed(db.from('workspace_members').select('role').eq('workspace_id', workspace).eq('user_id', user).maybeSingle(), z.object({ role: z.string() }).nullable(), 'workspace_members'))?.role ?? null,
    proposal: async (workspace: string, id: string): Promise<PressRow | null> =>
      parsed(db.from('supervisor_proposals').select(PROPOSAL).eq('workspace_id', workspace).eq('id', id).maybeSingle(), PressRow.nullable(), 'supervisor_proposals'),
    /** The row answering `id`: a suggestion's press, a press's result. */
    replyOf: async (id: string): Promise<PressRow | null> =>
      parsed(db.from('supervisor_proposals').select(PROPOSAL).eq('reply_to', id).maybeSingle(), PressRow.nullable(), 'supervisor_proposals'),
    findingState: async (workspace: string, id: string): Promise<FindingState | null> =>
      (await parsed(db.from('supervisor_findings').select('state').eq('workspace_id', workspace).eq('id', id).maybeSingle(), z.object({ state: FindingState }).nullable(), 'supervisor_findings'))?.state ?? null,
    job: async (workspace: string, id: string): Promise<JobRow | null> =>
      parsed(db.from('runner_jobs').select('id, line, repo, status, cancel_requested, to_runner, to_fleet').eq('workspace_id', workspace).eq('id', id).maybeSingle(), JobRow.nullable(), 'runner_jobs'),
    /** The automatic resume of a lost job (PRD 2809), whatever its state, or null. */
    resumeOf: async (job: string): Promise<string | null> =>
      (await parsed(db.from('runner_jobs').select('id').eq('resumes', job).limit(1).maybeSingle(), z.object({ id: z.string() }).nullable(), 'runner_jobs'))?.id ?? null,
    missionIn: async (workspace: string, id: string): Promise<boolean> =>
      (await parsed(db.from('missions').select('id').eq('workspace_id', workspace).eq('id', id).maybeSingle(), z.object({ id: z.string() }).nullable(), 'missions')) !== null,
    runnerName: async (workspace: string, id: string): Promise<string | null> =>
      (await parsed(db.from('runners').select('name').eq('workspace_id', workspace).eq('id', id).maybeSingle(), z.object({ name: z.string() }).nullable(), 'runners'))?.name ?? null,
    insertResult: async (row: { workspace_id: string; finding_id: string; reply_to: string; outcome: 'done' | 'refused' | 'failed'; note: string }): Promise<PressRow> =>
      parsed(db.from('supervisor_proposals').insert({ ...row, kind: 'result' }).select(PROPOSAL).single(), PressRow, 'supervisor_proposals'),
    /** Closes an open finding; a closed one stays as it is. */
    close: async (id: string, state: 'acted' | 'resolved', at: string): Promise<void> => {
      await parsed(db.from('supervisor_findings').update({ state, closed_at: at }).eq('id', id).eq('state', 'open'), z.unknown(), 'supervisor_findings');
    },
    postResult: async (row: { workspace_id: string; finding_id: string; body: string }): Promise<void> => {
      await parsed(db.from('supervisor_messages').insert({ ...row, kind: 'result' }), z.unknown(), 'supervisor_messages');
    },
    /** Adds a job to the App's ledger once by its key: whether it was added. */
    addLedgerJob: async (job: LedgerJob): Promise<boolean> =>
      parsed(db.rpc('background_job_add', { p_kind: job.kind, p_key: job.key, p_subject: job.subject, p_payload: job.payload, p_lane: job.lane }), z.boolean(), 'background_job_add()'),
  };
}

export type ProposalsStore = ReturnType<typeof proposalsRepository>;

/** An owner's act: its row, or the database's refusal (`forbidden`: not an owner; `refused`: a value it refused). */
export type PressActed = { ok: true; value: PressRow } | { ok: false; refusal: 'forbidden' | 'refused'; error: string };

const REFUSALS: Record<string, 'forbidden' | 'refused'> = { '42501': 'forbidden', '22023': 'refused' };

/** An owner's act as the function answered it: its refusal by code, else its one row (PostgREST may answer a list of one). */
async function acted(call: PromiseLike<Raw>, what: string): Promise<PressActed> {
  const answer = await call;
  const code = answer.error?.code;
  const refusal = code === undefined ? undefined : REFUSALS[code];
  if (refusal !== undefined) return { ok: false, refusal, error: answer.error?.message ?? 'The database refused this act.' };
  const one: unknown = Array.isArray(answer.data) ? answer.data.at(0) : answer.data;
  return { ok: true, value: await parsed(Promise.resolve({ data: one, error: answer.error }), PressRow, what) };
}

/** An owner's press and dismissal, as that owner: the database checks is_owner() in each function. */
export function proposalActsRepository(db: ProposalActsDb) {
  return {
    approve: (proposal: string) => acted(db.rpc('supervisor_proposal_approve', { p_proposal: proposal }), 'supervisor_proposal_approve()'),
    dismiss: (finding: string, reason: string | null) => acted(db.rpc('supervisor_finding_dismiss', { p_finding: finding, p_reason: reason }), 'supervisor_finding_dismiss()'),
  };
}

export type ProposalActs = ReturnType<typeof proposalActsRepository>;
