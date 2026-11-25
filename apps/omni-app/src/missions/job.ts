// `mission` as a kind of the App's job ledger (PRD 2842 s4, spec "3. The supervisor"; ADR-0123): one job per mission,
// keyed `mission:<id>` and run in the lane `mission:<id>`, so one run of a mission happens at a time. Plain code: no
// model call, and no runner slot while it waits. Its payload names the mission and nothing else, never a token
// (L-GDPR-2).
//
//   who adds it    Start and Resume (s5) refresh it due at once (`background_job_refresh`, kind `mission`, the key,
//                  subject and lane of `missionJob`), and so does any wake: a job of the mission ending, a stage
//                  change of one of its PRDs, an answer on one of them. A refresh adds the job, brings a queued one
//                  forward, or queues a finished one again, where a bare `background_job_wake` only brings a queued
//                  one forward
//   the branch     above `with-you` (PRD 2896) a run first cuts the mission's branch from the default branch (./branch.ts), once; with
//                  it not cut (rebase merges not allowed, no installation) it sends nothing and the mission waits, saying why
//   the landing    then, while a PRD is on the branch (s6, ./landing.ts), the mission pull requests are read: a PRD whose feature
//                  pull request a merged one carried is on the default branch, recorded `prd-merged` once and read as merged
//                  from then, never before; it leaves the branch, and keeping up drops its commit
//   keeping up     then, while the mission runs or waits (s5, ./keep-up.ts), its branch is rebased onto the default branch when
//                  that moved, and each feature branch of a PRD with no job running brought onto the branch's tip. A feature
//                  branch that conflicts only in generated paths gets one `/omni:pr-care <n> --once --base <branch>` job per
//                  head of the branch, which merges the tip in and rebuilds them. Any other conflict changes no branch and
//                  waits on a person, naming the files, and while the branch itself cannot follow, no PRD joins it
//   the joins      then, while the mission runs or waits, each PRD that ended Ready and is not on the branch yet meets the merge
//                  gate (./gate.ts, read through ./join.ts): passed, the App squash-merges its feature pull request into the
//                  branch and records `prd-joined`, once (a replay reads it on the branch from that event, and a pull request
//                  already merged into the branch joins without a second merge); not passed, the PRD waits on what it lacks
//   the mission PR then, while a PRD is on the branch and the branch follows, the mission pull request lists each PRD in the order
//                  it joined, with its commit, the Reviewer's pass and its page: opened when none is open, rewritten when what it
//                  lists changed, never merged by the App (a person merges it with Rebase and merge). Once every row joined (PRD
//                  omni-loop-21 s15), one per repository, each naming the others, with its Deferred decisions and its Re-test; a
//                  person's Agree is settled on the mission branch, an Overturn reworked there (see "Landing in the run" below)
//   the drops      a member's `omni mission drop` (PRD 2896 s7) is an event of the mission, `drop-asked`: while a PRD it names is on the
//                  branch, the run takes it off (./drop.ts), and the later PRDs sharing its territory with it unless the ask said
//                  `--keep`, reopens each one's feature pull request and records `prd-dropped`; the PRD is dropped from then, and
//                  never joins again until a person sends it again. A drop that cannot be made (a PRD kept was built on it) changes
//                  no branch and waits on a person, naming the commit
//   the committee  at `alone` (PRD 2896 s9) a run first records each committee job that ended, once, as the service
//                  (./committee.ts, then mission_decide_approval()): carried, the PRD's approval stands for this mission and the
//                  facts are read again; escalated, it waits for a person, why attached. Then a PRD not approved is sent to its
//                  fleet's committee (`/omni:committee <n> --approve`) instead of waiting for a person, outside `mandate.parallel`
//   the PM         at `alone` with `mandate.ownPrds` above 0 (PRD 2896 s12, ./pm.ts) a run first records what each ended PM job wrote,
//                  once: the PRDs it added join the scope (`prd-added`), the rows its cap left are named (`not-written`). Then, once,
//                  the mission sends its PM `/omni:brainstorm` or `/omni:roadmap` (their mega forms in a plan repository) for the
//                  PRDs left under the cap; a PRD it wrote goes to the committee with the PM sitting out. While it writes, the
//                  mission runs
//   plan, replan   at `alone` (PRD omni-loop-21 s9, ./pm.plan.ts) a PRD with no plan on its page is sent to the PM (`/omni:plan <n>`)
//                  before its committee, which is sent once a plan is on the page; a PRD stopped once its repairs are spent is replanned
//                  (`--replan`), once, and built again only once a committee approved the new plan version. The PM sits out both
//                  committees. A refused replan stops the PRD and sends the mission's retro (PRD 3065)
//   PM products    at `alone` on a repository whose phase 0 is on the server (PRD omni-loop-26, ./tech.ts) the PM writes product PRDs
//                  (`--product <key>`); each it wrote is planned by the PM, its plan approved by it (`omni plan:`), reviewed by the
//                  fleet's Architect (`/omni:tech-review`, `omni tech:`), each decision recorded through mission_decide_plan(), and
//                  built only once both name its latest plan version. No committee is sent for it
//   the repairs    each run reads the mission's repairs first (PRD 2980, ./repair-run.ts): each repair that ended kept, each code
//                  repair's fix landed on the mission branch once green, each step sent again settled, each Omni Loop bug report
//                  sent. Then, where the table stops a PRD, a repair is sent first in line while the mission has repairs left,
//                  outside `mandate.parallel` (the PRD's own slot is held)
//   the QA pair    each run reads QA's pair (PRD 3001, ./qa-run.ts): a QA job done with no verdict of its round reads failed,
//                  `verdict not read`; for a PRD in its fix phase, its feature branch, from the feature pull request QA checked,
//                  and each fix that ended landed on it once green, or refused; a person's pick on `Decide the bugs`. A build
//                  ready for review is then sent to QA, each bug of its round 1 to the Engineer one at a time, and its round 2,
//                  before the Reviewer
//   red            a mission branch whose own checks go red once a PRD joined holds every further join: the mission waits on a
//                  person, naming the PRD that joined last and the drop line (`omni mission drop <mission> <prd>`)
//   each run       reads the mission (./store.ts); a draft runs nothing, delivered is done. Then, in order: check
//                  first (its jobs and their resumes, each PRD's approval, stage, blockers and plan), pick
//                  (./supervisor.ts), send each pick to the mission's AI Fleet (its runners when one holds the
//                  repository, else any runner of the workspace) under its mission key (the build, `/omni:ultra-yolo`
//                  when the repository is a product's plan repository (PRD 2873), else `/omni:yolo --for-review`; or
//                  the Reviewer and the fix after it, PRD 2871), record each decision as an event, and set the
//                  status, what it waits on and the next wake
//   the budget     before anything is sent (PRD 3040, ./budget-run.ts): what the mission and its fleet spent, read against its
//                  budget and its fleet's daily cap. Over one, it records one stop, pauses (a fleet's cap every mission of the
//                  fleet that runs or waits) and sends nothing new; a running job is never cancelled. Once a person answers,
//                  it resumes (raised, under every cap), wakes by itself when the fleet's window frees room (tomorrow) or
//                  ends stopped, saying the budget stopped it
//   how it ends    `later`, a minute on, while the mission runs or waits, or while it is paused with a job of it
//                  still running (its end is recorded); at its wake, paused by the budget until tomorrow; `done`
//                  otherwise. Paused sends nothing new
//   the bug team   an `omni-bugs` mission (PRD 3088) runs ./bug-team-run.ts instead: no PRD, no branch, never delivered; its budget,
//                  each bug's ended job read, the next bugs taken (`/omni:bug-fix #<issue>`), watched a minute on while it runs or waits;
//                  then it wakes each paused or stopped mission that waited on a bug fixed or not planned and was not told yet
//   the way back   a PRD stopped on an Omni Loop bug (PRD 3088 s5, ./repair.ts): once the bug is fixed and the kit the repository
//                  pins (./repair.github.ts) is at its version, its step is sent again, spending no repair; older, it waits on the
//                  kit; paused or stopped, the mission waits for its own Resume; a bug not planned leaves it stopped
//   the cap        the ledger fails a job's 21st `later` in a row: before that, a run refreshes its own job (it is
//                  running, so the refresh marks it `again`), and its finish queues it at once with its count reset.
//                  The extra run reads the same state and records nothing twice
//
// A replay, or two runs at once, insert one job: the key is unique (`runner_jobs.mission_key`), so a second insert is
// refused and records nothing. The events read back give a dispatch whose event was lost its event on the next run.
import { z } from 'zod';
import { isProductPrdId, type PrdNumber, type PrNumber } from 'omni-loop/kit/lib/ids.ts';
import type { Criterion } from 'omni-loop/kit/lib/ready/criteria.ts';
import { DEFAULT_GALAXY_URL } from '../env.ts';
import type { ClaimedJob, RefreshJob } from '../jobs/ledger.ts';
import { checkPayloadOf, MissionJobDataSchema } from '../jobs/payloads.ts';
import type { JobHandler, JobResult } from '../jobs/worker.ts';
import { noteTo } from '../run-log/run-log.ts';
import { prepareAll, scopeRepos, type MissionBranches } from './branch.ts';
import { heldWords } from './expand.ts';
import type { MissionPrd } from './store.prd.ts';
import { levelRefusal } from 'omni-loop/kit/lib/mission/brief.ts';
import { resumeCap } from './resume.ts';
import { dropLine, dropSet, droppedOf, standingAsks } from 'omni-loop/kit/lib/mission/drop.ts';
import { decisionsOf, deferredOf, reworkLine, reworksOf, type DecisionPrd, type DeferredDecision, type FleetDecision } from 'omni-loop/kit/lib/mission/overturn.ts';
import { withDecisions, type ItemCommittee, type ItemVerdict, type OpenAt } from './answers.ts';
import { itemDecisionOf, recordedOf, sendsCommittees, type Committee } from './committee.ts';
import { addedOf, isOwnJob, pmAsks, pmDispatched, pmEvents, pmNext, pmWait, pmWorking, withAdded, withPm, type Home, type PmEvent, type PmJob, type PmView } from './pm.ts';
import { addedProductsOf, decisionEvent, isRetry, productPlansOf, reviewDispatched, reviewStateOf, type PlanDecision, type ReviewState, type TechJob } from './tech.ts';
import { planRecordOf } from 'omni-loop/kit/lib/virtual-fleet/plan-record.ts';
import { SENT_BACK } from 'omni-loop/kit/lib/mission/send-back.ts';
import { techJobLine, techRecordOf } from 'omni-loop/kit/lib/virtual-fleet/tech-record.ts';
import type { ProductPrdId } from 'omni-loop/kit/lib/ids.ts';
import { nextPlanRound, planDispatched, planEvents, plannedOf, planJobsOf, withPlans, type PlanAt, type PlanJob, type PlanSend } from './pm.plan.ts';
import { planJobLine } from 'omni-loop/kit/lib/virtual-fleet/pm.ts';
import { retroSkillLine } from './milestone.ts';
import type { MissionAgrees, MissionAnswers } from './settle.ts';
import type { MissionDrops, Reopened } from './drop.ts';
import { checksOf, judge, type OpenItems } from './gate.ts';
import { joinProduct, type MissionJoins } from './join.ts';
import { careLine, keptWaits, type FeatureAt, type MissionKeepUps } from './keep-up.ts';
import {
  answerLinks,
  landedBy,
  missionPullBody,
  missionPullTitle,
  type BranchCommit,
  type LandingAt,
  type LandingRow,
  type MissionLandings,
  type MissionPull,
  type OtherPull,
  type Proof,
  type Retest,
} from './landing.ts';
import type { MissionDecision as StoredDecision, MissionProducts, MissionRecord, MissionRetros, MissionStore, NewStoredEvent, StoredEvent, StoredProduct } from './store.ts';
import { readOutsideBugs, readRepairs, sendOutsideBugs, type RepairRunAt } from './repair-run.ts';
import { outsideEvents, type Outside } from './outside-bug.ts';
import { readQa } from './qa-run.ts';
import { overCap, runBudget } from './budget-run.ts';
import { withVerdicts } from './qa.ts';
import { isStuckRow, leftOf, MISSION_REPAIRS, ofRepository, repairEvents, repairingWords, repairNext, type RepairJob, type RepairView } from './repair.ts';
import { readStuck, stuckStep } from './stuck-run.ts';
import { NO_STUCK, type StuckView } from './stuck.ts';
import { milestoneStep } from './milestone-run.ts';
import { bugTeamRun } from './bug-team-run.ts';
import type { MissionBugIssues } from './bug-team.github.ts';
import type { MissionKits } from './repair.github.ts';
import {
  baseOf,
  basesOf,
  conclude,
  cut,
  lineOf,
  productStateOf,
  withProducts,
  type ProductRun,
  type ProductState,
  type ProductsRun,
  eventsOf,
  featurePrOf,
  landedOf,
  NO_BRANCH,
  onBranchOf,
  passOf,
  pick,
  prdStates,
  recordedKeys,
  roomOn,
  unrecorded,
  WAKE_MS,
  waitsForMerge,
  whereOf,
  withLanded,
  withWaits,
  type AnswersView,
  type Attempt,
  type CommitteeView,
  type Concluded,
  type Joined,
  type NewEvent,
  type Landed,
  type OnBranch,
  type PrdFacts,
  type PrdState,
  type RecordedEvent,
  type Run,
} from './supervisor.ts';

