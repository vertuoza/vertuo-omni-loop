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
//                  lists changed, never merged by the App (a person merges it with Rebase and merge)
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
//   red            a mission branch whose own checks go red once a PRD joined holds every further join: the mission waits on a
//                  person, naming the PRD that joined last and the drop line (`omni mission drop <mission> <prd>`)
//   each run       reads the mission (./store.ts); a draft runs nothing, delivered is done. Then, in order: check
//                  first (its jobs and their resumes, each PRD's approval, stage, blockers and plan), pick
//                  (./supervisor.ts), send each pick to the mission's Virtual Fleet (its runners when one holds the
//                  repository, else any runner of the workspace) under its mission key (the build, `/omni:ultra-yolo`
//                  when the repository is a product's plan repository (PRD 2873), else `/omni:yolo --for-review`; or
//                  the Reviewer and the fix after it, PRD 2871), record each decision as an event, and set the
//                  status, what it waits on and the next wake
//   how it ends    `later`, a minute on, while the mission runs or waits, or while it is paused with a job of it
//                  still running (its end is recorded); `done` otherwise. Paused sends nothing new
//   the cap        the ledger fails a job's 21st `later` in a row: before that, a run refreshes its own job (it is
//                  running, so the refresh marks it `again`), and its finish queues it at once with its count reset.
//                  The extra run reads the same state and records nothing twice
//
// A replay, or two runs at once, insert one job: the key is unique (`runner_jobs.mission_key`), so a second insert is
// refused and records nothing. The events read back give a dispatch whose event was lost its event on the next run.
import { z } from 'zod';
import type { PrdNumber } from 'omni-loop/kit/lib/ids.ts';
import { DEFAULT_GALAXY_URL } from '../env.ts';
import type { ClaimedJob, RefreshJob } from '../jobs/ledger.ts';
import { checkPayloadOf, MissionJobDataSchema } from '../jobs/payloads.ts';
import type { JobHandler, JobResult } from '../jobs/worker.ts';
import { noteTo } from '../run-log/run-log.ts';
import type { MissionBranches } from './branch.ts';
import { levelRefusal } from 'omni-loop/kit/lib/mission/brief.ts';
import { dropLine, dropSet, droppedOf, standingAsks } from 'omni-loop/kit/lib/mission/drop.ts';
import { decisionsOf, type FleetDecision } from 'omni-loop/kit/lib/mission/overturn.ts';
import { answeredOf, withDecisions, type ItemCommittee, type OpenAt } from './answers.ts';
import { recordedOf, sendsCommittees, type Committee, type Decision } from './committee.ts';
import { addedOf, pmDispatched, pmEvents, pmNext, pmWorking, withAdded, withPm, type PmJob } from './pm.ts';
import type { MissionAnswers } from './settle.ts';
import type { MissionDrops, Reopened } from './drop.ts';
import { checksOf, judge, type OpenItems } from './gate.ts';
import type { MissionJoins } from './join.ts';
import { careLine, keptWaits, type FeatureAt, type MissionKeepUps } from './keep-up.ts';
import { landedBy, missionPullBody, missionPullTitle, type LandingAt, type LandingRow, type MissionLandings, type MissionPull } from './landing.ts';
import type { MissionRecord, MissionStore } from './store.ts';
import {
  baseOf,
  conclude,
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
  WAKE_MS,
  waitsForMerge,
  withLanded,
  withWaits,
  type AnswersView,
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
  /** A high item the fleet's committee answered, settled on its PRD's feature branch (PRD 2896 s10); null (no GitHub): it goes to a person. */
  answers?: MissionAnswers | null;
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
  answers: MissionAnswers | null;
  galaxyUrl: string;
};

