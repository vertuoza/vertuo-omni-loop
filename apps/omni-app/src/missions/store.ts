// The mission's store (PRD 2842 s4), as the service role (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`): the App has
// no person's session. Every read stays inside the mission's own workspace and repository (BR-PRODUCT-63), and
// reads only Omni's database, never GitHub:
//
//   mission      the row (supabase/migrations/20270122093000_missions.sql): its fleet, status, what it waits on,
//                its mandate and its scope
//   facts        each PRD of its scope, in order: the PRDs it names alone, then each roadmap's (`roadmaps` of
//                the workspace and repository, by number, then their `roadmap_prds`, blockers included); for
//                each, its stages (`prd_stages`), its page (a `dossiers` row of kind prd), the latest product
//                approval there and whether a push voided it (`approvals`, `approval_voids`: BL-APPROVALS-1),
//                and the territory of the latest plan on its page (`dossier_versions` of kind plan)
//   runs         the runner jobs the mission sent (`runner_jobs.mission_id`), each with the resumes that carry
//                it on after a lost runner (`runner_jobs.resumes`, PRD 2809), one chain per job, its step read
//                from its key; for a Reviewer job's verdict, what its log's `omni review post` line says it
//                posted (`runner_jobs.log_tail`, PRD 2871): its count of findings and its review's link, nothing
//                else of the log
//   events       the events already recorded, in the order they happened, read back as keys, so nothing is
//                recorded twice, and as the PRDs on the mission branch (PRD 2896)
//   fleetRunners whether a runner of the mission's Virtual Fleet holds its repository
//   installation the GitHub installation of the mission's workspace (`workspaces.github_installation_id`), for the mission
//                branch the App cuts (PRD 2896); null when the workspace has none
//   planRepository whether the mission's repository is a live product's plan repository (`products.plan_repository`)
//   send         the step's line queued (`/omni:yolo <n> --for-review`, `/omni:review <n>` or `/omni:yolo-fix
//                <n> --for-review`, PRD 2871; the build `/omni:ultra-yolo <n>` for a PRD of a plan repository, PRD
//                2873), sent by the app (`sent_by_app`, never a person's name, Never 10), to the fleet's runners or
//                else to any runner of the workspace, under `mission_key`: a key already held (23505) inserts
//                nothing and answers null
//   record       the run's events, signed `agent`, a millisecond apart so the ledger keeps their order
//   update       the mission's status, what it waits on and its next wake, only while its status is still the
//                one this run read: a Pause landing meanwhile is never overwritten
//
// Throws when the database refuses or answers out of shape: the run fails, and the worker retries it.
import { z } from 'zod';
import { IssueNumberSchema, PrdNumberSchema, type IssueNumber, type PrdNumber } from 'omni-loop/kit/lib/ids.ts';
import { MISSION_LEVELS } from 'omni-loop/kit/lib/mission/brief.ts';
import type { Connection } from '../approved-check/record.ts';
import { rowsOf, serviceDb } from '../server-event/service-db.ts';
import {
  approvalOf,
  baseOf,
  expandScope,
  lineOf,
  missionKey,
  postedOf,
  runOfKey,
  stageOf,
  territoryOf,
  type Attempt,
  type BuildSkill,
  type Concluded,
  type Mission,
  type MissionStatus,
  type NewEvent,
  type PrdFacts,
  type RecordedEvent,
  type RoadmapRow,
  type Run,
  type Step,
} from './supervisor.ts';

/** A mission as the store reads it: the supervisor's view, its workspace and repository, and its scope. */
export type MissionRecord = Mission & { workspace: string; repo: string; scope: { prds: PrdNumber[]; roadmaps: IssueNumber[] } };

/** The skill a mission builds its PRD with: `ultra-yolo` for a PRD of a plan repository, `yolo` otherwise (PRD 2873). */
export type MissionSkill = BuildSkill;

/** A job to send: the mission, the PRD, its run and step, whether the fleet's runners take it, and the build's skill. */
export type Dispatch = { mission: MissionRecord; prd: PrdNumber; run: number; step: Step; toFleet: boolean; skill: MissionSkill };