export const MISSION_KIND = 'mission';

/** How many `later`s in a row a mission's job takes before it refreshes itself: the ledger fails the 21st. */
export const LATERS_BEFORE_RENEW = 15;

/** The job of mission `id`, in repository `repo`: due at once, in its own lane. */
export function missionJob(id: string, repo: string): RefreshJob {
  const subject = repo.toLowerCase();
  return { kind: MISSION_KIND, key: `mission:${id}`, subject, payload: { mission: id }, lane: `mission:${id}`, delaySeconds: 0 };
}

/** What an earlier run kept: how many `later`s in a row the job took. */
const ProgressSchema = z.looseObject({ laters: z.number().int().min(0).optional() });

export type MissionDeps = {
  /** The missions, as the service role; null (no database): nothing is read or sent. */
  store: MissionStore | null;
  /** The mission branch, cut at the first run above `with-you` (PRD 2896); null (no GitHub): such a mission waits, and sends nothing. */
  branches?: MissionBranches | null;
  /** The merge gate's reads and the squash-merge into the mission branch (PRD 2896); null (no GitHub): a Ready PRD waits, unjudged. */
  joins?: MissionJoins | null;
  /** The mission branch kept up with the default branch, and its feature branches with it (PRD 2896 s5); null (no GitHub): it is not. */
  keepUps?: MissionKeepUps | null;
  /** A PRD taken off the mission branch when a member asks for it (PRD 2896 s7); null (no GitHub): the ask waits. */
  drops?: MissionDrops | null;
  /** The mission pull request, opened and rewritten, and the landings read from it (PRD 2896 s6); null (no GitHub): none is opened or read. */
  landings?: MissionLandings | null;
  /**
   * A high item the fleet's committee answered, settled on its PRD's feature branch (PRD 2896 s10); null (no GitHub): it goes to a person.
   * With `agree` (PRD omni-loop-21 s12), a person's Agree with a deferred decision is settled on the mission branch as theirs.
   */
  answers?: (MissionAnswers & Partial<MissionAgrees>) | null;
  /** Each PRD's acceptance criteria and their proofs, for the mission pull request's Re-test (PRD omni-loop-21 s15); null: none read. */
  retests?: MissionRetests | null;
  /** The Omni Loop bug team's read of its bugs' issues (PRD 3088); null (no GitHub): an `omni-bugs` mission takes no bug, saying why. */
  bugIssues?: MissionBugIssues | null;
  /** The kit a mission's repository pins (PRD 3088 s5); null (no GitHub): a PRD whose Omni Loop bug was fixed waits to update the kit. */
  kits?: MissionKits | null;
  /** The Omni page's host, which each PRD's page in the mission pull request is linked on. */
  galaxyUrl?: string;
  /** Refreshes a job on the ledger: how a run resets its count of `later`s. */
  refresh: (job: RefreshJob) => Promise<unknown>;
  now?: () => number;
  log?: (line: string) => void;
};

/** What one supervising run did: the mission's new state, whether anything of it still runs, and if it moved. */
type Supervised = { next: Concluded; running: boolean; moved: boolean; sent: number; events: number };

/** What GitHub the run may ask: the branch to cut, keep up and join to, and its mission pull request, as the mission's installation. */
type GitHubDeps = {
  branches: MissionBranches | null;
  joins: MissionJoins | null;
  keepUps: MissionKeepUps | null;
  landings: MissionLandings | null;
  drops: MissionDrops | null;
  answers: (MissionAnswers & Partial<MissionAgrees>) | null;
  kits: MissionKits | null;
  retests: MissionRetests | null;
  galaxyUrl: string;
};

/** One run of a running, waiting, paused or stopped mission: check, land, keep up, join, write the mission pull request, pick, send, record, set. */
async function supervise(store: MissionStore, sought: MissionRecord, now: number, github: GitHubDeps): Promise<Supervised> {
  const first = await readRun(store, sought, now);
  const { read, runs, recorded, toFleet, inPlan, decided, pm, fleet } = first;
  // The token budget first (PRD 3040): over a cap the mission reads as paused for the rest of the run, so nothing new is sent.
  const budget = await runBudget(store, first.mission, now);
  const mission = budget.mission;
  const skill = inPlan ? 'ultra-yolo' : 'yolo';
  // Above `with-you` the PRDs are built on the mission's branch: with it not cut, nothing is sent and the mission says why.
  const ready = await branchReady(store, mission, inPlan, github.branches);
  const unready = ready.waits;
  const at = landingAt(mission, inPlan, ready.installation);
  const dropped = await dropAll({ store, mission, at, recorded, facts: read, runs, now, drops: github.drops });
  const landing = await landAll({ at, runs, joined: onBranchOf(dropped.recorded), landings: github.landings });
  const { facts, joined } = afterLanding(read, dropped.recorded, landing.landed);
  const off = droppedOf(dropped.recorded);
  const kept = await keepUp({ store, mission, inPlan, facts, runs, joined, off, toFleet, installation: ready.installation, keepUps: github.keepUps });
  const held = holdOf(kept, await redBranch({ mission, at, joined, joins: github.joins }));
  const { branch, joins } = await joinAll({ mission, inPlan, facts, runs, joined, off, installation: ready.installation, joins: github.joins, hold: held.hold });
  const answered = await answerAll({ store, mission, facts, runs, branch, recorded, installation: ready.installation, now, github });
  const view: CommitteeView = { alone: mission.level === 'alone', committees: decided, answers: answered, resumes: resumeCap(mission) };
  const { repairView, stuck } = await repairsOf({ store, mission, runs, recorded: dropped.recorded, branch: baseOf(mission, inPlan), installation: ready.installation, joins: github.joins, budget: MISSION_REPAIRS, kits: github.kits, ...(await productRepairAt(store, mission)) });
  const qa = await readQa({ store, mission, runs, recorded: dropped.recorded, installation: ready.installation, joins: github.joins, inPlan });
  const outside = await outsideAll({ store, mission, runs, repairs: repairView, branch: baseOf(mission, inPlan), installation: ready.installation, joins: github.joins, toFleet, sends: unready === null, recorded: dropped.recorded });
  // The PM plans a PRD with no plan before its approval, and replans one stopped once its repairs are spent (PRD omni-loop-21 s9).
  const planAt: PlanAt = { alone: view.alone, facts, runs, committees: decided, plans: pm.plans, recorded: dropped.recorded, repairs: repairView };
  const before = withPlans(prdStates(facts, runs, branch, view, fleet, repairView, qa), planAt);
  const { sent, approved, asked, repaired } = unready === null ? await sendEvery({ store, mission, facts, states: before.states, toFleet, skill, added: pm.authored, left: leftOf(repairView) }) : NOTHING_SENT;
  const sentRepairs: RepairView = { ...repairView, jobs: [...repairView.jobs, ...repaired] };
  const planned = await sendPlans({ store, mission, send: before.send, jobs: pm.jobs, toFleet, sends: unready === null });
  const committees = [...decided, ...approved];
  const asks = [...answered.committees, ...asked];
  const all = [...runs, ...sent];
  const after = withPlans(prdStates(facts, all, branch, { ...view, committees, answers: { open: answered.open, committees: asks } }, fleet, sentRepairs, qa), { ...planAt, runs: all, committees, plans: [...pm.plans, ...planned.jobs], repairs: sentRepairs });
  const states = after.states;
  const pmSent = await sendPmAll({ store, mission, pm, inPlan, toFleet, sends: unready === null, planned: planned.events, retro: after.retro });
  const fresh = sent.length + approved.length + asked.length + repaired.length;
  const products = await productAll({ store, mission, inPlan, states, installation: ready.installation, toFleet, sends: unready === null, github, pm: { jobs: [...pm.jobs, ...planned.jobs], authored: pm.products }, repairs: sentRepairs });
  // The product PRDs' repairs sent this run (bug #3302) are the mission's too: its events and its 9 count them.
  const repairs: RepairView = { ...sentRepairs, jobs: [...sentRepairs.jobs, ...products.repaired] };
  // The mission pull requests, then the landing once every row joined (PRD omni-loop-21 s15), and the person's Agree and Overturn.
  const landed = await landingStep({ store, mission, at, landing, hold: kept.hold, on: [...branch.joined], facts, runs, states, off, products, outside: outside.states, toFleet, now, github });
  const waited = withWaits(conclude({ mission, facts, states, sent: fresh, now, branch: branch.branch }), [...dropped.waits, ...held.waits, ...landed.waits]);
  // A goal-only mission whose PM wrote no PRD, its jobs spent, waits on a person with that line (PRD omni-loop-24, ./pm.ts › pmWait).
  const concluded = withProducts(withPm(waited, pm.writing || pmSent.length > 0, new Date(now + WAKE_MS).toISOString(), pmWait(pmView(mission, pm, inPlan))), products, now);
  const finished: Concluded = budget.finish(unready === null || concluded.status === 'delivered' || concluded.status === 'paused' ? concluded : { ...concluded, status: 'waiting', waitingOn: unready });
  const events = eventsOf({ mission: { ...mission, status: budget.said }, facts, states, runs: all, next: finished, toFleet, skill, recorded: recordedKeys(dropped.recorded), joins, landings: landing.landed, committees, asks, repairs, qa, resumes: resumeCap(mission) });
  // A product PRD's repair events (bug #3302) name its id: recorded beside the repository PRDs', each once.
  const productRepairs = unrecorded(repairEvents(repairs, { where: whereOf(mission, toFleet), mission: mission.number }).filter((one) => !ofRepository(one)), recordedKeys(dropped.recorded));
  const retro = await retrosOf({ store, mission, next: finished, states, runs: all, recorded: dropped.recorded, events, stuck, left: leftOf(repairs), toFleet, inPlan, sends: unready === null, over: budget.over });
  const next = retro.next;
  await store.record(mission.id, [...pmSent, ...budget.events, ...outside.events, ...products.events, ...productRepairs, ...landed.events, ...events, ...retro.events], new Date(now));
  const moved = await store.update(mission.id, budget.from, next);
  const running = atWork(states, retro.running) || products.moving;
  return { next, running, moved, sent: sent.length + repaired.length + products.sent + landed.events.length, events: events.length + retro.events.length + products.events.length + productRepairs.length + landed.events.length };
}

/**
 * What a run reads for its product PRDs' repairs (bug #3302): their builds, which a repair is settled on, and the repositories the
 * mission cut its branch in, where a product PRD's fix may land. None for a mission with no product PRD, or a store with none.
 */
async function productRepairAt(store: MissionStore, mission: MissionRecord): Promise<Pick<RepairRunAt, 'products' | 'repos'>> {
  if (store.products === undefined || mission.products === undefined) return {};
  return { products: await store.products.runs(mission.id), repos: (await store.branches(mission.id)).map((one) => one.repo) };
}

/** Whether a PRD's job or its repair is at work, or a stuck repair or a milestone retro (`retros`, PRD 3065). */
const atWork = (states: ReadonlyMap<PrdNumber, PrdState>, retros: boolean): boolean => retros || [...states.values()].some((state) => state.state === 'running' || state.state === 'repairing');

/**
 * The mission's repairs, as a run reads them (PRD 2980), with its stuck repairs (PRD 3065): a stuck repair is a repair of the same 3
 * and 9, so its rows and its jobs at work count before anything is sent. A store without them reads none.
 */
async function repairsOf(at: RepairRunAt): Promise<{ repairView: RepairView; stuck: StuckView }> {
  const read = await readRepairs(at);
  const stuck = at.store.retros === undefined ? NO_STUCK : await readStuck({ ...at, retros: at.store.retros, rows: read.rows });
  return { repairView: { ...read, rows: [...read.rows.filter((row) => !isStuckRow(row)), ...stuck.rows], stuck: stuck.jobs }, stuck };
}

/** What a run's outside bugs are read from (PRD omni-loop-21 s11): the mission, its runs and repairs, its branch and GitHub, where its jobs go. */
type OutsideAt = Pick<RepairRunAt, 'store' | 'mission' | 'runs' | 'recorded' | 'branch' | 'installation' | 'joins'> & {
  repairs: RepairView;
  toFleet: boolean;
  /** Whether the run may send at all: its PRDs can be built (the mission branch ready). */
  sends: boolean;
};

/**
 * The Engineer's outside bugs (PRD omni-loop-21 s11, ./repair-run.ts), at `alone` only and never in an `omni-bugs` mission, while it
 * runs or waits with its branch ready: each bug a Reviewer's, QA's or repair's job (a stuck repair's too) named outside the mission's
 * PRDs read with where it stands, each fix that opened landed once green, the next bug's `/omni:bug-fix #<issue> --base <branch>` sent
 * under `…:bug:<issue>:run:<k>`; the events not recorded yet, once. A store without the bug team's jobs reads none. The bugs, where
 * each stands, close the mission pull request's Re-test (PRD omni-loop-21 s15).
 */