/** One run of a running, waiting, paused or stopped mission: check, land, keep up, join, write the mission pull request, pick, send, record, set. */
async function supervise(store: MissionStore, sought: MissionRecord, now: number, github: GitHubDeps): Promise<Supervised> {
  const { mission, read, runs, recorded, toFleet, inPlan, decided, pm, fleet } = await readRun(store, sought, now);
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
  if (kept.hold === null) await missionPull({ store, at, mission, landing, on: [...branch.joined], facts, runs, github });
  const answered = await answerAll({ store, mission, facts, runs, branch, recorded, installation: ready.installation, now, github });
  const view: CommitteeView = { alone: mission.level === 'alone', committees: decided, answers: answered };
  const before = prdStates(facts, runs, branch, view, fleet);
  const { sent, approved, asked } = unready === null ? await sendEvery({ store, mission, facts, states: before, toFleet, skill, added: pm.added }) : NOTHING_SENT;
  const pmSent = unready === null ? await sendPm(store, mission, pm, inPlan, toFleet) : [];
  const committees = [...decided, ...approved];
  const asks = [...answered.committees, ...asked];
  const all = [...runs, ...sent];
  const states = prdStates(facts, all, branch, { ...view, committees, answers: { open: answered.open, committees: asks } }, fleet);
  const fresh = sent.length + approved.length + asked.length;
  const waited = withWaits(conclude({ mission, facts, states, sent: fresh, now, branch: branch.branch }), [...dropped.waits, ...held.waits]);
  const concluded = withPm(waited, pm.writing || pmSent.length > 0, new Date(now + WAKE_MS).toISOString());
  const next: Concluded = unready === null || concluded.status === 'delivered' || concluded.status === 'paused' ? concluded : { ...concluded, status: 'waiting', waitingOn: unready };
  const events = eventsOf({ mission, facts, states, runs: all, next, toFleet, skill, recorded: recordedKeys(dropped.recorded), joins, landings: landing.landed, committees, asks });
  await store.record(mission.id, [...pmSent, ...events], new Date(now));
  const moved = await store.update(mission.id, mission.status, next);
  return { next, running: [...states.values()].some((state) => state.state === 'running'), moved, sent: sent.length, events: events.length };
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
    store.runs(mission.id),
    store.fleetRunners(mission),
    store.planRepository(mission),
    store.committees(mission.id),
    store.fleetRunners(mission).then((to) => store.room(mission, to)),
  ]);
  const decided = await decideAll(store, mission, asked, pm.added);
  const read = decided.carried ? await store.facts(mission) : first;
  return { mission, read, runs, recorded: pm.recorded, toFleet, inPlan, decided: decided.committees, pm, fleet: { room: roomOn(runners, mission.repo, now), now } };
}

/** What a run read of the mission's PM (PRD 2896 s12): the mission, its scope widened by the PRDs its fleet added, its events, those PRDs, its PM jobs, and whether one is at work. */
type PmRead = { mission: MissionRecord; recorded: RecordedEvent[]; added: ReadonlySet<PrdNumber>; jobs: readonly PmJob[]; writing: boolean };

/**
 * Each PM job of a mission at `alone` that ended, what it wrote recorded once, a second before this run's events (./pm.ts): the PRDs it
 * added and the rows its cap left unwritten. Then the mission's scope holds the PRDs its fleet added, after its own.
 */
async function pmRead(store: MissionStore, mission: MissionRecord, events: readonly RecordedEvent[], jobs: readonly PmJob[], now: number): Promise<PmRead> {
  const fresh: NewEvent[] = [];
  if (mission.level === 'alone') {
    for (const one of jobs) {
      const known = [...events, ...fresh.map(asRecorded)];
      const held = new Set([...mission.scope.prds, ...addedOf(known)]);
      const log = pmWorking(one) ? null : await store.committeeLog(one.job);
      fresh.push(...pmEvents(mission, one, log, held, events));
    }
    if (fresh.length > 0) await store.record(mission.id, fresh, new Date(now - 1000));
  }
  const recorded = [...events, ...fresh.map(asRecorded)];
  const added = addedOf(recorded);
  return { mission: { ...mission, scope: { ...mission.scope, prds: withAdded(mission.scope.prds, added) } }, recorded, added: new Set(added), jobs, writing: jobs.some(pmWorking) };
}

/** A new event as a run reads it back. */
const asRecorded = ({ kind, prd, job }: NewEvent): RecordedEvent => ({ kind, prd, job });

