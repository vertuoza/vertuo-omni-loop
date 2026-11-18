// The mission's store (PRD 2842 s4), as the service role (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`): the App has
// no person's session. Every read stays inside the mission's own workspace and repository (BR-PRODUCT-63), and
// reads only Omni's database, never GitHub:
//
//   mission      the row (supabase/migrations/20270122093000_missions.sql): its fleet, status, what it waits on,
//                its mandate and its scope
//   facts        each PRD of its scope, in order: the PRDs it names alone, then each roadmap's (`roadmaps` of
//                the workspace and repository, by number, then their `roadmap_prds`, blockers included); for
//                each, its stages (`prd_stages`), its page (a `dossiers` row of kind prd), the latest product
//                approval there and whether a push voided it (`approvals`, `approval_voids`: BL-APPROVALS-1); a fleet's
//                approval given in another mission counts as none here (PRD 2896 s9),
//                and the territory of the latest plan on its page (`dossier_versions` of kind plan)
//   runs         the runner jobs the mission sent (`runner_jobs.mission_id`), each with the resumes that carry
//                it on after a lost runner (`runner_jobs.resumes`, PRD 2809), one chain per job, its step read
//                from its key; for a Reviewer job's verdict, what its log's `omni review post` line says it
//                posted (`runner_jobs.log_tail`, PRD 2871): its count of findings and its review's link, nothing
//                else of the log; for a QA job that ended done, its verdict, read by the kit's `qaLine` from the same
//                tail, or none when it reads none (PRD 3001)
//   events       the events already recorded, in the order they happened, read back as keys, so nothing is
//                recorded twice, and as the PRDs on the mission branch (PRD 2896)
//   fleetRunners whether a runner of the mission's Virtual Fleet holds its repository
//   installation the GitHub installation of the mission's workspace (`workspaces.github_installation_id`), for the mission
//                branch the App cuts (PRD 2896); null when the workspace has none
//   planRepository whether the mission's repository is a live product's plan repository (`products.plan_repository`)
//   send         the step's line queued (`/omni:yolo <n> --for-review`, `/omni:review <n>` or `/omni:yolo-fix
//                <n> --for-review`, PRD 2871; the build `/omni:ultra-yolo <n>` for a PRD of a plan repository, PRD
//                2873; QA's `/omni:qa <n>`, its `--round 2`, and the Engineer's `/omni:bug-fix #<issue> --base <feature
//                branch>` between them, PRD 3001), sent by the app (`sent_by_app`, never a person's name, Never 10), to the fleet's runners or
//                else to any runner of the workspace, under `mission_key`: a key already held (23505) inserts
//                nothing and answers null
//   care         a feature branch's care job (PRD 2896 s5: `/omni:pr-care <n> --once --base <mission branch>`, for a branch that
//                conflicts with the mission branch only in generated paths), sent by the app with no mission key, unless a
//                job of the same line was queued for the mission since the mission branch's head was committed: one per head
//   committees   the committees the mission sent (PRD 2896 s9): its jobs keyed `…:approve:<k>`, each with the decision recorded
//                for it (`mission_decisions`), if any
//   committeeLog what an ended committee job's log ends on (`runner_jobs.log_tail`): read only for its record line
//   decide       a committee job's decision, recorded through mission_decide_approval() as the service role (BR-PRODUCT-94):
//                the database escalates what it reads itself, and a carried approval approves the PRD in the fleet's name
//   approve      a committee's job queued (`/omni:committee <n> --approve`), sent by the app, to the fleet's runners or else to
//                any runner of the workspace, under its key: a key already held inserts nothing and answers null
//   pmJobs       the PM jobs the mission sent (PRD 2896 s12): its jobs keyed `…:pm:<k>`, each with its line; their logs read
//                through committeeLog, only for the PM's record line
//   pm           the mission's PM job queued (`/omni:roadmap --mission <n> --cap <k>` or its kin), sent by the app, under its key
//   repairs      the repairs the mission sent (PRD 2980): its jobs keyed `…:repair:<k>`, each with the job whose failure it repairs
//                (read from its line) and the resumes that carry it on, and the `mission_repairs` rows the database kept
//   repair       a repair's job queued (`/omni:repair --mission <m> --prd <n> --job <failed job>`), sent by the app under its key,
//                which the runners claim first in line
//   keepRepair   a repair's row, numbered by the database, which refuses a 4th repair of a cause in a round and a 10th in a
//                mission (23514): the cap it refused it on is the answer, never a throw
//   endRepair    a repair's outcome, set once
//   bugIssue     the Omni Loop bug a fingerprint was filed as (`omni_bug_reports`), read only for its repository and issue
//   addJob       a job added to the App's ledger: an Omni Loop bug report to file (../bug-reports/job.ts)
//   names        what the mission's workspace is known by (its repositories' owners and names, the logins on its events), which
//                a public report never holds
//   record      the run's events, signed `agent`, a millisecond apart so the ledger keeps their order
//   update       the mission's status, what it waits on and its next wake, only while its status is still the
//                one this run read: a Pause landing meanwhile is never overwritten
//   budget       what a run reads of the mission's token budget (PRD 3040): what the mission and its fleet spent
//                (mission_tokens(), fleet_tokens_24h() up to the run's time), the fleet's daily cap (`teams.daily_tokens`;
//                the mission's own is its mandate's `tokens`), the latest stop naming the mission and the fleet's stop still
//                waiting (`mission_budget_stops`), and the mission's own `paused` and `resumed` events, a person's or the
//                supervisor's. Counts and times only: never a job's log
//   fleetMissions the missions of the fleet that run or wait, the mission first: the ones a fleet's stop pauses
//   stop         a budget stop recorded as the service role, unanswered: a stop of the same cap still waiting (23505) records
//                none and answers null
//   pause        the other missions a fleet's stop paused, each only while it still runs or waits
//
// Throws when the database refuses or answers out of shape: the run fails, and the worker retries it.
import { z } from 'zod';
import { IssueNumberSchema, PrdNumberSchema, type IssueNumber, type PrdNumber } from 'omni-loop/kit/lib/ids.ts';
import { MISSION_LEVELS } from 'omni-loop/kit/lib/mission/brief.ts';
import type { DecisionEvent } from 'omni-loop/kit/lib/mission/overturn.ts';
import type { Connection } from '../approved-check/record.ts';
import { rowsOf, serviceDb } from '../server-event/service-db.ts';
import { approveLine, committeeKey, committeeOfKey, type Committee, type Decision, type Recorded } from './committee.ts';
import { askLine, askPrefix, DEFAULT_BOUND, itemOfLine, type ItemCommittee } from './answers.ts';
import { pmKey, pmRoundOfKey, type PmJob } from './pm.ts';
import { RepairRetroSchema } from 'omni-loop/kit/lib/repair/retro.ts';
import { jobLedger, type NewJob } from '../jobs/ledger.ts';
import { failedJobOf, repairKey, repairSkillLine, repairOfKey, type RepairJob, type RepairOutcome, type RepairRow } from './repair.ts';
import type { CommitteeRole } from 'omni-loop/kit/lib/committee/vote.ts';
import { qaLine } from 'omni-loop/kit/lib/qa/verdict.ts';
import { isQaStep, type Fix } from './qa.ts';
import type { BudgetRead, NewStop, StopRow } from './budget.ts';
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
  type RoomRunner,
  type Run,
  type Step,
} from './supervisor.ts';