export type MissionStore = {
  mission: (id: string) => Promise<MissionRecord | null>;
  facts: (mission: MissionRecord) => Promise<PrdFacts[]>;
  runs: (id: string) => Promise<Run[]>;
  events: (id: string) => Promise<RecordedEvent[]>;
  fleetRunners: (mission: MissionRecord) => Promise<boolean>;
  /** Whether the mission's repository is the plan repository of a live product of its workspace. */
  planRepository: (mission: MissionRecord) => Promise<boolean>;
  /** The GitHub installation of the mission's workspace; null when it has none. */
  installation: (mission: MissionRecord) => Promise<number | null>;
  /** The job's id, or null when its key was already held. */
  send: (job: Dispatch) => Promise<string | null>;
  record: (id: string, events: readonly NewEvent[], at: Date) => Promise<void>;
  /** Whether the mission was still at `from`, and so was moved. */
  update: (id: string, from: MissionStatus, next: Concluded) => Promise<boolean>;
};

/** Who the job is sent by: the app, never a person (`runner_jobs.sent_by_app`). */
const APP_SENDER = 'omni-app';

/** The database's answer to a key already held. */
const TAKEN = '23505';

/** The columns each read selects, shared with ./store.boundary.ts. */
export const MISSION = 'id, workspace_id, repo, fleet, number, title, status, waiting_on, mandate, scope';
export const WORKSPACE = 'github_installation_id';
export const ROADMAP = 'id, number';
export const ROADMAP_PRD = 'roadmap_id, position, row_id, prd, blockers';
export const STAGE = 'prd, stage';
export const DOSSIER = 'id, prd';
export const APPROVAL = 'id, dossier_id';
export const VOID = 'approval_id';
export const PLAN = 'content';
export const JOB = 'id, mission_key, resumes, status, outcome, reason, pr_url';
export const JOB_LOG = 'id, log_tail';
export const EVENT = 'kind, prd, job_id';
export const RUNNER = 'repos';
export const PRODUCT = 'plan_repository';

const text = z.string().min(1);

export const MissionRowSchema = z.object({
  id: text,
  workspace_id: text,
  repo: text,
  fleet: text,
  number: IssueNumberSchema,
  title: text,
  status: z.enum(['draft', 'running', 'waiting', 'paused', 'delivered', 'stopped']),
  waiting_on: z.string().nullable(),
  mandate: z.object({ parallel: z.number().int().min(1).max(4), level: z.enum(MISSION_LEVELS).default('with-you') }),
  scope: z.object({ prds: z.array(PrdNumberSchema), roadmaps: z.array(IssueNumberSchema) }),
});
export const WorkspaceRowSchema = z.object({ github_installation_id: z.number().int().positive().nullable() });
export const RoadmapRowSchema = z.object({ id: text, number: IssueNumberSchema.nullable() });
export const RoadmapPrdRowSchema = z.object({ roadmap_id: text, position: z.number().int(), row_id: text, prd: PrdNumberSchema.nullable(), blockers: z.array(z.string()) });
export const StageRowSchema = z.object({ prd: PrdNumberSchema, stage: text });
export const DossierRowSchema = z.object({ id: text, prd: PrdNumberSchema.nullable() });
export const ApprovalRowSchema = z.object({ id: text, dossier_id: text });
export const VoidRowSchema = z.object({ approval_id: text });
export const PlanRowSchema = z.object({ content: z.string() });
export const JobRowSchema = z.object({
  id: text,
  mission_key: z.string().nullable(),
  resumes: z.string().nullable(),
  status: z.enum(['queued', 'claimed', 'running', 'done', 'failed', 'cancelled']),
  outcome: z.string().nullable(),
  reason: z.string().nullable(),
  pr_url: z.string().nullable(),
});
export const JobLogRowSchema = z.object({ id: text, log_tail: z.string() });
export const EventRowSchema = z.object({ kind: text, prd: PrdNumberSchema.nullable(), job_id: z.string().nullable() });
export const RunnerRowSchema = z.object({ repos: z.array(z.string()) });
export const ProductRowSchema = z.object({ plan_repository: z.string().nullable() });

type JobRow = z.infer<typeof JobRowSchema>;

const attemptOf = (row: JobRow): Attempt => ({ id: row.id, status: row.status, outcome: row.outcome, reason: row.reason, prUrl: row.pr_url });

/** A Reviewer job that ended on its verdict (PRD 2871): its log says what it posted. */
const isVerdict = (step: Step, attempt: Attempt): boolean => step.startsWith('review:') && attempt.status === 'done' && (attempt.outcome === 'changes' || attempt.outcome === 'ready');

