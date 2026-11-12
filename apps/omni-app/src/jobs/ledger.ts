// The job ledger (PRD 2676 s1, spec "The ledger"), as the service role (`SUPABASE_URL`,
// `SUPABASE_SERVICE_ROLE_KEY`, the approved check's own pair): the App has no person's session. Every call is
// one of the seven functions of `supabase/migrations/20270113090000_background_jobs.sql`,
// `20270114090000_pr_check_jobs.sql` and `20270116090000_background_job_later.sql`, the service role's alone, and
// every answer is parsed where it comes in:
//
//   add      background_job_add(): a job, nothing for a key the kind already holds; whether it added one. Its
//            lane and its tries (PRD omni-loop-3 s1) are sent only when given: none, and 5 tries, otherwise
//   refresh  background_job_refresh() (PRD 2688 s1): the job of that kind and key on its latest payload, due in
//            the delay; `added`, `updated` (it was queued), `again` (it was running: its finish queues it once
//            more) or `requeued` (it was finished: queued, its tries at zero, its attempts kept)
//   claim    background_job_claim(): the jobs due, oldest first, each under a fresh claim with one more try, never
//            two of one kind and lane running at once; the claims that ran out are written as `lost` first (due
//            again, or failed on the job's last try)
//   finish   background_job_finish(): the try recorded and the job moved; `later` keeps the job's progress for
//            its next run and gives its try back (a 21st `later` fails it); `stale` when the claim is no longer
//            the job's (55000): a worker presumed dead never overwrites the one that replaced it
//   replay   background_job_replay(): a failed job queued again, its tries at zero, its attempts kept; no such
//            job (P0002) or one not failed (55000) is answered in words
//   health   background_jobs_health(): ok or late, with counts and no name; given the schedules (./schedule.ts),
//            late too when a schedule's kind has had no done job for three of its periods
//   forget   background_jobs_forget(): the jobs finished over 90 days ago deleted, with their saved steps; how many
//
// A job that lives for days (PRD omni-loop-4 s1, `20270117090000_background_job_steps.sql`):
//
//   save     background_job_save(): one finished step of the job, its value as JSON (at most 1 MB, else
//            thrown naming the step), under the job's claim; `stale` when the claim is no longer the job's
//   stepsOf  background_job_steps_of(): the job's saved steps, by id, under its claim; `stale` as above
//   renew    background_job_renew(): the claim held a lease more from now (5 minutes when not given); `until`
//            it now runs out, or `stale` as above
//   wake     background_job_wake(): the queued job of that kind and key due now; whether there was one. A job
//            running or finished is left as it is
//
// Throws on any other refusal, or an answer out of shape.
import { z } from 'zod';
import type { Json } from '../../../../supabase/database.types.ts';
import type { Connection } from '../approved-check/record.ts';
import { serviceDb } from '../server-event/service-db.ts';
import { SCHEDULES, type Schedule } from './schedule.ts';

/** How a try ends, as the worker reports it. `lost` is the database's alone. */
export type JobOutcome = 'done' | 'skipped' | 'retry' | 'waiting' | 'later' | 'failed';

/** A JSON object a job carries: its payload, or the progress it keeps between runs. Never a token. */
export type JobFields = { [field: string]: Json | undefined };

/**
 * A job to add: what it is, its key (unique per kind), its repository and what it needs. Never a token. Its lane
 * (one running job per kind and lane) and its tries (1 to 5) are optional: none, and 5, when not given.
 */
export type NewJob = { kind: string; key: string; subject: string; payload: JobFields; lane?: string; maxTries?: number };

/** A job to refresh, and how many seconds from now it falls due when queued (0 to 3600). */
export type RefreshJob = NewJob & { delaySeconds: number };

/** The spec's refresh delay: a burst of events within 5 seconds becomes one run on the latest. */
export const REFRESH_DELAY_SECONDS = 5;

