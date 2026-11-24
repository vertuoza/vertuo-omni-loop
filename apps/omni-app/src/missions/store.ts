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
//   fleetRunners whether a runner of the mission's AI Fleet holds its repository
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
//   bugIssue     the Omni Loop bug a fingerprint was filed as (`omni_bug_reports`), read only for its repository, its issue, and
//                where it stands (PRD 3088: open, fixed in its version, or won't fix)
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
//   retros       PRD 3065: the roadmaps of the scope with their PRDs; the stuck repairs the mission sent (`…:stuck:<k>`, the jobs
//                their line names) and one queued, claimed first in line; the milestone retros it sent (`…:retro:<milestone>`) and
//                the `mission_retros` rows kept, one queued; a retro kept once per milestone (23505 keeps none) and the changes
//                it proposed as `mission_items`, each once. A stuck repair's row is a `mission_repairs` row, `trigger` stuck, and
//                `update` writes `paused_by` stuck when a run pauses the mission by stuck
//   bugTeam      PRD 3088: an `omni-bugs` mission's bugs, the rows of `omni_bug_reports` filed on its repository that it may still
//                take, run or wait on (open, fixing, asked), never a workspace, a mission or a log of who reported one; its bug-fix
//                jobs (`…:bug:<issue>:run:<k>`) with their resumes; one queued, `/omni:bug-fix #<issue>`, under its key; and a bug's
//                row moved only while it still holds the state and tries the run read; and the paused or stopped missions to tell
//                that a bug a PRD of theirs stopped on was fixed or will not be (`mission_repairs` of class omni-loop, joined by
//                the fingerprint as the service role, never shown to anyone), each that has no `bug-fixed` event of it yet
//   alone        PRD omni-loop-21: a scope's product PRD and roadmap ids (`products`, beside the repository's numbers the supervisor
//                reads), the mandate's `resumes`; a step's k-th fresh job after one that ended without its result line, under its
//                step's key and `:resume:<k>` (a run's step, a committee's or a PM's), read back as that step with its `resume`;
//                the mission's branch in each repository, kept once per repository (`mission_branches`); an item committee's
//                decision, carried, deferred with its option or escalated, recorded through mission_decide_item() as the service
//                role; and every decision of the mission, an approval's and an item's (`mission_decisions`), for its landing
//   products     PRD omni-loop-21 s3b: a mission's events (its joins among them), decisions and repairs name a product PRD by its
//                id (`product_prd`) where a repository's is named by its number (`prd`), and are read back from `prd_id`, either
//                as text (./store.prd.ts); a product PRD's reaches a reader of numbers only as `product`, its `prd` null, and an
//                item's decision on one goes through mission_decide_item() named by its id
//   reviews      PRD omni-loop-26: the PM product PRDs' plan versions (the latest `dossier_versions` sha256 of kind plan on each
//                page), the Architect's reviews the mission sent (`mission:<id>:prd:<product id>:tech:<k>`) and one queued, the
//                `plan` and `tech` decisions recorded through mission_decide_plan() as the service role (BR-PRODUCT-94), read
//                back in order, and the mission's repository's phase 0 (`repositories.phase0`) and its one live product
//                (`product_repositories`, `products.key`)
//
// Throws when the database refuses or answers out of shape: the run fails, and the worker retries it.
import { z } from 'zod';
import {
  IssueNumberSchema,
  PrdNumberSchema,
  PrNumberSchema,
  ProductPrdIdSchema,
  ProductRoadmapIdSchema,
  type IssueNumber,
  type PrdNumber,
  type ProductPrdId,
  type ProductRoadmapId,
} from 'omni-loop/kit/lib/ids.ts';
import { isProductPrdId, productPrdParts, productRoadmapParts } from 'omni-loop/kit/lib/ids.ts';
import { planTargets } from './branch.ts';
import { expandMissionScope, rowsOfRoadmap, type ScopeEntry, type ScopeRow } from './expand.ts';
import { numberedOf, PrdIdSchema, prdColumns, productRunOfKey, type MissionPrd, type ProductNamed } from './store.prd.ts';
import { DEFAULT_RESUMES, MISSION_LEVELS, type MissionKind } from 'omni-loop/kit/lib/mission/brief.ts';
import { BUG_STATES, BUG_TRIES, bugFixLine, bugKey, bugOfKey, type Bug, type BugJob, type BugMove } from './bug-team.ts';
import type { DecisionEvent } from 'omni-loop/kit/lib/mission/overturn.ts';
import type { Connection } from '../approved-check/record.ts';
import { rowsOf, serviceDb } from '../server-event/service-db.ts';
import type { OpenItems } from './gate.ts';
import { approveLine, committeeKey, committeeOfKey, type Committee, type Decision, type Recorded } from './committee.ts';
import { askLine, askPrefix, DEFAULT_BOUND, itemOfLine, type ItemCommittee } from './answers.ts';
import { pmKey, pmRoundOfKey, type Home, type PmJob } from './pm.ts';
import { techKey, techOfKey, type PlanDecision, type TechJob } from './tech.ts';
import type { PlanRecord } from 'omni-loop/kit/lib/virtual-fleet/plan-record.ts';
import type { TechRecord } from 'omni-loop/kit/lib/virtual-fleet/tech-record.ts';
import { RepairRetroSchema } from 'omni-loop/kit/lib/repair/retro.ts';
import { jobLedger, type NewJob } from '../jobs/ledger.ts';
import { bugFixOf, failedJobOf, repairKey, repairSkillLine, repairOfKey, untold, type BugFix, type RepairJob, type RepairOutcome, type RepairRow, type StuckJob } from './repair.ts';
import { retroKey, retroOfKey, retroSkillLine, type ItemRow, type Milestone, type MissionRetro, type RetroJob, type RetroRow, type RoadmapScope } from './milestone.ts';
import { stuckJobsOf, stuckKey, stuckOfKey, stuckSkillLine } from './stuck.ts';
import type { CommitteeRole, MemberVerdict } from 'omni-loop/kit/lib/committee/vote.ts';
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
  type ProductFact,
  type ProductRun,
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
  /** `paused_by` (PRD 3065): `stuck` while the supervisor holds it paused by stuck; absent otherwise. */
  pausedBy?: 'stuck';
  /** `kind` (PRD 3088): `omni-bugs` for the standing Omni Loop bug team; absent, a mission of PRDs. */
  kind?: MissionKind;
  /** `mandate.resumes` (PRD omni-loop-21): how many times a step that ended without its result line is sent again; 3 when absent. */
  resumes?: number;
  /** PRD omni-loop-21: the product PRDs and product roadmaps its scope names, beside `scope`'s numbers; absent when it names none. */
  products?: { prds: ProductPrdId[]; roadmaps: ProductRoadmapId[] };
};

/** A mission's branch in one repository (PRD omni-loop-21): cut once from its default branch, kept once. */
export type MissionBranch = { repo: string; branch: string; cutAt: string };

/** The option a deferred item is settled with meanwhile (PRD omni-loop-21 s2: the kit takes A, as built). */
export type ItemOption = 'A' | 'B' | 'C' | 'D';
const ITEM_OPTIONS = ['A', 'B', 'C', 'D'] as const;

/**
 * An item committee's decision (PRD omni-loop-21): `carried`, its why the cases of the escalation list it was on; `deferred`, settled
 * meanwhile with `option`, open for a person on the mission pull request; or `escalated` to a person.
 */