/** The store, as the service role on `connection`. */
export function missionStore(connection: Connection): MissionStore {
  const db = serviceDb(connection);

  /** Each roadmap's rows, in the order the scope names the roadmaps. */
  async function roadmapRows(mission: MissionRecord): Promise<RoadmapRow[][]> {
    if (mission.scope.roadmaps.length === 0) return [];
    const roadmaps = rowsOf(RoadmapRowSchema, await db.from('roadmaps').select(ROADMAP).eq('workspace_id', mission.workspace).eq('repo', mission.repo).in('number', mission.scope.roadmaps));
    if (roadmaps.length === 0) return [];
    const rows = rowsOf(RoadmapPrdRowSchema, await db.from('roadmap_prds').select(ROADMAP_PRD).in('roadmap_id', roadmaps.map(({ id }) => id)).order('position'));
    return mission.scope.roadmaps.flatMap((number) => {
      const roadmap = roadmaps.find((one) => one.number === number);
      return roadmap ? [rows.filter((row) => row.roadmap_id === roadmap.id).map((row) => ({ prd: row.prd, rowId: row.row_id, blockers: row.blockers }))] : [];
    });
  }

  /** Each PRD's latest product approval, and whether a push voided it, by its page's id. */
  async function approvals(dossiers: readonly string[]): Promise<Map<string, { voided: boolean }>> {
    if (dossiers.length === 0) return new Map();
    const rows = rowsOf(
      ApprovalRowSchema,
      await db.from('approvals').select(APPROVAL).in('dossier_id', dossiers).eq('approval_kind', 'product').order('approved_at', { ascending: false }).order('id', { ascending: false }),
    );
    const latest = new Map<string, string>();
    for (const row of rows) if (!latest.has(row.dossier_id)) latest.set(row.dossier_id, row.id);
    const ids = [...latest.values()];
    const voided = new Set(ids.length === 0 ? [] : rowsOf(VoidRowSchema, await db.from('approval_voids').select(VOID).in('approval_id', ids)).map((row) => row.approval_id));
    return new Map([...latest].map(([dossier, id]) => [dossier, { voided: voided.has(id) }]));
  }

  /** `runs`, each Reviewer verdict carrying what its log says it posted: one read of those jobs' log tails, none without one. */
  async function withPosted(runs: Run[]): Promise<Run[]> {
    const ids = runs.flatMap((one) => one.attempts.filter((attempt) => isVerdict(one.step, attempt)).map((attempt) => attempt.id));
    if (ids.length === 0) return runs;
    const logs = new Map(rowsOf(JobLogRowSchema, await db.from('runner_jobs').select(JOB_LOG).in('id', ids)).map((row) => [row.id, row.log_tail]));
    return runs.map((one) => ({
      ...one,
      attempts: one.attempts.map((attempt) => {
        const log = isVerdict(one.step, attempt) ? logs.get(attempt.id) : undefined;
        return log === undefined ? attempt : { ...attempt, posted: postedOf(log) };
      }),
    }));
  }

  /** The latest plan on a PRD's page; null when it has none. */
  async function planOf(dossier: string | undefined): Promise<string | null> {
    if (dossier === undefined) return null;
    const [plan] = rowsOf(PlanRowSchema, await db.from('dossier_versions').select(PLAN).eq('dossier_id', dossier).eq('kind', 'plan').order('created_at', { ascending: false }).limit(1));
    return plan?.content ?? null;
  }

  return {
    async mission(id) {
      const [row] = rowsOf(MissionRowSchema, await db.from('missions').select(MISSION).eq('id', id).limit(1));
      if (!row) return null;
      return { id: row.id, workspace: row.workspace_id, repo: row.repo, fleet: row.fleet, number: row.number, title: row.title, level: row.mandate.level, status: row.status, waitingOn: row.waiting_on, parallel: row.mandate.parallel, scope: row.scope };
    },

    async facts(mission) {
      const scope = expandScope(mission.scope.prds, await roadmapRows(mission));
      const prds = scope.map(({ prd }) => prd);
      if (prds.length === 0) return [];
      const stages = rowsOf(StageRowSchema, await db.from('prd_stages').select(STAGE).eq('workspace_id', mission.workspace).eq('repository', mission.repo).in('prd', prds));
      const dossiers = rowsOf(DossierRowSchema, await db.from('dossiers').select(DOSSIER).eq('workspace_id', mission.workspace).eq('home_repo', mission.repo).eq('kind', 'prd').in('prd', prds));
      const pageOf = new Map(dossiers.flatMap((row) => (row.prd === null ? [] : [[row.prd, row.id] as const])));
      const approved = await approvals([...pageOf.values()]);
      const facts: PrdFacts[] = [];
      for (const { prd, blockers } of scope) {
        const page = pageOf.get(prd);
        facts.push({
          prd,
          approval: approvalOf(page === undefined ? null : (approved.get(page) ?? null)),
          stage: stageOf(stages.filter((row) => row.prd === prd).map((row) => row.stage)),
          blockers,
          territory: territoryOf(await planOf(page)),
        });
      }
      return facts;
    },

    async runs(id) {
      const jobs = rowsOf(JobRowSchema, await db.from('runner_jobs').select(JOB).eq('mission_id', id).order('queued_at'));
      const chains = new Map(jobs.map((job) => [job.id, [job]]));
      let frontier = new Map(jobs.map((job) => [job.id, job.id]));
      // A job is attempted three times at most (runner_jobs.attempt): two rounds of resumes.
      for (let round = 0; round < 2 && frontier.size > 0; round += 1) {
        const resumes = rowsOf(JobRowSchema, await db.from('runner_jobs').select(JOB).in('resumes', [...frontier.keys()]));
        const next = new Map<string, string>();
        for (const resume of resumes) {
          const head = resume.resumes === null ? undefined : frontier.get(resume.resumes);
          if (head === undefined) continue;
          chains.get(head)?.push(resume);
          next.set(resume.id, head);
        }
        frontier = next;
      }
      const runs = jobs.flatMap((job): Run[] => {
        const key = job.mission_key === null ? null : runOfKey(job.mission_key);
        return key === null ? [] : [{ prd: key.prd, run: key.run, step: key.step, job: job.id, attempts: (chains.get(job.id) ?? [job]).map(attemptOf) }];
      });
      return withPosted(runs);
    },

    async events(id) {
      return rowsOf(EventRowSchema, await db.from('mission_events').select(EVENT).eq('mission_id', id).order('at')).map((row) => ({ kind: row.kind, prd: row.prd, job: row.job_id }));
    },

    async fleetRunners(mission) {
      const runners = rowsOf(RunnerRowSchema, await db.from('runners').select(RUNNER).eq('workspace_id', mission.workspace).eq('fleet', mission.fleet));
      return runners.some((runner) => runner.repos.some((repo) => repo.toLowerCase() === mission.repo));
    },

    async planRepository(mission) {
      const products = rowsOf(ProductRowSchema, await db.from('products').select(PRODUCT).eq('workspace_id', mission.workspace).is('archived_at', null));
      return products.some((product) => product.plan_repository?.toLowerCase() === mission.repo.toLowerCase());
    },

    async installation(mission) {
      const [workspace] = rowsOf(WorkspaceRowSchema, await db.from('workspaces').select(WORKSPACE).eq('id', mission.workspace).limit(1));
      return workspace?.github_installation_id ?? null;
    },

    async send({ mission, prd, run, step, toFleet, skill }) {
      const answer = await db
        .from('runner_jobs')
        .insert({
          workspace_id: mission.workspace,
          repo: mission.repo,
          line: lineOf(prd, step, skill, baseOf(mission, skill === 'ultra-yolo')),
          sent_by_app: APP_SENDER,
          to_fleet: toFleet ? mission.fleet : null,
          mission_id: mission.id,
          mission_key: missionKey(mission.id, prd, run, step),
        })
        .select('id');
      if (answer.error?.code === TAKEN) return null;
      const [made] = rowsOf(z.object({ id: text }), answer);
      if (!made) throw new Error('the database queued no job and gave no reason');
      return made.id;
    },

    async record(id, events, at) {
      if (events.length === 0) return;
      const rows = events.map((event, n) => ({
        mission_id: id,
        at: new Date(at.getTime() + n).toISOString(),
        role: event.role,
        actor: 'agent',
        kind: event.kind,
        prd: event.prd,
        job_id: event.job,
        link: event.link,
        sentence: event.sentence,
      }));
      rowsOf(z.unknown(), await db.from('mission_events').insert(rows).select('id'));
    },

    async update(id, from, { status, waitingOn, nextWakeAt }) {
      const moved = rowsOf(
        z.object({ id: text }),
        await db.from('missions').update({ status, waiting_on: waitingOn, next_wake_at: nextWakeAt, updated_at: new Date().toISOString() }).eq('id', id).eq('status', from).select('id'),
      );
      return moved.length > 0;
    },
  };
}
