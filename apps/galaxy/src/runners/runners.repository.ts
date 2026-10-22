// The runners' storage (PRD 1830 s1; ADR-0095), on the client it is given: the service role's, since
// the routes alone write the tables (supabase/migrations/20261207100000_runners.sql, and a job's live
// lines, supabase/migrations/20261208090000_runner_job_lines.sql, PRD 1904; a runner's health and
// samples, supabase/migrations/20261211100000_runner_health.sql, PRD 2102) and the service holds the
// rules. Every answer is parsed where it comes in; it holds no rule. A refusal of the
// database, or an answer out of shape, throws, naming the call: the controller answers 500 and logs it.
// The two functions that act on a job's questions (supabase/migrations/20261218100000_runner_job_questions.sql,
// PRD 2255) are the exception: their refusals are rules of the database (no row, closed, not a member,
// answers that do not match), so they are read by their code and answered, never thrown.
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { IssueNumberSchema, type IssueNumber, type PrdNumber } from 'omni-loop/kit/lib/ids.ts';
import { JOB_OUTCOMES, QuestionSchema, RunnerHealthSchema, type Question } from './runners.contract';

/** What the reads and writes need: the tables, and the database's functions. */
export type RunnersDb = Pick<SupabaseClient, 'from' | 'rpc'>;

const TokensColumn = z.object({ input: z.number(), output: z.number(), cacheRead: z.number(), cacheWrite: z.number() }).nullable().catch(null).optional();

const RunnerRow = z.object({
  id: z.string(),
  workspace_id: z.string(),
  owner: z.string(),
  name: z.string(),
  fleet: z.string().nullable(),
  slots: z.number(),
  repos: z.array(z.string()),
  version: z.string(),
  last_seen_at: z.string(),
  /** Its last health report (PRD 2102); one out of shape reads as none, as a runner that never sent one. */
  health: RunnerHealthSchema.nullable().catch(null),
  /** Whether it registered able to run a job as an API key's GitHub App (PRD 2433). */
  github_app: z.boolean(),
});
export type RunnerRow = z.infer<typeof RunnerRow>;

const JobRow = z.object({
  id: z.string(),
  workspace_id: z.string(),
  line: z.string(),
  repo: z.string(),
  to_runner: z.string().nullable(),
  to_fleet: z.string().nullable(),
  /** Null for a job the Omni app sent (PRD 2338): then sent_by_app names the app. */
  sent_by: z.string().nullable(),
  sent_by_app: z.enum(['omni-app']).nullable(),
  sent_by_key: z.string().nullable(),
  status: z.enum(['queued', 'claimed', 'running', 'done', 'failed', 'cancelled']),
  runner_id: z.string().nullable(),
  cancel_requested: z.boolean(),
  log_tail: z.string(),
  pr_url: z.string().nullable(),
  exit_code: z.number().nullable(),
  reason: z.string().nullable(),
  /** The tokens its runner reported (PRD 2102); one out of shape, or a database without the column, reads as none. */
  tokens: TokensColumn,
  /** The claims its runner released once it ended (PRD 2175); one out of shape reads as none. */
  released: z.array(z.number()).nullable().catch(null).optional(),
  /** Why its runner could not release them (PRD 2175). */
  release_error: z.string().nullable().catch(null).optional(),
  /** What it ended on (PRD 2223, 2255); a value out of shape reads as none. */
  outcome: z.enum(JOB_OUTCOMES).nullable().catch(null).optional(),
  /** The PRD's slices merged out of all when it ended `stopped` (PRD 2375); one out of shape reads as none. */
  slices_merged: z.number().int().nullable().catch(null).optional(),
  slices_total: z.number().int().nullable().catch(null).optional(),
  /** The job this one continues, once its answers were in (PRD 2270); one out of shape reads as none. */
  continues: z.string().nullable().catch(null).optional(),
  queued_at: z.string(),
  claimed_at: z.string().nullable(),
  running_at: z.string().nullable(),
  ended_at: z.string().nullable(),
});
export type JobRow = z.infer<typeof JobRow>;
export type JobRowStatus = JobRow['status'];

const RUNNER_COLUMNS = 'id, workspace_id, owner, name, fleet, slots, repos, version, last_seen_at, health, github_app';
const JOB_COLUMNS = 'id, workspace_id, line, repo, to_runner, to_fleet, sent_by, sent_by_app, sent_by_key, status, runner_id, cancel_requested, log_tail, pr_url, exit_code, reason, tokens, released, release_error, outcome, slices_merged, slices_total, continues, queued_at, claimed_at, running_at, ended_at';