async function outsideAll(at: OutsideAt): Promise<{ events: NewEvent[]; states: Outside[] }> {
  const team = at.store.bugTeam;
  if (at.mission.level !== 'alone' || at.mission.kind === 'omni-bugs' || team === undefined || !at.sends || !sendsCommittees(at.mission.status)) return { events: [], states: [] };
  const repairs = [...at.repairs.jobs, ...at.repairs.stuck.map(({ attempts }) => ({ prd: null, attempts }))];
  const jobs = await team.jobs(at.mission.id);
  const states = await readOutsideBugs({ ...at, repairs, jobs, logOf: (job) => at.store.committeeLog(job) });
  const taken = await sendOutsideBugs(states, ({ issue, k, line }) => team.send({ mission: at.mission, issue, k, line, toFleet: at.toFleet }));
  return { events: unrecorded([...taken, ...outsideEvents(states)], recordedKeys(at.recorded)), states };
}

/** What the run's retro steps work from (PRD 3065), once its events are known. */
type RetrosAt = {
  store: MissionStore;
  mission: MissionRecord;
  next: Concluded;
  states: ReadonlyMap<PrdNumber, PrdState>;
  runs: readonly Run[];
  recorded: readonly RecordedEvent[];
  events: readonly NewEvent[];
  stuck: StuckView;
  left: number;
  toFleet: boolean;
  inPlan: boolean;
  /** Whether the run may send at all: its PRDs can be built (the mission branch ready). */
  sends: boolean;
  /** Whether a token cap is reached (PRD 3040): no retro is sent. */
  over: boolean;
};

/**
 * The run's stuck count and milestone retros (PRD 3065, ./stuck-run.ts, ./milestone-run.ts), once its events are known: a stuck repair
 * sent or at work, or the mission paused by stuck; each milestone retro that ended recorded, the next sent. A store without them
 * (a test's) leaves the run as it concluded. `running` while a stuck repair or a milestone retro works: the job keeps watching.
 */
async function retrosOf(at: RetrosAt): Promise<{ next: Concluded; events: NewEvent[]; running: boolean }> {
  const retros = at.store.retros;
  if (retros === undefined) return { next: at.next, events: [], running: false };
  const where = whereOf(at.mission, at.toFleet);
  const stuck = await stuckStep({ ...at, retros, where });
  const done = (prd: PrdNumber): boolean => ['merged', 'joined'].includes(at.states.get(prd)?.state ?? '');
  const sends = at.sends && (stuck.next.status === 'running' || stuck.next.status === 'waiting' || stuck.next.status === 'delivered');
  const milestones = await milestoneStep({ store: at.store, retros, mission: at.mission, branch: baseOf(at.mission, at.inPlan), toFleet: at.toFleet, where, done, delivered: stuck.next.status === 'delivered', over: at.over, sends });
  return { next: stuck.next, events: [...stuck.events, ...milestones.events], running: stuck.running || milestones.watching };
}

/**
 * A delivered mission's run (PRD 3065): its milestone retros only, each that ended recorded, the next sent while every cap allows it,
 * else skipped, budget reached. Whether one still works: the job keeps watching it until it is recorded.
 */
async function deliveredRun(store: MissionStore, retros: MissionRetros, mission: MissionRecord, now: number): Promise<boolean> {
  const [toFleet, inPlan, over] = await Promise.all([store.fleetRunners(mission), store.planRepository(mission), overCap(store, mission, now)]);
  const at = { store, retros, mission, branch: baseOf(mission, inPlan), toFleet, where: whereOf(mission, toFleet) };
  const step = await milestoneStep({ ...at, done: () => true, delivered: true, over, sends: true });
  await store.record(mission.id, step.events, new Date(now));
  return step.watching;
}

/**
 * What a run reads first: the PRDs, the mission's jobs and events, where its jobs go, and its committees, each that ended
 * recorded at `alone` (PRD 2896 s9). A carried committee approved its PRD, so the PRDs are read again then. Before them, what the
 * mission's PM wrote (PRD 2896 s12): its scope widened by the PRDs its fleet added, which a PRD the PM wrote reads as.
 */
async function readRun(store: MissionStore, sought: MissionRecord, now: number) {
  const [events, jobs] = await Promise.all([store.events(sought.id), store.pmJobs(sought.id)]);
  const pm = await pmRead(store, sought, events, jobs, now);
  const mission = pm.mission;
  const [first, runs, toFleet, inPlan, asked, runners] = await Promise.all([
    store.facts(mission),
    // A QA job done with no verdict of its round reads failed, verdict not read (PRD 3001, ./qa.ts).
    store.runs(mission.id).then(withVerdicts),
    store.fleetRunners(mission),
    store.planRepository(mission),
    store.committees(mission.id),
    store.fleetRunners(mission).then((to) => store.room(mission, to)),
  ]);
  const decided = await decideAll(store, mission, asked, pm.authored);
  const read = decided.carried ? await store.facts(mission) : first;
  return { mission, read, runs, recorded: pm.recorded, toFleet, inPlan, decided: decided.committees, pm, fleet: { room: roomOn(runners, mission.repo, now), now } };
}

/**
 * What a run read of the mission's PM (PRD 2896 s12): the mission, its scope widened by the PRDs its fleet added, its events, those
 * PRDs, its PM jobs, and whether one is at work; its plan jobs (PRD omni-loop-21 s9), and the PRDs the PM wrote or planned, whose
 * committees it sits out.
 */
type PmRead = {
  mission: MissionRecord;
  recorded: RecordedEvent[];
  added: ReadonlySet<PrdNumber>;
  jobs: readonly PmJob[];
  writing: boolean;
  plans: PlanJob[];
  authored: ReadonlySet<PrdNumber>;
  /** PRD omni-loop-26: the product PRDs the PM wrote, in the order its fleet added them, and where its repository approves its phase 0. */
  products: ReadonlySet<ProductPrdId>;
  home: Home;
};

/**
 * What each PM job that ended records, once: a repository plan job's end (./pm.plan.ts), and what an own job wrote (./pm.ts). A product
 * PRD's plan job records its decision with the product steps (./tech.ts).
 */
async function pmJobEvents(store: MissionStore, mission: MissionRecord, events: readonly StoredEvent[], jobs: readonly PmJob[], plans: readonly PlanJob[]): Promise<PmEvent[]> {
  const fresh: PmEvent[] = [];
  for (const one of jobs) {
    const known = [...events, ...fresh.map(asRecorded)];
    const plan = plans.find((each) => each.job === one.job);
    if (plan !== undefined) fresh.push(...planEvents(plan, known));
    if (!isOwnJob(one)) continue;
    const log = pmWorking(one) ? null : await store.committeeLog(one.job);
    fresh.push(...pmEvents(mission, one, log, heldOf(mission, known), events));
  }
  return fresh;
}

/** The PRDs a mission holds: its scope's numbers and product ids, and those its fleet added. */
const heldOf = (mission: MissionRecord, known: readonly StoredEvent[]): Set<MissionPrd> =>
  new Set<MissionPrd>([...mission.scope.prds, ...(mission.products?.prds ?? []), ...addedOf(known), ...addedProductsOf(known)]);

/** The mission's product PRDs widened by those its PM wrote (PRD omni-loop-26), after its own; nothing when it wrote none. */
function withProductsAdded(mission: MissionRecord, added: readonly ProductPrdId[]): Pick<MissionRecord, 'products'> {
  if (added.length === 0) return {};
  const named = mission.products ?? { prds: [], roadmaps: [] };
  return { products: { ...named, prds: [...named.prds, ...added.filter((prd) => !named.prds.includes(prd))] } };
}

/** Today's path: a repository whose phase 0 is a pull request, as a store with no product PRDs reads every repository. */
const PR_HOME: Home = { phase0: 'pr', product: null };

/**
 * Each PM job of a mission at `alone` that ended, what it wrote recorded once, a second before this run's events (./pm.ts): the PRDs it
 * added and the rows its cap left unwritten; a plan job's end (./pm.plan.ts). Then the mission's scope holds the PRDs its fleet added,
 * after its own.
 */
async function pmRead(store: MissionStore, mission: MissionRecord, events: readonly StoredEvent[], jobs: readonly PmJob[], now: number): Promise<PmRead> {
  const plans = planJobsOf(jobs);
  const fresh = mission.level === 'alone' ? await pmJobEvents(store, mission, events, jobs, plans) : [];
  if (fresh.length > 0) await store.record(mission.id, fresh, new Date(now - 1000));
  const recorded = [...events, ...fresh.map(asRecorded)];
  const added = addedOf(recorded);
  const authored = new Set([...added, ...plannedOf(plans)]);
  const products = addedProductsOf(recorded);
  const home = mission.level === 'alone' && store.products !== undefined ? await store.products.home(mission) : PR_HOME;
  return { mission: { ...mission, ...withProductsAdded(mission, products), scope: { ...mission.scope, prds: withAdded(mission.scope.prds, added) } }, recorded, added: new Set(added), jobs, writing: jobs.some(pmWorking), plans, authored, products: new Set(products), home };
}

/** What a run sent its PM to plan (PRD omni-loop-21 s9): each dispatch, and each job as the run reads it from then on. */
type PlansSent = { events: NewEvent[]; jobs: PlanJob[] };

/**
 * The plan jobs this run sends the PM, while the mission runs or waits and its PRDs can be built (`sends`), each under the next PM
 * round (round 1 kept for its own PRDs).
 */
async function sendPlans({ store, mission, send, jobs, toFleet, sends }: { store: MissionStore; mission: MissionRecord; send: readonly PlanSend[]; jobs: readonly PmJob[]; toFleet: boolean; sends: boolean }): Promise<PlansSent> {
  const out: PlansSent = { events: [], jobs: [] };
  if (!sends || !sendsCommittees(mission.status)) return out;
  let round = nextPlanRound(jobs);
  for (const one of send) {
    const line = planJobLine(one.prd, one.kind, mission.number);
    const job = await store.pm({ mission, round, line, toFleet });
    round += 1;
    if (job === null) continue;
    out.events.push(planDispatched(job, one));
    out.jobs.push({ round: round - 1, job, line, attempt: { id: job, status: 'queued', outcome: null, reason: null, prUrl: null }, prd: one.prd, kind: one.kind });
  }
  return out;
}

/**
 * What this run sent the PM and for it, when its PRDs can be built (`sends`): its own PRDs' job (PRD 2896 s12), the plan jobs already
 * sent (`planned`, their dispatches), and the mission's retro once a replan was refused (`retro`, PRD omni-loop-21 s9).
 */
async function sendPmAll(at: { store: MissionStore; mission: MissionRecord; pm: PmRead; inPlan: boolean; toFleet: boolean; sends: boolean; planned: readonly NewEvent[]; retro: boolean }): Promise<NewEvent[]> {
  if (!at.sends) return [];
  const own = await sendPm(at.store, at.mission, at.pm, at.inPlan, at.toFleet);
  const retro = at.retro ? await sendRetro(at.store, at.mission, at.toFleet) : [];
  return [...own, ...at.planned, ...retro];
}

/** The mission's retro (PRD 3065), sent once when the committee refused a PRD's new plan; nothing when the store keeps no retros. */
async function sendRetro(store: MissionStore, mission: MissionRecord, toFleet: boolean): Promise<NewEvent[]> {
  const retros = store.retros;
  if (retros === undefined || !sendsCommittees(mission.status)) return [];
  const job = await retros.retro({ mission, milestone: 'mission', toFleet });
  const sentence = `A new plan was refused: sent ${retroSkillLine(mission.number, 'mission')} to ${whereOf(mission, toFleet)}.`;
  return job === null ? [] : [{ kind: 'dispatched', role: 'supervisor', prd: null, job, link: null, sentence }];
}

/** A new event as a run reads it back: a product PRD's named as `product`, its `prd` null (PRD omni-loop-26). */
const asRecorded = ({ kind, prd, job }: Pick<PmEvent, 'kind' | 'prd' | 'job'>): StoredEvent => (typeof prd === 'string' ? { kind, prd: null, product: prd, job } : { kind, prd, job });

/** What a run decides the PM's job from (./pm.ts): the mission, its cap, the PRDs its fleet added, its PM jobs, where it lives, and the rounds a person asked for. */
const pmView = (mission: MissionRecord, pm: PmRead, inPlan: boolean): PmView => ({ mission, ownPrds: mission.ownPrds ?? 0, added: pm.added.size + pm.products.size, jobs: pm.jobs, inPlan, asks: pmAsks(mission, pm.recorded, pm.jobs), home: pm.home });

/** The mission's PM job, when this run sends it (PRD 2896 s12): its dispatch, or nothing. */
async function sendPm(store: MissionStore, mission: MissionRecord, pm: PmRead, inPlan: boolean, toFleet: boolean): Promise<NewEvent[]> {
  const next = pmNext(pmView(mission, pm, inPlan));
  if (next.next !== 'send') return [];
  const job = await store.pm({ mission, round: next.round, line: next.line, toFleet });
  return job === null ? [] : [pmDispatched(job, next)];
}