/** A mission as the store reads it: the supervisor's view, its workspace and repository, and its scope. */
export type MissionRecord = Mission & {
  workspace: string;
  repo: string;
  scope: { prds: PrdNumber[]; roadmaps: IssueNumber[] };
  /** `mandate.hardToRevert` (PRD 2896 s10): the bound an item's score is read against at `alone`; its default when absent. */
  hardToRevert?: number;
  /** `mandate.ownPrds` (PRD 2896 s12): how many PRDs the fleet's PM may add at `alone`; 0, none, when absent. */
  ownPrds?: number;
  /** `mandate.tokens` (PRD 3040): the mission's token budget over every job it sent; null or absent, none. */
  tokens?: number | null;
};

/** An item's committee to send (PRD 2896 s10): the mission, the PRD, the item, and whether the fleet's runners take it. */
export type Ask = { mission: MissionRecord; prd: PrdNumber; item: string; toFleet: boolean };

/** The skill a mission builds its PRD with: `ultra-yolo` for a PRD of a plan repository, `yolo` otherwise (PRD 2873). */
export type MissionSkill = BuildSkill;

/**
 * A committee to send (PRD 2896 s9): the mission, the PRD, its round, whether the fleet's runners take it, and the hero who wrote
 * the PRD and sits out (PRD 2896 s12: the PM, for a PRD its fleet added), none by default.
 */
export type Approve = { mission: MissionRecord; prd: PrdNumber; round: number; toFleet: boolean; author?: CommitteeRole | null };

/** The mission's PM job to send (PRD 2896 s12): the mission, its round, its line, and whether the fleet's runners take it. */
export type PmSend = { mission: MissionRecord; round: number; line: string; toFleet: boolean };

/**
 * A job to send: the mission, the PRD, its run and step, whether the fleet's runners take it, and the build's skill; for the
 * Engineer's fix of a QA bug, the bug and the feature branch it is fixed into (PRD 3001).
 */
export type Dispatch = { mission: MissionRecord; prd: PrdNumber; run: number; step: Step; toFleet: boolean; skill: MissionSkill; fix?: Fix };

/**
 * A care job to send (PRD 2896 s5): its line, and since when one of it counts as sent, the mission branch's head's commit time,
 * so one job is sent per feature branch and head of the mission branch. It is no step of a run: it has no mission key.
 */
export type Care = { mission: MissionRecord; line: string; since: string; toFleet: boolean };

/** A repair to send (PRD 2980): the mission, the PRD, its number among the PRD's repairs, the job that failed, and where it goes. */
export type RepairSend = { mission: MissionRecord; prd: PrdNumber; k: number; failedJob: string; toFleet: boolean };

/** A repair's row to keep: what its record line found, in the mission's round. The database numbers it. */
export type NewRepair = Pick<RepairRow, 'prd' | 'fingerprint' | 'round' | 'failedJob' | 'job' | 'retro' | 'fixPr'>;

/** The row kept, or the cap the database refused it on. */
export type Kept = RepairRow | { spent: 'cause' | 'mission' };