/** A job's questions (PRD 2255), as runner_job_questions holds a row: open while `closed_at` is null; closed
 * with answers it was answered, without them dismissed. */
const QuestionsRow = z.object({
  job_id: z.string(),
  workspace_id: z.string(),
  issue: IssueNumberSchema,
  lead: z.string(),
  questions: z.array(QuestionSchema),
  answers: z.record(z.string(), z.string()).nullable(),
  closed_by: z.string().nullable(),
  closed_at: z.string().nullable(),
  resume_job: z.string().nullable(),
  asked_at: z.string(),
});
export type QuestionsRow = z.infer<typeof QuestionsRow>;

const QUESTIONS_COLUMNS = 'job_id, workspace_id, issue, lead, questions, answers, closed_by, closed_at, resume_job, asked_at';

/** A new row of questions: the job that asks, its workspace, its issue, its lead and its questions. */
type NewQuestions = { jobId: string; workspaceId: string; issue: IssueNumber; lead: string; questions: Question[] };

/** Why runner_job_answer() or runner_job_dismiss() refused, read by the code the database raised: `none` no row
 * for the job (P0002), `closed` the row is closed or the job is not waiting (55000), `stranger` the person is not a
 * member of the workspace (42501), `mismatch` the answers do not match the questions (22023). */
export type QuestionsRefusal = 'none' | 'closed' | 'stranger' | 'mismatch';

/** What acting on a job's questions answered: the value, or the refusal. */
export type Acted<T> = { ok: true; value: T } | { ok: false; refusal: QuestionsRefusal };

/** The refusal a database error is, or null when it is anything else (a failure the controller logs). */
function refusalOf(error: { code?: string; message?: string }): QuestionsRefusal | null {
  if (error.code === 'P0002') return 'none';
  if (error.code === '55000') return 'closed';
  if (error.code === '42501' && error.message?.startsWith('not a member')) return 'stranger';
  if (error.code === '22023') return 'mismatch';
  return null;
}

/** One line of a job's live log, as runner_job_lines holds it (its `at` is the database's). */
export type JobLineRow = { job_id: string; workspace_id: string; seq: number; text: string };

const JobLineRead = z.object({ seq: z.number(), text: z.string() });

/** One of a runner's samples (PRD 2102), as runner_samples holds it. */
const SampleRow = z.object({
  runner_id: z.string(),
  workspace_id: z.string(),
  at: z.string(),
  cpu: z.number().nullable(),
  mem_used: z.number().nullable(),
  mem_total: z.number().nullable(),
  disk_free: z.number().nullable(),
  tokens_5h: z.number().nullable(),
});
export type SampleRow = z.infer<typeof SampleRow>;

const SAMPLE_COLUMNS = 'runner_id, workspace_id, at, cpu, mem_used, mem_total, disk_free, tokens_5h';

/** A new runner's columns. */
export type NewRunner = { workspaceId: string; owner: string; name: string; slots: number; repos: string[]; version: string; seenAt: string; githubApp: boolean };

/** A new job's columns. */
export type NewJob = { workspaceId: string; line: string; repo: string; toRunner: string | null; toFleet: string | null; sentBy: string; sentByKey: string | null };

/** What a job's update may change. */
export type JobPatch = Partial<Pick<JobRow, 'status' | 'cancel_requested' | 'log_tail' | 'pr_url' | 'exit_code' | 'reason' | 'tokens' | 'released' | 'release_error' | 'outcome' | 'slices_merged' | 'slices_total' | 'running_at' | 'ended_at'>>;

type Raw = { data: unknown; error: { code?: string; message?: string } | null };

async function parsed<T>(call: PromiseLike<Raw>, schema: z.ZodType<T>, what: string): Promise<T> {
  const { data, error } = await call;
  if (error) throw new Error(`${what}: ${error.message ?? error.code ?? 'the database refused'}`);
  const read = schema.safeParse(data);
  if (!read.success) throw new Error(`${what} answered out of shape`);
  return read.data;
}

/** Calls a function that acts on a job's questions: its value parsed, a refusal of the database answered by
 * its code, anything else thrown, naming the call. A function that returns one row may answer it as an object
 * or as a list of one (PostgREST), as `Placement` below. */