/** The builds and steps this run sends, picked in scope order, each a run with its queued attempt. */
async function sendAll({
  store,
  mission,
  facts,
  states,
  toFleet,
  skill,
}: {
  store: MissionStore;
  mission: MissionRecord;
  facts: readonly PrdFacts[];
  states: ReadonlyMap<PrdNumber, PrdState>;
  toFleet: boolean;
  skill: 'yolo' | 'ultra-yolo';
}): Promise<Run[]> {
  const sent: Run[] = [];
  for (const { prd, run, step, fix, resume } of pick({ mission, facts, states })) {
    // A step sent again after it ended without its result line goes under its `:resume:<k>` key (PRD omni-loop-21 s10).
    const again = resume === undefined ? {} : { resume };
    const made = await store.send({ mission, prd, run, step, toFleet, skill, ...(fix === undefined ? {} : { fix }), ...again });
    if (made !== null) sent.push({ prd, run, step, job: made, attempts: [{ id: made, status: 'queued', outcome: null, reason: null, prUrl: null }], ...again });
  }
  return sent;
}

/**
 * The repairs this run sends (PRD 2980): one per PRD whose step failed, first in line and outside `mandate.parallel`, in scope order,
 * never more than the mission has left. Nothing while paused, a draft or delivered.
 */
async function repairAll({ store, mission, facts, states, toFleet, left }: { store: MissionStore; mission: MissionRecord; facts: readonly PrdFacts[]; states: ReadonlyMap<PrdNumber, PrdState>; toFleet: boolean; left: number }): Promise<RepairJob[]> {
  if (mission.status === 'draft' || mission.status === 'paused' || mission.status === 'delivered') return [];
  const sent: RepairJob[] = [];
  for (const { prd } of facts) {
    const state = states.get(prd);
    if (state?.state !== 'repairable' || sent.length >= left) continue;
    const job = await store.repair({ mission, prd, k: state.k, failedJob: state.failedJob, toFleet });
    if (job !== null) sent.push({ prd, k: state.k, job, failedJob: state.failedJob, attempts: [{ id: job, status: 'queued', outcome: null, reason: null, prUrl: null }] });
  }
  return sent;
}

/** Whether a committee's job ended and has no decision yet: the App records it. */
const toRecord = (one: Committee): boolean => one.decision === null && (one.attempt.status === 'done' || one.attempt.status === 'failed' || one.attempt.status === 'cancelled');

/**
 * Each committee job that ended, its decision recorded once (PRD 2896 s9): its log's record decided again (./committee.ts), then
 * kept by the database, which escalates what it reads itself; at `alone` only. `carried` when one approved its PRD.
 */
async function decideAll(store: MissionStore, mission: MissionRecord, committees: readonly Committee[], added: ReadonlySet<PrdNumber>): Promise<{ committees: Committee[]; carried: boolean }> {
  if (mission.level !== 'alone') return { committees: [...committees], carried: false };
  let carried = false;
  const out: Committee[] = [];
  for (const one of committees) {
    if (!toRecord(one)) {
      out.push(one);
      continue;
    }
    const log = one.attempt.status === 'done' ? await store.committeeLog(one.job) : null;
    const recorded = recordedOf(one.prd, one, log, added.has(one.prd) ? 'pm' : null);
    const decision = await store.decide(mission, one, recorded);
    carried ||= decision.outcome === 'carried';
    out.push({ ...one, decision: { ...decision, verdicts: recorded.record.verdicts } });
  }
  return { committees: out, carried };
}

/** The committees this run sends (PRD 2896 s9): one per PRD whose approval goes to its committee, while the mission runs or waits. */
async function approveAll(store: MissionStore, mission: MissionRecord, facts: readonly PrdFacts[], states: ReadonlyMap<PrdNumber, PrdState>, toFleet: boolean, added: ReadonlySet<PrdNumber>): Promise<Committee[]> {
  if (!sendsCommittees(mission.status)) return [];
  const made: Committee[] = [];
  for (const { prd } of facts) {
    const state = states.get(prd);
    if (state?.state !== 'approvable') continue;
    // A PRD the mission's PM wrote (PRD 2896 s12): the PM sits out, the Architect and the Reviewer approve it.
    const job = await store.approve({ mission, prd, round: state.round, toFleet, author: added.has(prd) ? 'pm' : null });
    if (job !== null) made.push({ prd, round: state.round, job, attempt: { id: job, status: 'queued', outcome: null, reason: null, prUrl: null }, decision: null });
  }
  return made;
}

/** What a run sends: builds and steps, approvals' committees (PRD 2896 s9), items' committees (s10), repairs (PRD 2980). */
type SentAll = { sent: Run[]; approved: Committee[]; asked: ItemCommittee[]; repaired: RepairJob[] };

/** Nothing sent: the mission's branch is not ready. */
const NOTHING_SENT: SentAll = { sent: [], approved: [], asked: [], repaired: [] };

/** Everything this run sends, in order: the builds and steps, then the committees of approvals, then those of items, then the repairs, `left` at most. */
async function sendEvery(at: {
  store: MissionStore;
  mission: MissionRecord;
  facts: readonly PrdFacts[];
  states: ReadonlyMap<PrdNumber, PrdState>;
  toFleet: boolean;
  skill: 'yolo' | 'ultra-yolo';
  added: ReadonlySet<PrdNumber>;
  left: number;
}): Promise<SentAll> {
  const sent = await sendAll(at);
  const approved = await approveAll(at.store, at.mission, at.facts, at.states, at.toFleet, at.added);
  const asked = await askAll(at);
  const repaired = await repairAll(at);
  return { sent, approved, asked, repaired };
}

/** What a run of the item committees works from (PRD 2896 s10). */
type AnswerRun = {
  store: MissionStore;
  mission: MissionRecord;
  facts: readonly PrdFacts[];
  runs: readonly Run[];
  branch: OnBranch;
  recorded: readonly RecordedEvent[];
  installation: number | null;
  now: number;
  github: GitHubDeps;
};

/** Whether a job ended: done, failed or cancelled. */
const ended = ({ status }: { status: string }): boolean => status === 'done' || status === 'failed' || status === 'cancelled';

/**
 * The item committees of a mission at `alone` (PRD 2896 s10), each that ended decided once (./answers.ts, ./settle.ts), and the
 * items open at the head of each PRD that waits on answers. Below `alone`, none is read.
 */
async function answerAll(run: AnswerRun): Promise<AnswersView> {
  if (run.mission.level !== 'alone') return { open: new Map(), committees: [] };
  const committees: ItemCommittee[] = [];
  for (const one of withDecisions(await run.store.asks(run.mission.id), run.recorded)) {
    committees.push(one.decision !== null || !ended(one.attempt) ? one : { ...one, decision: await decideAsk(run, one) });
  }
  return { open: await openAtHeads(run, committees), committees };
}

/**
 * The items open at the head of each PRD that waits on answers, by PRD, read through the merge gate's reads (./join.ts), while the
 * mission runs or waits with its branch prepared. A PRD whose items were not read is absent: it waits for a person, as below `alone`.
 */
async function openAtHeads({ mission, facts, runs, branch, installation, github }: AnswerRun, committees: readonly ItemCommittee[]): Promise<Map<PrdNumber, readonly OpenAt[]>> {
  const open = new Map<PrdNumber, readonly OpenAt[]>();
  const joins = github.joins;
  if (installation === null || joins === null || !sendsCommittees(mission.status)) return open;
  const first = prdStates(facts, runs, branch, { alone: true, committees: [], answers: { open, committees } });
  for (const { prd } of facts.filter((fact) => waitsOnAnswers(first.get(fact.prd)))) {
    const pr = featurePrOf(runs, prd);
    const listed = pr === null ? undefined : listedOf((await joins.read({ installation, repo: mission.repo, prd, pr })).items);
    if (listed !== undefined) open.set(prd, listed);
  }
  return open;
}

/** Whether a PRD waits on a person's answers. */
const waitsOnAnswers = (state: PrdState | undefined): boolean => state?.state === 'waits' && state.on === 'answer';

/** The items a head lists by id; none when they were not read, or were read by ranks alone. */
const listedOf = (items: OpenItems): readonly OpenAt[] | undefined => ('notRead' in items ? undefined : items.open);

/**
 * An ended item committee's decision (PRD omni-loop-21 s8): the members' vote read again from its log (./committee.ts ›
 * itemDecisionOf). Carried, or deferred with option A, the App settles the item on the feature branch with option A, answered for
 * the mission branch only; escalated as its log reads, or when it cannot be settled. Recorded once as the service
 * (mission_decide_item()), whose answer is the decision kept.
 */
async function decideAsk(run: AnswerRun, one: ItemCommittee): Promise<ItemVerdict> {
  const log = one.attempt.status === 'done' ? await run.store.committeeLog(one.job) : null;
  const { verdicts, decision } = itemDecisionOf(one.prd, one, log);
  const settled = decision.outcome === 'escalated' ? null : await settleAsk(run, one, verdicts);
  const taken = settled === null || settled.ok ? decision : { outcome: 'escalated' as const, why: [settled.why], option: null };
  const kept = await run.store.decideItem(run.mission, { prd: one.prd, item: one.item, job: one.job, verdicts, decision: taken });
  if (kept.outcome === 'deferred') return { outcome: 'deferred', why: kept.why, verdicts, option: kept.option ?? 'A' };
  return { outcome: kept.outcome, why: kept.why, verdicts };
}

/** An item the fleet carried or deferred, settled with option A on its PRD's feature branch; why it cannot be, when it cannot. */
async function settleAsk(
  { mission, runs, branch, installation, now, github }: AnswerRun,
  one: ItemCommittee,
  verdicts: ReturnType<typeof itemDecisionOf>['verdicts'],
): Promise<{ ok: true } | { ok: false; why: string }> {
  const pr = featurePrOf(runs, one.prd);
  const answers = github.answers;
  if (pr === null || installation === null || answers === null || branch.branch === null) return { ok: false, why: 'the App cannot settle it here: no feature pull request or no GitHub access' };
  const answer = { fleet: mission.fleet, option: 'A', branch: branch.branch, at: new Date(now).toISOString(), verdicts };
  const settled = await answers.settle({ installation, repo: mission.repo, prd: one.prd, pr, item: one.item, answer });
  return settled.ok ? { ok: true } : settled;
}

/** The item committees this run sends (PRD 2896 s10): one per high item of a PRD that waits on its committee, while the mission runs or waits. */
async function askAll({ store, mission, facts, states, toFleet }: { store: MissionStore; mission: MissionRecord; facts: readonly PrdFacts[]; states: ReadonlyMap<PrdNumber, PrdState>; toFleet: boolean }): Promise<ItemCommittee[]> {
  if (!sendsCommittees(mission.status)) return [];
  const made: ItemCommittee[] = [];
  for (const { prd } of facts) {
    const state = states.get(prd);
    if (state?.state !== 'answering') continue;
    for (const item of state.send) {
      const job = await store.ask({ mission, prd, item, toFleet });
      if (job !== null) made.push({ prd, item, job, attempt: { id: job, status: 'queued', outcome: null, reason: null, prUrl: null }, decision: null });
    }
  }
  return made;
}

/** Why a mission at `own-branch` in a plan repository waits: no branch spans repositories (PRD 2896 s14); null otherwise, and while paused or stopped. */
function ownBranchRefusal(mission: MissionRecord, inPlan: boolean): string | null {
  return mission.status === 'paused' || mission.status === 'stopped' ? null : levelRefusal(mission.level, inPlan);
}

/**
 * Why the mission's PRDs cannot be built yet (`waits`, null when they can), and the installation its branch was prepared as
 * (null when it was not): a mission above `with-you` in a repository that is not a plan repository needs its branch (PRD 2896),
 * cut from the default branch once, and refused where rebase merges are not allowed. Nothing is asked of GitHub for a draft, a
 * paused or a delivered mission, nor at `with-you`.
 */
async function branchReady(
  store: MissionStore,
  mission: MissionRecord,
  inPlan: boolean,
  branches: MissionBranches | null,
): Promise<{ waits: string | null; installation: number | null }> {
  const refused = ownBranchRefusal(mission, inPlan);
  return refused === null ? cutBranch(store, mission, inPlan, branches) : { waits: refused, installation: null };
}

async function cutBranch(
  store: MissionStore,
  mission: MissionRecord,
  inPlan: boolean,
  branches: MissionBranches | null,
): Promise<{ waits: string | null; installation: number | null }> {
  const branch = baseOf(mission, inPlan);
  const none = { waits: null, installation: null };
  if (branch === null || mission.status === 'paused' || mission.status === 'stopped') return none;
  if (branches === null) return { ...none, waits: `the mission branch ${branch} cannot be cut: the app has no GitHub access here` };
  const installation = await store.installation(mission);
  if (installation === null) return { ...none, waits: `the mission branch ${branch} cannot be cut: the workspace has not installed the Omni GitHub App` };
  const prepared = await branches.prepare({ installation, repo: mission.repo, branch });
  return prepared.ok ? { waits: null, installation } : { ...none, waits: prepared.why };
}