export type ItemDecision = { outcome: 'carried' | 'deferred' | 'escalated'; why: string[]; option: ItemOption | null };

/** An item committee's decision to record: the PRD (a product's too, PRD omni-loop-21 s3b), the item, its job, the members' verdicts and what the App decided. */
export type ItemDecide = { prd: MissionPrd; item: string; job: string; verdicts: readonly MemberVerdict[]; decision: ItemDecision };

/** One decision the mission's committee recorded (PRD omni-loop-21): an approval's (`approve`, no item) or an item's (`answer`). */
export type MissionDecision = { kind: 'approve' | 'answer'; prd: MissionPrd; item: string | null; job: string } & ItemDecision & { decidedAt: string };

/** A step's resume (PRD omni-loop-21): its k-th fresh job after one that ended without its result line; absent on the step's first job. */
export type Resumed = { resume?: number };

/**
 * A bug-fix job to send (PRD 3088): the mission, the bug's issue, its number among the bug's jobs, and where it goes; `line`, the line it
 * is sent as when not the bug team's own (an outside bug's, `/omni:bug-fix #<issue> --base <mission branch>`: PRD omni-loop-21 s9b).
 */
export type BugSend = { mission: MissionRecord; issue: IssueNumber; k: number; toFleet: boolean; line?: string };

/**
 * An `omni-bugs` mission's bugs and their jobs (PRD 3088), as the service role. A store without them (a test's) reads no bug, and the
 * team takes none.
 */
export type MissionBugTeam = {
  /** The bugs filed on `repo` the team may take, run or wait on: open, fixing or asked, oldest first. */
  bugs: (repo: string) => Promise<Bug[]>;
  /** The bug-fix jobs the mission sent (`…:bug:<issue>:run:<k>`), each with its resumes. */
  jobs: (id: string) => Promise<BugJob[]>;
  /** A bug-fix job queued under its key: its id, or null when the key was already held. */
  send: (job: BugSend) => Promise<string | null>;
  /** The bug's row moved to `to`, only while it still holds the state and tries the run read: whether it moved. */
  move: (bug: Bug, to: BugMove) => Promise<boolean>;
  /**
   * The paused or stopped missions, of any workspace, holding a PRD on a bug that was fixed or will not be, and not told yet (no
   * `bug-fixed` event of that bug): the ones the team wakes, so each records it once (PRD 3088 s5). Their ids and repositories only.
   * Absent (a store that keeps no repairs), the team wakes none.
   */
  holders?: () => Promise<{ id: string; repo: string }[]>;
};

/** A stuck repair to send (PRD 3065): the mission, its number among the mission's stuck repairs, the five jobs, and where it goes. */
export type StuckSend = { mission: MissionRecord; k: number; jobs: readonly string[]; toFleet: boolean };

/** A milestone retro to send (PRD 3065): the mission, its milestone, and where it goes. */
export type RetroSend = { mission: MissionRecord; milestone: Milestone; toFleet: boolean };

/** A milestone's retro to keep (PRD 3065): its job (none when skipped before one was sent), and its retro and file, or why it was skipped. */
export type NewRetro = { milestone: Milestone; job: string | null } & ({ retro: MissionRetro; file: string | null } | { skipped: string });

/**
 * The mission's stuck repairs and milestone retros (PRD 3065), as the service role. A store without them (a test's) runs no stuck
 * count and no milestone retro.
 */
export type MissionRetros = {
  /** The roadmaps of the mission's scope, in the scope's order, each with its PRDs. */
  milestones: (mission: MissionRecord) => Promise<RoadmapScope[]>;
  /** The stuck repairs the mission sent: its jobs keyed `…:stuck:<k>`, each with the jobs its line names and its resumes. */
  stucks: (id: string) => Promise<StuckJob[]>;
  /** A stuck repair's job queued under its key, claimed first in line: its id, or null when the key was already held. */
  stuck: (job: StuckSend) => Promise<string | null>;
  /** The milestone retros the mission sent (`…:retro:<milestone>`), with their resumes, and the rows the database kept. */
  retros: (id: string) => Promise<{ jobs: RetroJob[]; rows: RetroRow[] }>;
  /** A milestone retro's job queued under its key: its id, or null when the key was already held. */
  retro: (job: RetroSend) => Promise<string | null>;
  /** A milestone's retro kept: its id, or null when one was kept for that milestone already. */
  keepRetro: (mission: MissionRecord, row: NewRetro) => Promise<string | null>;
  /** The changes a retro proposed, kept as the mission's own outbox: the numbers kept, none already kept twice. */
  keepItems: (mission: MissionRecord, retro: string, items: readonly ItemRow[]) => Promise<number[]>;
};

/** An item's committee to send (PRD 2896 s10): the mission, the PRD, the item, and whether the fleet's runners take it. */
export type Ask = { mission: MissionRecord; prd: PrdNumber; item: string; toFleet: boolean };

/** The skill a mission builds its PRD with: `ultra-yolo` for a PRD of a plan repository, `yolo` otherwise (PRD 2873). */
export type MissionSkill = BuildSkill;

/**
 * A committee to send (PRD 2896 s9): the mission, the PRD, its round, whether the fleet's runners take it, and the hero who wrote
 * the PRD and sits out (PRD 2896 s12: the PM, for a PRD its fleet added), none by default.
 */
export type Approve = { mission: MissionRecord; prd: PrdNumber; round: number; toFleet: boolean; author?: CommitteeRole | null } & Resumed;

/** The mission's PM job to send (PRD 2896 s12): the mission, its round, its line, and whether the fleet's runners take it. */
export type PmSend = { mission: MissionRecord; round: number; line: string; toFleet: boolean } & Resumed;

/**
 * A job to send: the mission, the PRD, its run and step, whether the fleet's runners take it, and the build's skill; for the
 * Engineer's fix of a QA bug, the bug and the feature branch it is fixed into (PRD 3001).
 */
export type Dispatch = { mission: MissionRecord; prd: PrdNumber; run: number; step: Step; toFleet: boolean; skill: MissionSkill; fix?: Fix } & Resumed;

/**
 * A care job to send (PRD 2896 s5): its line, and since when one of it counts as sent, the mission branch's head's commit time,
 * so one job is sent per feature branch and head of the mission branch. It is no step of a run: it has no mission key.
 */
export type Care = { mission: MissionRecord; line: string; since: string; toFleet: boolean };

/** A repair to send (PRD 2980): the mission, the PRD, its number among the PRD's repairs, the job that failed, and where it goes. */
export type RepairSend = { mission: MissionRecord; prd: PrdNumber; k: number; failedJob: string; toFleet: boolean };

/** A repair's row as the store reads it: a product PRD's (PRD omni-loop-21 s3b) names it as `product`, its `prd` null. */
export type StoredRepair = RepairRow & ProductNamed;

/**
 * A repair's row to keep: what its record line found, in the mission's round, and, for a stuck repair, its trigger. The database
 * numbers it. Its PRD a repository's number or a product's id (PRD omni-loop-21 s3b).
 */
export type NewRepair = Pick<RepairRow, 'fingerprint' | 'round' | 'failedJob' | 'job' | 'retro' | 'fixPr' | 'trigger'> & { prd: MissionPrd | null };