async function acted<T>(call: PromiseLike<Raw>, schema: z.ZodType<T>, what: string): Promise<Acted<T>> {
  const { data, error } = await call;
  if (error) {
    const refusal = refusalOf(error);
    if (refusal) return { ok: false, refusal };
    throw new Error(`${what}: ${error.message ?? error.code ?? 'the database refused'}`);
  }
  const read = z.union([schema, z.array(schema).length(1).transform((rows) => rows[0])]).safeParse(data);
  if (!read.success || read.data === undefined) throw new Error(`${what} answered out of shape`);
  return { ok: true, value: read.data };
}

/** The App an API key's job runs as, as api_key_github_app_of_job() answers (supabase/migrations/20261228090000_api_key_github_apps.sql):
 * `working` while the key is not revoked and its maker is still a member; `needs_app` while the key holds an App or the job
 * was queued while it did; `app` null once the key holds none. `ciphertext` and `iv` are the sealed private key. */
const AppOfJobRow = z.object({
  key_id: z.string(),
  workspace_id: z.string(),
  working: z.boolean(),
  needs_app: z.boolean(),
  app: z.object({ app_id: z.number().int(), slug: z.string(), bot_id: z.number().int(), ciphertext: z.string(), iv: z.string() }).nullable(),
}).nullable();
export type AppOfJob = NonNullable<z.infer<typeof AppOfJobRow>>;

const MemberRow = z.object({ role: z.string() }).nullable();
const PlayerRow = z.object({ team: z.string().nullable(), github_login: z.string().nullable() }).nullable();
const PlacementRow = z.object({ workspace_id: z.string().nullable(), refusal: z.string().nullable() });
/** repo_workspace() has out parameters and no `setof`, so PostgREST answers its one row as an object;
 * a list is read too, as loop.repository.ts reads it. */
const Placement = z.union([PlacementRow, z.array(PlacementRow)]).transform((data) => (Array.isArray(data) ? data[0] : data));

