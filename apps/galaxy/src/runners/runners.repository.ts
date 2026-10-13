// The runners' storage (PRD 1830 s1; ADR-0095), on the client it is given: the service role's, since
// the routes alone write the two tables (supabase/migrations/20261207100000_runners.sql) and the
// service holds the rules. Every answer is parsed where it comes in; it holds no rule. A refusal of the
// database, or an answer out of shape, throws, naming the call: the controller answers 500 and logs it.
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

/** What the reads and writes need: the tables, and the database's functions. */
export type RunnersDb = Pick<SupabaseClient, 'from' | 'rpc'>;

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
});
export type RunnerRow = z.infer<typeof RunnerRow>;

const JobRow = z.object({
  id: z.string(),
  workspace_id: z.string(),
  line: z.string(),
  repo: z.string(),
  to_runner: z.string().nullable(),
  to_fleet: z.string().nullable(),
  sent_by: z.string(),
  status: z.enum(['queued', 'claimed', 'running', 'done', 'failed', 'cancelled']),
  runner_id: z.string().nullable(),
  cancel_requested: z.boolean(),
  log_tail: z.string(),
  pr_url: z.string().nullable(),
  exit_code: z.number().nullable(),
  reason: z.string().nullable(),
  queued_at: z.string(),
  claimed_at: z.string().nullable(),
  running_at: z.string().nullable(),
  ended_at: z.string().nullable(),
});
export type JobRow = z.infer<typeof JobRow>;
export type JobRowStatus = JobRow['status'];

const RUNNER_COLUMNS = 'id, workspace_id, owner, name, fleet, slots, repos, version, last_seen_at';
const JOB_COLUMNS = 'id, workspace_id, line, repo, to_runner, to_fleet, sent_by, status, runner_id, cancel_requested, log_tail, pr_url, exit_code, reason, queued_at, claimed_at, running_at, ended_at';

/** A new runner's columns. */
export type NewRunner = { workspaceId: string; owner: string; name: string; slots: number; repos: string[]; version: string; seenAt: string };

/** A new job's columns. */
export type NewJob = { workspaceId: string; line: string; repo: string; toRunner: string | null; toFleet: string | null; sentBy: string };

/** What a job's update may change. */
export type JobPatch = Partial<Pick<JobRow, 'status' | 'cancel_requested' | 'log_tail' | 'pr_url' | 'exit_code' | 'reason' | 'running_at' | 'ended_at'>>;

type Raw = { data: unknown; error: { code?: string; message?: string } | null };

async function parsed<T>(call: PromiseLike<Raw>, schema: z.ZodType<T>, what: string): Promise<T> {
  const { data, error } = await call;
  if (error) throw new Error(`${what}: ${error.message ?? error.code ?? 'the database refused'}`);
  const read = schema.safeParse(data);
  if (!read.success) throw new Error(`${what} answered out of shape`);
  return read.data;
}

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
        version: runner.version, last_seen_at: runner.seenAt,
      }).select(RUNNER_COLUMNS).single(), RunnerRow, 'runners'),

    updateRunner: async (id: string, patch: Partial<Pick<RunnerRow, 'fleet' | 'slots' | 'repos' | 'version' | 'last_seen_at'>>): Promise<RunnerRow> =>
      parsed(db.from('runners').update(patch).eq('id', id).select(RUNNER_COLUMNS).single(), RunnerRow, 'runners'),

    /** Ends the claimed and running jobs of every runner silent since before `cutoff`: `runner lost`. */
    markLost: async (cutoff: string): Promise<number> =>
      parsed(db.rpc('runners_mark_lost', { p_cutoff: cutoff }), z.number(), 'runners_mark_lost()'),

    /** The oldest queued job the runner may run, claimed for it; null when none (runner_claim()). */
    claim: async (runnerId: string): Promise<JobRow | null> =>
      (await parsed(db.rpc('runner_claim', { p_runner: runnerId }), z.array(JobRow), 'runner_claim()'))[0] ?? null,

    job: async (id: string): Promise<JobRow | null> =>
      parsed(db.from('runner_jobs').select(JOB_COLUMNS).eq('id', id).maybeSingle(), JobRow.nullable(), 'runner_jobs'),

    insertJob: async (job: NewJob): Promise<JobRow> =>
      parsed(db.from('runner_jobs').insert({
        workspace_id: job.workspaceId, line: job.line, repo: job.repo, to_runner: job.toRunner, to_fleet: job.toFleet, sent_by: job.sentBy,
      }).select(JOB_COLUMNS).single(), JobRow, 'runner_jobs'),

    /** Changes the job while its status is still one of `from`; null when it moved on meanwhile. */
    updateJob: async (id: string, from: readonly JobRowStatus[], patch: JobPatch): Promise<JobRow | null> =>
      parsed(db.from('runner_jobs').update(patch).eq('id', id).in('status', [...from]).select(JOB_COLUMNS).maybeSingle(), JobRow.nullable(), 'runner_jobs'),

    /** The workspace's queued, claimed and running jobs, oldest first. */
    activeJobs: async (workspaceId: string): Promise<JobRow[]> =>
      parsed(db.from('runner_jobs').select(JOB_COLUMNS).eq('workspace_id', workspaceId).in('status', ['queued', 'claimed', 'running']).order('queued_at'), z.array(JobRow), 'runner_jobs'),

    /** The workspace's last `limit` ended jobs, newest first. */
    endedJobs: async (workspaceId: string, limit: number): Promise<JobRow[]> =>
      parsed(db.from('runner_jobs').select(JOB_COLUMNS).eq('workspace_id', workspaceId).in('status', ['done', 'failed', 'cancelled']).order('ended_at', { ascending: false }).limit(limit), z.array(JobRow), 'runner_jobs'),
  };
}

export type RunnersRepository = ReturnType<typeof runnersRepository>;
