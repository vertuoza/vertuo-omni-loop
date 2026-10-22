// The waiting list's own reads (PRD 1318, s4; ADR-0095): every query the bell sends that is not the ask
// pages', on the client it is given, as the signed-in person, so row-level security has the last word.
// The Questions part's first question of each waiting round, the New documents part's versions, the
// Business part's two counts, and the Runners part's two reads (PRD 2255). A failed read throws. No rule lives here: which rounds wait and which
// versions count is waiting.service.ts's. The client is handed in, as the ask reads are (src/ask/
// ask.repository.ts): the controller and the server's first paint pass the viewer's.
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { PrdNumberSchema, PrNumberSchema } from 'omni-loop/kit/lib/ids.ts';
import { orThrow, parseRows } from '../data/parse-rows';

/** What the waiting reads need: the tables and the database's functions. */
export type WaitingDb = Pick<SupabaseClient, 'from' | 'rpc'>;

/** What the Questions part reads of a waiting round: its questions, read by readQuestions. */
const QUESTION_COLUMNS = 'id, questions';
export const WaitingRound = z.object({ id: z.string(), questions: z.unknown() });
type WaitingRoundRow = z.infer<typeof WaitingRound>;

const DOCUMENT_COLUMNS = 'id, kind, created_at, dossier:dossiers!inner(id, prd, title, opened_by)';
/** How many of the newest versions one read takes. */
export const DOCS_LIMIT = 50;

/** A version as the read answers it, with its dossier: a row of another kind, or of an unnumbered
 * dossier, is left out by the service, not refused. */
export const DocumentRead = z.object({
  id: z.string(),
  kind: z.string(),
  created_at: z.string(),
  dossier: z.object({ id: z.string(), prd: PrdNumberSchema.nullable(), title: z.string() }).nullable(),
});
export type DocumentReadRow = z.infer<typeof DocumentRead>;

/** The newest versions of the numbered dossiers, whoever opened them, at any date: the read
 * `pnpm schemas:verify` checks (src/waiting/documents.boundary.ts). */
export const newestVersions = (db: Pick<SupabaseClient, 'from'>) =>
  db.from('dossier_versions').select(DOCUMENT_COLUMNS).not('dossier.prd', 'is', null).order('created_at', { ascending: false }).limit(DOCS_LIMIT);

const OPEN_QUESTION_COLUMNS = 'job_id';
/** A runner job's open questions, as the Runners part reads them: the job that asked (PRD 2255). */
export const OpenQuestionRead = z.object({ job_id: z.string() });

const JOB_STATE_COLUMNS = 'id, status, outcome';
/** A runner job's state, as the Runners part reads it: the service decides which ones wait (PRD 2255). */
export const JobStateRead = z.object({ id: z.string(), status: z.string(), outcome: z.string().nullable() });
type JobStateReadRow =z.infer<typeof JobStateRead>;

/** The jobs with questions nobody has closed, in every workspace the client reads: the read
 * `pnpm schemas:verify` checks (src/waiting/runners.boundary.ts). */
export const openQuestionRows = (db: Pick<SupabaseClient, 'from'>) =>
  db.from('runner_job_questions').select(OPEN_QUESTION_COLUMNS).is('closed_at', null);

/** The state of fifty runner jobs that ended with an outcome, any workspace: the read `pnpm schemas:verify`
 * checks, where the Runners part reads the jobs of one workspace among the ids it asks for. */
export const jobStateRows = (db: Pick<SupabaseClient, 'from'>) =>
  db.from('runner_jobs').select(JOB_STATE_COLUMNS).not('outcome', 'is', null).limit(50);