export type MissionStore = {
  mission: (id: string) => Promise<MissionRecord | null>;
  facts: (mission: MissionRecord) => Promise<PrdFacts[]>;
  runs: (id: string) => Promise<Run[]>;
  events: (id: string) => Promise<RecordedEvent[]>;
  fleetEvents: (id: string) => Promise<DecisionEvent[]>;
  fleetRunners: (mission: MissionRecord) => Promise<boolean>;
  /** The runners a job of the mission goes to, with their slots in use (PRD 2949): what its room is read from. */
  room: (mission: MissionRecord, toFleet: boolean) => Promise<RoomRunner[]>;
  /** Whether the mission's repository is the plan repository of a live product of its workspace. */
  planRepository: (mission: MissionRecord) => Promise<boolean>;
  /** The GitHub installation of the mission's workspace; null when it has none. */
  installation: (mission: MissionRecord) => Promise<number | null>;
  /** The job's id, or null when its key was already held. */
  send: (job: Dispatch) => Promise<string | null>;
  /** A feature branch's care job (PRD 2896 s5): its id, or null when a job of `line` was queued for the mission since `since`. */
  care: (job: Care) => Promise<string | null>;
  /** The committees the mission sent (PRD 2896 s9), each with its decision once recorded. */
  committees: (id: string) => Promise<Committee[]>;
  /** The log tail of a committee's job; null when it has none. */
  committeeLog: (job: string) => Promise<string | null>;
  /** A committee job's decision recorded once, as the database kept it. */
  decide: (mission: MissionRecord, one: Committee, recorded: Recorded) => Promise<Decision>;
  /** A committee's job: its id, or null when its key was already held. */
  approve: (job: Approve) => Promise<string | null>;
  /** The PM jobs the mission sent (PRD 2896 s12): its jobs keyed `…:pm:<k>`, in order. */
  pmJobs: (id: string) => Promise<PmJob[]>;
  /** The mission's PM job queued under its key: its id, or null when the key was already held. */
  pm: (job: PmSend) => Promise<string | null>;
  /** The item committees the mission sent (PRD 2896 s10): its jobs whose line is `/omni:committee <n> --item <id>`, in order. */
  asks: (id: string) => Promise<Omit<ItemCommittee, 'decision'>[]>;
  /** An item's committee queued, with no mission key: its id, or null when one was sent for that item already. */
  ask: (job: Ask) => Promise<string | null>;
  /** The repairs the mission sent (PRD 2980), with their resumes, and the rows the database kept of them. */
  repairs: (id: string) => Promise<{ jobs: RepairJob[]; rows: RepairRow[] }>;
  /** A repair's job queued under its key: its id, or null when the key was already held. */
  repair: (job: RepairSend) => Promise<string | null>;
  /** A repair's row kept, or the cap the database refused it on. */
  keepRepair: (mission: MissionRecord, row: NewRepair) => Promise<Kept>;
  /** A repair's outcome, set once. */
  endRepair: (id: string, outcome: RepairOutcome) => Promise<void>;
  /** The Omni Loop bug a fingerprint was filed as; null when none was. */
  bugIssue: (fingerprint: string) => Promise<{ repo: string; issue: IssueNumber } | null>;
  /** A job added to the App's ledger: whether it was added (a key already held adds none). */
  addJob: (job: NewJob) => Promise<boolean>;
  /** The names the mission's workspace is known by, which a public report never holds. */
  names: (mission: MissionRecord) => Promise<string[]>;
  record: (id: string, events: readonly NewEvent[], at: Date) => Promise<void>;
  /** Whether the mission was still at `from`, and so was moved. */
  update: (id: string, from: MissionStatus, next: Concluded) => Promise<boolean>;
  /** What the run reads of the mission's token budget at `at` (PRD 3040). */
  budget: (mission: MissionRecord, at: Date) => Promise<BudgetRead>;
  /** The missions of the mission's fleet that run or wait, the mission first: what a fleet's stop pauses. */
  fleetMissions: (mission: MissionRecord) => Promise<string[]>;
  /** A budget stop recorded: its id, or null when a stop of the same cap still waits for its answer. */
  stop: (mission: MissionRecord, stop: NewStop & { missions: readonly string[] }) => Promise<string | null>;
  /** The missions a fleet's stop paused, set paused and saying why, each only while it still runs or waits. */
  pause: (ids: readonly string[], waitingOn: string) => Promise<void>;
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
export const APPROVAL = 'id, dossier_id, mission_id, approved_at';
export const OVERTURN = 'prd, at';
export const FLEET_EVENT = 'kind, prd, sentence, link, actor';
export const VOID = 'approval_id';
export const PLAN = 'content';
export const JOB = 'id, mission_key, resumes, status, outcome, reason, pr_url, limited_until, parts';
export const JOB_LOG = 'id, log_tail';
export const CARE = 'id';
export const EVENT = 'kind, prd, job_id';
export const DECISION = 'job_id, outcome, why';
export const RUNNER = 'repos';
export const ROOM_RUNNER = 'id, repos, slots, last_seen_at, health';
export const ROOM_JOB = 'runner_id';
export const PRODUCT = 'plan_repository';
export const REPAIR = 'id, prd, fingerprint, round, number, failed_job_id, job_id, retro, fix_pr, outcome';
export const BUG_REPORT = 'repo, issue';
export const REPOSITORY = 'full_name';
export const ACTOR = 'actor';
export const FLEET_CAP = 'daily_tokens';
export const STOP = 'id, cap, cap_tokens, spent, missions, answer, raised_to, created_at, answered_at';
export const PAUSE_EVENT = 'kind, actor, at';
export const FLEET_MISSION = 'id';

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
  mandate: z.object({
    parallel: z.number().int().min(1).max(4),
    level: z.enum(MISSION_LEVELS).default('with-you'),
    hardToRevert: z.number().min(0).max(1).default(DEFAULT_BOUND),
    ownPrds: z.number().int().min(0).max(10).default(0),
    tokens: z.number().int().min(1).nullable().default(null),
  }),
  scope: z.object({ prds: z.array(PrdNumberSchema), roadmaps: z.array(IssueNumberSchema) }),
});
export const WorkspaceRowSchema = z.object({ github_installation_id: z.number().int().positive().nullable() });
export const RoadmapRowSchema = z.object({ id: text, number: IssueNumberSchema.nullable() });
export const RoadmapPrdRowSchema = z.object({ roadmap_id: text, position: z.number().int(), row_id: text, prd: PrdNumberSchema.nullable(), blockers: z.array(z.string()) });
export const StageRowSchema = z.object({ prd: PrdNumberSchema, stage: text });
export const DossierRowSchema = z.object({ id: text, prd: PrdNumberSchema.nullable() });
export const ApprovalRowSchema = z.object({ id: text, dossier_id: text, mission_id: z.string().nullable(), approved_at: text });
export const FleetEventRowSchema = z.object({ kind: text, prd: PrdNumberSchema.nullable(), sentence: text, link: z.string().nullable(), actor: z.string().nullable() });
export const OverturnRowSchema = z.object({ prd: PrdNumberSchema.nullable(), at: text });
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
  limited_until: z.string().nullable().default(null),
  /** The job's parts, read only for whether the runner guessed the reset (PRD 2949). */
  parts: z.array(z.looseObject({ guessed: z.boolean().optional() })).nullable().default(null),
});
export const JobLogRowSchema = z.object({ id: text, log_tail: z.string() });
/** An item committee's job (PRD 2896 s10): a job row with its line, which names the PRD and the item. */
export const ASK = `${JOB}, line`;
export const AskRowSchema = JobRowSchema.extend({ line: z.string() });
export const CareRowSchema = z.object({ id: text });
export const EventRowSchema = z.object({ kind: text, prd: PrdNumberSchema.nullable(), job_id: z.string().nullable() });
export const DecisionRowSchema = z.object({ job_id: text, outcome: z.enum(['carried', 'escalated']), why: z.array(z.string()) });
const DecidedSchema = z.object({ outcome: z.enum(['carried', 'escalated']), why: z.array(z.string()) });
export const RunnerRowSchema = z.object({ repos: z.array(z.string()) });
export const RoomRunnerRowSchema = z.object({
  id: text,
  repos: z.array(z.string()),
  slots: z.number().int(),
  last_seen_at: text,
  health: z.looseObject({ at: text, paused: z.string().nullable().optional(), accounts: z.array(z.looseObject({ state: z.string(), resetsAt: z.string().optional() })).optional() }).nullable(),
});
export const RoomJobRowSchema = z.object({ runner_id: z.string().nullable() });
/** The most resumes one job's chain holds: three tries and six waits, the first job apart (PRD 2949). */
const CHAIN_MAX = 9;
export const ProductRowSchema = z.object({ plan_repository: z.string().nullable() });
export const RepairRowSchema = z.object({
  id: text,
  prd: PrdNumberSchema,
  fingerprint: z.string().regex(/^[0-9a-f]{64}$/),
  round: z.number().int().min(1),
  number: z.number().int().min(1).max(3),
  failed_job_id: text,
  job_id: z.string().nullable(),
  /** A retro that no longer reads as one is read as none: the repair counts, its words are not shown. */
  retro: RepairRetroSchema.nullable().catch(null),
  fix_pr: z.string().nullable(),
  outcome: z.enum(['fixed', 'not fixed', 'stopped', 'lost']).nullable(),
});
export const BugReportRowSchema = z.object({ repo: text, issue: IssueNumberSchema });
export const RepositoryRowSchema = z.object({ full_name: text });
export const ActorRowSchema = z.object({ actor: z.string().nullable() });
export const FleetCapRowSchema = z.object({ daily_tokens: z.number().int().positive().nullable() });
export const StopRowSchema = z.object({
  id: text,
  cap: z.enum(['mission', 'fleet']),
  cap_tokens: z.number().int().positive(),
  spent: z.number().int().min(0),
  missions: z.array(text),
  answer: z.enum(['raised', 'tomorrow', 'stopped']).nullable(),
  raised_to: z.number().int().positive().nullable(),
  created_at: text,
  answered_at: z.string().nullable(),
});
export const PauseEventRowSchema = z.object({ kind: z.enum(['paused', 'resumed']), actor: z.string().nullable(), at: text });
export const FleetMissionRowSchema = z.object({ id: text });
/** What mission_tokens() answers, and each row of fleet_tokens_24h(): a bigint, which PostgREST may give as a number or its text. */
const CountSchema = z.coerce.number().int().min(0);
const FleetTokensRowSchema = z.object({ tokens: CountSchema, oldest_end: z.string().nullable() });