/** The mission's PM job, when this run sends it (PRD 2896 s12): its dispatch, or nothing. */
async function sendPm(store: MissionStore, mission: MissionRecord, pm: PmRead, inPlan: boolean, toFleet: boolean): Promise<NewEvent[]> {
  const next = pmNext({ mission, ownPrds: mission.ownPrds ?? 0, added: pm.added.size, jobs: pm.jobs, inPlan });
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
  for (const { prd, run, step } of pick({ mission, facts, states })) {
    const made = await store.send({ mission, prd, run, step, toFleet, skill });
    if (made !== null) sent.push({ prd, run, step, job: made, attempts: [{ id: made, status: 'queued', outcome: null, reason: null, prUrl: null }] });
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

/** What a run sends: builds and steps, approvals' committees (PRD 2896 s9), items' committees (s10). */
type SentAll = { sent: Run[]; approved: Committee[]; asked: ItemCommittee[] };

/** Nothing sent: the mission's branch is not ready. */
const NOTHING_SENT: SentAll = { sent: [], approved: [], asked: [] };

/** Everything this run sends, in order: the builds and steps, then the committees of approvals, then those of items. */
async function sendEvery(at: { store: MissionStore; mission: MissionRecord; facts: readonly PrdFacts[]; states: ReadonlyMap<PrdNumber, PrdState>; toFleet: boolean; skill: 'yolo' | 'ultra-yolo'; added: ReadonlySet<PrdNumber> }): Promise<SentAll> {
  const sent = await sendAll(at);
  const approved = await approveAll(at.store, at.mission, at.facts, at.states, at.toFleet, at.added);
  const asked = await askAll(at);
  return { sent, approved, asked };
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

/** An ended item committee's decision: escalated as its log reads, or carried once the App settled the item on the feature branch. */
async function decideAsk({ store, mission, runs, branch, installation, now, github }: AnswerRun, one: ItemCommittee): Promise<Decision> {
  const log = one.attempt.status === 'done' ? await store.committeeLog(one.job) : null;
  const { verdicts, decision } = answeredOf(one.prd, one, log);
  if (decision.outcome === 'escalated') return decision;
  const pr = featurePrOf(runs, one.prd);
  const answers = github.answers;
  if (pr === null || installation === null || answers === null || branch.branch === null) return { outcome: 'escalated', why: ['the App cannot settle it here: no feature pull request or no GitHub access'] };
  const answer = { fleet: mission.fleet, option: 'A', branch: branch.branch, at: new Date(now).toISOString(), verdicts };
  const settled = await answers.settle({ installation, repo: mission.repo, prd: one.prd, pr, item: one.item, answer });
  return settled.ok ? { ...decision, verdicts } : { outcome: 'escalated', why: [settled.why] };
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
  const rows = on.map((prd): LandingRow => {
    const pr = featurePrOf(runs, prd);
    const page = facts.find((fact) => fact.prd === prd)?.page ?? null;
    return { prd, pr, commit: commits.find((one) => pr !== null && one.pr === pr)?.sha ?? null, pass: passOf(runs, prd), page: page === null ? null : `${galaxyUrl}/prd/${encodeURIComponent(page)}` };
  });
  const title = missionPullTitle(mission);
  const body = missionPullBody({ mission, branch: at.branch, defaultBranch, rows, link, decisions });
  if (open !== null && open.title === title && open.body === body) return;
  await landings.write({ ...at, defaultBranch, pull: open?.number ?? null, title, body });
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
    current = [...current, ...events.map(({ kind, prd: of, job }) => ({ kind, prd: of, job }))];
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

/** Whether the mission is still watched: it runs or waits, or it is paused with a job of it still running. */
const watched = ({ next, running }: Supervised): boolean => next.status === 'running' || next.status === 'waiting' || (next.status === 'paused' && running);

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
  galaxyUrl = DEFAULT_GALAXY_URL,
  now = Date.now,
  log = noteTo('missions'),
}: MissionDeps): JobHandler {
  return async (job): Promise<JobResult> => {
    const { mission: id } = checkPayloadOf(MissionJobDataSchema, MISSION_KIND, job.payload);
    const mission = await runnable(store, id);
    if (!('id' in mission)) return mission;
    const at = now();
    const run = await supervise(mission.store, mission, at, { branches, joins, keepUps, landings, drops, answers, galaxyUrl: galaxyUrl.replace(/\/+$/, '') });
    log(`mission ${id}: ${run.next.status}, sent ${String(run.sent)}, ${String(run.events)} events${run.moved ? '' : ', its status changed meanwhile'}`);
    // A status changed meanwhile (a Pause) is read again on the next run, a minute on.
    if (!watched(run) && run.moved) return { outcome: 'done' };
    return laterOf({ job, refresh, mission, at });
  };
}

/** The mission to run, with its store; or how the run ends without one: no database, no mission, a draft, delivered. */
async function runnable(store: MissionStore | null, id: string): Promise<(MissionRecord & { store: MissionStore }) | JobResult> {
  if (!store) return { outcome: 'skipped', reason: 'no database to read the mission from' };
  const mission = await store.mission(id);
  if (!mission) return { outcome: 'skipped', reason: `no mission ${id}` };
  if (mission.status === 'draft') return { outcome: 'skipped', reason: 'the mission is a draft: nothing runs before Start' };
  return mission.status === 'delivered' ? { outcome: 'done' } : { ...mission, store };
}

/** A minute on, counting the `later`s in a row; the job refreshed, and its count reset, before the ledger's cap. */
async function laterOf({ job, refresh, mission, at }: { job: ClaimedJob; refresh: MissionDeps['refresh']; mission: MissionRecord; at: number }): Promise<JobResult> {
  const laters = (ProgressSchema.parse(job.progress ?? {}).laters ?? 0) + 1;
  if (laters < LATERS_BEFORE_RENEW) return { outcome: 'later', at: new Date(at + WAKE_MS), progress: { laters } };
  await refresh(missionJob(mission.id, mission.repo));
  return { outcome: 'later', at: new Date(at + WAKE_MS), progress: { laters: 0 } };
}
