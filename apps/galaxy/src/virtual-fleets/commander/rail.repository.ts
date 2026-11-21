import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { IssueNumberSchema, PrdNumberSchema } from 'omni-loop/kit/lib/ids.ts';
import { orThrow, parseRows } from '../../data/parse-rows';
import type { ApprovalRow, JobQuestionsRow, MissionItemRow, OutboxRow, RailMission } from './rail';

// The rail's reads (PRD 3107 s2; ADR-0095), on the signed-in person's own client, so row-level security shows a fleet's
// missions, its jobs' questions, its mission items, its PRDs' outboxes and the approvals waiting on them to the
// workspace's members alone; every read also names the workspace or this fleet's missions. Nothing is written here: a
// card is answered through its question's own route (commander.live.ts). Each answer is parsed where it comes in; a
// failed read throws. No rule lives here: rail.ts does.

export type RailDb = Pick<SupabaseClient, 'from' | 'rpc'>;

const WHERE = 'virtual-fleets/commander/rail.repository';
/** The jobs of the fleet's missions the rail reads: the newest that ended on questions for a person. */
const JOB_LIMIT = 200;

const MissionSchema = z.object({
  id: z.uuid(), number: z.number().int().positive(), repo: z.string(), status: z.string(),
  scope: z.object({ prds: z.array(PrdNumberSchema) }).loose(),
});
const JobSchema = z.object({ id: z.uuid(), mission_id: z.uuid().nullable() });
const QuestionSchema = z.object({
  question: z.string(), options: z.array(z.object({ label: z.string() }).loose()), multiSelect: z.boolean().default(false),
}).loose();
const JobQuestionsSchema = z.object({
  job_id: z.uuid(), issue: IssueNumberSchema, questions: z.array(QuestionSchema),
  answers: z.record(z.string(), z.string()).nullable(), closed_by: z.uuid().nullable(), closed_at: z.string().nullable(), asked_at: z.string(),
});
const ItemSchema = z.object({
  id: z.uuid(), mission_id: z.uuid(), target: z.string(), wording: z.string(), answer: z.enum(['adopted', 'declined']).nullable(),
  answered_by: z.uuid().nullable(), answered_at: z.string().nullable(), created_at: z.string(),
});
const OutboxSchema = z.object({
  repository: z.string(), prd: PrdNumberSchema, waiting: z.array(z.object({ id: z.string(), question: z.string() }).loose()), synced_at: z.string(),
});
const ApprovalSchema = z.object({ id: z.uuid(), repo: z.string(), prd: PrdNumberSchema, title: z.string(), askedAt: z.string() }).loose();
const LoginSchema = z.object({ user_id: z.uuid(), github_login: z.string().nullable() });

type Answer = { data: unknown; error: { message: string } | null };

/** The answer's rows in `schema`, or a throw naming what could not be read. */
function rowsOf<T>(answer: Answer, schema: z.ZodType<T>, what: string): T[] {
  if (answer.error) throw new Error(`Supabase: could not read ${what} (${answer.error.message})`);
  return orThrow(parseRows(schema, answer.data, `${WHERE}: ${what}`));
}

export function railReader(db: RailDb) {
  return {
    /** The fleet's missions that started, newest first: at most 50, with the PRDs each works on. */
    async missions(workspace: string, fleet: string): Promise<RailMission[]> {
      const answer = await db.from('missions').select('id, number, repo, status, scope').eq('workspace_id', workspace).eq('fleet', fleet).neq('status', 'draft').order('updated_at', { ascending: false }).limit(50);
      return rowsOf(answer, MissionSchema, 'missions').map((m) => ({ id: m.id, number: m.number, repo: m.repo, status: m.status, prds: m.scope.prds }));
    },

    /** The questions of the jobs these missions of the workspace sent that ended on questions for a person. */
    async jobQuestions(workspace: string, missions: readonly string[]): Promise<JobQuestionsRow[]> {
      if (missions.length === 0) return [];
      const jobs = rowsOf(
        await db.from('runner_jobs').select('id, mission_id').eq('workspace_id', workspace).in('mission_id', [...missions]).eq('outcome', 'human').order('queued_at', { ascending: false }).limit(JOB_LIMIT),
        JobSchema, 'runner_jobs',
      );
      const missionOf = new Map(jobs.flatMap((j) => (j.mission_id === null ? [] : [[j.id, j.mission_id] as const])));
      if (missionOf.size === 0) return [];
      const rows = rowsOf(
        await db.from('runner_job_questions').select('job_id, issue, questions, answers, closed_by, closed_at, asked_at').eq('workspace_id', workspace).in('job_id', [...missionOf.keys()]),
        JobQuestionsSchema, 'runner_job_questions',
      );
      return rows.flatMap((r) => {
        const mission = missionOf.get(r.job_id);
        return mission === undefined ? [] : [{
          job: r.job_id, mission, issue: r.issue, questions: r.questions, answers: r.answers, closedBy: r.closed_by, closedAt: r.closed_at, askedAt: r.asked_at,
        }];
      });
    },

    /** The items of these missions. */
    async items(missions: readonly string[]): Promise<MissionItemRow[]> {
      if (missions.length === 0) return [];
      const rows = rowsOf(
        await db.from('mission_items').select('id, mission_id, target, wording, answer, answered_by, answered_at, created_at').in('mission_id', [...missions]).order('created_at', { ascending: true }).limit(200),
        ItemSchema, 'mission_items',
      );
      return rows.map((i) => ({
        id: i.id, mission: i.mission_id, target: i.target, wording: i.wording, answer: i.answer, answeredBy: i.answered_by, answeredAt: i.answered_at, createdAt: i.created_at,
      }));
    },

    /** What the outboxes of these repositories' PRDs in the workspace hold waiting on a person. */
    async outbox(workspace: string, repos: readonly string[]): Promise<OutboxRow[]> {
      if (repos.length === 0) return [];
      const rows = rowsOf(
        await db.from('prd_outbox').select('repository, prd, waiting, synced_at').eq('workspace_id', workspace).in('repository', [...repos]).neq('waiting', '[]'),
        OutboxSchema, 'prd_outbox',
      );
      return rows.map((o) => ({ repository: o.repository, prd: o.prd, waiting: o.waiting.map((w) => ({ id: w.id, question: w.question })), syncedAt: o.synced_at }));
    },

    /** The approval requests waiting on the signed-in member (approval_requests_waiting()). */
    async approvals(): Promise<ApprovalRow[]> {
      const answer: Answer = await db.rpc('approval_requests_waiting');
      return rowsOf(answer, ApprovalSchema, 'approval_requests_waiting').map((a) => ({ id: a.id, repo: a.repo, prd: a.prd, title: a.title, askedAt: a.askedAt }));
    },

    /** The GitHub logins of these people in the workspace, by their id. */
    async logins(workspace: string, people: readonly string[]): Promise<Map<string, string>> {
      if (people.length === 0) return new Map();
      const rows = rowsOf(await db.from('players').select('user_id, github_login').eq('workspace_id', workspace).in('user_id', [...people]), LoginSchema, 'players');
      return new Map(rows.flatMap((r) => (r.github_login === null ? [] : [[r.user_id, r.github_login] as const])));
    },
  };
}

export type RailReader = ReturnType<typeof railReader>;