const RefreshedSchema = z.enum(['added', 'updated', 'again', 'requeued']);
/** What a refresh did to the job: see the table in the header. */
export type Refreshed = z.infer<typeof RefreshedSchema>;

const PayloadSchema = z.record(z.string(), z.unknown());

/**
 * A row as background_job_claim() answers it: held, under its claim. A row from before PRD omni-loop-3's
 * migration reads as no progress, no lane and 5 tries.
 */
const ClaimedRowSchema = z.object({
  id: z.string().min(1),
  kind: z.string().min(1),
  key: z.string().min(1),
  subject: z.string().min(1),
  payload: PayloadSchema,
  progress: PayloadSchema.default({}),
  lane: z.string().min(1).nullable().default(null),
  tries: z.number().int().min(1).max(5),
  max_tries: z.number().int().min(1).max(5).default(5),
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
  // The three below are always set by the ledger; a job built by hand (a test) may leave them out.
  /** What the job's last `later` kept for this run; `{}` when none did. */
  progress?: z.infer<typeof PayloadSchema>;
  /** The lane it runs in; null when none. */
  lane?: string | null;
  /** Its tries, 1 to 5: the last that throws fails it. 5 when not set. */
  maxTries?: number;
};

/**
 * A try to record: the job, its claim, how it ended, why (an error's first line), when it may run again, and,
 * for a `later` only, the progress its next run reads.
 */
export type Finish = { id: string; claim: string; outcome: JobOutcome; reason: string | null; retryAt: string | null; progress?: JobFields };

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
  /** The schedules whose kind has had no done job for three periods; absent before PRD omni-loop-3's migration. */
  scheduled: z.number().int().nonnegative().optional(),
});
export type JobsHealth = z.infer<typeof HealthSchema>;

/** A job held under its claim: what saving, reading and renewing are done under. */
export type Held = { id: string; claim: string };

/** A step to save: its id, and its value as JSON (what `asSaved` makes of what the step returned). */
export type SaveStep = Held & { step: string; value: unknown };

/** A job's saved steps: each step's value, by the step's id. */
export type SavedSteps = ReadonlyMap<string, unknown>;

/** A row as background_job_steps_of() answers it. */
const StepRowSchema = z.object({ step: z.string().min(1), value: z.unknown(), saved_at: z.string().min(1) });

export type Ledger = {
  add: (job: NewJob) => Promise<boolean>;
  refresh: (job: RefreshJob) => Promise<Refreshed>;
  claim: (input: { limit: number; leaseSeconds: number }) => Promise<ClaimedJob[]>;
  finish: (input: Finish) => Promise<FinishAnswer>;
  replay: (id: string) => Promise<Replayed>;
  health: (schedules?: readonly Schedule[]) => Promise<JobsHealth>;
  forget: () => Promise<number>;
  save: (input: SaveStep) => Promise<'saved' | 'stale'>;
  stepsOf: (job: Held) => Promise<SavedSteps | 'stale'>;
  renew: (job: Held & { leaseSeconds?: number }) => Promise<{ until: string } | 'stale'>;
  wake: (job: { kind: string; key: string }) => Promise<boolean>;
};

/** What a job's saved steps need of the ledger (PRD omni-loop-4 s1). */
export type StepLedger = Pick<Ledger, 'save' | 'stepsOf' | 'renew'>;

/**
 * What the worker needs of the ledger: its claims and finishes, and the saved steps of the jobs it runs. A
 * ledger without the steps (a test's) keeps each job's steps for its one run only.
 */
export type JobLedger = Pick<Ledger, 'claim' | 'finish'> & Partial<StepLedger>;

type Refusal = { message: string; code?: string };

/** The database's refusal of a claim that is no longer the job's. */
const STALE = '55000';

const refused = (error: Refusal) => new Error(`the database refused: ${error.message}${error.code ? ` (${error.code})` : ''}`);

/** The data of an answer, or its refusal thrown. */
function dataOf({ data, error }: { data: unknown; error: Refusal | null }): unknown {
  if (error) throw refused(error);
  return data;
}