/** The row kept, or the cap the database refused it on. */
export type Kept = StoredRepair | { spent: 'cause' | 'mission' };

/** An event to record: its PRD a repository's number or a product's id (PRD omni-loop-21 s3b). */
export type NewStoredEvent = Omit<NewEvent, 'prd'> & { prd: MissionPrd | null };
/** An event recorded, as a run reads it back: a product PRD's names it as `product`, its `prd` null (PRD omni-loop-21 s3b). */
export type StoredEvent = RecordedEvent & ProductNamed;
/** A fleet's decision or a person's overturn, as recorded: a product PRD's names it as `product`, its `prd` null. */
export type StoredDecisionEvent = DecisionEvent & ProductNamed;

export type MissionStore = {
  mission: (id: string) => Promise<MissionRecord | null>;
  facts: (mission: MissionRecord) => Promise<PrdFacts[]>;
  /** Each job of a step, a resume of it (PRD omni-loop-21) included, with its `resume`. */
  runs: (id: string) => Promise<(Run & Resumed)[]>;
  /** Its events, a product PRD's naming it by its id (PRD omni-loop-21 s3b). */
  events: (id: string) => Promise<StoredEvent[]>;
  fleetEvents: (id: string) => Promise<StoredDecisionEvent[]>;
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
  committees: (id: string) => Promise<(Committee & Resumed)[]>;
  /** The log tail of a committee's job; null when it has none. */
  committeeLog: (job: string) => Promise<string | null>;
  /** A committee job's decision recorded once, as the database kept it. */
  decide: (mission: MissionRecord, one: Committee, recorded: Recorded) => Promise<Decision>;
  /** A committee's job: its id, or null when its key was already held. */
  approve: (job: Approve) => Promise<string | null>;
  /** The PM jobs the mission sent (PRD 2896 s12): its jobs keyed `…:pm:<k>`, in order. */
  pmJobs: (id: string) => Promise<(PmJob & Resumed)[]>;
  /** The mission's PM job queued under its key: its id, or null when the key was already held. */
  pm: (job: PmSend) => Promise<string | null>;
  /** The item committees the mission sent (PRD 2896 s10): its jobs whose line is `/omni:committee <n> --item <id>`, in order. */
  asks: (id: string) => Promise<Omit<ItemCommittee, 'decision'>[]>;
  /** An item's committee queued, with no mission key: its id, or null when one was sent for that item already. */
  ask: (job: Ask) => Promise<string | null>;
  /** The repairs the mission sent (PRD 2980), with their resumes, and the rows the database kept of them. */
  repairs: (id: string) => Promise<{ jobs: RepairJob[]; rows: StoredRepair[] }>;
  /** A repair's job queued under its key: its id, or null when the key was already held. */
  repair: (job: RepairSend) => Promise<string | null>;
  /** A repair's row kept, or the cap the database refused it on. */
  keepRepair: (mission: MissionRecord, row: NewRepair) => Promise<Kept>;
  /** A repair's outcome, set once. */
  endRepair: (id: string, outcome: RepairOutcome) => Promise<void>;
  /** The Omni Loop bug a fingerprint was filed as, and where it stands (PRD 3088; absent, open); null when none was filed. */
  bugIssue: (fingerprint: string) => Promise<{ repo: string; issue: IssueNumber; fix?: BugFix } | null>;
  /** A job added to the App's ledger: whether it was added (a key already held adds none). */
  addJob: (job: NewJob) => Promise<boolean>;
  /** The names the mission's workspace is known by, which a public report never holds. */
  names: (mission: MissionRecord) => Promise<string[]>;
  /** The run's events recorded, a product PRD's under its id (PRD omni-loop-21 s3b). */
  record: (id: string, events: readonly NewStoredEvent[], at: Date) => Promise<void>;
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
  /** Its stuck repairs and milestone retros (PRD 3065); absent, none is read or sent. */
  retros?: MissionRetros;
  /** An `omni-bugs` mission's bugs and jobs (PRD 3088); absent, none is read or sent. */
  bugTeam?: MissionBugTeam;
  /** The mission's branch in each repository it was cut in (PRD omni-loop-21), in the order they were cut. */
  branches: (id: string) => Promise<MissionBranch[]>;
  /** A mission branch kept once it is cut: whether it was kept (false when one was kept for that repository already). */
  keepBranch: (mission: MissionRecord, branch: { repo: string; branch: string }) => Promise<boolean>;
  /** An item committee's decision recorded once, as the database kept it (PRD omni-loop-21). */
  decideItem: (mission: MissionRecord, one: ItemDecide) => Promise<ItemDecision>;
  /** Every decision the mission's committee recorded, an approval's and an item's, in the order they were taken: what landing lists. */
  decisions: (id: string) => Promise<MissionDecision[]>;
  /** The product PRDs of the scope, their builds and their sends (PRD omni-loop-21 s9b); absent, none is read or sent. */
  products?: MissionProducts;
};

/**
 * A product PRD of the scope as the store reads it (PRD omni-loop-21 s9b): its facts, and its open items as the server holds them;
 * `plan` the sha256 of the latest plan version on its page (PRD omni-loop-26), null when it has none.
 */
export type StoredProduct = ProductFact & { items: OpenItems; plan?: string | null };

/** The Architect's review of a product PRD to send (PRD omni-loop-26): its k-th, its line (`/omni:tech-review <id> --mission <m>`). */
export type TechSend = { mission: MissionRecord; prd: ProductPrdId; k: number; line: string; toFleet: boolean };

/** A `plan` or `tech` decision to record (PRD omni-loop-26): the job's record as the App read it, null when it left none, and the App's own reasons. */
export type PlanDecide = { prd: ProductPrdId; job: string; kind: PlanDecision['kind']; record: PlanRecord | TechRecord | null; why: readonly string[] };

/** What mission_decide_plan() answers: the decision kept, and whether it names the PRD's latest plan version. */
export type PlanDecided = { outcome: PlanDecision['outcome']; why: string[]; plan: string | null; latest: boolean | null };

/** A product PRD's build to send: the mission, the PRD, its run, its line (`/omni:ultra-yolo <id> --base-of …`) and where it goes. */
export type ProductSend = { mission: MissionRecord; prd: ProductPrdId; run: number; line: string; toFleet: boolean };

/**
 * A mission's product PRDs (PRD omni-loop-21 s9b), as the service role: the scope's product PRDs and each product roadmap's rows in wave
 * order (./expand.ts), each with its approval, its blockers, its plan's repositories and its open items; the builds sent for them
 * (`mission:<id>:prd:<key>-<n>:run:<k>`); a build queued under its key, null when the key was held.
 */
export type MissionProducts = {
  facts: (mission: MissionRecord) => Promise<StoredProduct[]>;
  runs: (id: string) => Promise<ProductRun[]>;
  send: (job: ProductSend) => Promise<string | null>;
  /** PRD omni-loop-26: the Architect's reviews the mission sent, and its `plan` and `tech` decisions, in the order recorded. */
  reviews: (id: string) => Promise<{ techs: TechJob[]; decisions: PlanDecision[] }>;
  /** PRD omni-loop-26: the Architect's review queued under its key: its id, or null when the key was already held. */
  review: (job: TechSend) => Promise<string | null>;
  /** PRD omni-loop-26: a plan or tech job's decision recorded once, as the database kept it. */
  decidePlan: (mission: MissionRecord, one: PlanDecide) => Promise<PlanDecided>;
  /** PRD omni-loop-26: where the mission's repository approves its phase 0, and the one product it belongs to. */
  home: (mission: MissionRecord) => Promise<Home>;
};

