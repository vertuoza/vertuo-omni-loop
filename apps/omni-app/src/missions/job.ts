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
import { judge } from './gate.ts';
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
  WAKE_MS,
  waitsForMerge,
  withLanded,
  withWaits,
  type Concluded,
  type Joined,
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
  /** The mission pull request, opened and rewritten, and the landings read from it (PRD 2896 s6); null (no GitHub): none is opened or read. */
  landings?: MissionLandings | null;
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
type GitHubDeps = { branches: MissionBranches | null; joins: MissionJoins | null; keepUps: MissionKeepUps | null; landings: MissionLandings | null; galaxyUrl: string };

/** One run of a running, waiting, paused or stopped mission: check, land, keep up, join, write the mission pull request, pick, send, record, set. */
async function supervise(store: MissionStore, mission: MissionRecord, now: number, github: GitHubDeps): Promise<Supervised> {
  const [read, runs, recorded, toFleet, inPlan] = await Promise.all([store.facts(mission), store.runs(mission.id), store.events(mission.id), store.fleetRunners(mission), store.planRepository(mission)]);
  const skill = inPlan ? 'ultra-yolo' : 'yolo';
  // Above `with-you` the PRDs are built on the mission's branch: with it not cut, nothing is sent and the mission says why.
  const ready = await branchReady(store, mission, inPlan, github.branches);
  const unready = ready.waits;
  const at = landingAt(mission, inPlan, ready.installation);
  const landing = await landAll({ at, runs, joined: onBranchOf(recorded), landings: github.landings });
  const { facts, joined } = afterLanding(read, recorded, landing.landed);
  const kept = await keepUp({ store, mission, inPlan, facts, runs, joined, toFleet, installation: ready.installation, keepUps: github.keepUps });
  const { branch, joins } = await joinAll({ mission, inPlan, facts, runs, joined, installation: ready.installation, joins: github.joins, hold: kept.hold });
  if (kept.hold === null) await missionPull({ at, mission, landing, on: [...branch.joined], facts, runs, github });
  const sent: Run[] = [];
  for (const { prd, run, step } of unready === null ? pick({ mission, facts, states: prdStates(facts, runs, branch) }) : []) {
    const made = await store.send({ mission, prd, run, step, toFleet, skill });
    if (made !== null) sent.push({ prd, run, step, job: made, attempts: [{ id: made, status: 'queued', outcome: null, reason: null, prUrl: null }] });
  }
  const all = [...runs, ...sent];
  const states = prdStates(facts, all, branch);
  const concluded = withWaits(conclude({ mission, facts, states, sent: sent.length, now, branch: branch.branch }), kept.waits);
  const next: Concluded = unready === null || concluded.status === 'delivered' || concluded.status === 'paused' ? concluded : { ...concluded, status: 'waiting', waitingOn: unready };
  const events = eventsOf({ mission, facts, states, runs: all, next, toFleet, skill, recorded: recordedKeys(recorded), joins, landings: landing.landed });
  await store.record(mission.id, events, new Date(now));
  const moved = await store.update(mission.id, mission.status, next);
  return { next, running: [...states.values()].some((state) => state.state === 'running'), moved, sent: sent.length, events: events.length };
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
  toFleet: boolean;
  installation: number | null;
  keepUps: MissionKeepUps | null;
}): Promise<Kept> {
  const base = keptBase(mission, inPlan, installation);
  if (base === null || installation === null || keepUps === null) return NOT_KEPT;
  const states = prdStates(facts, runs, { branch: base, joined, lacks: new Map() });
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
  at,
  mission,
  landing,
  on,
  facts,
  runs,
  github,
}: {
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
  await writeMissionPull({ at, mission, defaultBranch: known.defaultBranch, open: known.open, on, facts, runs, landings: github.landings, galaxyUrl: github.galaxyUrl });
}

/**
 * The mission pull request, once a PRD is on the branch (PRD 2896 s6): opened when none is open, rewritten when what it lists
 * changed (a join, a landing, a rebase), each PRD with its commit, the Reviewer's pass and its page. Nothing on the branch, nothing
 * is written. GitHub refusing to open it is said in the run's log, and the next run tries again.
 */
async function writeMissionPull({
  at,
  mission,
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
  const body = missionPullBody({ mission, branch: at.branch, defaultBranch, rows, link });
  if (open !== null && open.title === title && open.body === body) return;
  await landings.write({ ...at, defaultBranch, pull: open?.number ?? null, title, body });
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
  installation,
  joins,
  hold = null,
}: {
  mission: MissionRecord;
  inPlan: boolean;
  facts: readonly PrdFacts[];
  runs: readonly Run[];
  joined: ReadonlySet<PrdNumber>;
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
    const states = prdStates(facts, runs, { branch: base, joined, lacks });
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
  return { branch: { branch: base, joined: new Set([...joined, ...made.map(({ prd }) => prd)]), lacks }, joins: made };
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
  galaxyUrl = DEFAULT_GALAXY_URL,
  now = Date.now,
  log = noteTo('missions'),
}: MissionDeps): JobHandler {
  return async (job): Promise<JobResult> => {
    const { mission: id } = checkPayloadOf(MissionJobDataSchema, MISSION_KIND, job.payload);
    const mission = await runnable(store, id);
    if (!('id' in mission)) return mission;
    const at = now();
    const run = await supervise(mission.store, mission, at, { branches, joins, keepUps, landings, galaxyUrl: galaxyUrl.replace(/\/+$/, '') });
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