/** A job's lane and tries as the database takes them: only those given, so a call without them reads as before. */
function paced(lane: string | undefined, maxTries: number | undefined): { p_lane?: string; p_max_tries?: number } {
  return { ...(lane === undefined ? {} : { p_lane: lane }), ...(maxTries === undefined ? {} : { p_max_tries: maxTries }) };
}

/** The schedules as background_jobs_health() takes them, a kind and its period in seconds at one place; none, nothing sent. */
function healthArgs(schedules: readonly Schedule[]): { p_kinds: string[]; p_periods: number[] } | undefined {
  if (schedules.length === 0) return undefined;
  return { p_kinds: schedules.map(({ kind }) => kind), p_periods: schedules.map(({ periodMinutes }) => periodMinutes * 60) };
}

/** The ledger, as the service role on `connection`. */
export function jobLedger(connection: Connection): Ledger {
  const db = serviceDb(connection);
  return {
    add: async ({ kind, key, subject, payload, lane, maxTries }) =>
      z.boolean().parse(dataOf(await db.rpc('background_job_add', { p_kind: kind, p_key: key, p_subject: subject, p_payload: payload, ...paced(lane, maxTries) }))),

    refresh: async ({ kind, key, subject, payload, delaySeconds, lane, maxTries }) =>
      RefreshedSchema.parse(dataOf(await db.rpc('background_job_refresh', {
        p_kind: kind,
        p_key: key,
        p_subject: subject,
        p_payload: payload,
        p_delay_seconds: delaySeconds,
        ...paced(lane, maxTries),
      }))),

    claim: async ({ limit, leaseSeconds }) => {
      const rows = z.array(ClaimedRowSchema).parse(dataOf(await db.rpc('background_job_claim', { p_limit: limit, p_lease_seconds: leaseSeconds })));
      return rows.map(({ claimed_until, max_tries, ...row }) => ({ ...row, claimedUntil: claimed_until, maxTries: max_tries }));
    },

    finish: async ({ id, claim, outcome, reason, retryAt, progress }) => {
      const answer = await db.rpc('background_job_finish', {
        p_id: id,
        p_claim: claim,
        p_outcome: outcome,
        ...(reason === null ? {} : { p_reason: reason }),
        ...(retryAt === null ? {} : { p_retry_at: retryAt }),
        ...(progress === undefined ? {} : { p_progress: progress }),
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

    health: async (schedules = SCHEDULES) =>
      HealthSchema.parse(dataOf(await db.rpc('background_jobs_health', healthArgs(schedules), { get: true }))),

    forget: async () => z.number().int().nonnegative().parse(dataOf(await db.rpc('background_jobs_forget'))),

    save: async ({ id, claim, step, value }) => {
      // The value is JSON already: what `asSaved` made of the step's return, so it reads back as it was saved.
      const answer = await db.rpc('background_job_save', { p_id: id, p_claim: claim, p_step: step, p_value: value as Json });
      if (answer.error?.code === STALE) return 'stale';
      dataOf(answer);
      return 'saved';
    },

    stepsOf: async ({ id, claim }) => {
      const answer = await db.rpc('background_job_steps_of', { p_id: id, p_claim: claim });
      if (answer.error?.code === STALE) return 'stale';
      const rows = z.array(StepRowSchema).parse(dataOf(answer));
      return new Map(rows.map(({ step, value }) => [step, value]));
    },

    renew: async ({ id, claim, leaseSeconds }) => {
      const answer = await db.rpc('background_job_renew', { p_id: id, p_claim: claim, ...(leaseSeconds === undefined ? {} : { p_lease_seconds: leaseSeconds }) });
      if (answer.error?.code === STALE) return 'stale';
      return { until: z.string().min(1).parse(dataOf(answer)) };
    },

    wake: async ({ kind, key }) => z.boolean().parse(dataOf(await db.rpc('background_job_wake', { p_kind: kind, p_key: key }))),
  };
}