/** What keeping up left for the run: what a person must do, one line each, and, while the branch cannot follow, why nothing joins. */
type Kept = { waits: readonly string[]; hold: string | null };

const NOT_KEPT: Kept = { waits: [], hold: null };

/** What several holds say together: every wait, and the first reason nothing joins. */
const holdOf = (...parts: readonly Kept[]): Kept => ({ waits: parts.flatMap((part) => part.waits), hold: parts.find((part) => part.hold !== null)?.hold ?? null });

/** The feature pull requests to keep up: those of PRDs not merged, not on the branch and with no job running, by the PR their jobs named. */
function featuresOf(facts: readonly PrdFacts[], runs: readonly Run[], states: ReadonlyMap<PrdNumber, PrdState>): FeatureAt[] {
  return facts.flatMap((fact) => {
    const state = states.get(fact.prd)?.state;
    const pr = featurePrOf(runs, fact.prd);
    return pr === null || state === 'merged' || state === 'joined' || state === 'running' ? [] : [{ prd: fact.prd, pr }];
  });
}

/**
 * The mission branch kept up with the default branch (PRD 2896 s5), while the mission runs or waits with its branch ready: rebased
 * when the default branch moved, then each feature branch of a PRD with no job running brought onto its tip. A feature branch
 * that conflicts only in generated paths gets one care job per head of the branch, which merges the tip in and rebuilds them;
 * any other conflict, and a branch that cannot follow, waits on a person, and nothing joins the branch until it follows.
 */
async function keepUp({
  store,
  mission,
  inPlan,
  facts,
  runs,
  joined,
  off,
  toFleet,
  installation,
  keepUps,
}: {
  store: MissionStore;
  mission: MissionRecord;
  inPlan: boolean;
  facts: readonly PrdFacts[];
  runs: readonly Run[];
  joined: ReadonlySet<PrdNumber>;
  /** The PRDs a person dropped from the branch (PRD 2896 s7). */
  off: ReadonlySet<PrdNumber>;
  toFleet: boolean;
  installation: number | null;
  keepUps: MissionKeepUps | null;
}): Promise<Kept> {
  const base = keptBase(mission, inPlan, installation);
  if (base === null || installation === null || keepUps === null) return NOT_KEPT;
  const states = prdStates(facts, runs, { branch: base, joined, lacks: new Map(), dropped: off });
  const kept = await keepUps.keepUp({ installation, repo: mission.repo, branch: base, features: featuresOf(facts, runs, states) });
  const waits = keptWaits(kept, base);
  if (kept.branch === 'conflict' || kept.branch === 'held') return { waits, hold: `${base} must follow ${kept.defaultBranch} first` };
  const rebuilds = kept.features.filter((one) => one.kept === 'conflict' && one.generated);
  for (const one of rebuilds) await store.care({ mission, line: careLine(one.prd, base), since: kept.since, toFleet });
  return { waits, hold: null };
}

/** The branch a run keeps up: the mission's, while it runs or waits with its branch prepared; null otherwise. */
function keptBase(mission: MissionRecord, inPlan: boolean, installation: number | null): string | null {
  if (installation === null || (mission.status !== 'running' && mission.status !== 'waiting')) return null;
  return baseOf(mission, inPlan);
}

/** Where the mission pull request is asked of GitHub: the mission's branch, while it runs or waits with its branch prepared; null otherwise. */
function landingAt(mission: MissionRecord, inPlan: boolean, installation: number | null): LandingAt | null {
  const branch = keptBase(mission, inPlan, installation);
  return branch === null || installation === null ? null : { installation, repo: mission.repo, branch };
}

/** What the landings read: the PRDs a merged mission pull request carried, the open one, and the default branch (null when nothing was read). */
type Landing = { landed: Landed[]; open: MissionPull | null; defaultBranch: string | null };

const NO_LANDING: Landing = { landed: [], open: null, defaultBranch: null };

/**
 * The PRDs on the branch that a person landed (PRD 2896 s6): each whose feature pull request a merged mission pull request carried
 * to the default branch, in the order they joined. Nothing is asked while no PRD is on the branch, unless `always`.
 */
async function landAll({
  at,
  runs,
  joined,
  landings,
  always = false,
}: {
  at: LandingAt | null;
  runs: readonly Run[];
  joined: ReadonlySet<PrdNumber>;
  landings: MissionLandings | null;
  always?: boolean;
}): Promise<Landing> {
  if (at === null || landings === null || (joined.size === 0 && !always)) return NO_LANDING;
  const read = await landings.landings(at);
  const features = new Map([...joined].flatMap((prd) => {
    const pr = featurePrOf(runs, prd);
    return pr === null ? [] : [[prd, pr] as const];
  }));
  return { landed: landedBy(read.pulls, features), open: read.pulls.find((one) => one.open) ?? null, defaultBranch: read.defaultBranch };
}

/** The PRDs as a run reads them after its landings (PRD 2896 s6): each one landed read as merged, and off the branch. */
function afterLanding(read: readonly PrdFacts[], recorded: readonly RecordedEvent[], landings: readonly Landed[]): { facts: PrdFacts[]; joined: Set<PrdNumber> } {
  const landed = new Set(landings.map(({ prd }) => prd));
  return { facts: withLanded(read, new Set([...landedOf(recorded), ...landed])), joined: new Set([...onBranchOf(recorded)].filter((prd) => !landed.has(prd))) };
}

/** The mission pull request of a run, once a PRD is on the branch (PRD 2896 s6): the mission pull requests read first when no landing read them. */
async function missionPull({
  store,
  at,
  mission,
  landing,
  on,
  facts,
  runs,
  github,
}: {
  store: MissionStore;
  at: LandingAt | null;
  mission: MissionRecord;
  landing: Landing;
  on: readonly PrdNumber[];
  facts: readonly PrdFacts[];
  runs: readonly Run[];
  github: GitHubDeps;
}): Promise<void> {
  if (at === null || on.length === 0) return;
  // The first join of this run: the mission pull requests were not read yet.
  const known = landing.defaultBranch === null ? await landAll({ at, runs, joined: new Set(), landings: github.landings, always: true }) : landing;
  if (known.defaultBranch === null) return;
  const decisions = mission.level === 'alone' ? decisionsOf(await store.fleetEvents(mission.id)) : [];
  await writeMissionPull({ at, mission, decisions, defaultBranch: known.defaultBranch, open: known.open, on, facts, runs, landings: github.landings, galaxyUrl: github.galaxyUrl });
}

/**
 * The mission pull request, once a PRD is on the branch (PRD 2896 s6): opened when none is open, rewritten when what it lists
 * changed (a join, a landing, a rebase), each PRD with its commit, the Reviewer's pass and its page. Nothing on the branch, nothing
 * is written. GitHub refusing to open it is said in the run's log, and the next run tries again.
 */
async function writeMissionPull({
  at,
  mission,
  decisions,
  defaultBranch,
  open,
  on,
  facts,
  runs,
  landings,
  galaxyUrl,
}: {
  at: LandingAt;
  mission: MissionRecord;
  decisions: readonly FleetDecision[];
  defaultBranch: string;
  open: MissionPull | null;
  on: readonly PrdNumber[];
  facts: readonly PrdFacts[];
  runs: readonly Run[];
  landings: MissionLandings | null;
  galaxyUrl: string;
}): Promise<void> {
  if (landings === null || on.length === 0) return;
  const { commits, link } = await landings.branch({ ...at, defaultBranch });
  const rows = rowsOf({ on, commits, facts, runs, galaxyUrl });
  const title = missionPullTitle(mission);
  const body = missionPullBody({ mission, branch: at.branch, defaultBranch, rows, link, decisions });
  if (open !== null && open.title === title && open.body === body) return;
  await landings.write({ ...at, defaultBranch, pull: open?.number ?? null, title, body });
}

/** The PRDs on the branch as the mission pull request's table lists them: each with its feature pull request, its commit, the Reviewer's pass and its page. */
function rowsOf({ on, commits, facts, runs, galaxyUrl }: { on: readonly PrdNumber[]; commits: readonly BranchCommit[]; facts: readonly PrdFacts[]; runs: readonly Run[]; galaxyUrl: string }): LandingRow[] {
  return on.map((prd): LandingRow => {
    const pr = featurePrOf(runs, prd);
    const page = facts.find((fact) => fact.prd === prd)?.page ?? null;
    return { prd, pr, commit: commits.find((one) => pr !== null && one.pr === pr)?.sha ?? null, pass: passOf(runs, prd), page: page === null ? null : `${galaxyUrl}/prd/${encodeURIComponent(page)}` };
  });
}

// ── Landing in the run (PRD omni-loop-21 s15, item s12-01; spec "7. Landing") ────────────────────────────────────────────────────
//
//   the landing  once every row of the mission joined its branch (each repository PRD on it, merged or dropped, and every product PRD
//                on it), one mission pull request per repository the joined PRDs touch, each naming the others (./landing.ts): its
//                body gains the **Deferred decisions** (at `alone`, each with Agree and Overturn) and the **Re-test** (per PRD its
//                acceptance criteria and their proofs, read through `retests`, then the steps by hand, then the outside bugs of that
//                repository, from ./outside-bug.ts › outsideLanding). Until then, the mission's own repository's pull request is
//                written on every join, as before. Opened when none is open, rewritten only when its body changed
//   agree        each deferred decision a person agreed with (their `agreed` event), on a repository PRD, settled on the mission branch
//                as theirs (./settle.ts › agree); one that cannot be settled waits on a person, saying why. A product PRD's items are
//                the server's: nothing is written here
//   overturn     each PRD with a decision a person overturned (their `overturned` event, BR-PRODUCT-146), reworked once on the mission
//                branch: `/omni:yolo-fix <n> --base <branch>`, or `/omni:ultra-yolo-fix <key>-<n> --base-of …` into each repository
//                its plan names, queued as a care job (no mission key) and recorded `dispatched`, once

/** A PRD's acceptance criteria and the proofs its feature pull request's head carried (PRD 2898), as the Re-test lists them. */
export type RetestRead = { criteria: readonly Criterion[]; proofs: readonly Proof[] };

/** Where the Re-test reads a PRD's criteria and proofs: its repository, and its feature pull request when the mission knows it. */
export type MissionRetests = { read: (at: { installation: number; repo: string; prd: DecisionPrd; pr: PrNumber | null }) => Promise<RetestRead> };

const NO_RETEST: RetestRead = { criteria: [], proofs: [] };

/** Since when a rework counts as sent: ever, so each PRD is reworked once per mission (a care job has no mission key). */
const SINCE_EVER = new Date(0).toISOString();

/** What a run's landing step works from. */
type LandingStep = {
  store: MissionStore;
  mission: MissionRecord;
  at: LandingAt | null;
  landing: Landing;
  /** Why the branch cannot follow the default branch: no mission pull request is written meanwhile. */
  hold: string | null;
  on: readonly PrdNumber[];
  facts: readonly PrdFacts[];
  runs: readonly Run[];
  states: ReadonlyMap<PrdNumber, PrdState>;
  off: ReadonlySet<PrdNumber>;
  products: ProductsDone;
  outside: readonly Outside[];
  toFleet: boolean;
  now: number;
  github: GitHubDeps;
};

/** What the landing step leaves for the run: the reworks sent, and what a person must do. */
type LandingDone = { events: NewStoredEvent[]; waits: string[] };

const NOT_LANDED: LandingDone = { events: [], waits: [] };

/** What the deferred decisions are read from at `alone`: the store's decisions and the fleet's and people's events. */
type DecisionsRead = { deferred: readonly DeferredDecision[]; fleet: readonly FleetDecision[] };

/**
 * The run's landing step, while the mission runs or waits with its branch ready: the person's Agree and Overturn routed first, then the
 * mission pull requests written: every repository's at landing, once every row joined; the mission's own repository's otherwise.
 */
async function landingStep(at: LandingStep): Promise<LandingDone> {
  if (at.at === null) return NOT_LANDED;
  const read = await decisionsRead(at.store, at.mission);
  const waits = await agreeAll(at, at.at, read.deferred);
  const events = await reworkAll(at, at.at, read.deferred);
  if (at.hold === null) {
    if (everyRowJoined(at)) await landEvery(at, at.at, read);
    else await missionPull({ store: at.store, at: at.at, mission: at.mission, landing: at.landing, on: at.on, facts: at.facts, runs: at.runs, github: at.github });
  }
  return { events, waits };
}

/** The deferred decisions and the fleet's decisions, at `alone` only: none below it. */
async function decisionsRead(store: MissionStore, mission: MissionRecord): Promise<DecisionsRead> {
  if (mission.level !== 'alone') return { deferred: [], fleet: [] };
  const [decisions, events] = await Promise.all([store.decisions(mission.id), store.fleetEvents(mission.id)]);
  return { deferred: deferredOf(decisions, events), fleet: decisionsOf(events) };
}

/** Whether every row of the mission joined its branch: each repository PRD on it, merged or dropped, each product PRD on it, one at least. */
function everyRowJoined({ on, facts, states, off, products }: LandingStep): boolean {
  if (products.pending || on.length + products.on.length === 0) return false;
  return facts.every((fact) => off.has(fact.prd) || ['joined', 'merged'].includes(states.get(fact.prd)?.state ?? ''));
}