const stopOf = (row: z.infer<typeof StopRowSchema>): StopRow => ({
  id: row.id,
  cap: row.cap,
  capTokens: row.cap_tokens,
  spent: row.spent,
  missions: row.missions,
  answer: row.answer,
  raisedTo: row.raised_to,
  createdAt: row.created_at,
  answeredAt: row.answered_at,
});

/** The latest time of each of a mission's own `paused` and `resumed` events, newest first: a person's, or the supervisor's (`agent`). */
function pausesOf(rows: readonly z.infer<typeof PauseEventRowSchema>[]): Pick<BudgetRead, 'personPausedAt' | 'personResumedAt' | 'agentPausedAt'> {
  const first = (kind: 'paused' | 'resumed', byAgent: boolean): string | null => rows.find((row) => row.kind === kind && (row.actor === 'agent') === byAgent)?.at ?? null;
  return { personPausedAt: first('paused', false), personResumedAt: first('resumed', false), agentPausedAt: first('paused', true) };
}

/** The most missions one budget stop names (`mission_budget_stops.missions`). */
const STOP_MISSIONS = 100;
/** The newest of a mission's own pauses and resumes a run reads (PRD 3040): the latest of each kind is among them. */
const PAUSES_READ = 50;

/** The id of a row inserted, or null when a unique key refused it (23505); any other refusal throws. */
function madeOf(answer: { data: unknown; error: { message: string; code?: string } | null }, none: string): string | null {
  if (answer.error?.code === TAKEN) return null;
  const [made] = rowsOf(z.object({ id: text }), answer);
  if (!made) throw new Error(`the database ${none} and gave no reason`);
  return made.id;
}