const REVIEW_COLUMNS = 'id, repo, prd, pr, kind, turn, since';
/** An open review, merge or law wait, as the Reviews part reads it (PRD 2377 s5): a pull request's, so `pr` is set. */
export const ReviewWaitRead = z.strictObject({
  id: z.string(),
  repo: z.string(),
  prd: PrdNumberSchema.nullable(),
  pr: PrNumberSchema,
  kind: z.enum(['review', 'merge', 'law']),
  turn: z.array(z.string()),
  since: z.string(),
});
type ReviewWaitRow = z.infer<typeof ReviewWaitRead>;

/** The open review, merge and law waits the caller reads: the read `pnpm schemas:verify` checks
 * (src/waiting/reviews.boundary.ts). */
export const openReviewWaits = (db: Pick<SupabaseClient, 'from'>) =>
  db.from('waits').select(REVIEW_COLUMNS).is('ended_at', null).in('kind', ['review', 'merge', 'law']);

export function waitingRepository(db: WaitingDb) {
  return {
    /** These rounds' questions. */
    async roundQuestions(ids: string[]): Promise<WaitingRoundRow[]> {
      const { data, error } = await db.from('ask_rounds').select(QUESTION_COLUMNS).in('id', ids);
      if (error) throw new Error(`read the questions: ${error.message}`);
      return orThrow(parseRows(WaitingRound, data, 'waiting/source: ask_rounds'));
    },

    /** The versions pushed after `since` to the numbered dossiers `me` opened, the 50 newest. */
    async documents(me: string, since: string): Promise<DocumentReadRow[]> {
      const { data, error } = await db.from('dossier_versions')
        .select(DOCUMENT_COLUMNS)
        .eq('dossier.opened_by', me)
        .not('dossier.prd', 'is', null)
        .gt('created_at', since)
        .order('created_at', { ascending: false })
        .limit(DOCS_LIMIT);
      if (error) throw new Error(`read the new documents: ${error.message}`);
      return orThrow(parseRows(DocumentRead, data, 'waiting/documents: dossier_versions'));
    },

    /** The workspace's open review, merge and law waits (PRD 2377 s5). */
    async openReviewWaits(workspace: string): Promise<ReviewWaitRow[]> {
      const { data, error } = await openReviewWaits(db).eq('workspace_id', workspace);
      if (error) throw new Error(`read the review waits: ${error.message}`);
      return orThrow(parseRows(ReviewWaitRead, data, 'waiting/reviews: waits'));
    },

    /** The ids of the workspace's jobs whose questions nobody has answered or dismissed (PRD 2255). */
    async openQuestionJobs(workspace: string): Promise<string[]> {
      const { data, error } = await db.from('runner_job_questions').select(OPEN_QUESTION_COLUMNS).eq('workspace_id', workspace).is('closed_at', null);
      if (error) throw new Error(`read the runner jobs' open questions: ${error.message}`);
      return orThrow(parseRows(OpenQuestionRead, data, 'waiting/runners: runner_job_questions')).map((row) => row.job_id);
    },

    /** The state of the workspace's jobs among `ids` (PRD 2255). */
    async jobStates(workspace: string, ids: string[]): Promise<JobStateReadRow[]> {
      const { data, error } = await db.from('runner_jobs').select(JOB_STATE_COLUMNS).eq('workspace_id', workspace).in('id', ids);
      if (error) throw new Error(`read the runner jobs: ${error.message}`);
      return orThrow(parseRows(JobStateRead, data, 'waiting/runners: runner_jobs'));
    },
  };
}

export type WaitingRepository = ReturnType<typeof waitingRepository>;

/** What a count needs of the client: one function call. */
export type CountDb = {
  rpc(fn: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: { message: string } | null }>;
};

/** One of the Business part's counts for a workspace (business_to_check(), agent_questions_open()):
 * 0 for anything but a positive whole number. Throws when the call fails. */
export async function workspaceCount(db: CountDb, fn: string, workspace: string): Promise<number> {
  const { data, error } = await db.rpc(fn, { p_workspace: workspace });
  if (error) throw new Error(error.message);
  return typeof data === 'number' && Number.isInteger(data) && data > 0 ? data : 0;
}