export function runnersRepository(db: RunnersDb) {
  return {
    /** The person's place in the workspace: whether they own it, and their fleet; null for a non-member. */
    member: async (workspaceId: string, userId: string): Promise<{ owner: boolean; fleet: string | null } | null> => {
      const member = await parsed(db.from('workspace_members').select('role').eq('workspace_id', workspaceId).eq('user_id', userId).maybeSingle(), MemberRow, 'workspace_members');
      if (!member) return null;
      const player = await parsed(db.from('players').select('team, github_login').eq('workspace_id', workspaceId).eq('user_id', userId).maybeSingle(), PlayerRow, 'players');
      return { owner: member.role === 'owner', fleet: player?.team ?? null };
    },

    /** The workspace a repository belongs to for the person (repo_workspace()), or the database's reason why none. */
    place: async (userId: string, repo: string): Promise<{ workspaceId: string | null; refusal: string | null }> => {
      const row = await parsed(db.rpc('repo_workspace', { person: userId, repo }), Placement, 'repo_workspace()');
      return { workspaceId: row?.workspace_id ?? null, refusal: row?.refusal ?? null };
    },

    /** Whether the workspace has this fleet, not retired. */
    fleetExists: async (workspaceId: string, fleet: string): Promise<boolean> =>
      (await parsed(db.from('teams').select('name').eq('workspace_id', workspaceId).eq('name', fleet).is('retired_at', null), z.array(z.unknown()), 'teams')).length > 0,

    /** The GitHub logins of these people in the workspace, by their id. */
    logins: async (workspaceId: string, userIds: string[]): Promise<Map<string, string>> => {
      if (userIds.length === 0) return new Map();
      const rows = await parsed(
        db.from('players').select('user_id, github_login').eq('workspace_id', workspaceId).in('user_id', userIds),
        z.array(z.object({ user_id: z.string(), github_login: z.string().nullable() })), 'players',
      );
      return new Map(rows.flatMap((row) => (row.github_login ? [[row.user_id, row.github_login] as const] : [])));
    },

    /** The names of these API keys of the workspace, by their id (api_key_names(): the service role may
     * not read agent_tokens itself). */
    keyNames: async (workspaceId: string, keyIds: string[]): Promise<Map<string, string>> => {
      if (keyIds.length === 0) return new Map();
      const names = await parsed(db.rpc('api_key_names', { p_workspace: workspaceId, p_keys: keyIds }), z.record(z.string(), z.string()), 'api_key_names()');
      return new Map(Object.entries(names));
    },

    /** The GitHub App the job of an API key runs as (PRD 2433; api_key_github_app_of_job(), service role only):
     * null for a job no key sent. The sealed private key comes with it, for the server to open and nobody else. */
    appOfJob: async (jobId: string): Promise<AppOfJob | null> =>
      parsed(db.rpc('api_key_github_app_of_job', { p_job: jobId }), AppOfJobRow, 'api_key_github_app_of_job()'),

    /** Records that the key's App minted a token now (api_key_github_app_minted(), service role only). */
    appMinted: async (keyId: string): Promise<void> => {
      await parsed(db.rpc('api_key_github_app_minted', { p_key: keyId }), z.unknown(), 'api_key_github_app_minted()');
    },

    runner: async (id: string): Promise<RunnerRow | null> =>
      parsed(db.from('runners').select(RUNNER_COLUMNS).eq('id', id).maybeSingle(), RunnerRow.nullable(), 'runners'),

    runnerNamed: async (workspaceId: string, name: string): Promise<RunnerRow | null> =>
      parsed(db.from('runners').select(RUNNER_COLUMNS).eq('workspace_id', workspaceId).eq('name', name).maybeSingle(), RunnerRow.nullable(), 'runners'),

    /** The workspace's runners, by name. */
    runners: async (workspaceId: string): Promise<RunnerRow[]> =>
      parsed(db.from('runners').select(RUNNER_COLUMNS).eq('workspace_id', workspaceId).order('name'), z.array(RunnerRow), 'runners'),

    insertRunner: async (runner: NewRunner): Promise<RunnerRow> =>
      parsed(db.from('runners').insert({
        workspace_id: runner.workspaceId, owner: runner.owner, name: runner.name, slots: runner.slots, repos: runner.repos,
        version: runner.version, last_seen_at: runner.seenAt, github_app: runner.githubApp,
      }).select(RUNNER_COLUMNS).single(), RunnerRow, 'runners'),

    updateRunner: async (id: string, patch: Partial<Pick<RunnerRow, 'fleet' | 'slots' | 'repos' | 'version' | 'last_seen_at' | 'health' | 'github_app'>>): Promise<RunnerRow> =>
      parsed(db.from('runners').update(patch).eq('id', id).select(RUNNER_COLUMNS).single(), RunnerRow, 'runners'),

    /** Adds one of a runner's samples; one it already holds at that instant stays as it is. */
    insertSample: async (row: SampleRow): Promise<void> => {
      await parsed(db.from('runner_samples').upsert(row, { onConflict: 'runner_id,at', ignoreDuplicates: true }), z.unknown(), 'runner_samples');
    },

    /** Deletes the runner's samples taken before `before`. */
    trimSamples: async (runnerId: string, before: string): Promise<void> => {
      await parsed(db.from('runner_samples').delete().eq('runner_id', runnerId).lt('at', before), z.unknown(), 'runner_samples');
    },

    /** These runners' samples taken at `since` or after, oldest first. */
    samples: async (runnerIds: string[], since: string): Promise<SampleRow[]> => {
      if (runnerIds.length === 0) return [];
      return parsed(db.from('runner_samples').select(SAMPLE_COLUMNS).in('runner_id', runnerIds).gte('at', since).order('at'), z.array(SampleRow), 'runner_samples');
    },

    /** Ends the claimed and running jobs of every runner silent since before `cutoff`: `runner lost`. */
    markLost: async (cutoff: string): Promise<number> =>
      parsed(db.rpc('runners_mark_lost', { p_cutoff: cutoff }), z.number(), 'runners_mark_lost()'),

    /** The repository's own skills its workspace's owner allowed on the runners, in order (PRD 2313;
     * repository_runner_skills_of(), supabase/migrations/20261222090000_repository_runner_skills.sql). */
    allowedSkills: async (workspaceId: string, repo: string): Promise<string[]> =>
      parsed(db.rpc('repository_runner_skills_of', { p_workspace: workspaceId, p_full_name: repo }), z.array(z.string()), 'repository_runner_skills_of()'),

    /** The oldest queued job the runner may run, claimed for it; null when none (runner_claim()). */
    claim: async (runnerId: string): Promise<JobRow | null> =>
      (await parsed(db.rpc('runner_claim', { p_runner: runnerId }), z.array(JobRow), 'runner_claim()'))[0] ?? null,

    job: async (id: string): Promise<JobRow | null> =>
      parsed(db.from('runner_jobs').select(JOB_COLUMNS).eq('id', id).maybeSingle(), JobRow.nullable(), 'runner_jobs'),

    insertJob: async (job: NewJob): Promise<JobRow> =>
      parsed(db.from('runner_jobs').insert({
        workspace_id: job.workspaceId, line: job.line, repo: job.repo, to_runner: job.toRunner, to_fleet: job.toFleet, sent_by: job.sentBy,
        sent_by_key: job.sentByKey,
      }).select(JOB_COLUMNS).single(), JobRow, 'runner_jobs'),

    /** Changes the job while its status is still one of `from`; null when it moved on meanwhile. */
    updateJob: async (id: string, from: readonly JobRowStatus[], patch: JobPatch): Promise<JobRow | null> =>
      parsed(db.from('runner_jobs').update(patch).eq('id', id).in('status', [...from]).select(JOB_COLUMNS).maybeSingle(), JobRow.nullable(), 'runner_jobs'),

    /** Adds a job's lines; a line it already holds (by job and sequence number) stays as it is, so a
     * report sent twice adds nothing (`insert … on conflict (job_id, seq) do nothing`). */
    appendLines: async (rows: JobLineRow[]): Promise<void> => {
      await parsed(db.from('runner_job_lines').upsert(rows, { onConflict: 'job_id,seq', ignoreDuplicates: true }), z.unknown(), 'runner_job_lines');
    },

    /** Deletes the job's lines numbered `upTo` and below. */
    trimLines: async (jobId: string, upTo: number): Promise<void> => {
      await parsed(db.from('runner_job_lines').delete().eq('job_id', jobId).lte('seq', upTo), z.unknown(), 'runner_job_lines');
    },

    /** Deletes the lines of the workspace's ended jobs beyond its `keep` most recent (runner_job_lines_retain()); answers how many. */
    retainLines: async (workspaceId: string, keep: number): Promise<number> =>
      parsed(db.rpc('runner_job_lines_retain', { p_workspace: workspaceId, p_keep: keep }), z.number(), 'runner_job_lines_retain()'),

    /** The job's first `limit` lines numbered above `after`, in order. */
    lines: async (jobId: string, after: number, limit: number): Promise<{ seq: number; text: string }[]> =>
      parsed(db.from('runner_job_lines').select('seq, text').eq('job_id', jobId).gt('seq', after).order('seq').limit(limit), z.array(JobLineRead), 'runner_job_lines'),

    /** The smallest sequence number the job still holds, or null when it holds none. */
    firstLine: async (jobId: string): Promise<number | null> =>
      (await parsed(db.from('runner_job_lines').select('seq').eq('job_id', jobId).order('seq').limit(1), z.array(z.object({ seq: z.number() })), 'runner_job_lines'))[0]?.seq ?? null,

    /** The workspace's queued, claimed and running jobs, oldest first. */
    activeJobs: async (workspaceId: string): Promise<JobRow[]> =>
      parsed(db.from('runner_jobs').select(JOB_COLUMNS).eq('workspace_id', workspaceId).in('status', ['queued', 'claimed', 'running']).order('queued_at'), z.array(JobRow), 'runner_jobs'),

    /** The workspace's last `limit` ended jobs, newest first. */
    endedJobs: async (workspaceId: string, limit: number): Promise<JobRow[]> =>
      parsed(db.from('runner_jobs').select(JOB_COLUMNS).eq('workspace_id', workspaceId).in('status', ['done', 'failed', 'cancelled']).order('ended_at', { ascending: false }).limit(limit), z.array(JobRow), 'runner_jobs'),

    /** The workspace's jobs among these ids, newest ended first (a job still running last). */
    jobsById: async (workspaceId: string, ids: string[]): Promise<JobRow[]> => {
      if (ids.length === 0) return [];
      return parsed(db.from('runner_jobs').select(JOB_COLUMNS).eq('workspace_id', workspaceId).in('id', ids).order('ended_at', { ascending: false }), z.array(JobRow), 'runner_jobs');
    },

    /** A job's questions (PRD 2255); null when it asked none. */
    questionsOf: async (jobId: string): Promise<QuestionsRow | null> =>
      parsed(db.from('runner_job_questions').select(QUESTIONS_COLUMNS).eq('job_id', jobId).maybeSingle(), QuestionsRow.nullable(), 'runner_job_questions'),

    /** Stores the questions a job asks; null when it already asked (one row per job, so a second insert reads none). */
    insertQuestions: async (row: NewQuestions): Promise<QuestionsRow | null> => {
      const inserted = db.from('runner_job_questions').insert({
        job_id: row.jobId, workspace_id: row.workspaceId, issue: row.issue, lead: row.lead, questions: row.questions,
      }).select(QUESTIONS_COLUMNS).single();
      return parsed(Promise.resolve(inserted).then((raw) => (raw.error?.code === '23505' ? { data: null, error: null } : raw)), QuestionsRow.nullable(), 'runner_job_questions');
    },

    /** The ids of the workspace's jobs whose questions are still open, whatever the job's state. */
    openQuestionJobs: async (workspaceId: string): Promise<string[]> =>
      (await parsed(db.from('runner_job_questions').select('job_id').eq('workspace_id', workspaceId).is('closed_at', null), z.array(z.object({ job_id: z.string() })), 'runner_job_questions')).map((row) => row.job_id),

    /** Answers a job's questions for the person (runner_job_answer()): in one transaction it locks the row, queues the
     * resume job and stores the answers. Answers the resume job, or why the database refused. */
    answer: async (jobId: string, answers: Record<string, string>, by: string): Promise<Acted<JobRow>> =>
      acted(db.rpc('runner_job_answer', { p_job: jobId, p_answers: answers, p_by: by }), JobRow, 'runner_job_answer()'),

    /** Dismisses a job's questions for the person (runner_job_dismiss()). Answers the closed row, or why the database refused. */
    dismiss: async (jobId: string, by: string): Promise<Acted<QuestionsRow>> =>
      acted(db.rpc('runner_job_dismiss', { p_job: jobId, p_by: by }), QuestionsRow, 'runner_job_dismiss()'),
  };
}