/** Each deferred decision of a repository PRD a person agreed with, settled on the mission branch as theirs; why one was not. */
async function agreeAll(at: LandingStep, where: LandingAt, deferred: readonly DeferredDecision[]): Promise<string[]> {
  const answers = at.github.answers;
  if (answers?.agree === undefined) return [];
  const waits: string[] = [];
  for (const one of deferred) {
    if (one.answer?.answer !== 'agree' || isProductPrdId(one.prd)) continue;
    const settled = await answers.agree({ installation: where.installation, repo: where.repo, branch: where.branch, prd: one.prd, item: one.item, login: one.answer.by, at: new Date(at.now).toISOString() });
    if (!settled.ok) waits.push(cut(`${one.item} of PRD ${String(one.prd)}: ${one.answer.by}'s Agree is not settled on ${where.branch} yet: ${settled.why}`));
  }
  return waits;
}

/** The repositories a product PRD's plan names; the mission's own when it is not read. */
const targetsOf = (at: Pick<LandingStep, 'mission' | 'products'>, prd: DecisionPrd): readonly string[] => at.products.rows.find((one) => one.prd === prd)?.targets ?? [at.mission.repo];

/** Each PRD with an overturned decision, its rework queued once on the mission branch, and its dispatch. */
async function reworkAll(at: LandingStep, where: LandingAt, deferred: readonly DeferredDecision[]): Promise<NewStoredEvent[]> {
  const events: NewStoredEvent[] = [];
  for (const prd of reworksOf(deferred)) {
    const line = reworkLine(prd, isProductPrdId(prd) ? { bases: basesOf(targetsOf(at, prd), where.branch) } : { branch: where.branch });
    const job = await at.store.care({ mission: at.mission, line, since: SINCE_EVER, toFleet: at.toFleet });
    if (job === null) continue;
    events.push({ kind: 'dispatched', role: 'supervisor', prd, job, link: null, sentence: cut(`A person overturned a decision of PRD ${String(prd)}: sent ${line} to ${whereOf(at.mission, at.toFleet)}.`) });
  }
  return events;
}

/** Whether two repositories are the same one, whatever their case. */
const sameRepo = (a: string, b: string): boolean => a.toLowerCase() === b.toLowerCase();

/** The repositories the joined PRDs touch, the mission's own first, each with its PRDs in the order they joined. */
function repoPlans(at: LandingStep): { repo: string; prds: DecisionPrd[] }[] {
  const home = at.mission.repo;
  const named = [home, ...at.products.on.flatMap((prd) => targetsOf(at, prd))];
  const repos = named.filter((repo, n) => named.findIndex((one) => sameRepo(one, repo)) === n);
  return repos
    .map((repo) => ({ repo, prds: [...(sameRepo(repo, home) ? at.on : []), ...at.products.on.filter((prd) => targetsOf(at, prd).some((one) => sameRepo(one, repo)))] }))
    .filter((plan) => plan.prds.length > 0);
}

/** One repository's mission pull request at landing: where, the open one, and what its body lists but the others. */
type RepoLanding = {
  at: LandingAt;
  defaultBranch: string;
  open: { number: PrNumber; url: string; title: string; body: string } | null;
  rows: LandingRow[];
  link: string | null;
  prds: readonly DecisionPrd[];
  retest: Retest;
};

/**
 * The landing (PRD omni-loop-21 s15): one mission pull request per repository, each opened when none is open, then each rewritten
 * once every one is known, naming the others, its Deferred decisions and its Re-test; one whose body did not change is not written.
 */
async function landEvery(at: LandingStep, where: LandingAt, read: DecisionsRead): Promise<void> {
  const landings = at.github.landings;
  if (landings === null) return;
  const repos: RepoLanding[] = [];
  for (const plan of repoPlans(at)) repos.push(await repoLanding(at, landings, { ...where, repo: plan.repo }, plan.prds));
  const title = missionPullTitle(at.mission);
  const bodyOf = (one: RepoLanding): string => landingBody(at, one, read, repos);
  for (const one of repos.filter((each) => each.open === null)) {
    const body = bodyOf(one);
    const written = await landings.write({ ...one.at, defaultBranch: one.defaultBranch, pull: null, title, body });
    if (written.ok) one.open = { number: written.number, url: written.url, title, body };
  }
  for (const one of repos) {
    const body = bodyOf(one);
    if (one.open === null || (one.open.title === title && one.open.body === body)) continue;
    await landings.write({ ...one.at, defaultBranch: one.defaultBranch, pull: one.open.number, title, body });
    one.open = { ...one.open, title, body };
  }
}

/** What one repository's mission pull request is written from: its open one, its table (the mission's own repository's only), its Re-test. */
async function repoLanding(at: LandingStep, landings: MissionLandings, where: LandingAt, prds: readonly DecisionPrd[]): Promise<RepoLanding> {
  const home = sameRepo(where.repo, at.mission.repo);
  const known = home && at.landing.defaultBranch !== null ? { defaultBranch: at.landing.defaultBranch, open: at.landing.open } : await openOf(landings, where);
  const own = home ? await landings.branch({ ...where, defaultBranch: known.defaultBranch }) : { commits: [], link: null };
  const rows = home ? rowsOf({ on: at.on, commits: own.commits, facts: at.facts, runs: at.runs, galaxyUrl: at.github.galaxyUrl }) : [];
  const retest: Retest = { prds: await retestsOf(at, where, prds), outside: at.outside.filter((bug) => sameRepo(bug.repo, where.repo)) };
  const open = known.open === null ? null : { number: known.open.number, url: known.open.url, title: known.open.title, body: known.open.body };
  return { at: where, defaultBranch: known.defaultBranch, open, rows, link: own.link, prds, retest };
}

/** A repository's open mission pull request and its default branch. */
async function openOf(landings: MissionLandings, where: LandingAt): Promise<{ defaultBranch: string; open: MissionPull | null }> {
  const read = await landings.landings(where);
  return { defaultBranch: read.defaultBranch, open: read.pulls.find((one) => one.open) ?? null };
}

/** Each PRD of a repository's Re-test: its criteria and proofs as `retests` reads them, none without it. */
async function retestsOf(at: LandingStep, where: LandingAt, prds: readonly DecisionPrd[]): Promise<Retest['prds']> {
  const retests = at.github.retests;
  const out: Retest['prds'][number][] = [];
  for (const prd of prds) {
    const pr = isProductPrdId(prd) ? null : featurePrOf(at.runs, prd);
    const read = retests === null ? NO_RETEST : await retests.read({ installation: where.installation, repo: where.repo, prd, pr });
    out.push({ prd, criteria: read.criteria, proofs: read.proofs, reworked: null });
  }
  return out;
}

/** One repository's mission pull request body at landing: its table, the fleet's decisions on its PRDs, the others, its Re-test. */
function landingBody(at: LandingStep, one: RepoLanding, read: DecisionsRead, repos: readonly RepoLanding[]): string {
  const home = sameRepo(one.at.repo, at.mission.repo);
  const others: OtherPull[] = repos.filter((each) => each !== one).map((each) => ({ repo: each.at.repo, number: each.open?.number ?? null, url: each.open?.url ?? null }));
  const deferred = read.deferred.filter((decision) => one.prds.includes(decision.prd));
  const links = answerLinks({ galaxyUrl: at.github.galaxyUrl, fleet: at.mission.fleet, mission: at.mission.number });
  const answers = at.mission.level === 'alone' ? { deferred, links } : null;
  return missionPullBody({ mission: at.mission, branch: one.at.branch, defaultBranch: one.defaultBranch, rows: one.rows, link: one.link, decisions: home ? read.fleet : [], answers, others, retest: one.retest });
}

/** What a run's drops left: the mission's events as the run reads them from then on, and what a person must do. */
type Dropped = { recorded: RecordedEvent[]; waits: string[] };

/**
 * The PRDs a member asked to drop from the mission branch (PRD 2896 s7, `drop-asked`), taken off it: with the later PRDs that
 * share their territory unless the ask said `--keep`, their commits removed by rebase and their feature pull requests reopened
 * (./drop.ts), then `prd-dropped` recorded for each, once. A drop that cannot be made changes no branch and waits on a person.
 * Nothing is asked of GitHub without an ask standing, nor while the mission's branch is not ready.
 */
async function dropAll({
  store,
  mission,
  at,
  recorded,
  facts,
  runs,
  now,
  drops,
}: {
  store: MissionStore;
  mission: MissionRecord;
  at: LandingAt | null;
  recorded: readonly RecordedEvent[];
  facts: readonly PrdFacts[];
  runs: readonly Run[];
  now: number;
  drops: MissionDrops | null;
}): Promise<Dropped> {
  let current = [...recorded];
  const asks = standingAsks(recorded);
  if (at === null || drops === null || asks.length === 0) return { recorded: current, waits: [] };
  const waits: string[] = [];
  for (const { prd, keep } of asks) {
    const set = dropSet({ order: [...onBranchOf(current)], prd, keep, territory: (one) => facts.find((fact) => fact.prd === one)?.territory ?? null });
    if (set === null) continue;
    const prds = set.dropped.flatMap((one) => {
      const pr = featurePrOf(runs, one);
      return pr === null ? [] : [{ prd: one, pr }];
    });
    const done = await drops.drop({ installation: at.installation, repo: at.repo, branch: at.branch, prds });
    if (!done.ok) {
      waits.push(`PRD ${String(prd)} cannot be dropped from ${at.branch}: ${done.why}`);
      continue;
    }
    const events: NewEvent[] = [...done.removed, ...done.absent].map((one) => {
      const reopened = done.reopened.find((made) => made.prd === one);
      const how = done.absent.includes(one) ? 'its commit was not on the branch' : dropHow(reopened);
      const why = one === prd ? '' : `, with PRD ${String(prd)}, which shares its territory`;
      return { kind: 'prd-dropped', role: 'supervisor', prd: one, job: null, link: reopened?.url ?? null, sentence: `PRD ${String(one)} was dropped from ${at.branch}${why}: ${how}.` };
    });
    await store.record(mission.id, events, new Date(now));
    current = [...current, ...events.map(asRecorded)];
  }
  return { recorded: current, waits };
}

/** What became of a dropped PRD's feature pull request, in words. */
function dropHow(reopened: Reopened | undefined): string {
  if (reopened?.pr != null) return `its commit is off the branch, #${String(reopened.pr)} reopened`;
  return reopened?.why == null ? 'its commit is off the branch' : `its commit is off the branch, but ${reopened.why}`;
}

/**
 * Why no PRD joins the mission branch while its own checks are red (PRD 2896 s7), once a PRD joined: the checks on its head are
 * read, and one that failed holds the joins and waits on a person, naming the PRD that joined last (its head is that PRD's
 * commit) and the drop line. Nothing when the branch is green, still running its checks, or no check has run.
 */
async function redBranch({ mission, at, joined, joins }: { mission: MissionRecord; at: LandingAt | null; joined: ReadonlySet<PrdNumber>; joins: MissionJoins | null }): Promise<Kept> {
  const last = [...joined].at(-1);
  if (at === null || last === undefined || joins?.checks === undefined) return NOT_KEPT;
  const read = await joins.checks({ installation: at.installation, repo: at.repo, branch: at.branch });
  const failed = checksOf(read.runs, read.statuses).filter(({ state }) => state === 'fail');
  if (failed.length === 0) return NOT_KEPT;
  const why = `${at.branch} is red (${failed.map(({ name }) => name).join(', ')}) since PRD ${String(last)} joined: no further PRD joins; run ${dropLine(mission.number, last)} to take it off`;
  return { waits: [why], hold: why };
}

// ── Product PRDs (PRD omni-loop-21 s9b, item s7-05) ──────────────────────────────

/** What a run did of the mission's product PRDs: what they leave for its conclusion, the events and builds sent, and, for the landing (s15), their rows and those on the branch, in the order they joined. */
type ProductsDone = ProductsRun & { events: NewStoredEvent[]; sent: number; rows: readonly StoredProduct[]; on: readonly MissionPrd[]; repaired: readonly RepairJob[] };

const NO_PRODUCTS: ProductsDone = { pending: false, moving: false, waits: [], events: [], sent: 0, rows: [], on: [], repaired: [] };

/** What a run's product PRDs are read from: the mission, its repository PRDs' states, its installation and GitHub. */
type ProductAt = {
  store: MissionStore;
  mission: MissionRecord;
  inPlan: boolean;
  states: ReadonlyMap<PrdNumber, PrdState>;
  installation: number | null;
  toFleet: boolean;
  /** Whether the run may send at all: its own branch ready. */
  sends: boolean;
  github: GitHubDeps;
  /** PRD omni-loop-26: the PM's jobs, this run's plan jobs among them, and the product PRDs it wrote, which ./tech.ts takes to their build. */
  pm: { jobs: readonly PmJob[]; authored: ReadonlySet<ProductPrdId> };
  /** Bug #3302: the mission's repairs, this run's sent for its repository PRDs among them, which a product PRD's build shares. */
  repairs: RepairView;
};