/** The most times a step is sent again after ending halfway (`mandate.resumes`, 0 to 10: PRD omni-loop-21). */
const RESUMES_MAX = 10;
const RESUME = /^(.+):resume:([1-9]|10)$/;

/** A step's key for its `resume`-th fresh job: the step's own key for 0 (PRD omni-loop-21). */
export const resumeKey = (key: string, resume = 0): string => (resume === 0 ? key : `${key}:resume:${String(resume)}`);

/** The step's key a job's key names, and which of its fresh jobs it is: 0 for the step's first. */
export function resumeOfKey(key: string): { key: string; resume: number } {
  const match = RESUME.exec(key);
  return match?.[1] === undefined ? { key, resume: 0 } : { key: match[1], resume: Number(match[2]) };
}

/** `{ resume }` for a resume, nothing for a step's first job: a run read before PRD omni-loop-21 reads as it did. */
const resumed = (resume: number): Resumed => (resume === 0 ? {} : { resume });

/** Who the job is sent by: the app, never a person (`runner_jobs.sent_by_app`). */
const APP_SENDER = 'omni-app';

/** The database's answer to a key already held. */
const TAKEN = '23505';

/** The columns each read selects, shared with ./store.boundary.ts. */
export const MISSION = 'id, workspace_id, repo, fleet, number, title, status, waiting_on, mandate, scope, paused_by, kind';
export const WORKSPACE = 'github_installation_id';
export const ROADMAP = 'id, number';
export const ROADMAP_PRD = 'roadmap_id, position, row_id, prd, blockers';
export const STAGE = 'prd, stage';
export const DOSSIER = 'id, prd';
export const APPROVAL = 'id, dossier_id, mission_id, approved_at';
export const OVERTURN = 'prd_id, at';
export const FLEET_EVENT = 'kind, prd_id, sentence, link, actor';
export const VOID = 'approval_id';
export const PLAN = 'content';
export const JOB = 'id, mission_key, resumes, status, outcome, reason, pr_url, limited_until, parts';
export const JOB_LOG = 'id, log_tail';
export const CARE = 'id';
export const EVENT = 'kind, prd_id, job_id';
export const DECISION = 'job_id, outcome, why';
export const RUNNER = 'repos';
export const ROOM_RUNNER = 'id, repos, slots, last_seen_at, health';
export const ROOM_JOB = 'runner_id';
export const PRODUCT = 'plan_repository';
export const REPAIR = 'id, prd_id, fingerprint, round, number, failed_job_id, job_id, retro, fix_pr, outcome, trigger';
export const RETRO = 'id, milestone, job_id, skipped, file';
export const BUG_REPORT = 'repo, issue, state, fixed_in';
export const TEAM_BUG = 'fingerprint, issue, count, created_at, state, attempts, fix_pr, fixed_in, asked_job';
/** PRD 3088 s5: the bugs that moved, the repairs that stopped on them, the events that told them, and the missions to tell. */
export const MOVED_BUG = 'fingerprint';
export const HOLDER_REPAIR = 'mission_id, job_id, fingerprint';
export const TOLD = 'job_id';
export const HOLDER_MISSION = 'id, repo';
export const REPOSITORY = 'full_name';
export const ACTOR = 'actor';
export const FLEET_CAP = 'daily_tokens';
export const STOP = 'id, cap, cap_tokens, spent, missions, answer, raised_to, created_at, answered_at';
export const PAUSE_EVENT = 'kind, actor, at';
export const FLEET_MISSION = 'id';
/** PRD omni-loop-21: a mission's branches, and every decision of its committee. */
export const BRANCH = 'repo, branch, cut_at';
export const FLEET_DECISION = 'kind, prd_id, item, job_id, outcome, why, option, decided_at';

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
    resumes: z.number().int().min(0).max(RESUMES_MAX).default(DEFAULT_RESUMES),
    tokens: z.number().int().min(1).nullable().default(null),
  }),
  /** PRD omni-loop-21: a product's ids beside the repository's numbers. */
  scope: z.object({ prds: z.array(z.union([PrdNumberSchema, ProductPrdIdSchema])), roadmaps: z.array(z.union([IssueNumberSchema, ProductRoadmapIdSchema])) }),
  /** PRD 3065: `stuck` while paused by stuck. A row read before the column was added has none. */
  paused_by: z.enum(['stuck']).nullable().default(null),
  /** PRD 3088: `omni-bugs` for the Omni Loop bug team. A row read before the column was added is a mission of PRDs. */
  kind: z.enum(['prds', 'omni-bugs']).default('prds'),
});
export const WorkspaceRowSchema = z.object({ github_installation_id: z.number().int().positive().nullable() });
export const RoadmapRowSchema = z.object({ id: text, number: IssueNumberSchema.nullable() });
export const RoadmapPrdRowSchema = z.object({ roadmap_id: text, position: z.number().int(), row_id: text, prd: PrdNumberSchema.nullable(), blockers: z.array(z.string()) });
export const StageRowSchema = z.object({ prd: PrdNumberSchema, stage: text });
export const DossierRowSchema = z.object({ id: text, prd: PrdNumberSchema.nullable() });
export const ApprovalRowSchema = z.object({ id: text, dossier_id: text, mission_id: z.string().nullable(), approved_at: text });
export const FleetEventRowSchema = z.object({ kind: text, prd_id: PrdIdSchema.nullable(), sentence: text, link: z.string().nullable(), actor: z.string().nullable() });
export const OverturnRowSchema = z.object({ prd_id: PrdIdSchema.nullable(), at: text });
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
export const EventRowSchema = z.object({ kind: text, prd_id: PrdIdSchema.nullable(), job_id: z.string().nullable() });
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
/** PRD omni-loop-21 s9b: a product's or a dossier's id; an item of a product PRD, with its settlements (none: open). */
const IdRowSchema = z.object({ id: text });
const PRODUCT_ITEM = 'item, rank, outbox_settlements(verdict)';
const ProductItemRowSchema = z.object({ item: text, rank: text, outbox_settlements: z.array(z.looseObject({})) });
export const RepairRowSchema = z.object({
  id: text,
  /** None only for a stuck repair whose cause is the mission's own (PRD 3065); a product PRD's id (PRD omni-loop-21 s3b). */
  prd_id: PrdIdSchema.nullable(),
  trigger: z.enum(['failure', 'stuck']).default('failure'),
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
/** PRD 3088: where the bug stands, and the kit that released its fix; a row read before the columns were added is open. */
export const BugReportRowSchema = z.object({ repo: text, issue: IssueNumberSchema, state: z.enum(BUG_STATES).default('open'), fixed_in: z.string().nullable().default(null) });
export const TeamBugRowSchema = z.object({
  fingerprint: z.string().regex(/^[0-9a-f]{64}$/),
  issue: IssueNumberSchema,
  count: z.number().int().min(1),
  created_at: text,
  state: z.enum(BUG_STATES),
  attempts: z.number().int().min(0).max(BUG_TRIES),
  fix_pr: PrNumberSchema.nullable(),
  fixed_in: z.string().nullable(),
  asked_job: z.string().nullable(),
});
/** The states a bug the team may take, run or wait on holds: the rest are a person's, a release's or the webhooks' to move. */
const TEAM_STATES = ['open', 'fixing', 'asked'] as const;
export const MovedBugRowSchema = z.object({ fingerprint: z.string().regex(/^[0-9a-f]{64}$/) });
export const HolderRepairRowSchema = z.object({ mission_id: text, job_id: text, fingerprint: z.string().regex(/^[0-9a-f]{64}$/) });
export const ToldRowSchema = z.object({ job_id: z.string().nullable() });
export const HolderMissionRowSchema = z.object({ id: text, repo: text });
/** The states of a bug whose holding missions are told (PRD 3088 s5): released fixed, or closed as not planned. */
const MOVED_STATES = ['fixed', 'wont-fix'] as const;
/** The statuses of a mission the team wakes to tell it: one that runs or waits wakes by itself, a minute on. */
const HELD_STATUSES = ['paused', 'stopped'] as const;
export const RetroRowSchema = z.object({ id: text, milestone: text, job_id: z.string().nullable(), skipped: z.string().nullable(), file: z.string().nullable() });
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
export const BranchRowSchema = z.object({ repo: text, branch: text, cut_at: text });
const ItemOutcomeSchema = z.enum(['carried', 'deferred', 'escalated']);
export const PLAN_DECISION = 'kind, product_prd, job_id, plan, outcome, why, settled';
export const PlanDecisionRowSchema = z.object({
  kind: z.enum(['plan', 'tech']),
  product_prd: ProductPrdIdSchema,
  job_id: text,
  plan: z.string().regex(/^[0-9a-f]{64}$/).nullable(),
  outcome: z.enum(['approved', 'escalated']),
  why: z.array(z.string()),
  settled: z.array(z.string()),
});
const PlanDecidedSchema = z.object({ outcome: z.enum(['approved', 'escalated']), why: z.array(z.string()), plan: z.string().nullable(), latest: z.boolean().nullable() });
export const PLAN_VERSION = 'sha256';
export const PlanVersionRowSchema = z.object({ sha256: z.string().regex(/^[0-9a-f]{64}$/) });
export const PHASE0 = 'phase0';
export const Phase0RowSchema = z.object({ phase0: z.enum(['pr', 'server']) });
export const HOME_PRODUCT = 'product_id, products!inner(key, archived_at)';
export const HomeProductRowSchema = z.object({ product_id: text, products: z.object({ key: text, archived_at: z.string().nullable() }) });
export const FleetDecisionRowSchema = z.object({
  kind: z.enum(['approve', 'answer']),
  prd_id: PrdIdSchema,
  item: z.string().nullable(),
  job_id: text,
  outcome: ItemOutcomeSchema,
  why: z.array(z.string()),
  option: z.enum(ITEM_OPTIONS).nullable(),
  decided_at: text,
});
const ItemDecidedSchema = z.object({ outcome: ItemOutcomeSchema, why: z.array(z.string()), option: z.enum(ITEM_OPTIONS).nullable() });
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

const repairOf = (row: z.infer<typeof RepairRowSchema>): StoredRepair => ({
  id: row.id,
  ...numberedOf(row.prd_id),
  ...(row.trigger === 'stuck' ? { trigger: 'stuck' as const } : {}),
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

/** A scope as the row holds it, split: the repository's numbers the supervisor reads, and a product's ids, null when it names none. */
function scopeOf(scope: z.infer<typeof MissionRowSchema>['scope']): { numbers: MissionRecord['scope']; products: { prds: ProductPrdId[]; roadmaps: ProductRoadmapId[] } | null } {
  const numbers = { prds: scope.prds.filter((prd) => typeof prd === 'number'), roadmaps: scope.roadmaps.filter((roadmap) => typeof roadmap === 'number') };
  const products = { prds: scope.prds.filter((prd) => typeof prd === 'string'), roadmaps: scope.roadmaps.filter((roadmap) => typeof roadmap === 'string') };
  return { numbers, products: products.prds.length + products.roadmaps.length === 0 ? null : products };
}

/** The store, as the service role on `connection`. */
export function missionStore(connection: Connection): MissionStore {
  const db = serviceDb(connection);

  /** Each roadmap of the scope, by its number, with its rows, in the order the scope names the roadmaps. */
  async function roadmapsOf(mission: MissionRecord): Promise<{ number: IssueNumber; rows: z.infer<typeof RoadmapPrdRowSchema>[] }[]> {
    if (mission.scope.roadmaps.length === 0) return [];
    const roadmaps = rowsOf(RoadmapRowSchema, await db.from('roadmaps').select(ROADMAP).eq('workspace_id', mission.workspace).eq('repo', mission.repo).in('number', mission.scope.roadmaps));
    if (roadmaps.length === 0) return [];
    const rows = rowsOf(RoadmapPrdRowSchema, await db.from('roadmap_prds').select(ROADMAP_PRD).in('roadmap_id', roadmaps.map(({ id }) => id)).order('position'));
    return mission.scope.roadmaps.flatMap((number) => {
      const roadmap = roadmaps.find((one) => one.number === number);
      return roadmap ? [{ number, rows: rows.filter((row) => row.roadmap_id === roadmap.id) }] : [];
    });
  }

  /** Each roadmap's rows, in the order the scope names the roadmaps. */
  async function roadmapRows(mission: MissionRecord): Promise<RoadmapRow[][]> {
    return (await roadmapsOf(mission)).map(({ rows }) => rows.map((row) => ({ prd: row.prd, rowId: row.row_id, blockers: row.blockers })));
  }

  /** The mission's jobs whose key is like `like`, each with the resumes that carry it on, its line read with it. */
  async function keyedJobs(id: string, like: string): Promise<{ row: z.infer<typeof AskRowSchema>; attempts: Attempt[] }[]> {
    const jobs = rowsOf(AskRowSchema, await db.from('runner_jobs').select(ASK).eq('mission_id', id).like('mission_key', like).order('queued_at'));
    const chains = jobs.length === 0 ? new Map<string, JobRow[]>() : await chainsOf(jobs);
    return jobs.map((row) => ({ row, attempts: (chains.get(row.id) ?? [row]).map(attemptOf) }));
  }

  /** The pages whose fleet approval (`given`, this mission's) a person overturned after it was given (PRD 2896 s11); no read when none was given. */
  async function overturnedAmong(given: readonly z.infer<typeof ApprovalRowSchema>[], mission: string, pageOf: ReadonlyMap<PrdNumber, string>): Promise<Set<string>> {
    const overturned = new Set<string>();
    if (given.length === 0) return overturned;
    for (const event of rowsOf(OverturnRowSchema, await db.from('mission_events').select(OVERTURN).eq('mission_id', mission).eq('kind', 'overturned').not('prd_id', 'is', null).order('at'))) {
      const page = event.prd_id === null || isProductPrdId(event.prd_id) ? undefined : pageOf.get(event.prd_id);
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
  async function withPosted(runs: (Run & Resumed)[]): Promise<(Run & Resumed)[]> {
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
    return CountSchema.parse(spent.data);
  }

  /** The mission's stuck repairs and milestone retros (PRD 3065). */
  const retros: MissionRetros = {
    async milestones(mission) {
      return (await roadmapsOf(mission)).map(({ number, rows }) => ({ roadmap: number, prds: rows.flatMap((row) => (row.prd === null ? [] : [row.prd])) }));
    },

    async stucks(id) {
      return (await keyedJobs(id, `mission:${id}:stuck:%`)).flatMap(({ row, attempts }): StuckJob[] => {
        const k = row.mission_key === null ? null : stuckOfKey(row.mission_key);
        const jobs = stuckJobsOf(row.line);
        return k === null || jobs === null ? [] : [{ k, job: row.id, jobs, attempts }];
      });
    },

    stuck: ({ mission, k, jobs, toFleet }) => queue({ mission, toFleet, line: stuckSkillLine(mission.number, jobs), key: stuckKey(mission.id, k) }),

    async retros(id) {
      const jobs = (await keyedJobs(id, `mission:${id}:retro:%`)).flatMap(({ row, attempts }): RetroJob[] => {
        const milestone = row.mission_key === null ? null : retroOfKey(row.mission_key);
        return milestone === null ? [] : [{ milestone, job: row.id, attempts }];
      });
      const rows = rowsOf(RetroRowSchema, await db.from('mission_retros').select(RETRO).eq('mission_id', id).order('created_at'));
      return { jobs, rows: rows.map((row): RetroRow => ({ id: row.id, milestone: row.milestone, job: row.job_id, skipped: row.skipped, file: row.file })) };
    },

    retro: ({ mission, milestone, toFleet }) => queue({ mission, toFleet, line: retroSkillLine(mission.number, milestone), key: retroKey(mission.id, milestone) }),

    async keepRetro(mission, row) {
      const written = 'retro' in row ? { retro: row.retro, file: row.file } : { skipped: row.skipped };
      return madeOf(await db.from('mission_retros').insert({ mission_id: mission.id, milestone: row.milestone, job_id: row.job, ...written }).select('id'), 'kept no retro');
    },

    async keepItems(mission, retro, items) {
      const kept: number[] = [];
      // One at a time: an item a replayed run kept already (23505) is skipped, and the others are kept.
      for (const { number, target, wording, evidence } of items) {
        const made = madeOf(await db.from('mission_items').insert({ mission_id: mission.id, retro_id: retro, number, target, wording, evidence }).select('id'), 'kept no item');
        if (made !== null) kept.push(number);
      }
      return kept;
    },
  };

  /** The latest stop naming the mission, and its fleet's stop still waiting for an answer. */
  async function stopsOf(mission: MissionRecord): Promise<Pick<BudgetRead, 'named' | 'open'>> {
    const stops = () => db.from('mission_budget_stops').select(STOP).eq('workspace_id', mission.workspace);
    const named = rowsOf(StopRowSchema, await stops().contains('missions', [mission.id]).order('created_at', { ascending: false }).limit(1)).map(stopOf);
    const open = rowsOf(StopRowSchema, await stops().eq('fleet', mission.fleet).eq('cap', 'fleet').is('answer', null).limit(1)).map(stopOf);
    return { named: named[0] ?? null, open: open[0] ?? null };
  }

  /** An `omni-bugs` mission's bugs and their jobs (PRD 3088). */
  const bugTeam: MissionBugTeam = {
    async bugs(repo) {
      const rows = rowsOf(TeamBugRowSchema, await db.from('omni_bug_reports').select(TEAM_BUG).eq('repo', repo.toLowerCase()).in('state', [...TEAM_STATES]).order('created_at'));
      return rows.map((row): Bug => ({
        fingerprint: row.fingerprint,
        issue: row.issue,
        count: row.count,
        createdAt: row.created_at,
        state: row.state,
        attempts: row.attempts,
        fixPr: row.fix_pr,
        fixedIn: row.fixed_in,
        askedJob: row.asked_job,
      }));
    },

    async jobs(id) {
      return (await keyedJobs(id, `mission:${id}:bug:%`)).flatMap(({ row, attempts }): BugJob[] => {
        const key = row.mission_key === null ? null : bugOfKey(row.mission_key);
        return key === null ? [] : [{ issue: key.issue, k: key.k, job: row.id, attempts }];
      });
    },

    send: ({ mission, issue, k, toFleet, line }) => queue({ mission, toFleet, line: line ?? bugFixLine(issue), key: bugKey(mission.id, issue, k) }),

    async move(bug, { state, attempts, fixPr, askedJob }) {
      const moved = rowsOf(
        z.object({ fingerprint: text }),
        await db
          .from('omni_bug_reports')
          .update({ state, attempts, fix_pr: fixPr, asked_job: askedJob, updated_at: new Date().toISOString() })
          .eq('fingerprint', bug.fingerprint)
          .eq('state', bug.state)
          .eq('attempts', bug.attempts)
          .select('fingerprint'),
      );
      return moved.length > 0;
    },

    async holders() {
      const moved = rowsOf(MovedBugRowSchema, await db.from('omni_bug_reports').select(MOVED_BUG).in('state', [...MOVED_STATES])).map((row) => row.fingerprint);
      if (moved.length === 0) return [];
      // A PRD's repair that stopped on the bug (never a stuck repair's, which no PRD waits on), by the fingerprint, as the service role.
      const repairs = rowsOf(
        HolderRepairRowSchema,
        await db.from('mission_repairs').select(HOLDER_REPAIR).in('fingerprint', moved).eq('outcome', 'stopped').eq('trigger', 'failure').eq('retro->>class', 'omni-loop').not('job_id', 'is', null),
      );
      if (repairs.length === 0) return [];
      const told = rowsOf(ToldRowSchema, await db.from('mission_events').select(TOLD).eq('kind', 'bug-fixed').in('job_id', repairs.map((row) => row.job_id)));
      const ids = untold(repairs.map((row) => ({ mission: row.mission_id, job: row.job_id, fingerprint: row.fingerprint })), new Set(told.flatMap((row) => (row.job_id === null ? [] : [row.job_id]))));
      if (ids.length === 0) return [];
      return rowsOf(HolderMissionRowSchema, await db.from('missions').select(HOLDER_MISSION).in('id', ids).in('status', [...HELD_STATUSES]));
    },
  };

  /** The dossier of a product's PRD (`prd`) or roadmap (`roadmap`), numbered `seq`, among the workspace's products keyed `key`; null when none. */
  async function productDossier(mission: MissionRecord, { key, seq, kind }: { key: string; seq: number; kind: 'prd' | 'roadmap' }): Promise<string | null> {
    const products = rowsOf(IdRowSchema, await db.from('products').select('id').eq('workspace_id', mission.workspace).eq('key', key).is('archived_at', null).order('created_at'));
    for (const { id } of products) {
      const [dossier] = rowsOf(IdRowSchema, await db.from('dossiers').select('id').eq('product_id', id).eq('kind', kind).eq('product_seq', seq).limit(1));
      if (dossier !== undefined) return dossier.id;
    }
    return null;
  }

  /** The latest version of `kind` (`plan`, `roadmap`) a dossier holds; null when it holds none. */
  async function latestOf(dossier: string | null, kind: 'plan' | 'roadmap'): Promise<string | null> {
    if (dossier === null) return null;
    const [version] = rowsOf(PlanRowSchema, await db.from('dossier_versions').select(PLAN).eq('dossier_id', dossier).eq('kind', kind).order('created_at', { ascending: false }).limit(1));
    return version?.content ?? null;
  }

  /** The sha256 of the latest plan version a dossier holds; null when it holds none. */
  async function latestPlanSha(dossier: string | null): Promise<string | null> {
    if (dossier === null) return null;
    const [version] = rowsOf(PlanVersionRowSchema, await db.from('dossier_versions').select(PLAN_VERSION).eq('dossier_id', dossier).eq('kind', 'plan').order('created_at', { ascending: false }).order('id', { ascending: false }).limit(1));
    return version?.sha256 ?? null;
  }

  /** A product PRD's open items as the server holds them: each with no settlement (PRD 1548 s7-03), in the order raised. */
  async function productItems(dossier: string | null): Promise<OpenItems> {
    if (dossier === null) return { notRead: 'its page is not found on the Omni page' };
    const rows = rowsOf(ProductItemRowSchema, await db.from('outbox_items').select(PRODUCT_ITEM).eq('dossier_id', dossier).order('raised_at').order('item'));
    const open = rows.filter((row) => row.outbox_settlements.length === 0).map(({ item, rank }) => ({ id: item, rank }));
    return { ranks: open.map(({ rank }) => rank), open };
  }

  /** The scope's product PRDs in order (./expand.ts): those it names, then each product roadmap's rows in wave order, repository rows left out. */
  async function productScope(mission: MissionRecord, named: { prds: readonly ProductPrdId[]; roadmaps: readonly ProductRoadmapId[] }): Promise<ScopeEntry[]> {
    const roadmaps: ScopeRow[][] = [];
    for (const id of named.roadmaps) {
      const text = await latestOf(await productDossier(mission, { ...productRoadmapParts(id), kind: 'roadmap' }), 'roadmap');
      const read = text === null ? null : rowsOfRoadmap(text);
      if (read?.ok === true) roadmaps.push(read.rows);
    }
    return expandMissionScope([...named.prds], roadmaps).filter((entry) => isProductPrdId(entry.prd));
  }

  /** The mission's product PRDs (PRD omni-loop-21 s9b). */
  const products: MissionProducts = {
    async facts(mission) {
      if (mission.products === undefined) return [];
      const owner = mission.repo.split('/')[0] ?? '';
      const out: StoredProduct[] = [];
      for (const { prd, blockers } of await productScope(mission, mission.products)) {
        if (!isProductPrdId(prd)) continue;
        const page = await productDossier(mission, { ...productPrdParts(prd), kind: 'prd' });
        const approved = page === null ? new Map<string, { voided: boolean; overturned: boolean }>() : await approvals([page], mission.id, new Map());
        const plan = await latestOf(page, 'plan');
        out.push({ prd, approval: approvalOf(page === null ? null : (approved.get(page) ?? null)), blockers, targets: plan === null ? [] : planTargets(plan, owner), items: await productItems(page), plan: await latestPlanSha(page) });
      }
      return out;
    },

    async runs(id) {
      return (await keyedJobs(id, `mission:${id}:prd:%-%:run:%`)).flatMap(({ row, attempts }): ProductRun[] => {
        const key = row.mission_key === null ? null : productRunOfKey(row.mission_key);
        return key === null ? [] : [{ prd: key.prd, run: key.run, job: row.id, attempts }];
      });
    },

    send: ({ mission, prd, run, line, toFleet }) => queue({ mission, toFleet, line, key: missionKey(mission.id, prd, run) }),

    async reviews(id) {
      const techs = (await keyedJobs(id, `mission:${id}:prd:%:tech:%`)).flatMap(({ row, attempts }): TechJob[] => {
        const key = row.mission_key === null ? null : techOfKey(row.mission_key);
        const attempt = attempts.at(-1);
        return key === null || attempt === undefined ? [] : [{ prd: key.prd, k: key.k, job: row.id, attempt }];
      });
      const decisions = rowsOf(PlanDecisionRowSchema, await db.from('mission_decisions').select(PLAN_DECISION).eq('mission_id', id).in('kind', ['plan', 'tech']).order('decided_at').order('id'));
      return { techs, decisions: decisions.map((row) => ({ kind: row.kind, prd: row.product_prd, job: row.job_id, plan: row.plan, outcome: row.outcome, why: row.why, settled: row.settled })) };
    },

    review: ({ mission, prd, k, line, toFleet }) => queue({ mission, toFleet, line, key: techKey(mission.id, prd, k) }),

    async decidePlan(mission, { prd, job, kind, record, why }) {
      const answer = await db.rpc('mission_decide_plan', { p_mission: mission.id, p_product_prd: prd, p_job: job, p_kind: kind, p_record: record, p_why: [...why] });
      if (answer.error) throw new Error(`the database refused the ${kind} decision: ${answer.error.message}`);
      return PlanDecidedSchema.parse(answer.data);
    },

    async home(mission) {
      const [repository] = rowsOf(Phase0RowSchema, await db.from('repositories').select(PHASE0).eq('workspace_id', mission.workspace).eq('full_name', mission.repo.toLowerCase()).limit(1));
      const links = rowsOf(HomeProductRowSchema, await db.from('product_repositories').select(HOME_PRODUCT).eq('workspace_id', mission.workspace).eq('repository', mission.repo.toLowerCase()));
      const live = links.filter((row) => row.products.archived_at === null);
      return { phase0: repository?.phase0 ?? 'pr', product: live.length === 1 ? (live[0]?.products.key ?? null) : null };
    },
  };

  return {
    retros,
    bugTeam,
    products,

    async mission(id) {
      const [row] = rowsOf(MissionRowSchema, await db.from('missions').select(MISSION).eq('id', id).limit(1));
      if (!row) return null;
      const scope = scopeOf(row.scope);
      return {
        id: row.id, workspace: row.workspace_id, repo: row.repo, fleet: row.fleet, number: row.number, title: row.title, level: row.mandate.level, status: row.status, waitingOn: row.waiting_on, parallel: row.mandate.parallel, scope: scope.numbers, hardToRevert: row.mandate.hardToRevert, ownPrds: row.mandate.ownPrds, resumes: row.mandate.resumes,
        ...(scope.products === null ? {} : { products: scope.products }),
        ...(row.mandate.tokens === null ? {} : { tokens: row.mandate.tokens }),
        ...(row.paused_by === 'stuck' ? { pausedBy: 'stuck' as const } : {}),
        ...(row.kind === 'omni-bugs' ? { kind: row.kind } : {}),
      };
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
      const runs = jobs.flatMap((job): (Run & Resumed)[] => {
        const step = job.mission_key === null ? null : resumeOfKey(job.mission_key);
        const key = step === null ? null : runOfKey(step.key);
        return key === null || step === null ? [] : [{ prd: key.prd, run: key.run, step: key.step, job: job.id, attempts: (chains.get(job.id) ?? [job]).map(attemptOf), ...resumed(step.resume) }];
      });
      return withPosted(runs);
    },

    async fleetEvents(id) {
      return rowsOf(FleetEventRowSchema, await db.from('mission_events').select(FLEET_EVENT).eq('mission_id', id).in('kind', ['decided', 'overturned']).order('at')).map((row) => ({ kind: row.kind, ...numberedOf(row.prd_id), sentence: row.sentence, link: row.link, actor: row.actor }));
    },

    async events(id) {
      return rowsOf(EventRowSchema, await db.from('mission_events').select(EVENT).eq('mission_id', id).order('at')).map((row) => ({ kind: row.kind, ...numberedOf(row.prd_id), job: row.job_id }));
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

    send: ({ mission, prd, run, step, toFleet, skill, fix = null, resume = 0 }) =>
      queue({ mission, toFleet, line: lineOf(prd, step, skill, baseOf(mission, skill === 'ultra-yolo'), fix), key: resumeKey(missionKey(mission.id, prd, run, step), resume) }),

    async care({ mission, line, since, toFleet }) {
      // The mission's runs happen one at a time (its lane): a read, then the insert, sends one.
      const sent = rowsOf(CareRowSchema, await db.from('runner_jobs').select(CARE).eq('mission_id', mission.id).eq('line', line).gte('queued_at', since).limit(1));
      return sent.length > 0 ? null : queue({ mission, toFleet, line, key: null });
    },

    async committees(id) {
      const jobs = rowsOf(JobRowSchema, await db.from('runner_jobs').select(JOB).eq('mission_id', id).like('mission_key', `mission:${id}:prd:%:approve:%`).order('queued_at'));
      if (jobs.length === 0) return [];
      // An approval's decisions only: an item's (PRD omni-loop-21) are read by `decisions`.
      const decided = rowsOf(DecisionRowSchema, await db.from('mission_decisions').select(DECISION).eq('mission_id', id).eq('kind', 'approve'));
      return jobs.flatMap((job): (Committee & Resumed)[] => {
        const step = job.mission_key === null ? null : resumeOfKey(job.mission_key);
        const key = step === null ? null : committeeOfKey(step.key);
        const decision = decided.find((row) => row.job_id === job.id);
        return key === null || step === null ? [] : [{ prd: key.prd, round: key.round, job: job.id, attempt: attemptOf(job), decision: decision ? { outcome: decision.outcome, why: decision.why } : null, ...resumed(step.resume) }];
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

    approve: ({ mission, prd, round, toFleet, author = null, resume = 0 }) => queue({ mission, toFleet, line: approveLine(prd, author), key: resumeKey(committeeKey(mission.id, prd, round), resume) }),

    async pmJobs(id) {
      const jobs = rowsOf(AskRowSchema, await db.from('runner_jobs').select(ASK).eq('mission_id', id).like('mission_key', `mission:${id}:pm:%`).order('queued_at'));
      return jobs.flatMap((job): (PmJob & Resumed)[] => {
        const step = job.mission_key === null ? null : resumeOfKey(job.mission_key);
        const round = step === null ? null : pmRoundOfKey(step.key);
        return round === null || step === null ? [] : [{ round, job: job.id, line: job.line, attempt: attemptOf(job), ...resumed(step.resume) }];
      });
    },

    pm: ({ mission, round, line, toFleet, resume = 0 }) => queue({ mission, toFleet, line, key: resumeKey(pmKey(mission.id, round), resume) }),

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
      const repairJobs = (await keyedJobs(id, `mission:${id}:prd:%:repair:%`)).flatMap(({ row: job, attempts }): RepairJob[] => {
        const key = job.mission_key === null ? null : repairOfKey(job.mission_key);
        const failedJob = failedJobOf(job.line);
        return key === null || failedJob === null ? [] : [{ prd: key.prd, k: key.k, job: job.id, failedJob, attempts }];
      });
      const rows = rowsOf(RepairRowSchema, await db.from('mission_repairs').select(REPAIR).eq('mission_id', id).order('started_at')).map(repairOf);
      return { jobs: repairJobs, rows };
    },

    repair: ({ mission, prd, k, failedJob, toFleet }) => queue({ mission, toFleet, line: repairSkillLine(mission.number, prd, failedJob), key: repairKey(mission.id, prd, k) }),

    async keepRepair(mission, { prd, fingerprint, round, failedJob, job, retro, fixPr, trigger }) {
      const answer = await db
        .from('mission_repairs')
        .insert({ mission_id: mission.id, ...prdColumns(prd), fingerprint, round, failed_job_id: failedJob, job_id: job, retro, fix_pr: fixPr, ...(trigger === 'stuck' ? { trigger } : {}) })
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
      return row === undefined ? null : { repo: row.repo, issue: row.issue, fix: bugFixOf(row.state, row.fixed_in) };
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
        ...prdColumns(event.prd),
        job_id: event.job,
        link: event.link,
        sentence: event.sentence,
      }));
      rowsOf(z.unknown(), await db.from('mission_events').insert(rows).select('id'));
    },

    async update(id, from, { status, waitingOn, nextWakeAt, pausedBy }) {
      // Paused by stuck (PRD 3065) says so; the database clears it whenever the mission leaves `paused`.
      const by = pausedBy === 'stuck' ? { paused_by: pausedBy } : {};
      const moved = rowsOf(
        z.object({ id: text }),
        await db.from('missions').update({ status, waiting_on: waitingOn, next_wake_at: nextWakeAt, updated_at: new Date().toISOString(), ...by }).eq('id', id).eq('status', from).select('id'),
      );
      return moved.length > 0;
    },

    async budget(mission, at) {
      const fleetCap = await fleetCapOf(mission);
      const spent = await missionSpent(mission);
      const fleet = await fleetSpent(mission, at);
      const stops = await stopsOf(mission);
      const pauses = rowsOf(PauseEventRowSchema, await db.from('mission_events').select(PAUSE_EVENT).eq('mission_id', mission.id).in('kind', ['paused', 'resumed']).is('prd_id', null).order('at', { ascending: false }).limit(PAUSES_READ));
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

    async branches(id) {
      return rowsOf(BranchRowSchema, await db.from('mission_branches').select(BRANCH).eq('mission_id', id).order('cut_at')).map((row) => ({ repo: row.repo, branch: row.branch, cutAt: row.cut_at }));
    },

    async keepBranch(mission, { repo, branch }) {
      const answer = await db.from('mission_branches').insert({ mission_id: mission.id, repo: repo.toLowerCase(), branch }).select('repo');
      if (answer.error?.code === TAKEN) return false;
      if (rowsOf(z.object({ repo: text }), answer).length === 0) throw new Error('the database kept no mission branch and gave no reason');
      return true;
    },

    async decideItem(mission, { prd, item, job, verdicts, decision }) {
      const answer = await db.rpc('mission_decide_item', {
        p_mission: mission.id,
        ...(isProductPrdId(prd) ? { p_product_prd: prd } : { p_prd: prd }),
        p_job: job,
        p_item: item,
        p_verdicts: [...verdicts],
        p_outcome: decision.outcome,
        p_why: decision.why,
        ...(decision.option === null ? {} : { p_option: decision.option }),
      });
      if (answer.error) throw new Error(`the database refused the item's decision: ${answer.error.message}`);
      return ItemDecidedSchema.parse(answer.data);
    },

    async decisions(id) {
      return rowsOf(FleetDecisionRowSchema, await db.from('mission_decisions').select(FLEET_DECISION).eq('mission_id', id).in('kind', ['approve', 'answer']).order('decided_at')).map((row) => ({
        kind: row.kind,
        prd: row.prd_id,
        item: row.item,
        job: row.job_id,
        outcome: row.outcome,
        why: row.why,
        option: row.option,
        decidedAt: row.decided_at,
      }));
    },
  };
}