/** The database's answer to a repair over its budget, and the cap it names in its hint. */
const OVER_BUDGET = '23514';

const repairOf = (row: z.infer<typeof RepairRowSchema>): RepairRow => ({
  id: row.id,
  prd: row.prd,
  fingerprint: row.fingerprint,
  round: row.round,
  number: row.number,
  failedJob: row.failed_job_id,
  job: row.job_id,
  retro: row.retro,
  fixPr: row.fix_pr,
  outcome: row.outcome,
});

type JobRow = z.infer<typeof JobRowSchema>;

const attemptOf = (row: JobRow): Attempt => ({
  id: row.id,
  status: row.status,
  outcome: row.outcome,
  reason: row.reason,
  prUrl: row.pr_url,
  ...(row.limited_until === null ? {} : { limitedUntil: row.limited_until, guessed: row.parts?.at(-1)?.guessed === true }),
});

/** A Reviewer job that ended on its verdict (PRD 2871): its log says what it posted. */
const isVerdict = (step: Step, attempt: Attempt): boolean => step.startsWith('review:') && attempt.status === 'done' && (attempt.outcome === 'changes' || attempt.outcome === 'ready');

/** A QA job that ended done (PRD 3001): its log's record line says its verdict, or that none reads. */
const isChecked = (step: Step, attempt: Attempt): boolean => isQaStep(step) && attempt.status === 'done';

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

  /** The pages whose fleet approval (`given`, this mission's) a person overturned after it was given (PRD 2896 s11); no read when none was given. */
  async function overturnedAmong(given: readonly z.infer<typeof ApprovalRowSchema>[], mission: string, pageOf: ReadonlyMap<PrdNumber, string>): Promise<Set<string>> {
    const overturned = new Set<string>();
    if (given.length === 0) return overturned;
    for (const event of rowsOf(OverturnRowSchema, await db.from('mission_events').select(OVERTURN).eq('mission_id', mission).eq('kind', 'overturned').not('prd', 'is', null).order('at'))) {
      const page = event.prd === null ? undefined : pageOf.get(event.prd);
      const row = given.find((one) => one.dossier_id === page);
      if (row !== undefined && Date.parse(event.at) > Date.parse(row.approved_at)) overturned.add(row.dossier_id);
    }
    return overturned;
  }

  /**
   * Each PRD's latest product approval, and whether a push voided it, by its page's id. A fleet's approval given in another
   * mission than `mission` counts for that mission only (PRD 2896 s9): here it reads as none.
   */
  async function approvals(dossiers: readonly string[], mission: string, pageOf: ReadonlyMap<PrdNumber, string>): Promise<Map<string, { voided: boolean; overturned: boolean }>> {
    if (dossiers.length === 0) return new Map();
    const rows = rowsOf(
      ApprovalRowSchema,
      await db.from('approvals').select(APPROVAL).in('dossier_id', dossiers).eq('approval_kind', 'product').order('approved_at', { ascending: false }).order('id', { ascending: false }),
    );
    const latest = new Map<string, string>();
    const elsewhere = new Set<string>();
    for (const row of rows) {
      if (latest.has(row.dossier_id) || elsewhere.has(row.dossier_id)) continue;
      if (row.mission_id !== null && row.mission_id !== mission) elsewhere.add(row.dossier_id);
      else latest.set(row.dossier_id, row.id);
    }
    const ids = [...latest.values()];
    const voided = new Set(ids.length === 0 ? [] : rowsOf(VoidRowSchema, await db.from('approval_voids').select(VOID).in('approval_id', ids)).map((row) => row.approval_id));
    // A person overturned the fleet's approval, given in this mission, after it was given (PRD 2896 s11): it no longer counts here.
    const overturnedHere = await overturnedAmong(rows.filter((row) => row.mission_id === mission && latest.get(row.dossier_id) === row.id), mission, pageOf);
    return new Map([...latest].map(([dossier, id]) => [dossier, { voided: voided.has(id), overturned: overturnedHere.has(dossier) }]));
  }

  /**
   * `runs`, each Reviewer verdict carrying what its log says it posted, and each QA job that ended done its verdict, or null when
   * none reads (PRD 3001): one read of those jobs' log tails, none without one. Only the verdict is kept, never a line of the log.
   */
  async function withPosted(runs: Run[]): Promise<Run[]> {
    const read = (step: Step, attempt: Attempt): boolean => isVerdict(step, attempt) || isChecked(step, attempt);
    const ids = runs.flatMap((one) => one.attempts.filter((attempt) => read(one.step, attempt)).map((attempt) => attempt.id));
    if (ids.length === 0) return runs;
    const logs = new Map(rowsOf(JobLogRowSchema, await db.from('runner_jobs').select(JOB_LOG).in('id', ids)).map((row) => [row.id, row.log_tail]));
    return runs.map((one) => ({
      ...one,
      attempts: one.attempts.map((attempt) => {
        const log = logs.get(attempt.id);
        if (isChecked(one.step, attempt)) return { ...attempt, checked: log === undefined ? null : qaLine(log) };
        return log === undefined || !isVerdict(one.step, attempt) ? attempt : { ...attempt, posted: postedOf(log) };
      }),
    }));
  }

  /** The latest plan on a PRD's page; null when it has none. */
  async function planOf(dossier: string | undefined): Promise<string | null> {
    if (dossier === undefined) return null;
    const [plan] = rowsOf(PlanRowSchema, await db.from('dossier_versions').select(PLAN).eq('dossier_id', dossier).eq('kind', 'plan').order('created_at', { ascending: false }).limit(1));
    return plan?.content ?? null;
  }

  /** Each job with the resumes that carry it on, in order, the job first (PRD 2809). */
  async function chainsOf(jobs: readonly JobRow[]): Promise<Map<string, JobRow[]>> {
    const chains = new Map(jobs.map((job) => [job.id, [job]]));
    let frontier = new Map(jobs.map((job) => [job.id, job.id]));
    // A chain is three tries and six waits at most (runner_jobs.attempt, runner_jobs.waits, PRD 2949): the whole chain is followed.
    for (let round = 0; round < CHAIN_MAX && frontier.size > 0; round += 1) {
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
    return chains;
  }

  /** A job of the mission queued under its key (none for a care or an item's committee), sent by the app: its id, or null when the key was already held. */
  async function queue({ mission, toFleet, line, key }: { mission: MissionRecord; toFleet: boolean; line: string; key: string | null }): Promise<string | null> {
    const answer = await db
      .from('runner_jobs')
      .insert({ workspace_id: mission.workspace, repo: mission.repo, line, sent_by_app: APP_SENDER, to_fleet: toFleet ? mission.fleet : null, mission_id: mission.id, mission_key: key })
      .select('id');
    return madeOf(answer, 'queued no job');
  }

  /** What the run reads of the fleet's last 24 hours up to `at`: what its jobs counted, and when the oldest of them ended. */
  async function fleetSpent(mission: MissionRecord, at: Date): Promise<Pick<BudgetRead, 'fleetSpent24h' | 'oldestEnd'>> {
    const [fleet] = rowsOf(FleetTokensRowSchema, await db.rpc('fleet_tokens_24h', { p_workspace: mission.workspace, p_fleet: mission.fleet, p_at: at.toISOString() }));
    return { fleetSpent24h: fleet?.tokens ?? 0, oldestEnd: fleet?.oldest_end ?? null };
  }

  /** The fleet's daily cap; null for none. */
  async function fleetCapOf(mission: MissionRecord): Promise<number | null> {
    const [team] = rowsOf(FleetCapRowSchema, await db.from('teams').select(FLEET_CAP).eq('workspace_id', mission.workspace).eq('name', mission.fleet).limit(1));
    return team?.daily_tokens ?? null;
  }

  /** What every ended job of the mission counted. */
  async function missionSpent(mission: MissionRecord): Promise<number> {
    const spent = await db.rpc('mission_tokens', { p_mission: mission.id });
    if (spent.error) throw new Error(`the database refused the mission's tokens: ${spent.error.message}`);
    return CountSchema.parse(spent.data ?? 0);
  }

  /** The latest stop naming the mission, and its fleet's stop still waiting for an answer. */
  async function stopsOf(mission: MissionRecord): Promise<Pick<BudgetRead, 'named' | 'open'>> {
    const stops = () => db.from('mission_budget_stops').select(STOP).eq('workspace_id', mission.workspace);
    const named = rowsOf(StopRowSchema, await stops().contains('missions', [mission.id]).order('created_at', { ascending: false }).limit(1)).map(stopOf);
    const open = rowsOf(StopRowSchema, await stops().eq('fleet', mission.fleet).eq('cap', 'fleet').is('answer', null).limit(1)).map(stopOf);
    return { named: named[0] ?? null, open: open[0] ?? null };
  }

  return {
    async mission(id) {
      const [row] = rowsOf(MissionRowSchema, await db.from('missions').select(MISSION).eq('id', id).limit(1));
      if (!row) return null;
      return { id: row.id, workspace: row.workspace_id, repo: row.repo, fleet: row.fleet, number: row.number, title: row.title, level: row.mandate.level, status: row.status, waitingOn: row.waiting_on, parallel: row.mandate.parallel, scope: row.scope, hardToRevert: row.mandate.hardToRevert, ownPrds: row.mandate.ownPrds, ...(row.mandate.tokens === null ? {} : { tokens: row.mandate.tokens }) };
    },

    async facts(mission) {
      const scope = expandScope(mission.scope.prds, await roadmapRows(mission));
      const prds = scope.map(({ prd }) => prd);
      if (prds.length === 0) return [];
      const stages = rowsOf(StageRowSchema, await db.from('prd_stages').select(STAGE).eq('workspace_id', mission.workspace).eq('repository', mission.repo).in('prd', prds));
      const dossiers = rowsOf(DossierRowSchema, await db.from('dossiers').select(DOSSIER).eq('workspace_id', mission.workspace).eq('home_repo', mission.repo).eq('kind', 'prd').in('prd', prds));
      const pageOf = new Map(dossiers.flatMap((row) => (row.prd === null ? [] : [[row.prd, row.id] as const])));
      const approved = await approvals([...pageOf.values()], mission.id, pageOf);
      const facts: PrdFacts[] = [];
      for (const { prd, blockers } of scope) {
        const page = pageOf.get(prd);
        facts.push({
          prd,
          approval: approvalOf(page === undefined ? null : (approved.get(page) ?? null)),
          stage: stageOf(stages.filter((row) => row.prd === prd).map((row) => row.stage)),
          blockers,
          territory: territoryOf(await planOf(page)),
          page: page ?? null,
        });
      }
      return facts;
    },

    async runs(id) {
      const jobs = rowsOf(JobRowSchema, await db.from('runner_jobs').select(JOB).eq('mission_id', id).order('queued_at'));
      const chains = await chainsOf(jobs);
      const runs = jobs.flatMap((job): Run[] => {
        const key = job.mission_key === null ? null : runOfKey(job.mission_key);
        return key === null ? [] : [{ prd: key.prd, run: key.run, step: key.step, job: job.id, attempts: (chains.get(job.id) ?? [job]).map(attemptOf) }];
      });
      return withPosted(runs);
    },

    async fleetEvents(id) {
      return rowsOf(FleetEventRowSchema, await db.from('mission_events').select(FLEET_EVENT).eq('mission_id', id).in('kind', ['decided', 'overturned']).order('at')).map((row) => ({ kind: row.kind, prd: row.prd, sentence: row.sentence, link: row.link, actor: row.actor }));
    },

    async events(id) {
      return rowsOf(EventRowSchema, await db.from('mission_events').select(EVENT).eq('mission_id', id).order('at')).map((row) => ({ kind: row.kind, prd: row.prd, job: row.job_id }));
    },

    async fleetRunners(mission) {
      const runners = rowsOf(RunnerRowSchema, await db.from('runners').select(RUNNER).eq('workspace_id', mission.workspace).eq('fleet', mission.fleet));
      return runners.some((runner) => runner.repos.some((repo) => repo.toLowerCase() === mission.repo));
    },

    async room(mission, toFleet) {
      const query = db.from('runners').select(ROOM_RUNNER).eq('workspace_id', mission.workspace);
      const runners = rowsOf(RoomRunnerRowSchema, await (toFleet ? query.eq('fleet', mission.fleet) : query.is('fleet', null)));
      if (runners.length === 0) return [];
      const held = rowsOf(RoomJobRowSchema, await db.from('runner_jobs').select(ROOM_JOB).in('runner_id', runners.map((runner) => runner.id)).in('status', ['claimed', 'running']));
      return runners.map((runner) => ({
        repos: runner.repos,
        slots: runner.slots,
        used: held.filter((job) => job.runner_id === runner.id).length,
        lastSeenAt: runner.last_seen_at,
        health: runner.health,
      }));
    },

    async planRepository(mission) {
      const products = rowsOf(ProductRowSchema, await db.from('products').select(PRODUCT).eq('workspace_id', mission.workspace).is('archived_at', null));
      return products.some((product) => product.plan_repository?.toLowerCase() === mission.repo.toLowerCase());
    },

    async installation(mission) {
      const [workspace] = rowsOf(WorkspaceRowSchema, await db.from('workspaces').select(WORKSPACE).eq('id', mission.workspace).limit(1));
      return workspace?.github_installation_id ?? null;
    },

    send: ({ mission, prd, run, step, toFleet, skill, fix = null }) =>
      queue({ mission, toFleet, line: lineOf(prd, step, skill, baseOf(mission, skill === 'ultra-yolo'), fix), key: missionKey(mission.id, prd, run, step) }),

    async care({ mission, line, since, toFleet }) {
      // The mission's runs happen one at a time (its lane): a read, then the insert, sends one.
      const sent = rowsOf(CareRowSchema, await db.from('runner_jobs').select(CARE).eq('mission_id', mission.id).eq('line', line).gte('queued_at', since).limit(1));
      return sent.length > 0 ? null : queue({ mission, toFleet, line, key: null });
    },

    async committees(id) {
      const jobs = rowsOf(JobRowSchema, await db.from('runner_jobs').select(JOB).eq('mission_id', id).like('mission_key', `mission:${id}:prd:%:approve:%`).order('queued_at'));
      if (jobs.length === 0) return [];
      const decided = rowsOf(DecisionRowSchema, await db.from('mission_decisions').select(DECISION).eq('mission_id', id));
      return jobs.flatMap((job): Committee[] => {
        const key = job.mission_key === null ? null : committeeOfKey(job.mission_key);
        const decision = decided.find((row) => row.job_id === job.id);
        return key === null ? [] : [{ prd: key.prd, round: key.round, job: job.id, attempt: attemptOf(job), decision: decision ? { outcome: decision.outcome, why: decision.why } : null }];
      });
    },

    async committeeLog(job) {
      const [row] = rowsOf(JobLogRowSchema, await db.from('runner_jobs').select(JOB_LOG).eq('id', job).limit(1));
      return row?.log_tail ?? null;
    },

    async decide(mission, one, { record, decision }) {
      const answer = await db.rpc('mission_decide_approval', {
        p_mission: mission.id,
        p_prd: one.prd,
        p_job: one.job,
        p_record: record,
        p_outcome: decision.outcome,
        p_why: decision.why,
      });
      if (answer.error) throw new Error(`the database refused the committee's decision: ${answer.error.message}`);
      return DecidedSchema.parse(answer.data);
    },

    approve: ({ mission, prd, round, toFleet, author = null }) => queue({ mission, toFleet, line: approveLine(prd, author), key: committeeKey(mission.id, prd, round) }),

    async pmJobs(id) {
      const jobs = rowsOf(AskRowSchema, await db.from('runner_jobs').select(ASK).eq('mission_id', id).like('mission_key', `mission:${id}:pm:%`).order('queued_at'));
      return jobs.flatMap((job): PmJob[] => {
        const round = job.mission_key === null ? null : pmRoundOfKey(job.mission_key);
        return round === null ? [] : [{ round, job: job.id, line: job.line, attempt: attemptOf(job) }];
      });
    },

    pm: ({ mission, round, line, toFleet }) => queue({ mission, toFleet, line, key: pmKey(mission.id, round) }),

    async asks(id) {
      const rows = rowsOf(AskRowSchema, await db.from('runner_jobs').select(ASK).eq('mission_id', id).is('mission_key', null).like('line', '/omni:committee % --item %').order('queued_at'));
      return rows.flatMap((row) => {
        const named = itemOfLine(row.line);
        return named === null ? [] : [{ prd: named.prd, item: named.item, job: row.id, attempt: attemptOf(row) }];
      });
    },

    async ask({ mission, prd, item, toFleet }) {
      // The mission's runs happen one at a time (its lane): a read, then the insert, sends one per item, whatever its bound.
      const sent = rowsOf(CareRowSchema, await db.from('runner_jobs').select(CARE).eq('mission_id', mission.id).is('mission_key', null).like('line', `${askPrefix(prd, item)}%`).limit(1));
      return sent.length > 0 ? null : queue({ mission, toFleet, line: askLine(prd, item, mission.hardToRevert ?? DEFAULT_BOUND), key: null });
    },

    async repairs(id) {
      const jobs = rowsOf(AskRowSchema, await db.from('runner_jobs').select(ASK).eq('mission_id', id).like('mission_key', `mission:${id}:prd:%:repair:%`).order('queued_at'));
      const chains = jobs.length === 0 ? new Map<string, JobRow[]>() : await chainsOf(jobs);
      const repairJobs = jobs.flatMap((job): RepairJob[] => {
        const key = job.mission_key === null ? null : repairOfKey(job.mission_key);
        const failedJob = failedJobOf(job.line);
        return key === null || failedJob === null ? [] : [{ prd: key.prd, k: key.k, job: job.id, failedJob, attempts: (chains.get(job.id) ?? [job]).map(attemptOf) }];
      });
      const rows = rowsOf(RepairRowSchema, await db.from('mission_repairs').select(REPAIR).eq('mission_id', id).order('started_at')).map(repairOf);
      return { jobs: repairJobs, rows };
    },

    repair: ({ mission, prd, k, failedJob, toFleet }) => queue({ mission, toFleet, line: repairSkillLine(mission.number, prd, failedJob), key: repairKey(mission.id, prd, k) }),

    async keepRepair(mission, { prd, fingerprint, round, failedJob, job, retro, fixPr }) {
      const answer = await db
        .from('mission_repairs')
        .insert({ mission_id: mission.id, prd, fingerprint, round, failed_job_id: failedJob, job_id: job, retro, fix_pr: fixPr })
        .select(REPAIR);
      if (answer.error?.code === OVER_BUDGET) return { spent: answer.error.hint === 'mission' ? 'mission' : 'cause' };
      const [kept] = rowsOf(RepairRowSchema, answer);
      if (!kept) throw new Error('the database kept no repair and gave no reason');
      return repairOf(kept);
    },

    async endRepair(id, outcome) {
      rowsOf(z.unknown(), await db.from('mission_repairs').update({ outcome }).eq('id', id).is('outcome', null).select('id'));
    },

    async bugIssue(fingerprint) {
      const [row] = rowsOf(BugReportRowSchema, await db.from('omni_bug_reports').select(BUG_REPORT).eq('fingerprint', fingerprint).limit(1));
      return row ?? null;
    },

    addJob: (job) => jobLedger(connection).add(job),

    async names(mission) {
      const repositories = rowsOf(RepositoryRowSchema, await db.from('repositories').select(REPOSITORY).eq('workspace_id', mission.workspace));
      const actors = rowsOf(ActorRowSchema, await db.from('mission_events').select(ACTOR).eq('mission_id', mission.id).neq('actor', 'agent'));
      const names = [mission.repo, ...repositories.map((row) => row.full_name)].flatMap((full) => [full, ...full.split('/')]);
      return [...new Set([...names, ...actors.flatMap((row) => (row.actor === null ? [] : [row.actor]))].filter((name) => name.length > 0))];
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

    async budget(mission, at) {
      const fleetCap = await fleetCapOf(mission);
      const spent = await missionSpent(mission);
      const fleet = await fleetSpent(mission, at);
      const stops = await stopsOf(mission);
      const pauses = rowsOf(PauseEventRowSchema, await db.from('mission_events').select(PAUSE_EVENT).eq('mission_id', mission.id).in('kind', ['paused', 'resumed']).is('prd', null).order('at', { ascending: false }).limit(PAUSES_READ));
      return { missionSpent: spent, missionCap: mission.tokens ?? null, fleetCap, ...fleet, ...stops, ...pausesOf(pauses) };
    },

    async fleetMissions(mission) {
      const rows = rowsOf(FleetMissionRowSchema, await db.from('missions').select(FLEET_MISSION).eq('workspace_id', mission.workspace).eq('fleet', mission.fleet).in('status', ['running', 'waiting']).order('created_at').limit(STOP_MISSIONS));
      return [mission.id, ...rows.map((row) => row.id).filter((id) => id !== mission.id)].slice(0, STOP_MISSIONS);
    },

    async stop(mission, { cap, capTokens, spent, missions }) {
      const answer = await db
        .from('mission_budget_stops')
        .insert({ workspace_id: mission.workspace, fleet: mission.fleet, cap, mission_id: cap === 'mission' ? mission.id : null, cap_tokens: capTokens, spent, missions: [...missions] })
        .select('id');
      return madeOf(answer, 'recorded no budget stop');
    },

    async pause(ids, waitingOn) {
      if (ids.length === 0) return;
      rowsOf(
        z.unknown(),
        await db.from('missions').update({ status: 'paused', waiting_on: waitingOn, next_wake_at: null, updated_at: new Date().toISOString() }).in('id', [...ids]).in('status', ['running', 'waiting']).select('id'),
      );
    },
  };
}