/** What a run read of the PM product PRDs' plan jobs, reviews and decisions (PRD omni-loop-26), each ended job's decision recorded. */
type Reviews = { techs: readonly TechJob[]; decisions: readonly PlanDecision[]; events: NewStoredEvent[] };

const NO_REVIEWS: Reviews = { techs: [], decisions: [], events: [] };

/** A plan job's or a review's end, as its decision reads it: its kind, its PRD, its job and attempt. */
type Reviewed = { kind: PlanDecision['kind']; prd: ProductPrdId; job: string; attempt: Attempt };

/** Why a job that did not end done decided nothing, beside the database's own `no record of …`. */
const notDoneWhy = ({ status }: Pick<Attempt, 'status'>): string[] => (status === 'done' ? [] : [status === 'cancelled' ? 'its job was cancelled' : 'its job failed']);

/** One ended plan job's or review's decision, recorded once as the service from its job's record line, null when it left none (BL-GATE-1). */
async function decideReviewed(at: ProductAt, products: MissionProducts, one: Reviewed): Promise<PlanDecision> {
  const log = one.attempt.status === 'done' ? await at.store.committeeLog(one.job) : null;
  const record = log === null ? null : one.kind === 'plan' ? planRecordOf(log, one.prd) : techRecordOf(log, one.prd);
  const kept = await products.decidePlan(at.mission, { prd: one.prd, job: one.job, kind: one.kind, record, why: notDoneWhy(one.attempt) });
  const settled = record !== null && 'settled' in record && kept.outcome === 'approved' ? record.settled : [];
  return { kind: one.kind, prd: one.prd, job: one.job, plan: kept.plan, outcome: kept.outcome, why: kept.why, settled };
}

/**
 * The PM product PRDs' reviews (PRD omni-loop-26, ./tech.ts): the Architect's jobs and the `plan` and `tech` decisions, each plan job
 * and review of a PRD the PM wrote that ended with no decision yet recorded once, its event beside it. None when the PM wrote none.
 */
async function reviewAll(at: ProductAt, products: MissionProducts): Promise<Reviews> {
  if (at.pm.authored.size === 0) return NO_REVIEWS;
  const read = await products.reviews(at.mission.id);
  const decided = new Set(read.decisions.map((one) => one.job));
  const ended: Reviewed[] = [
    ...productPlansOf(at.pm.jobs).map((one) => ({ kind: 'plan' as const, prd: one.prd, job: one.job, attempt: one.attempt })),
    ...read.techs.map((one) => ({ kind: 'tech' as const, prd: one.prd, job: one.job, attempt: one.attempt })),
  ].filter((one) => at.pm.authored.has(one.prd) && !pmWorking(one) && !decided.has(one.job));
  const decisions = [...read.decisions];
  const events: NewStoredEvent[] = [];
  for (const one of ended) {
    const decision = await decideReviewed(at, products, one);
    decisions.push(decision);
    events.push(decisionEvent(decision));
  }
  return { techs: read.techs, decisions, events };
}

/** Bug #3302: by product PRD, the decision its latest send-back by a person follows, as its `sent-back` event names its job. */
function sentBackOf(events: readonly StoredEvent[]): Map<ProductPrdId, string | null> {
  const sent = new Map<ProductPrdId, string | null>();
  for (const { kind, product, job } of events) if (kind === SENT_BACK && product !== undefined) sent.set(product, job);
  return sent;
}

/** The product PRDs on the mission branch, from the mission's events in order: joined, until dropped or landed. */
function productsJoined(events: readonly StoredEvent[]): Set<MissionPrd> {
  const on = new Set<MissionPrd>();
  for (const { kind, product } of events) {
    if (product === undefined) continue;
    if (kind === 'prd-joined') on.add(product);
    else if (kind === 'prd-dropped' || kind === 'prd-merged') on.delete(product);
  }
  return on;
}

/** The ids of each product PRD's items the fleet's committee carried or deferred (PRD omni-loop-21 s8): answered for the mission branch only. */
function answeredOf(decisions: readonly StoredDecision[]): Map<MissionPrd, Set<string>> {
  const answered = new Map<MissionPrd, Set<string>>();
  for (const one of decisions) {
    if (one.kind !== 'answer' || one.item === null || one.outcome === 'escalated') continue;
    answered.set(one.prd, new Set([...(answered.get(one.prd) ?? []), one.item]));
  }
  return answered;
}

/**
 * Where a run's product PRDs go: the mission branch, cut in every repository the scope touches that allows it, the installation, and
 * each product PRD a plan of which names a repository refused, with why (bug #3275: held alone); or why none can go.
 */
type ProductBranch = { ok: true; branch: string; installation: number; held: ReadonlyMap<MissionPrd, string> } | { ok: false; why: string };

/**
 * The mission branch cut in each repository the scope touches (./branch.ts › scopeRepos, prepareAll), each kept once; why the product
 * PRDs wait otherwise: no mission branch at `with-you`, the mission's own branch not ready, no GitHub.
 */
async function productBranch(at: ProductAt, facts: readonly StoredProduct[]): Promise<ProductBranch> {
  const branch = baseOf(at.mission, at.inPlan);
  if (branch === null) return { ok: false, why: 'a product PRD is built on mission branches: run the mission above with-you' };
  if (!at.sends || at.installation === null) return { ok: false, why: `the mission branch ${branch} is not ready` };
  if (at.github.branches === null) return { ok: false, why: `the mission branch ${branch} cannot be cut: the app has no GitHub access here` };
  const targets = new Map(facts.map((fact) => [fact.prd, fact.targets] as const));
  const repos = scopeRepos({ repo: at.mission.repo, prds: [...at.mission.scope.prds, ...facts.map((fact) => fact.prd)], targets });
  // The mission's own repository was prepared before anything ran (branchReady): the others are cut here.
  const others = repos.filter((repo) => repo.toLowerCase() !== at.mission.repo.toLowerCase());
  const { refused } = await prepareAll(at.github.branches, { installation: at.installation, repos: others, branch });
  for (const repo of repos.filter((one) => !refused.has(one.toLowerCase()))) await at.store.keepBranch(at.mission, { repo, branch });
  return { ok: true, branch, installation: at.installation, held: heldByTarget(facts, refused) };
}

/** Each product PRD whose plan names a repository the mission branch was refused in, with every refusal it waits on, joined. */
function heldByTarget(facts: readonly StoredProduct[], refused: ReadonlyMap<string, string>): Map<MissionPrd, string> {
  const held = new Map<MissionPrd, string>();
  for (const fact of facts) {
    const whys = fact.targets.flatMap((repo) => refused.get(repo.toLowerCase()) ?? []);
    if (whys.length > 0) held.set(fact.prd, `${fact.prd} waits: ${whys.join('; ')}`);
  }
  return held;
}

/**
 * The mission's product PRDs (PRD omni-loop-21 s9b): the scope's product PRDs and each product roadmap's rows, read with the store's
 * products, while one is not on the branch yet. Each held until its blockers joined, built once its approval stands with
 * `/omni:ultra-yolo <id> --base-of …` into the mission branch of every repository its plan names, while the mission has a slot of
 * `mandate.parallel` for it, and joined through the merge gate once its build ended Ready (./join.ts › joinProduct). A store or a
 * mission with no product reads none, and the mission runs as before.
 */
async function productAll(at: ProductAt): Promise<ProductsDone> {
  const products = at.store.products;
  if (products === undefined || at.mission.products === undefined || !sendsCommittees(at.mission.status)) return NO_PRODUCTS;
  const reviews = await reviewAll(at, products);
  const facts = await products.facts(at.mission);
  const recorded = await at.store.events(at.mission.id);
  const joined = productsJoined(recorded);
  if (facts.length === 0) return NO_PRODUCTS;
  const branch = baseOf(at.mission, at.inPlan) ?? 'the mission branch';
  if (facts.every((fact) => joined.has(fact.prd))) return { ...NO_PRODUCTS, rows: facts, on: [...joined], waits: [`every product PRD is on ${branch}: a person lands it`] };
  const ready = await productBranch(at, facts);
  if (!ready.ok) return { ...NO_PRODUCTS, rows: facts, on: [...joined], pending: true, waits: [ready.why], events: reviews.events };
  const runs = await products.runs(at.mission.id);
  const answered = answeredOf(await at.store.decisions(at.mission.id));
  const done = await productSteps({ ...at, ...ready, products, runs, joined, answered, reviews, rounds: nextPlanRound(at.pm.jobs), sentBack: sentBackOf(recorded) }, facts);
  return { ...done, events: [...reviews.events, ...done.events] };
}

/** What a run's product steps work from, once the branch is ready. */
type ProductSteps = ProductAt & {
  branch: string;
  installation: number;
  /** The product PRDs a plan of which names a repository the mission branch was refused in, each with why: held alone. */
  held: ReadonlyMap<MissionPrd, string>;
  products: MissionProducts;
  runs: readonly ProductRun[];
  joined: Set<MissionPrd>;
  answered: ReadonlyMap<MissionPrd, ReadonlySet<string>>;
  reviews: Reviews;
  /** The round the next plan job goes under: after every PM job's, one more for each sent this run. */
  rounds: number;
  /** Bug #3302: by PM product PRD a person sent back, the decision their latest send-back follows. */
  sentBack: ReadonlyMap<ProductPrdId, string | null>;
};

/** Where a product PRD is before its build: a PRD the PM wrote by its reviews (./tech.ts), any other built as before. */
function reviewOf(at: ProductSteps, fact: StoredProduct): ReviewState {
  if (!at.pm.authored.has(fact.prd)) return { state: 'build' };
  const plans = productPlansOf(at.pm.jobs).filter((one) => one.prd === fact.prd);
  const techs = at.reviews.techs.filter((one) => one.prd === fact.prd);
  return reviewStateOf({ prd: fact.prd, latest: fact.plan ?? null, approval: fact.approval, plans, techs, decisions: at.reviews.decisions, sentBack: at.sentBack.get(fact.prd) ?? null });
}

/** A PM product PRD's step before its build: its plan job or the Architect's review sent, at work, or what it waits on. */
async function reviewStep(at: ProductSteps, fact: StoredProduct, state: Exclude<ReviewState, { state: 'build' }>, step: ProductStep): Promise<void> {
  if (state.state === 'waits') {
    step.waits.push(cut(state.why));
    return;
  }
  step.moving = true;
  if (state.state === 'working') return;
  const line = state.state === 'plan' ? planJobLine(fact.prd, 'plan', at.mission.number) : techJobLine(fact.prd, at.mission.number);
  const job = state.state === 'plan'
    ? await at.store.pm({ mission: at.mission, round: at.rounds++, line, toFleet: at.toFleet })
    : await at.products.review({ mission: at.mission, prd: fact.prd, k: state.k, line, toFleet: at.toFleet });
  if (job === null) return;
  const sent = reviewDispatched(fact.prd, job, line, state, isRetry(fact.prd, at.reviews.decisions));
  step.events.push({ ...sent, sentence: cut(sent.sentence) });
}

/** Each product PRD in scope order: its build sent, at work, joined, or what it waits on. */
async function productSteps(at: ProductSteps, facts: readonly StoredProduct[]): Promise<ProductsDone> {
  const done = new Set<MissionPrd>([...at.joined, ...[...at.states].flatMap(([prd, state]) => (state.state === 'merged' || state.state === 'joined' ? [prd] : []))]);
  const where = { joined: at.joined, done, branch: at.branch, resumes: resumeCap(at.mission), repairs: at.repairs };
  // A repair runs on its PRD's own slot (PRD 2980), as a build at work does.
  const busy = facts.filter((fact) => ['running', 'repairing'].includes(productStateOf(fact, at.runs, where).state)).length;
  const step: ProductStep = { room: at.mission.parallel - busy, moving: false, waits: [], events: [], repairs: at.repairs, repaired: [] };
  for (const fact of facts) {
    const held = at.held.get(fact.prd);
    if (held !== undefined && !at.joined.has(fact.prd)) {
      step.waits.push(held);
      continue;
    }
    const review = reviewOf(at, fact);
    if (review.state !== 'build') await reviewStep(at, fact, review, step);
    else await productStep(at, fact, productStateOf(fact, at.runs, where), step);
    if (at.joined.has(fact.prd)) done.add(fact.prd);
  }
  const sent = step.events.filter((one) => one.kind === 'dispatched').length;
  const pending = facts.some((fact) => !at.joined.has(fact.prd));
  const waits = pending ? step.waits : [`every product PRD is on ${at.branch}: a person lands it`];
  return { pending, moving: step.moving, waits, events: step.events, sent: sent + step.repaired.length, rows: facts, on: [...at.joined], repaired: step.repaired };
}

/**
 * What a run's product steps add up to as they go: the slots left, whether one moved, what they wait on, the events, and the mission's
 * repairs with those sent for its product PRDs (bug #3302), which count toward its 9 as they go.
 */
type ProductStep = { room: number; moving: boolean; waits: string[]; events: NewStoredEvent[]; repairs: RepairView; repaired: RepairJob[] };