export type RunnersRepository = ReturnType<typeof runnersRepository>;

/** How many of a repository's jobs whose line may name a PRD are read: its newest, enough to hold the
 * one that waited and any queued or running beside it. */
const PRD_JOBS_READ = 50;

/** A continuation's columns (PRD 2270): a new job's, and the job it continues. */
type NewContinuation = NewJob & { continues: string };

const SwitchRow = z.object({ fix_when_answered: z.boolean() }).nullable();

/** The continuation's storage (PRD 2270 s1; supabase/migrations/20261220090000_fix_when_answered.sql), a
 * port of its own beside the runners': the repository's switch, a PRD's jobs, and the continuation's
 * insert, which the unique runner_jobs.continues refuses a second time. */
export function continuationsRepository(db: RunnersDb) {
  return {
    /** Whether the repository's Fix on a runner once answered is on; null when the workspace does not list it. */
    fixWhenAnswered: async (workspaceId: string, repo: string): Promise<boolean | null> =>
      (await parsed(db.from('repositories').select('fix_when_answered').eq('workspace_id', workspaceId).eq('full_name', repo).maybeSingle(), SwitchRow, 'repositories'))?.fix_when_answered ?? null,

    /** The repository's newest jobs whose line may name the PRD (`/omni:<skill> <n>…`), newest first: a cut
     * the decision reads exactly (./continue.ts). */
    prdJobs: async (workspaceId: string, repo: string, prd: PrdNumber): Promise<JobRow[]> =>
      parsed(db.from('runner_jobs').select(JOB_COLUMNS).eq('workspace_id', workspaceId).eq('repo', repo).like('line', `/omni:% ${String(prd)}%`)
        .order('queued_at', { ascending: false }).limit(PRD_JOBS_READ), z.array(JobRow), 'runner_jobs'),

    /** Queues the continuation; null when the job was continued already (23505, runner_jobs_continues_key). */
    insertContinuation: async (job: NewContinuation): Promise<JobRow | null> => {
      const { data, error } = await db.from('runner_jobs').insert({
        workspace_id: job.workspaceId, line: job.line, repo: job.repo, to_runner: job.toRunner, to_fleet: job.toFleet, sent_by: job.sentBy,
        sent_by_key: job.sentByKey, continues: job.continues,
      }).select(JOB_COLUMNS).single();
      if (error?.code === '23505') return null;
      return parsed(Promise.resolve({ data, error }), JobRow, 'runner_jobs');
    },
  };
}

export type ContinuationsRepository = ReturnType<typeof continuationsRepository>;
