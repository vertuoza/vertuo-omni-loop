// The job ledger (PRD 2676 s1, spec "The ledger"), as the service role (`SUPABASE_URL`,
// `SUPABASE_SERVICE_ROLE_KEY`, the approved check's own pair): the App has no person's session. Every call is
// one of the seven functions of `supabase/migrations/20270113090000_background_jobs.sql` and
// `20270114090000_pr_check_jobs.sql`, the service role's alone, and every answer is parsed where it comes in:
//
//   add      background_job_add(): a job, nothing for a key the kind already holds; whether it added one
//   refresh  background_job_refresh() (PRD 2688 s1): the job of that kind and key on its latest payload, due in
//            the delay; `added`, `updated` (it was queued), `again` (it was running: its finish queues it once
//            more) or `requeued` (it was finished: queued, its tries at zero, its attempts kept)
//   claim    background_job_claim(): the jobs due, oldest first, each under a fresh claim with one more try;
//            the claims that ran out are written as `lost` first (due again, or failed on the 5th try)
//   finish   background_job_finish(): the try recorded and the job moved; `stale` when the claim is no longer
//            the job's (55000): a worker presumed dead never overwrites the one that replaced it
//   replay   background_job_replay(): a failed job queued again, its tries at zero, its attempts kept; no such
//            job (P0002) or one not failed (55000) is answered in words
//   health   background_jobs_health(): ok or late, with counts and no name
//   forget   background_jobs_forget(): the jobs finished over 90 days ago deleted; how many
//
// Throws on any other refusal, or an answer out of shape.
import { z } from 'zod';
import type { Json } from '../../../../supabase/database.types.ts';
import type { Connection } from '../approved-check/record.ts';
import { serviceDb } from '../server-event/service-db.ts';

/** How a try ends, as the worker reports it. `lost` is the database's alone. */
export type JobOutcome = 'done' | 'skipped' | 'retry' | 'waiting' | 'failed';

/** A job to add: what it is, its key (unique per kind), its repository and what it needs. Never a token. */
export type NewJob = { kind: string; key: string; subject: string; payload: { [field: string]: Json | undefined } };

/** A job to refresh, and how many seconds from now it falls due when queued (0 to 3600). */
export type RefreshJob = NewJob & { delaySeconds: number };

/** The spec's refresh delay: a burst of events within 5 seconds becomes one run on the latest. */
export const REFRESH_DELAY_SECONDS = 5;

const RefreshedSchema = z.enum(['added', 'updated', 'again', 'requeued']);
/** What a refresh did to the job: see the table in the header. */
export type Refreshed = z.infer<typeof RefreshedSchema>;

const PayloadSchema = z.record(z.string(), z.unknown());

/** A row as background_job_claim() answers it: held, under its claim. */
const ClaimedRowSchema = z.object({
  id: z.string().min(1),
  kind: z.string().min(1),
  key: z.string().min(1),
  subject: z.string().min(1),
  payload: PayloadSchema,
  tries: z.number().int().min(1).max(5),
  claim: z.string().min(1),
  claimed_until: z.string().min(1),
});

/** A job a worker holds: run it, then finish it under its claim. */
export type ClaimedJob = {
  id: string;
  kind: string;
  key: string;
  subject: string;
  payload: z.infer<typeof PayloadSchema>;
  /** Which try this is, 1 to 5. */
  tries: number;
  claim: string;
  claimedUntil: string;
};

/** A try to record: the job, its claim, how it ended, why (an error's first line), and when it may run again. */
export type Finish = { id: string; claim: string; outcome: JobOutcome; reason: string | null; retryAt: string | null };

const JobStateSchema = z.enum(['queued', 'done', 'skipped', 'failed']);
/** The job's state once the try is recorded, or `stale`: the claim is no longer the job's, nothing was kept. */
export type FinishAnswer = z.infer<typeof JobStateSchema> | 'stale';

/** A job as background_job_replay() answers it. */
const ReplayedRowSchema = z.object({
  id: z.string().min(1),
  kind: z.string().min(1),
  key: z.string().min(1),
  state: z.literal('queued'),
  tries: z.literal(0),
});
export type Replayed =
  | { replayed: true; id: string; kind: string; key: string; state: 'queued'; tries: 0 }
  | { replayed: false; reason: string };

/** What background_jobs_health() answers. */
export const HealthSchema = z.object({
  state: z.enum(['ok', 'late']),
  late: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
});
export type JobsHealth = z.infer<typeof HealthSchema>;

export type Ledger = {
  add: (job: NewJob) => Promise<boolean>;
  refresh: (job: RefreshJob) => Promise<Refreshed>;
  claim: (input: { limit: number; leaseSeconds: number }) => Promise<ClaimedJob[]>;
  finish: (input: Finish) => Promise<FinishAnswer>;
  replay: (id: string) => Promise<Replayed>;
  health: () => Promise<JobsHealth>;
  forget: () => Promise<number>;
};

/** What the worker needs of the ledger. */
export type JobLedger = Pick<Ledger, 'claim' | 'finish'>;

type Refusal = { message: string; code?: string };

const refused = (error: Refusal) => new Error(`the database refused: ${error.message}${error.code ? ` (${error.code})` : ''}`);

/** The data of an answer, or its refusal thrown. */
function dataOf({ data, error }: { data: unknown; error: Refusal | null }): unknown {
  if (error) throw refused(error);
  return data;
}

/** The ledger, as the service role on `connection`. */
export function jobLedger(connection: Connection): Ledger {
  const db = serviceDb(connection);
  return {
    add: async ({ kind, key, subject, payload }) =>
      z.boolean().parse(dataOf(await db.rpc('background_job_add', { p_kind: kind, p_key: key, p_subject: subject, p_payload: payload }))),

    refresh: async ({ kind, key, subject, payload, delaySeconds }) =>
      RefreshedSchema.parse(dataOf(await db.rpc('background_job_refresh', {
        p_kind: kind,
        p_key: key,
        p_subject: subject,
        p_payload: payload,
        p_delay_seconds: delaySeconds,
      }))),

    claim: async ({ limit, leaseSeconds }) => {
      const rows = z.array(ClaimedRowSchema).parse(dataOf(await db.rpc('background_job_claim', { p_limit: limit, p_lease_seconds: leaseSeconds })));
      return rows.map(({ claimed_until, ...row }) => ({ ...row, claimedUntil: claimed_until }));
    },

    finish: async ({ id, claim, outcome, reason, retryAt }) => {
      const answer = await db.rpc('background_job_finish', {
        p_id: id,
        p_claim: claim,
        p_outcome: outcome,
        ...(reason === null ? {} : { p_reason: reason }),
        ...(retryAt === null ? {} : { p_retry_at: retryAt }),
      });
      if (answer.error?.code === '55000') return 'stale';
      return JobStateSchema.parse(dataOf(answer));
    },

    replay: async (id) => {
      const answer = await db.rpc('background_job_replay', { p_id: id });
      if (answer.error?.code === 'P0002' || answer.error?.code === '55000') return { replayed: false, reason: answer.error.message };
      const job = ReplayedRowSchema.parse(dataOf(answer));
      return { replayed: true, ...job };
    },

    health: async () => HealthSchema.parse(dataOf(await db.rpc('background_jobs_health', undefined, { get: true }))),

    forget: async () => z.number().int().nonnegative().parse(dataOf(await db.rpc('background_jobs_forget'))),
  };
}