/** One product PRD's step: its build sent while a slot is left, at work, joined once Ready, or what it waits on. */
async function productStep(at: ProductSteps, fact: StoredProduct, state: ReturnType<typeof productStateOf>, step: ProductStep): Promise<void> {
  if (await productRepairStep(at, fact, state, step)) return;
  if (state.state === 'running') step.moving = true;
  else if (state.state === 'blocked') step.waits.push(heldWords(fact.prd, state.by, at.branch));
  else if (state.state === 'waits') step.waits.push(state.why);
  else if (state.state === 'startable' && step.room > 0) {
    const sent = await sendProduct(at, fact, state.run);
    if (sent !== null) step.events.push(sent);
    step.moving = true;
    step.room -= 1;
  } else if (state.state === 'ready') await joinStep(at, fact, step);
}

/** A product PRD whose build ended Ready: joined, or what it lacks. */
async function joinStep(at: ProductSteps, fact: StoredProduct, step: ProductStep): Promise<void> {
  const joined = await joinOneProduct(at, fact);
  if ('lacks' in joined) {
    step.waits.push(joined.lacks);
    return;
  }
  step.events.push(joined.event);
  at.joined.add(fact.prd);
  step.moving = true;
}

/** A product PRD's repair step (bug #3302): its repair sent, or at work, saying so; false for any other state. */
async function productRepairStep(at: ProductSteps, fact: StoredProduct, state: ProductState, step: ProductStep): Promise<boolean> {
  if (state.state === 'repairable') await repairProduct(at, fact, state, step);
  else if (state.state === 'repairing') {
    step.moving = true;
    step.waits.push(state.why);
  } else return false;
  return true;
}

/**
 * A product PRD's repair (bug #3302), sent first in line and outside `mandate.parallel` while the mission has one left, as a repository
 * PRD's is (./repair.ts): `/omni:repair --mission <m> --prd <key>-<n> --job <failed build>`; its PRD then reads `repairing`. None left
 * once this run sent the others: the next run stops it, saying so.
 */
async function repairProduct(at: ProductSteps, fact: StoredProduct, state: Extract<ProductState, { state: 'repairable' }>, step: ProductStep): Promise<void> {
  step.moving = true;
  if (leftOf(step.repairs) === 0) return;
  const job = await at.store.repair({ mission: at.mission, prd: fact.prd, k: state.k, failedJob: state.failedJob, toFleet: at.toFleet });
  if (job === null) return;
  const sent: RepairJob = { prd: fact.prd, k: state.k, job, failedJob: state.failedJob, attempts: [{ id: job, status: 'queued', outcome: null, reason: null, prUrl: null }] };
  step.repaired.push(sent);
  step.repairs = { ...step.repairs, jobs: [...step.repairs.jobs, sent] };
  const next = repairNext(step.repairs, fact.prd, state.failedJob, state.why);
  if (next?.next === 'repairing') step.waits.push(`PRD ${fact.prd}: ${repairingWords(next)}`);
}

/** A product PRD's build sent under its key, and its dispatch; null when its key was held already. */
async function sendProduct(at: ProductSteps, fact: StoredProduct, run: number): Promise<NewStoredEvent | null> {
  const line = lineOf(fact.prd, 'build', 'ultra-yolo', basesOf(fact.targets, at.branch));
  const job = await at.products.send({ mission: at.mission, prd: fact.prd, run, line, toFleet: at.toFleet });
  if (job === null) return null;
  return { kind: 'dispatched', role: 'supervisor', prd: fact.prd, job, link: null, sentence: cut(`Sent ${line} to ${whereOf(at.mission, at.toFleet)} (run ${String(run)}).`) };
}

/** A product PRD whose build ended Ready, at the merge gate of every repository's mission branch: its `prd-joined`, or what it lacks. */
async function joinOneProduct(at: ProductSteps, fact: StoredProduct): Promise<{ event: NewStoredEvent } | { lacks: string }> {
  const joins = at.github.joins;
  const lacks = (why: string): { lacks: string } => ({ lacks: cut(`PRD ${fact.prd} waits to join ${at.branch}: ${why}`) });
  if (joins?.targets === undefined) return lacks('the app has no GitHub access to its target pull requests here');
  const targets = await joins.targets({ installation: at.installation, repos: fact.targets, prd: fact.prd, branch: at.branch });
  const answered = at.answered.get(fact.prd) ?? new Set<string>();
  const joined = await joinProduct(joins, { installation: at.installation, targets, branch: at.branch, items: fact.items, answered });
  if (!joined.joined) return lacks(joined.lacks.join('; '));
  const named = joined.pulls.map(({ repo, pr }) => `${repo} #${String(pr)}`).join(', ');
  const link = joined.pulls[0]?.url ?? null;
  return { event: { kind: 'prd-joined', role: 'supervisor', prd: fact.prd, job: null, link, sentence: cut(`PRD ${fact.prd} joined ${at.branch}: ${named} squash-merged.`) } };
}

/** A PRD the merge gate judged: joined (merged now, or already), or what it lacks. */
type Judged = { joined: Joined } | { lacks: readonly string[] };

/** One PRD waiting for its merge, at the merge gate of mission branch `base`: read, judged, and squash-merged when it passes. */
async function joinOne({ mission, base, prd, runs, installation, joins }: { mission: MissionRecord; base: string; prd: PrdNumber; runs: readonly Run[]; installation: number; joins: MissionJoins | null }): Promise<Judged> {
  const pr = featurePrOf(runs, prd);
  if (pr === null) return { lacks: ['its feature pull request is not known to the mission'] };
  if (joins === null) return { lacks: ['the app has no GitHub access here'] };
  const at = { installation, repo: mission.repo, prd, pr };
  const pull = await joins.read(at);
  const gate = judge(pull, base);
  if (gate.decision === 'waits') return { lacks: gate.lacks };
  const merged = gate.decision === 'joined' ? { ok: true as const } : await joins.merge({ ...at, head: pull.head, title: pull.title, base: pull.base, defaultBranch: pull.defaultBranch });
  return merged.ok ? { joined: { prd, pr, url: pull.url } } : { lacks: [merged.why] };
}

/**
 * The mission branch after this run's joins (PRD 2896): the PRDs on it, read from its events, and, while the mission runs or
 * waits with its branch ready (`installation` its GitHub installation, null when the branch was not prepared), each PRD of the
 * scope that waits for its merge meets the merge gate, in scope order. Passed, its feature pull request is squash-merged into the
 * branch; already merged into it, it joins without a second merge; otherwise the PRD waits on what the gate lacks, or on GitHub's
 * refusal of the merge. No branch at `with-you` or in a plan repository.
 */
async function joinAll({
  mission,
  inPlan,
  facts,
  runs,
  joined,
  off,
  installation,
  joins,
  hold = null,
}: {
  mission: MissionRecord;
  inPlan: boolean;
  facts: readonly PrdFacts[];
  runs: readonly Run[];
  joined: ReadonlySet<PrdNumber>;
  /** The PRDs a person dropped from the branch (PRD 2896 s7): none joins again. */
  off: ReadonlySet<PrdNumber>;
  installation: number | null;
  joins: MissionJoins | null;
  /** Why nothing joins this run (PRD 2896 s5: the branch cannot follow the default branch); null when PRDs may join. */
  hold?: string | null;
}): Promise<{ branch: OnBranch; joins: Joined[] }> {
  const base = baseOf(mission, inPlan);
  if (base === null) return { branch: NO_BRANCH, joins: [] };
  const lacks = new Map<PrdNumber, readonly string[]>();
  const made: Joined[] = [];
  if (installation !== null && (mission.status === 'running' || mission.status === 'waiting')) {
    const states = prdStates(facts, runs, { branch: base, joined, lacks, dropped: off });
    for (const { prd } of facts.filter((fact) => waitsForMerge(states.get(fact.prd)))) {
      if (hold !== null) {
        lacks.set(prd, [hold]);
        continue;
      }
      const judged = await joinOne({ mission, base, prd, runs, installation, joins });
      if ('joined' in judged) made.push(judged.joined);
      else lacks.set(prd, judged.lacks);
    }
  }
  return { branch: { branch: base, joined: new Set([...joined, ...made.map(({ prd }) => prd)]), lacks, dropped: off }, joins: made };
}

/**
 * Whether the mission is still watched: it runs or waits, or it is paused with a job of it still running, or delivered with a
 * milestone retro still to record (PRD 3065).
 */
const watched = ({ next, running }: Supervised): boolean => next.status === 'running' || next.status === 'waiting' || ((next.status === 'paused' || next.status === 'delivered') && running);

/** The handler of the `mission` kind. */
export function missionHandler({
  store,
  refresh,
  branches = null,
  joins = null,
  keepUps = null,
  landings = null,
  drops = null,
  answers = null,
  bugIssues = null,
  kits = null,
  retests = null,
  galaxyUrl = DEFAULT_GALAXY_URL,
  now = Date.now,
  log = noteTo('missions'),
}: MissionDeps): JobHandler {
  return async (job): Promise<JobResult> => {
    const { mission: id } = checkPayloadOf(MissionJobDataSchema, MISSION_KIND, job.payload);
    const mission = await runnable(store, id);
    if (!('id' in mission)) return mission;
    const at = now();
    // Delivered (PRD 3065): only its milestone retros run, watched until each that was sent is recorded.
    if (mission.status === 'delivered' && mission.kind !== 'omni-bugs') {
      const retros = mission.store.retros;
      return retros !== undefined && (await deliveredRun(mission.store, retros, mission, at)) ? laterOf({ job, refresh, mission, at }) : { outcome: 'done' };
    }
    // The Omni Loop bug team (PRD 3088): its own run, never delivered.
    const team = mission.kind === 'omni-bugs';
    const run = team
      ? await teamRun({ store: mission.store, mission, now: at, issues: bugIssues }, refresh)
      : await supervise(mission.store, mission, at, { branches, joins, keepUps, landings, drops, answers, kits, retests, galaxyUrl: galaxyUrl.replace(/\/+$/, '') });
    log(`mission ${id}: ${team ? 'the bug team ' : ''}${run.next.status}, sent ${String(run.sent)}, ${String(run.events)} events${run.moved ? '' : ', its status changed meanwhile'}`);
    return afterRun(run, { job, refresh, mission, at });
  };
}

/**
 * The bug team's run (PRD 3088, ./bug-team-run.ts), then the paused or stopped missions that waited on a bug that was fixed or will not
 * be (s5), each woken by its own job so that its run records the bug's move once, in its own room: the team writes nothing into another
 * workspace's mission itself. One that runs or waits wakes by itself, a minute on.
 */
async function teamRun(at: Parameters<typeof bugTeamRun>[0], refresh: MissionDeps['refresh']): Promise<Supervised> {
  const run = await bugTeamRun(at);
  const holders = (await at.store.bugTeam?.holders?.()) ?? [];
  for (const one of holders) await refresh(missionJob(one.id, one.repo));
  return run;
}

/** How a run ends: a status changed meanwhile (a Pause) is read again on the next run, a minute on; a mission no longer watched is done, or wakes by itself. */
function afterRun(run: Supervised, at: { job: ClaimedJob; refresh: MissionDeps['refresh']; mission: MissionRecord; at: number }): Promise<JobResult> {
  if (!watched(run) && run.moved) return wakeOf(run) === null ? Promise.resolve({ outcome: 'done' }) : laterOf({ ...at, until: wakeOf(run) });
  return laterOf(at);
}

/** The mission to run, with its store; or how the run ends without one: no database, no mission, a draft. */
async function runnable(store: MissionStore | null, id: string): Promise<(MissionRecord & { store: MissionStore }) | JobResult> {
  if (!store) return { outcome: 'skipped', reason: 'no database to read the mission from' };
  const mission = await store.mission(id);
  if (!mission) return { outcome: 'skipped', reason: `no mission ${id}` };
  if (mission.status === 'draft') return { outcome: 'skipped', reason: 'the mission is a draft: nothing runs before Start' };
  return { ...mission, store };
}

/**
 * When a paused mission wakes by itself (PRD 3040: `Resume tomorrow`, its fleet's last 24 hours back under the cap): its next wake;
 * null for any other mission, which a person or a job wakes.
 */
const wakeOf = ({ next }: Supervised): number | null => (next.status === 'paused' && next.nextWakeAt !== null ? Date.parse(next.nextWakeAt) : null);

/** A minute on, or at `until`, counting the `later`s in a row; the job refreshed, and its count reset, before the ledger's cap. */
async function laterOf({ job, refresh, mission, at, until = null }: { job: ClaimedJob; refresh: MissionDeps['refresh']; mission: MissionRecord; at: number; until?: number | null }): Promise<JobResult> {
  const due = new Date(until ?? at + WAKE_MS);
  const laters = (ProgressSchema.parse(job.progress ?? {}).laters ?? 0) + 1;
  if (laters < LATERS_BEFORE_RENEW) return { outcome: 'later', at: due, progress: { laters } };
  await refresh(missionJob(mission.id, mission.repo));
  return { outcome: 'later', at: due, progress: { laters: 0 } };
}
