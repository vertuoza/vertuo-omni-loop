// The supervisor's decisions (PRD 2842 s4, spec "3. The supervisor"): pure functions over what one run of a
// mission read, and a clock. No database, no model call: ./job.ts reads, calls these, then writes.
//
//   the reads     a PRD's approval in force stands, or there is none, or a push voided it (BL-APPROVALS-1); its
//                 stage is merged (shipped or retro), ready (outbox) or open; its plan's territory is every
//                 slice's, read with the kit's plan parser, none when it has no plan or one that cannot be read;
//                 a roadmap in scope is its PRDs, each blocker row read as its PRD
//   outcome       the spec's table: a job's end, at its step, to the PRD's next step
//
//                   Ready                  waits for a person to merge it (a build's, a fix's, or the Reviewer's pass)
//                   Review                 the build sends the Reviewer's round 1, the fix its round 2 (PRD 2871)
//                   Changes                round 1 sends the fix; round 2 waits for a person to decide the findings
//                   Waiting on answers     waits for a person to answer; the page's auto-fix carries on
//                   Need human             waits for a person to act on its runner job
//                   Held, Stopped mid-way  sent again once (run 2, at the same step); a second time stops that PRD
//                   Runner lost            recorded: PRD 2809's resume carries it
//                   Provider limit         recorded: its resume waits for the reset and spends no try (PRD 2949); the PRD stays running, waiting
//                   Cancelled              never sent again: that PRD is paused
//                   Failed                 stops that PRD, saying why
//
//                 where the table stops a PRD (a failure, a second hold, a second stop mid-way), a mission with repairs left sends
//                 a repair first (PRD 2980, ./repair.ts): the PRD is repaired, sent its step again once its fix landed, or stopped
//                 with the cause, what was tried and how to resume
//
//   prdStates     where each PRD of the scope is: merged, on the mission branch (PRD 2896), running (a job of it
//                 queued, claimed or running, resumes followed), waiting on a person, blocked by an unmerged PRD,
//                 stopped, paused, or startable. A stage of ready or merged wins over the mission's own runs: a PRD a
//                 person took to ready by hand carries on from there
//   the branch    above `with-you` (PRD 2896) a PRD that ends Ready joins the mission branch once the merge gate
//                 (./gate.ts) passes, instead of waiting for a person to merge it: on it, it no longer runs (it counts
//                 toward no `mandate.parallel`) and unblocks the PRDs it blocked, which are cut from that branch. One
//                 that does not pass waits on what the gate lacks. Which PRDs are on it is read from the mission's
//                 events, in order: joined, until dropped or landed
//   pick          the startable PRDs to send, in scope order, while fewer than `mandate.parallel` run: never one
//                 whose plan's territory meets a running PRD's, or one picked before it; a PRD with no plan runs
//                 alone. Nothing while paused, a draft or delivered
//   conclude      the mission's status (delivered only when every PRD is merged), what it waits on (at most 300
//                 characters) and its next wake, a minute on while it runs or waits
//   eventsOf      each decision as a mission event, once: the events already recorded are read back as keys, so
//                 a replayed run records nothing twice. The supervisor's own rows are signed `supervisor`, a
//                 job's end `engineer` (the Engineer hero's work), a Reviewer job's `reviewer`, its verdict a
//                 `reviewed` row linking its review; all by `agent`, never in a person's name. An event links to a
//                 pull request or its review; it never holds a person's words, a credential or a log line
//
// The steps of a run (PRD 2871): the build `/omni:yolo <n> --for-review` under the run's key, then the Reviewer
// `/omni:review <n>` under `…:review:1`, the fix `/omni:yolo-fix <n> --for-review` under `…:fix:1`, and the
// Reviewer again under `…:review:2`. Each key is unique, so a replay sends each once; there is no third round.
//
// The QA pair (PRD 3001, ./qa.ts): between the build and the Reviewer, QA `/omni:qa <n>` under `…:qa:1`, one Engineer's
// `/omni:bug-fix #<issue> --base <feature branch>` per bug of its round 1 under `…:qa-fix:1:<k>`, one at a time, then QA's round 2
// under `…:qa:2`. A pass sends the Reviewer's round 1; a bug still there after round 2 waits for a person to decide the bugs. A PRD
// of a plan repository skips the pair, as it skips the Reviewer.
import { isProductPrdId, PrdNumberSchema, PrNumberSchema, type PrdNumber, type PrNumber, type ProductPrdId } from 'omni-loop/kit/lib/ids.ts';
import { baseOfFlag, type BaseOfEntry } from 'omni-loop/kit/lib/ultra/base-of.ts';
import { prdKeyPart, type MissionPrd } from './store.prd.ts';
import type { MissionLevel } from 'omni-loop/kit/lib/mission/brief.ts';
import { sharedGround } from 'omni-loop/kit/lib/inbox/territory.ts';
import { territoryOf } from 'omni-loop/kit/lib/mission/drop.ts';
import { approvalNext, approveLine, verdictWords, type Committee } from './committee.ts';
import { answerEvents, answersNext, itemsOpen, type ItemCommittee, type OpenAt } from './answers.ts';
import { NO_REPAIRS, repairEvents, repairingWords, repairNext, type RepairView, type SentAfter } from './repair.ts';
import type { QaPosted } from 'omni-loop/kit/lib/qa/verdict.ts';
import type { IssueNumber } from 'omni-loop/kit/lib/ids.ts';
import {
  afterChecked,
  afterFix,
  bugOf,
  checkedEvent,
  decideWords,
  fixEvent,
  fixLine,
  fixNext,
  FIX_STEPS,
  isFixStep,
  isQaStep,
  NO_QA,
  qaRoundOf,
  qaSkillLine,
  sentPairWords,
  type Fix,
  type QaFixStep,
  type QaView,
} from './qa.ts';

export type MissionStatus = 'draft' | 'running' | 'waiting' | 'paused' | 'delivered' | 'stopped';
export type RunnerJobStatus = 'queued' | 'claimed' | 'running' | 'done' | 'failed' | 'cancelled';

/** The mission as a run reads it. */
export type Mission = { id: string; fleet: string; status: MissionStatus; parallel: number; waitingOn: string | null; level: Level; number: number; title: string };

export type Approval = 'standing' | 'none' | 'voided' | 'overturned';
export type Stage = 'merged' | 'ready' | 'open';

/**
 * One PRD of the scope, as a run read it. `territory` is null when it has no plan to read: it runs alone. `page` is its page's
 * id on the Omni page (its `dossiers` row), which the mission pull request links (PRD 2896 s6); null or absent when it has none.
 */
export type PrdFacts = { prd: PrdNumber; approval: Approval; stage: Stage; blockers: PrdNumber[]; territory: string[] | null; page?: string | null };

/** What a Reviewer job's log says it posted (PRD 2871): how many findings, when it says, and its review's link. */
export type Posted = { findings: number | null; url: string | null };

/** One runner job of a run: the job the mission sent, or a resume of it (PRD 2809). A Reviewer job's carries what it posted. */
export type Attempt = {
  id: string;
  status: RunnerJobStatus;
  outcome: string | null;
  reason: string | null;
  prUrl: string | null;
  posted?: Posted | null;
  /** When the provider limit that ended this job lifts (PRD 2949: `runner_jobs.limited_until`), and whether the runner guessed it (the job's parts). */
  limitedUntil?: string | null;
  guessed?: boolean;
  /** A QA job's verdict, read from its log when it ended done (PRD 3001); null when none reads. Absent for any other job. */
  checked?: QaPosted | null;
};

/** Why a running PRD does not run yet (PRD 2949): its job met a provider limit and its resume waits for the reset, or no runner of its target can take it now. */
export type Wait = { on: 'limit'; until: string; guessed: boolean } | { on: 'room' } | { on: 'fix'; words: string };

/** A runner of the mission's target, as the room's read sees it: what it holds, its slots, its last sight and its health. */
export type RoomRunner = {
  repos: readonly string[];
  slots: number;
  used: number;
  lastSeenAt: string;
  health: { at: string; paused?: string | null | undefined; accounts?: readonly { state: string; resetsAt?: string | undefined }[] | undefined } | null;
};

/** A runner is offline after this long without a sight (the Runners page's 90 s); its health is fresh under the claim's two minutes. */
const OFFLINE_MS = 90_000;
const FRESH_MS = 120_000;

/**
 * Whether a runner of the target can take a job now (PRD 2949): one that holds the repository, is online, is not paused, has a free slot and,
 * by a fresh health, an account left. With no runner holding the repository the mission's own check says so, not this one: there is room.
 */
export function roomOn(runners: readonly RoomRunner[], repo: string, now: number): boolean {
  const mine = runners.filter((runner) => runner.repos.some((one) => one.toLowerCase() === repo.toLowerCase()));
  if (mine.length === 0) return true;
  return mine.some((runner) => {
    if (now - Date.parse(runner.lastSeenAt) > OFFLINE_MS || runner.used >= runner.slots) return false;
    const health = runner.health;
    if (health === null) return true;
    if (health.paused != null) return false;
    const accounts = health.accounts ?? [];
    const out = accounts.length > 0 && accounts.every((one) => one.state === 'out' && one.resetsAt !== undefined && Date.parse(one.resetsAt) > now);
    return !(out && now - Date.parse(health.at) < FRESH_MS);
  });
}

/**
 * A step of a run, in order: the build, QA's round 1, the Engineer's fix of each of its bugs, QA's round 2 (PRD 3001), the
 * Reviewer's round 1, the fix after it, the Reviewer's round 2 (PRD 2871).
 */
export type Step = 'build' | 'qa:1' | QaFixStep | 'qa:2' | 'review:1' | 'fix:1' | 'review:2';
const STEPS: readonly Step[] = ['build', 'qa:1', ...FIX_STEPS, 'qa:2', 'review:1', 'fix:1', 'review:2'];

/** One job the mission sent for a PRD: its key's run number and step, its job, and its attempts in order, the job's first. */
export type Run = { prd: PrdNumber; run: number; step: Step; job: string; attempts: Attempt[] };

/** How a runner job ended, as the table reads it. */
export type JobEnd = 'ready' | 'answers' | 'human' | 'held' | 'stopped' | 'review' | 'changes' | 'checked' | 'lost' | 'limited' | 'cancelled' | 'failed';

/**
 * What a person must do for a PRD to carry on: `decide` the Reviewer's findings after round 2 (PRD 2871), `decide-bugs` QA's (PRD 3001),
 * `kit` update the kit to the one that fixed the Omni Loop bug it stopped on (PRD 3088).
 */
export type WaitsOn = 'approve' | 'approve-again' | 'answer' | 'merge' | 'act' | 'decide' | 'decide-bugs' | 'kit';

/**
 * A job's end, as the PRD's next step: `send` the run's next step (PRD 2871); `checked`, QA's verdict decides it, and `land`, the
 * Engineer's fix lands or is marked first (PRD 3001, ./qa.ts).
 */
export type Next =
  | { next: 'waits'; on: 'merge' | 'answer' | 'act' | 'decide' }
  | { next: 'send'; step: Step }
  | { next: 'checked' }
  | { next: 'land' }
  | { next: 'again' }
  | { next: 'stops'; why: string }
  | { next: 'paused' }
  | { next: 'records' };

export type PrdState =
  | { state: 'merged' }
  | { state: 'joined' }
  | { state: 'dropped' }
  | { state: 'waits'; on: 'join'; lacks: readonly string[] }
  | { state: 'running'; run: number; waiting?: Wait }
  | { state: 'waits'; on: Exclude<WaitsOn, 'decide' | 'decide-bugs'>; why?: string | null }
  | { state: 'waits'; on: 'decide'; pr: PrNumber | null }
  /** A bug still there after QA's round 2 (PRD 3001): a person sends it on to the Reviewer or stops it. */
  | { state: 'waits'; on: 'decide-bugs'; issues: readonly IssueNumber[]; pr: PrNumber | null }
  | { state: 'blocked'; by: PrdNumber[] }
  | { state: 'stopped'; why: string }
  | { state: 'paused' }
  /** `fix`: the bug and the feature branch of an Engineer's fix of QA's bug (PRD 3001). */
  | { state: 'startable'; run: number; step: Step; fix?: Fix }
  /** At `alone` (PRD 2896 s9): its committee to send, or at work. Neither takes a slot of `mandate.parallel`: no code runs. */
  | { state: 'approvable'; round: number }
  | { state: 'deciding'; round: number }
  /** At `alone` (PRD 2896 s10): its high items' committees to send (`send`), or at work. No slot of `mandate.parallel` either. */
  | { state: 'answering'; send: readonly string[] }
  /** Its step failed (PRD 2980): its repair to send, first in line, or at work. A repair runs on the PRD's own slot. */
  | { state: 'repairable'; k: number; failedJob: string }
  | { state: 'repairing'; number: number; left: number; why: string | null };

/**
 * What a run read of the PRDs' items at `alone` (PRD 2896 s10): the items open at the head of each PRD's feature pull request that
 * waits on answers, by PRD (a PRD not read is absent), and the item committees the mission sent.
 */
export type AnswersView = { open: ReadonlyMap<PrdNumber, readonly OpenAt[]>; committees: readonly ItemCommittee[] };

/**
 * The committees a run read (PRD 2896 s9), and whether the mission is at `alone`, where a PRD not approved goes to its committee;
 * and its items' committees (s10), where a PRD waiting on answers goes to its committee item by item.
 */
export type CommitteeView = { alone: boolean; committees: readonly Committee[]; answers?: AnswersView };

/** Below `alone`, or no committee read: a PRD not approved waits for a person, as before. */
const NO_COMMITTEE: CommitteeView = { alone: false, committees: [] };

/**
 * The mission branch as a run read it (PRD 2896): the PRDs on it, and what the merge gate lacks for each PRD that ended
 * Ready and has not joined. At `with-you` both are empty, and a Ready PRD waits for a person to merge it.
 */
export type OnBranch = {
  branch: string | null;
  joined: ReadonlySet<PrdNumber>;
  lacks: ReadonlyMap<PrdNumber, readonly string[]>;
  /** The PRDs a person dropped from the branch (PRD 2896 s7): off it, never joined again until a person sends them again. */
  dropped?: ReadonlySet<PrdNumber>;
};

/** No mission branch: a mission at `with-you`, or one whose branch was not read. */
export const NO_BRANCH: OnBranch = { branch: null, joined: new Set(), lacks: new Map() };

/** A PRD that joined the mission branch in this run: its pull request, squash-merged. */
export type Joined = { prd: PrdNumber; pr: PrNumber; url: string };

/** A PRD to send: the run it is, and its step; for an Engineer's fix of QA's bug, the bug and its feature branch (PRD 3001). */
export type Send = { prd: PrdNumber; run: number; step: Step; fix?: Fix };

/** What a run sets on the mission; `pausedBy` stuck when the run pauses it by stuck (PRD 3065). */
export type Concluded = { status: MissionStatus; waitingOn: string | null; nextWakeAt: string | null; pausedBy?: 'stuck' };

export type EventKind =
  | 'dispatched' | 'job-ended' | 'waits' | 'prd-ready' | 'prd-merged' | 'held' | 'stopped' | 'delivered' | 'reviewed' | 'prd-joined' | 'prd-dropped' | 'decided' | 'escalated'
  | 'prd-added' | 'not-written' | 'repair-started' | 'retro' | 'repair-ended' | 'bug-reported' | 'checked'
  /** PRD 3040: the supervisor recorded a budget stop, paused the mission again by it, or resumed it once it was answered. */
  | 'budget-stop' | 'paused' | 'resumed'
  /** PRD 3065: a stuck repair sent or a pause by stuck, a milestone retro recorded or skipped, a change a retro proposed. */
  | 'stuck' | 'milestone-retro' | 'item-proposed'
  /**
   * PRD 3088: the Omni Loop bug team sent a bug-fix job, or set a bug aside on its question or its third try; a bug a PRD of the mission
   * stopped on is fixed (or will not be), or that PRD went again on a kit that runs the fix.
   */
  | 'bug-taken' | 'bug-asked' | 'bug-fixed';
export type EventRole = 'supervisor' | 'engineer' | 'reviewer' | 'pm' | 'qa';

/** An event to record, signed by its role and `agent`. */
export type NewEvent = { kind: EventKind; role: EventRole; prd: PrdNumber | null; job: string | null; link: string | null; sentence: string };

/** An event already recorded, as a run reads it back. */
export type RecordedEvent = { kind: string; prd: PrdNumber | null; job: string | null };

/** How often a running or waiting mission checks again, when nothing wakes it first. */
export const WAKE_MS = 60_000;
/** The longest `waiting_on`, and the longest event sentence, the database keeps. */
const WORDS_MAX = 300;
/** The run a held or stopped-mid-way PRD stops at: sent again once, never a third time. */
const LAST_RUN = 2;

/** The rounds the Reviewer reviews at most (PRD 2871): a third has no key. */
const ROUNDS = 2;

const KEY = /^mission:([0-9a-f-]{36}):prd:([1-9][0-9]*):run:([1-9][0-9]*)(?::(review:[12]|fix:1|qa:[12]|qa-fix:1:[1-5]))?$/;

/**
 * The key a mission's job is sent under: never twice for one PRD, run and step. The build's is the run's own. A product PRD is keyed
 * by its id (PRD omni-loop-21 s7, ./store.prd.ts): `mission:<id>:prd:omni-loop-15:run:1`.
 */
export const missionKey = (mission: string, prd: MissionPrd, run: number, step: Step = 'build'): string =>
  `mission:${mission}:${prdKeyPart(prd)}:run:${String(run)}${step === 'build' ? '' : `:${step}`}`;

const isStep = (text: string): text is Step => STEPS.some((step) => step === text);

/** The PRD, run and step a mission key names; null for any other text. */
export function runOfKey(key: string): { prd: PrdNumber; run: number; step: Step } | null {
  const match = KEY.exec(key);
  const prd = PrdNumberSchema.safeParse(Number(match?.[2]));
  const step = match?.[4] ?? 'build';
  return match && prd.success && isStep(step) ? { prd: prd.data, run: Number(match[3]), step } : null;
}

/** The skill a mission builds its PRD with: `ultra-yolo` for a PRD of a plan repository, `yolo` otherwise (PRD 2873). */
export type BuildSkill = 'yolo' | 'ultra-yolo';

/**
 * The line a step is sent as (PRD 2871): the build and the fix sent for review, the Reviewer between them. A PRD of
 * a plan repository is built with `/omni:ultra-yolo <n>` (PRD 2873), which takes no `--for-review`: it is sent
 * unchanged, so its run ends as a build without the Reviewer does; its fix, were one sent, is
 * `/omni:ultra-yolo-fix <n> --for-review`. QA's rounds, and the Engineer's fix of a bug, `fix` its bug and feature branch (PRD 3001).
 * A product PRD (PRD omni-loop-21 s7) is built with `/omni:ultra-yolo <key>-<n>`, its `base` the mission branch of each repository
 * it touches (`--base-of`): see `productLineOf`.
 */
export function lineOf(prd: MissionPrd, step: Step, skill: BuildSkill = 'yolo', base: Base = null, fix: Fix | null = null): string {
  if (isProductPrdId(prd)) return productLineOf(prd, step, typeof base === 'string' || base === null ? [] : base);
  const n = String(prd);
  const onBase = typeof base === 'string' ? ` --base ${base}` : '';
  const round = qaRoundOf(step);
  if (round !== null) return qaSkillLine(prd, round);
  if (isFixStep(step)) {
    if (fix === null) throw new Error(`the fix of bug ${String(bugOf(step))} of PRD ${n} is sent with its bug and its feature branch`);
    return fixLine(fix);
  }
  if (step === 'build') return skill === 'ultra-yolo' ? `/omni:ultra-yolo ${n}` : `/omni:yolo ${n} --for-review${onBase}`;
  if (step === 'fix:1') return skill === 'ultra-yolo' ? `/omni:ultra-yolo-fix ${n} --for-review` : `/omni:yolo-fix ${n} --for-review${onBase}`;
  return `/omni:review ${n}`;
}

/**
 * Where a step's pull requests go: the mission branch, for a repository's PRD (`--base`); the mission branch of each repository a
 * product PRD touches (`--base-of`, PRD omni-loop-21 s7); none at `with-you`.
 */
export type Base = string | readonly BaseOfEntry[] | null;

/** The mission branch `branch` in each of `repos`, as `--base-of` names them. */
export const basesOf = (repos: readonly string[], branch: string): BaseOfEntry[] => repos.map((repo) => ({ repo, branch }));

/**
 * The line a step of a product PRD is sent as (PRD omni-loop-21 s7): built with `/omni:ultra-yolo <key>-<n> --base-of …`, each
 * target pull request into its repository's mission branch, the fix with the same bases, the Reviewer by its id. No bases (at
 * `with-you`) sends no flag. A product PRD skips the QA pair, as a plan repository's PRD does: no QA line is ever sent for one.
 */
function productLineOf(prd: ProductPrdId, step: Step, bases: readonly BaseOfEntry[]): string {
  const flag = bases.length === 0 ? '' : ` ${baseOfFlag(bases)}`;
  if (qaRoundOf(step) !== null || isFixStep(step)) throw new Error(`PRD ${prd} is a product PRD: it skips the QA pair, and ${step} is never sent for it`);
  if (step === 'build') return `/omni:ultra-yolo ${prd}${flag}`;
  return step === 'fix:1' ? `/omni:ultra-yolo-fix ${prd} --for-review${flag}` : `/omni:review ${prd}`;
}

/** What a mission may run at (PRD 2896): `with-you` changes nothing, the two others build on a branch of the mission's own. */
export type Level = MissionLevel;

/** `branches.mission`'s default (kit/lib/config.ts): the template the repository's config may change, which the App does not read. */
const MISSION_BRANCH = 'mission/{number}-{topic}';
const TOPIC_MAX = 40;

/**
 * The branch of mission `number`, titled `title` (PRD 2896): `branches.mission` filled, its topic the title as a slug (lowercase
 * letters and digits, dashes between, 40 characters at most, `mission` for a title with none). Cut from the default branch when the
 * mission starts above `with-you`; a PRD of the mission is built on it and its pull request targets it.
 */
export function missionBranch(number: number, title: string): string {
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+/, '').slice(0, TOPIC_MAX).replace(/-+$/, '');
  return MISSION_BRANCH.replace('{number}', String(number)).replace('{topic}', slug === '' ? 'mission' : slug);
}

/** The branch a mission builds its PRDs on: its own above `with-you` in a repository that is not a plan repository (PRD 2896), none otherwise. */
export function baseOf(mission: { level: Level; number: number; title: string }, inPlan: boolean): string | null {
  return mission.level === 'with-you' || inPlan ? null : missionBranch(mission.number, mission.title);
}

/** The Reviewer's round a step is; null for the build and the fix. */
const roundOf = (step: Step): number | null => (step === 'review:1' ? 1 : step === 'review:2' ? 2 : null);

/** A review's link as GitHub gives it: a pull request of a repository, or one review on it. */
const REVIEW_URL = /^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/pull\/\d+(?:#pullrequestreview-\d+)?$/;
/** `omni review post`'s line (kit/bin/commands/review.ts): posted, with its verdict and count, or a round already posted. */
const POSTED = /omni review: posted round [12] \((pass|changes, (\d+) findings?)\) on PR #\d+: (\S+)$/;
const ALREADY = /omni review: round [12] is already posted on PR #\d+: (\S+?)\. Nothing posted\.$/;

/**
 * What a Reviewer job's log says it posted: its last `omni review post` line, read for its count of findings (none
 * when it found the round already posted) and its review's link (none unless it is GitHub's). Only those two are
 * kept: never a line of the log (L-GDPR-2). Null when the log has no such line.
 */
export function postedOf(log: string): Posted | null {
  for (const line of log.split('\n').reverse()) {
    const posted = POSTED.exec(line.trimEnd());
    if (posted) return { findings: posted[1] === 'pass' ? 0 : Number(posted[2]), url: reviewUrl(posted[3]) };
    const already = ALREADY.exec(line.trimEnd());
    if (already) return { findings: null, url: reviewUrl(already[1]) };
  }
  return null;
}

const reviewUrl = (url: string | undefined): string | null => (url !== undefined && REVIEW_URL.test(url) ? url : null);

/** The pull request a link names; null when it names none. */
function prOfUrl(url: string | null): PrNumber | null {
  const number = /\/pull\/(\d+)/.exec(url ?? '')?.[1];
  const pr = PrNumberSchema.safeParse(Number(number));
  return number !== undefined && pr.success ? pr.data : null;
}

// ── The reads, made plain ────────────────────────────────────────────────────────

/** A PRD's latest approval, as standing or voided, or none. */
export const approvalOf = (latest: { voided: boolean; overturned?: boolean } | null): Approval =>
  latest === null ? 'none' : latest.overturned === true ? 'overturned' : latest.voided ? 'voided' : 'standing';

/** A PRD's stage, from the stages it reached. */
export function stageOf(stages: readonly string[]): Stage {
  if (stages.includes('shipped') || stages.includes('retro')) return 'merged';
  return stages.includes('outbox') ? 'ready' : 'open';
}

export { territoryOf };

/** A roadmap row: its PRD (null for a product's), its row id, and the row ids it waits on. */
export type RoadmapRow = { prd: PrdNumber | null; rowId: string; blockers: string[] };

/** The scope's PRDs, in order, each with the PRDs it waits on: the PRDs named alone first, then each roadmap's. */
export function expandScope(prds: readonly PrdNumber[], roadmaps: readonly (readonly RoadmapRow[])[]): { prd: PrdNumber; blockers: PrdNumber[] }[] {
  const scope = new Map<PrdNumber, Set<PrdNumber>>(prds.map((prd) => [prd, new Set()]));
  for (const rows of roadmaps) {
    const byRow = new Map(rows.map((row) => [row.rowId, row.prd]));
    for (const row of rows) {
      if (row.prd === null) continue;
      const blockers = scope.get(row.prd) ?? new Set<PrdNumber>();
      for (const id of row.blockers) {
        const blocker = byRow.get(id);
        if (blocker !== undefined && blocker !== null && blocker !== row.prd) blockers.add(blocker);
      }
      scope.set(row.prd, blockers);
    }
  }
  return [...scope].map(([prd, blockers]) => ({ prd, blockers: [...blockers] }));
}

// ── The table ────────────────────────────────────────────────────────────────────

/**
 * How a runner job ended; null while it is queued, claimed or running. A done job with no hand-off stopped mid-way; a QA job done on
 * its verdict is `checked` (PRD 3001).
 */
export function endOf({ status, outcome: word, checked }: Attempt): JobEnd | null {
  if (status === 'queued' || status === 'claimed' || status === 'running') return null;
  if (status === 'cancelled') return 'cancelled';
  if (status === 'failed') return 'failed';
  if (checked != null) return 'checked';
  if (word === 'ready' || word === 'answers' || word === 'human' || word === 'held' || word === 'review' || word === 'changes') return word;
  return 'stopped';
}

/** A step that stopped mid-way, in run `run`: sent again once, stopped the second time. */
const stoppedAt = (run: number): Next => (run >= LAST_RUN ? { next: 'stops', why: 'it stopped mid-way twice' } : { next: 'again' });

/**
 * A hand-off for the Reviewer at its step (PRD 2871): a build ready for review goes to QA first (PRD 3001) unless `withQa` is
 * false, a fix to round 2; changes in round 1 send the fix, in round 2 a person decides. Any other step stopped mid-way.
 */
function handedOff(end: 'review' | 'changes', { run, step, withQa }: { run: number; step: Step; withQa: boolean }): Next {
  if (end === 'review') {
    if (step === 'build') return { next: 'send', step: withQa ? 'qa:1' : 'review:1' };
    return step === 'fix:1' ? { next: 'send', step: 'review:2' } : stoppedAt(run);
  }
  if (step === 'review:1') return { next: 'send', step: 'fix:1' };
  return step === 'review:2' ? { next: 'waits', on: 'decide' } : stoppedAt(run);
}

/** How a job of the QA pair ended (PRD 3001): QA's verdict, or the Engineer's fix to land; any other end as any step's. */
function pairOutcome(end: JobEnd, step: Step): Next | null {
  const done = end !== 'lost' && end !== 'limited' && end !== 'cancelled' && end !== 'failed';
  if (isQaStep(step) && done) return end === 'checked' ? { next: 'checked' } : { next: 'stops', why: 'its job failed: verdict not read' };
  return isFixStep(step) && done ? { next: 'land' } : null;
}

/**
 * The spec's table: a job's end, at step `step` of run `run`, as the PRD's next step. A hand-off its step never ends on stopped mid-way.
 * A build ready for review goes to QA first (PRD 3001), unless `withQa` is false: a plan repository's PRD skips the QA pair.
 */
export function outcome(end: JobEnd, run: number, reason: string | null = null, step: Step = 'build', withQa = true): Next {
  const pair = pairOutcome(end, step);
  if (pair !== null) return pair;
  switch (end) {
    case 'ready':
      return { next: 'waits', on: 'merge' };
    case 'answers':
      return { next: 'waits', on: 'answer' };
    case 'human':
      return { next: 'waits', on: 'act' };
    case 'review':
    case 'changes':
      return handedOff(end, { run, step, withQa });
    case 'checked':
      return stoppedAt(run);
    case 'held':
      return run >= LAST_RUN ? { next: 'stops', why: 'it was held twice' } : { next: 'again' };
    case 'stopped':
      return stoppedAt(run);
    case 'lost':
    case 'limited':
      return { next: 'records' };
    case 'cancelled':
      return { next: 'paused' };
    case 'failed':
      return { next: 'stops', why: reason ? `its job failed: ${reason}` : 'its job failed' };
  }
}

// ── Where each PRD is ────────────────────────────────────────────────────────────

/** A run's latest attempt: the resume that carries it, or the job itself. */
const lastOf = (run: Run): Attempt | undefined => run.attempts.at(-1);

/** A step's place in a run, the build's 0: a later step is further on (PRD 3065: reaching one is moving). */
export const stepRank = (step: Step): number => STEPS.indexOf(step);

/** Whether job `a` comes after job `b`: a later run, or a later step of the same run. */
export const after = (a: Run, b: Run): boolean => a.run > b.run || (a.run === b.run && stepRank(a.step) > stepRank(b.step));

/**
 * Where each PRD of the scope is, by PRD. On a mission branch (PRD 2896), a PRD on it is `joined` and unblocks the PRDs
 * it blocked, and one waiting to be merged waits on what the merge gate lacks, when the run judged it.
 */
export function prdStates(
  facts: readonly PrdFacts[],
  runs: readonly Run[],
  branch: OnBranch = NO_BRANCH,
  view: CommitteeView = NO_COMMITTEE,
  fleet: Fleet = NO_FLEET,
  repairs: RepairView = NO_REPAIRS,
  qa: QaView = NO_QA,
): Map<PrdNumber, PrdState> {
  const merged = new Set([...facts.filter((fact) => fact.stage === 'merged').map((fact) => fact.prd), ...branch.joined]);
  const of = (fact: PrdFacts): PrdState => {
    if (fact.stage !== 'merged' && branch.joined.has(fact.prd)) return { state: 'joined' };
    if (fact.stage !== 'merged' && branch.dropped?.has(fact.prd) === true) return { state: 'dropped' };
    const answers = view.answers === undefined ? undefined : { open: view.answers.open, committees: view.answers.committees.filter((one) => one.prd === fact.prd) };
    const own = { alone: view.alone, committees: view.committees.filter((one) => one.prd === fact.prd), ...(answers === undefined ? {} : { answers }) };
    return stateOf(fact, runs.filter((one) => one.prd === fact.prd), { merged, branch, view: own, fleet, repairs, qa });
  };
  return new Map(facts.map((fact) => [fact.prd, of(fact)]));
}

/** A PRD waiting for its merge: into the mission branch, on what the gate lacks, when the run judged it; else for a person. */
const toMerge = (prd: PrdNumber, branch: OnBranch): PrdState => {
  const lacks = branch.lacks.get(prd);
  return lacks === undefined ? { state: 'waits', on: 'merge' } : { state: 'waits', on: 'join', lacks };
};

/**
 * What a PRD's state is read against: the PRDs merged (or on the branch), the mission branch, the PRD's committees, and the QA pair as
 * the run read it (PRD 3001), with the PRD's own runs.
 */
type Around = { merged: ReadonlySet<PrdNumber>; branch: OnBranch; view: CommitteeView; fleet: Fleet; repairs: RepairView; qa: QaView; runs?: readonly Run[] };

/** What the target's runners let a queued job do (PRD 2949): whether one can take it, at `now`. */
export type Fleet = { room: boolean; now: number };
const NO_FLEET: Fleet = { room: true, now: 0 };

/**
 * Why a job still queued does not run (PRD 2949): its resume waits for the provider limit that ended the job before it, until the
 * reset; else no runner of its target can take it now. A claimed or running job waits for nothing.
 */
function waitOf(attempts: readonly Attempt[], fleet: Fleet): Wait | undefined {
  if (attempts.at(-1)?.status !== 'queued') return undefined;
  const limited = attempts.at(-2);
  if (limited?.limitedUntil != null && Date.parse(limited.limitedUntil) > fleet.now) return { on: 'limit', until: limited.limitedUntil, guessed: limited.guessed === true };
  return fleet.room ? undefined : { on: 'room' };
}

/** A PRD whose job is at work or queued: running, and waiting when its job is queued and cannot go yet (PRD 2949). */
function runningAt(latest: Run, fleet: Fleet): PrdState {
  const waiting = waitOf(latest.attempts, fleet);
  return waiting === undefined ? { state: 'running', run: latest.run } : { state: 'running', run: latest.run, waiting };
}

function stateOf(fact: PrdFacts, runs: readonly Run[], outside: Around): PrdState {
  const around = { ...outside, runs };
  if (fact.stage === 'merged') return { state: 'merged' };
  const latest = runs.reduce<Run | null>((last, one) => (last === null || after(one, last) ? one : last), null);
  const last = latest ? lastOf(latest) : undefined;
  if (latest && last && endOf(last) === null) return runningAt(latest, around.fleet);
  if (fact.stage === 'ready') return toMerge(fact.prd, around.branch);
  return latest && last ? afterEnd(fact, latest, last, around) : gate(fact, 1, 'build', around);
}

/**
 * What a PRD whose job ended waits on: its merge (into the mission branch, on a branch), the Reviewer's findings, a person, or, at
 * `alone`, its answers from its committee (PRD 2896 s10).
 */
function waitsAfter(on: Extract<Next, { next: 'waits' }>['on'], { fact, latest, last }: { fact: PrdFacts; latest: Run; last: Attempt }, around: Around): PrdState {
  if (on === 'merge') return toMerge(fact.prd, around.branch);
  if (on === 'answer' && around.view.alone) return answering(fact, latest, around);
  return on === 'decide' ? { state: 'waits', on: 'decide', pr: prOfUrl(last.prUrl) } : { state: 'waits', on };
}

/** Where a PRD is once its latest job ended: the table's next step, the next step of a run under the same run. */
/** Where a PRD of the QA pair goes once its job ended (PRD 3001, ./qa.ts): QA's verdict decides, or the Engineer's fix lands first. */
function pairAfter(next: Next, { fact, latest, last }: { fact: PrdFacts; latest: Run; last: Attempt }, around: Around): PrdState | null {
  const runs = around.runs ?? [];
  if (next.next === 'checked' && last.checked != null) return afterChecked(fact.prd, latest, last.checked, runs, around.qa);
  return next.next === 'land' && isFixStep(latest.step) ? afterFix(fact.prd, { ...latest, step: latest.step }, last, runs, around.qa) : null;
}

function afterEnd(fact: PrdFacts, latest: Run, last: Attempt, around: Around): PrdState {
  const next = outcome(endOf(last) ?? 'stopped', latest.run, last.reason, latest.step, !around.qa.skip);
  const pair = pairAfter(next, { fact, latest, last }, around);
  if (pair !== null) return pair;
  if (next.next === 'waits') return waitsAfter(next.on, { fact, latest, last }, around);
  if (next.next === 'send') return { state: 'startable', run: latest.run, step: next.step };
  if (next.next === 'stops') return repaired(fact, latest, last, next.why, around);
  if (next.next === 'paused') return { state: 'paused' };
  if (next.next === 'again') return gate(fact, latest.run + 1, latest.step, around);
  return { state: 'running', run: latest.run };
}

/**
 * A PRD the table stops (PRD 2980): repaired first while the mission has repairs left (./repair.ts), its step sent again once the
 * repair allows it, else stopped, saying why. With repairs off it stops, as before.
 */
function repaired(fact: PrdFacts, latest: Run, last: Attempt, why: string, around: Around): PrdState {
  const next = repairNext(around.repairs, fact.prd, last.id, why);
  if (next === null || next.next === 'stops') return { state: 'stopped', why: next?.why ?? why };
  if (next.next === 'kit') return { state: 'waits', on: 'kit', why: next.why };
  if (next.next === 'repair') return { state: 'repairable', k: next.k, failedJob: next.failedJob };
  if (next.next === 'repairing') return { state: 'repairing', number: next.number, left: next.left, why: next.why };
  if (next.next === 'paused') return { state: 'paused' };
  return gate(fact, latest.run + 1, latest.step, around);
}

/**
 * At `alone` (PRD 2896 s10), a PRD whose job ended Waiting on answers: each high item open at its head goes to the fleet's
 * committee, and the PRD waits for a person only on what the committee sent to one, a human-action item, or an item that does not
 * read. Once none is open, its run is sent again, once: its gate is green, so it ships and goes to the Reviewer. Its items not read
 * (no feature pull request known, no GitHub): it waits for a person, as below `alone`.
 */
function answering(fact: PrdFacts, latest: Run, around: Around): PrdState {
  const open = around.view.answers?.open.get(fact.prd);
  if (open === undefined) return { state: 'waits', on: 'answer' };
  if (!itemsOpen(open)) {
    if (latest.run >= LAST_RUN) return { state: 'waits', on: 'answer', why: 'its questions are answered, and its run was sent again once already' };
    return gate(fact, latest.run + 1, latest.step, around);
  }
  const next = answersNext(open, around.view.answers?.committees ?? []);
  if (next.send.length > 0 || next.deciding) return { state: 'answering', send: next.send };
  return { state: 'waits', on: 'answer', why: next.person.length > 0 ? next.person.join('; ') : null };
}

/**
 * Step `step` of run `run` of the PRD. A build waits for its approval to stand and every blocker to be merged; a
 * later step (the Reviewer, the fix) carries on a build already sent, and waits on neither. At `alone` (PRD 2896 s9) a PRD
 * not approved goes to its fleet's committee first, and waits for a person only once the committee sent it to one.
 */
function gate(fact: PrdFacts, run: number, step: Step, { merged, view, qa, runs = [] }: Around): PrdState {
  if (isFixStep(step)) return fixNext(fact.prd, run, bugOf(step), runs, qa);
  if (step !== 'build') return { state: 'startable', run, step };
  const approval = approvalNext(fact.approval, view.committees, view.alone);
  if (approval.next === 'send') return { state: 'approvable', round: approval.round };
  if (approval.next === 'deciding') return { state: 'deciding', round: approval.round };
  if (approval.next === 'person') return { state: 'waits', on: fact.approval === 'voided' ? 'approve-again' : 'approve', why: approval.why };
  const by = fact.blockers.filter((blocker) => !merged.has(blocker));
  return by.length > 0 ? { state: 'blocked', by } : { state: 'startable', run, step };
}

/** Whether a PRD waits for its merge, to be judged by the merge gate of a mission branch. */
export const waitsForMerge = (state: PrdState | undefined): boolean => state?.state === 'waits' && state.on === 'merge';

/**
 * The PRDs on the mission branch, from the mission's events in the order they happened: joined, until dropped or landed. A
 * landing is recorded as the PRD's `prd-merged` (PRD 2896 s6): its commit is on the default branch.
 */
export function onBranchOf(events: readonly RecordedEvent[]): Set<PrdNumber> {
  const on = new Set<PrdNumber>();
  for (const { kind, prd } of events) {
    if (prd === null) continue;
    if (kind === 'prd-joined') on.add(prd);
    else if (kind === 'prd-dropped' || kind === 'landed' || kind === 'prd-merged') on.delete(prd);
  }
  return on;
}

/** The PRDs the mission recorded merged into the default branch: by its stage, or by a landing of the mission pull request (PRD 2896 s6). */
export const landedOf = (events: readonly RecordedEvent[]): Set<PrdNumber> =>
  new Set(events.flatMap(({ kind, prd }) => (kind === 'prd-merged' && prd !== null ? [prd] : [])));

/**
 * `facts`, each PRD in `landed` read as merged (PRD 2896 s6): its commit is on the default branch, so it is shipped from the
 * moment the mission pull request landed it, before its stage is synced, and never before.
 */
export const withLanded = (facts: readonly PrdFacts[], landed: ReadonlySet<PrdNumber>): PrdFacts[] =>
  facts.map((fact) => (landed.has(fact.prd) && fact.stage !== 'merged' ? { ...fact, stage: 'merged' } : fact));

/** A PRD a landing put on the default branch (PRD 2896 s6): the mission pull request that carried it, and its link. */
export type Landed = { prd: PrdNumber; pr: PrNumber; url: string };

/** The Reviewer's pass that let a PRD join (PRD 2871): its round and its review's link, from the latest Reviewer job that passed it; null when none did. */
export function passOf(runs: readonly Run[], prd: PrdNumber): { round: number; url: string | null } | null {
  let best: { round: number; run: number; url: string | null } | null = null;
  for (const one of runs) {
    const round = roundOf(one.step);
    const last = lastOf(one);
    if (one.prd !== prd || round === null || last === undefined || endOf(last) !== 'ready') continue;
    if (best === null || one.run > best.run || (one.run === best.run && round > best.round)) best = { round, run: one.run, url: reviewUrl(last.posted?.url ?? undefined) };
  }
  return best === null ? null : { round: best.round, url: best.url };
}

/**
 * The feature pull request of a PRD: the one its latest job to name one links (a Reviewer's review links it too, and QA's verdict
 * names it); null when none does. The Engineer's fix of a QA bug links its fix pull request, never the feature's (PRD 3001).
 */
export function featurePrOf(runs: readonly Run[], prd: PrdNumber): PrNumber | null {
  const ordered = runs.filter((one) => one.prd === prd && !isFixStep(one.step)).sort((a, b) => (after(a, b) ? -1 : after(b, a) ? 1 : 0));
  for (const one of ordered) {
    for (const attempt of [...one.attempts].reverse()) {
      const pr = isQaStep(one.step) ? (attempt.checked?.pr ?? null) : (prOfUrl(attempt.prUrl) ?? prOfUrl(attempt.posted?.url ?? null));
      if (pr !== null) return pr;
    }
  }
  return null;
}

// ── Pick ─────────────────────────────────────────────────────────────────────────

/** The states that hold a slot of `mandate.parallel`: a job at work, a repair of its step to send or at work (PRD 2980). */
const AT_WORK: ReadonlySet<PrdState['state']> = new Set(['running', 'repairable', 'repairing']);

/** A startable PRD as sent: its run and step, and the bug an Engineer's fix of QA's bug is for (PRD 3001). */
const sendOf = (prd: PrdNumber, { run, step, fix }: Extract<PrdState, { state: 'startable' }>): Send => (fix === undefined ? { prd, run, step } : { prd, run, step, fix });

/** The PRDs this run sends, in scope order. */
export function pick({ mission, facts, states }: { mission: Mission; facts: readonly PrdFacts[]; states: ReadonlyMap<PrdNumber, PrdState> }): Send[] {
  if (mission.status === 'draft' || mission.status === 'paused' || mission.status === 'delivered') return [];
  const running = facts.filter((fact) => AT_WORK.has(states.get(fact.prd)?.state ?? 'paused'));
  const busy = running.map((fact) => fact.territory);
  if (busy.includes(null)) return [];
  const slots = mission.parallel - running.length;
  const sends: Send[] = [];
  for (const fact of facts) {
    const state = states.get(fact.prd);
    if (sends.length >= slots) break;
    if (state?.state !== 'startable') continue;
    const send = sendOf(fact.prd, state);
    if (fact.territory === null) {
      if (busy.length > 0) continue;
      sends.push(send);
      break;
    }
    const territory = fact.territory;
    if (busy.some((other) => other !== null && sharedGround({ territory: other }, { territory }).length > 0)) continue;
    sends.push(send);
    busy.push(territory);
  }
  return sends;
}

// ── Conclude ─────────────────────────────────────────────────────────────────────

const WAITS_WORDS: Readonly<Record<Exclude<WaitsOn, 'decide' | 'decide-bugs'>, string>> = {
  approve: 'approve it',
  'approve-again': 'approve it again',
  answer: 'answer its questions',
  merge: 'merge it',
  act: 'act on its runner job',
  kit: 'update the kit',
};

/**
 * What a PRD waits on, in words: after round 2, the Reviewer's findings on its PR (PRD 2871); above `with-you`, what the merge
 * gate lacks for it to join the mission branch (PRD 2896).
 */
function waitWords(state: Extract<PrdState, { state: 'waits' }>, branch: string | null): string {
  if (state.on === 'join') return `joins ${branch ?? 'the mission branch'} once: ${state.lacks.join('; ')}`;
  if (state.on === 'decide-bugs') return decideWords(state.issues);
  // PRD 3088: `Fixed in v0.0.N: update the kit to resume (omni update)`, whole.
  if (state.on === 'kit') return state.why ?? WAITS_WORDS.kit;
  if (state.on !== 'decide') return state.why == null ? WAITS_WORDS[state.on] : `${WAITS_WORDS[state.on]} (${state.why})`;
  return `decide the Reviewer's findings on ${state.pr === null ? 'its feature PR' : `PR #${String(state.pr)}`}`;
}

/** `09:00` of an ISO time, in UTC. */
const clockOf = (iso: string): string => new Date(iso).toISOString().slice(11, 16);

/** What a running PRD waits for (PRD 2949): the provider limit's reset, or room on its target's runners. */
function limitWords(wait: Wait): string {
  if (wait.on === 'fix') return wait.words;
  return wait.on === 'limit' ? `waiting for a provider limit until ${clockOf(wait.until)} UTC${wait.guessed ? ' (guessed)' : ''}` : "waiting for room on the fleet's runners";
}

/** How a stopped mission carries on. */
const CARRY_ON = 'Take it to ready by hand and the mission carries on.';

/** `parts` joined by `glue`, as many as fit in `max` characters, an ellipsis when some were left out. */
function fitted(parts: readonly string[], glue: string, max = WORDS_MAX): string {
  let text = '';
  for (const [n, part] of parts.entries()) {
    const longer = text === '' ? part : `${text}${glue}${part}`;
    const room = n === parts.length - 1 ? max : max - 1;
    if (longer.length > room) return `${(text || part.slice(0, max - 1)).slice(0, max - 1)}…`;
    text = longer;
  }
  return text;
}

/** `text`, cut to `max` characters. */
export const cut = (text: string, max = WORDS_MAX): string => (text.length <= max ? text : `${text.slice(0, max - 1)}…`);

/** What the mission waits on, PRD by PRD, then the PRDs on its branch waiting to land (PRD 2896); null when nothing. */
function waitsOf(facts: readonly PrdFacts[], states: ReadonlyMap<PrdNumber, PrdState>, branch: string | null): string | null {
  const parts = facts.flatMap((fact) => {
    const state = states.get(fact.prd);
    if (state?.state === 'running' && state.waiting !== undefined) return [`PRD ${String(fact.prd)}: ${limitWords(state.waiting)}`];
    if (state?.state === 'repairing') return [`PRD ${String(fact.prd)}: ${repairingWords(state)}`];
    return state?.state === 'waits' ? [`PRD ${String(fact.prd)}: ${waitWords(state, branch)}`] : [];
  });
  for (const fact of facts) if (states.get(fact.prd)?.state === 'dropped') parts.push(`PRD ${String(fact.prd)}: dropped from ${branch ?? 'the mission branch'}, until a person sends it again`);
  const joined = facts.filter((fact) => states.get(fact.prd)?.state === 'joined').map((fact) => `PRD ${String(fact.prd)}`);
  if (joined.length > 0) parts.push(`on ${branch ?? 'the mission branch'}, to land: ${joined.join(', ')}`);
  return parts.length > 0 ? fitted(parts, ' · ') : null;
}

/** Why a mission stopped: each PRD that stopped or was paused, and how to carry on. */
function stoppedWhy(facts: readonly PrdFacts[], states: ReadonlyMap<PrdNumber, PrdState>): string {
  const parts = facts.flatMap((fact) => {
    const state = states.get(fact.prd);
    if (state?.state === 'stopped') return [`PRD ${String(fact.prd)} stopped: ${state.why}`];
    if (state?.state === 'paused') return [`PRD ${String(fact.prd)} was cancelled`];
    return [];
  });
  const why = parts.length > 0 ? parts.join(' · ') : 'no PRD of its scope can start';
  return cut(`${why}. ${CARRY_ON}`);
}

/** The states of a PRD that keep a mission running: a job of it at work or to send, its committee too (PRD 2896 s9). */
const MOVING: ReadonlySet<PrdState['state']> = new Set(['running', 'startable', 'approvable', 'deciding', 'answering', 'repairable', 'repairing']);

/** The mission's status, what it waits on, and when it checks again; `branch` the mission branch its PRDs join, when it has one. */
export function conclude({
  mission,
  facts,
  states,
  sent,
  now,
  branch = null,
}: {
  mission: Mission;
  facts: readonly PrdFacts[];
  states: ReadonlyMap<PrdNumber, PrdState>;
  sent: number;
  now: number;
  branch?: string | null;
}): Concluded {
  const at = new Date(now + WAKE_MS).toISOString();
  if (mission.status === 'draft' || mission.status === 'delivered') return { status: mission.status, waitingOn: mission.waitingOn, nextWakeAt: null };
  const all = [...states.values()];
  if (facts.length > 0 && all.every((state) => state.state === 'merged')) return { status: 'delivered', waitingOn: null, nextWakeAt: null };
  if (mission.status === 'paused') return { status: 'paused', waitingOn: mission.waitingOn, nextWakeAt: null };
  const waitingOn = waitsOf(facts, states, branch);
  if (sent > 0 || all.some((state) => MOVING.has(state.state))) return { status: 'running', waitingOn, nextWakeAt: at };
  if (waitingOn !== null) return { status: 'waiting', waitingOn, nextWakeAt: at };
  return { status: 'stopped', waitingOn: stoppedWhy(facts, states), nextWakeAt: null };
}

/**
 * `next` with what a person must do first for the mission branch to follow the default branch (PRD 2896 s5), before what it
 * already waits on: a mission that runs keeps running, one that waits waits, a minute on, and one that stopped stays stopped,
 * saying both. Delivered, paused, a draft, or nothing to add: as it is.
 */
export function withWaits(next: Concluded, waits: readonly string[]): Concluded {
  if (waits.length === 0 || next.status === 'delivered' || next.status === 'paused' || next.status === 'draft') return next;
  return { ...next, waitingOn: fitted([...waits, ...(next.waitingOn === null ? [] : [next.waitingOn])], ' · ') };
}

// ── The events ───────────────────────────────────────────────────────────────────

/** A job's key, when the event names one. */
const jobKey = (prefix: string, job: string | null): string[] => (job === null ? [] : [`${prefix}:${job}`]);

/** The keys each kind of event stands for: a run of the same state finds them and records nothing again. */
const KEYS: Readonly<Partial<Record<string, (prdKey: string | null, job: string | null) => string[]>>> = {
  dispatched: (_prdKey, job) => jobKey('dispatched', job),
  'job-ended': (_prdKey, job) => jobKey('end', job),
  held: (_prdKey, job) => jobKey('end', job),
  reviewed: (_prdKey, job) => jobKey('end', job),
  checked: (_prdKey, job) => jobKey('end', job),
  decided: (_prdKey, job) => jobKey('end', job),
  escalated: (_prdKey, job) => jobKey('end', job),
  'prd-ready': (prdKey, job) => [`ready:${prdKey ?? 'mission'}`, ...jobKey('end', job)],
  'prd-merged': (prdKey) => [`merged:${prdKey ?? 'mission'}`],
  stopped: (prdKey) => (prdKey === null ? [] : [`stopped:${prdKey}`]),
  delivered: () => ['delivered'],
  'repair-started': (_prdKey, job) => jobKey('repair', job),
  retro: (_prdKey, job) => jobKey('retro', job),
  'repair-ended': (_prdKey, job) => jobKey('repair-ended', job),
  'bug-reported': (_prdKey, job) => jobKey('bug', job),
  stuck: (_prdKey, job) => jobKey('stuck', job),
  'bug-taken': (_prdKey, job) => jobKey('bug-taken', job),
  'bug-asked': (_prdKey, job) => jobKey('bug-asked', job),
  'bug-fixed': (_prdKey, job) => jobKey('bug-fixed', job),
};

/** The keys an event recorded stands for; none for a kind recorded on every change (waits, Start, Pause). */
const keysOf = ({ kind, prd, job }: RecordedEvent): string[] => KEYS[kind]?.(prd === null ? null : String(prd), job) ?? [];

/** Every key the recorded events stand for. */
export const recordedKeys = (events: readonly RecordedEvent[]): Set<string> => new Set(events.flatMap(keysOf));

/** A link an event may carry: a web address of at most 500 characters, else none. */
const linkOf = (url: string | null): string | null => (url !== null && /^https?:\/\//.test(url) && url.length <= 500 ? url : null);

/** A held or stopped-mid-way PRD: sent again once, stopped the second time. */
const againWords = (n: string, what: string, run: number): string =>
  run >= LAST_RUN ? `${n} ${what} a second time${STOPS_HERE}` : `${n} ${what}: the mission sends it again, once.`;

const STOPS_HERE = ': it stops here.';
/**
 * The job of the first run of a repair's PRD sent after the run its failed job belongs to (PRD 3088): its step sent again; null when
 * none was.
 */
const sentAfterOf = (runs: readonly Run[]): SentAfter => (row) => {
  const failed = runs.find((one) => one.prd === row.prd && one.attempts.some((attempt) => attempt.id === row.failedJob));
  if (failed === undefined) return null;
  const later = runs.filter((one) => one.prd === row.prd && after(one, failed));
  return later.reduce<Run | null>((first, one) => (first === null || after(first, one) ? one : first), null)?.job ?? null;
};

/** Where the table stops a PRD and the mission repairs (PRD 2980): a repair goes first, while the mission has one left. */
const REPAIRS_HERE = ': the mission sends a repair, while it has one left.';

type EndWords = Pick<NewEvent, 'kind' | 'role' | 'sentence'>;

/** What a job's end says of its PRD (`n`), in run `run`: its event's kind, role and sentence. A Reviewer job's says it as the Reviewer. */
const END_WORDS: Readonly<Record<Exclude<JobEnd, 'review' | 'changes' | 'checked'>, (n: string, run: number, reason: string | null, branch: string | null) => EndWords>> = {
  ready: (n, _run, _reason, branch) => ({
    kind: 'prd-ready',
    role: 'engineer',
    sentence: branch === null ? `${n} is ready for review: it waits for a person to merge it.` : `${n} is ready for review: it joins ${branch} once the merge gate passes.`,
  }),
  answers: (n) => ({ kind: 'job-ended', role: 'engineer', sentence: `${n} waits on answers: the page's auto-fix carries on once a person answers.` }),
  human: (n) => ({ kind: 'job-ended', role: 'engineer', sentence: `${n}'s job needs a person: act on it on the Runners page.` }),
  held: (n, run) => ({ kind: 'held', role: 'supervisor', sentence: againWords(n, 'was held', run) }),
  stopped: (n, run) => ({ kind: 'held', role: 'supervisor', sentence: againWords(n, 'stopped mid-way', run) }),
  lost: (n) => ({ kind: 'job-ended', role: 'engineer', sentence: `${n}'s runner was lost: its resume carries the work on.` }),
  limited: (n) => ({ kind: 'job-ended', role: 'engineer', sentence: `${n} met a provider limit: its resume waits for the reset and carries the work on.` }),
  cancelled: (n) => ({ kind: 'job-ended', role: 'engineer', sentence: `${n}'s job was cancelled: the mission never sends it again.` }),
  failed: (n, _run, reason) => ({ kind: 'job-ended', role: 'engineer', sentence: reason ? `${n}'s job failed: ${reason}.` : `${n}'s job failed.` }),
};

/** `1 finding`, `2 findings`. */
const findingsWords = (count: number): string => `${String(count)} finding${count === 1 ? '' : 's'}`;

/**
 * The Reviewer's verdict in round `round` (PRD 2871), signed `reviewer`, linking its review (else its PR): `Changes
 * asked: 2 findings, round 1/2.`, without the count when its log gave none; `Passed, round 2 of 2: marked ready.`
 */
function verdictEvent(prd: PrdNumber, round: number, last: Attempt, end: 'changes' | 'ready'): NewEvent {
  const of = `${String(round)}/${String(ROUNDS)}`;
  const count = last.posted?.findings ?? null;
  const sentence =
    end === 'ready' ? `Passed, round ${String(round)} of ${String(ROUNDS)}: marked ready.` : count === null || count === 0 ? `Changes asked, round ${of}.` : `Changes asked: ${findingsWords(count)}, round ${of}.`;
  return { kind: 'reviewed', role: 'reviewer', prd, job: last.id, link: linkOf(last.posted?.url ?? last.prUrl), sentence };
}

/** What a fix shipped for review says it settled: round 1's findings, by their count when its log gave one. */
const fixedWords = (asked: number | null): string => (asked === null || asked === 0 ? 'the findings' : findingsWords(asked));

/**
 * A build or a fix shipped for review (PRD 2871), its PR left a draft for the Reviewer, in the before/after's words:
 * `Shipped; waits for review.`, then `Fixed 2 findings; shipped again.`, `asked` being round 1's count.
 */
const shippedEvent = (prd: PrdNumber, one: Run, last: Attempt, asked: number | null): NewEvent => ({
  kind: 'job-ended',
  role: 'engineer',
  prd,
  job: last.id,
  link: linkOf(last.prUrl),
  sentence: one.step === 'build' ? 'Shipped; waits for review.' : `Fixed ${fixedWords(asked)}; shipped again.`,
});

/** Any other end, in END_WORDS's words (a hand-off its step never ends on reads as stopped mid-way's), a Reviewer's or QA's job signed by it. */
function plainEndEvent(prd: PrdNumber, one: Run, last: Attempt, end: JobEnd, { branch, repairs }: { branch: string | null; repairs: boolean }): NewEvent {
  const words = END_WORDS[end === 'review' || end === 'changes' || end === 'checked' ? 'stopped' : end](`PRD ${String(prd)}`, one.run, last.reason, branch);
  const seat = roundOf(one.step) !== null ? 'reviewer' : isQaStep(one.step) ? 'qa' : null;
  const role = seat !== null && words.role === 'engineer' ? seat : words.role;
  const sentence = repairs ? words.sentence.replace(STOPS_HERE, REPAIRS_HERE) : words.sentence;
  return { prd, job: last.id, link: linkOf(last.prUrl), ...words, role, sentence };
}

/**
 * The event of a QA pair's job that ended done (PRD 3001): QA's verdict, `checked`; the Engineer's fix once it landed or was marked,
 * null while it waits. Undefined for any other end.
 */
function pairEndEvent(prd: PrdNumber, one: Run, last: Attempt, end: JobEnd, { runs, qa }: { runs: readonly Run[]; qa: QaView }): NewEvent | null | undefined {
  if (end === 'checked' && last.checked != null && isQaStep(one.step)) return checkedEvent(prd, last, last.checked);
  return isFixStep(one.step) && pairOutcome(end, one.step)?.next === 'land' ? fixEvent(prd, one.step, last, runs, qa) : undefined;
}

/** What a job's end is read against: round 1's findings before a fix, the mission branch, repairs on, and the QA pair (PRD 3001). */
type EndAt = { asked?: number | null; branch?: string | null; repairs?: boolean; runs?: readonly Run[]; qa?: QaView };

/**
 * The event of a job's end, at its step: a Reviewer's verdict is `reviewed`, QA's `checked` (PRD 3001); a build or fix shipped for
 * review waits for it. The Engineer's fix of a QA bug says so once it landed or was marked; none before.
 */
function endEvent(prd: PrdNumber, one: Run, last: Attempt, end: JobEnd, { asked = null, branch = null, repairs = false, runs = [], qa = NO_QA }: EndAt = {}): NewEvent | null {
  const pair = pairEndEvent(prd, one, last, end, { runs, qa });
  if (pair !== undefined) return pair;
  const round = roundOf(one.step);
  if (round !== null && (end === 'changes' || end === 'ready')) return verdictEvent(prd, round, last, end);
  return end === 'review' && round === null ? shippedEvent(prd, one, last, asked) : plainEndEvent(prd, one, last, end, { branch, repairs });
}

/** How many findings the Reviewer's round 1 raised before fix `one`, when its log said: the latest round 1 of its PRD up to its run. */
function askedBefore(runs: readonly Run[], one: Run): number | null {
  if (one.step !== 'fix:1') return null;
  const rounds = runs.filter((other) => other.prd === one.prd && other.step === 'review:1' && other.run <= one.run);
  const latest = rounds.reduce<Run | null>((last, other) => (last === null || other.run > last.run ? other : last), null);
  return (latest ? lastOf(latest)?.posted?.findings : null) ?? null;
}

/** What a dispatch says: the line sent, where, and its run (and round, for the Reviewer and QA; and bug, for the Engineer's fix). */
function sentWords(one: Run, where: string, { skill, base, runs, qa }: { skill: BuildSkill; base: string | null; runs: readonly Run[]; qa: QaView }): string {
  const pair = sentPairWords(one, where, runs, qa);
  if (pair !== null) return pair;
  const round = roundOf(one.step);
  return `Sent ${lineOf(one.prd, one.step, skill, base)} to ${where} (run ${String(one.run)}${round === null ? '' : `, round ${String(round)}`}).`;
}

/** What each job says: its dispatch, each runner lost along the way, and its end. */
function runEvents(runs: readonly Run[], where: string, { skill, base, repairs = false, qa = NO_QA }: { skill: BuildSkill; base: string | null; repairs?: boolean; qa?: QaView }): NewEvent[] {
  return runs.flatMap((one) => {
    const last = lastOf(one);
    const end = last ? endOf(last) : null;
    const sent: NewEvent = { kind: 'dispatched', role: 'supervisor', prd: one.prd, job: one.job, link: null, sentence: sentWords(one, where, { skill, base, runs, qa }) };
    const ending = last && end !== null ? [endEvent(one.prd, one, last, end, { asked: askedBefore(runs, one), branch: base, repairs, runs, qa })] : [];
    const gone = one.attempts.slice(0, -1).map((lost) => endEvent(one.prd, one, lost, lost.limitedUntil == null ? 'lost' : 'limited'));
    return [sent, ...gone, ...ending].filter((event): event is NewEvent => event !== null);
  });
}

/** What each PRD's state says: merged, ready by its stage, stopped. */
function prdEvents(facts: readonly PrdFacts[], states: ReadonlyMap<PrdNumber, PrdState>): NewEvent[] {
  return facts.flatMap((fact) => {
    const n = `PRD ${String(fact.prd)}`;
    const state = states.get(fact.prd);
    const said = (kind: EventKind, sentence: string): NewEvent => ({ kind, role: 'supervisor', prd: fact.prd, job: null, link: null, sentence });
    return [
      ...(fact.stage === 'merged' ? [said('prd-merged', `${n} is merged: delivered.`)] : []),
      ...(fact.stage === 'ready' ? [said('prd-ready', `${n} reads ready for review: it waits for a person to merge it.`)] : []),
      ...(state?.state === 'stopped' ? [said('stopped', `${n} stops: ${state.why}.`)] : []),
    ];
  });
}

/**
 * What each PRD that joined the mission branch in this run says (PRD 2896), once: the run that merged it is the one that
 * records it, and a later run reads it on the branch from this event. Signed `supervisor`, linking the pull request.
 */
const joinEvents = (joins: readonly Joined[], branch: string | null): NewEvent[] =>
  joins.map(({ prd, pr, url }) => ({
    kind: 'prd-joined',
    role: 'supervisor',
    prd,
    job: null,
    link: linkOf(url),
    sentence: `PRD ${String(prd)} joined ${branch ?? 'the mission branch'}: #${String(pr)} squash-merged.`,
  }));

/**
 * What each PRD a landing put on the default branch says (PRD 2896 s6), once: its `prd-merged`, linking the mission pull request
 * that carried it, recorded by the run that read the landing. Its key is the merge's, so the stage synced later records nothing again.
 */
const landEvents = (landings: readonly Landed[]): NewEvent[] =>
  landings.map(({ prd, pr, url }) => ({
    kind: 'prd-merged',
    role: 'supervisor',
    prd,
    job: null,
    link: linkOf(url),
    sentence: `PRD ${String(prd)} landed on the default branch with #${String(pr)}: shipped.`,
  }));

/**
 * What each committee says (PRD 2896 s9): its dispatch, signed `supervisor`; then, once recorded, its decision, signed `pm` (the
 * chair) and `agent`: `decided` when every member who sat answered yes, `escalated` with why when it went to a person.
 */
function committeeEvents(committees: readonly Committee[], where: string): NewEvent[] {
  return committees.flatMap((one) => {
    const n = `PRD ${String(one.prd)}`;
    const sent: NewEvent = { kind: 'dispatched', role: 'supervisor', prd: one.prd, job: one.job, link: null, sentence: `Sent ${approveLine(one.prd)} to ${where} (round ${String(one.round)}).` };
    if (one.decision === null) return [sent];
    const decided: NewEvent =
      one.decision.outcome === 'carried'
        ? { kind: 'decided', role: 'pm', prd: one.prd, job: one.job, link: null, sentence: `The committee approved ${n}: ${verdictWords(one.decision.verdicts) ?? 'every member who sat answered yes'}.` }
        : { kind: 'escalated', role: 'pm', prd: one.prd, job: one.job, link: null, sentence: `${n} goes to a person: ${one.decision.why.join('; ')}` };
    return [sent, decided];
  });
}

/** What the mission's own change says: delivered, stopped, or a new wait on a person. */
function missionEvents(mission: Mission, next: Concluded): NewEvent[] {
  const said = (kind: EventKind, sentence: string): NewEvent => ({ kind, role: 'supervisor', prd: null, job: null, link: null, sentence });
  if (next.status === 'delivered') return [said('delivered', 'Every PRD of the mission is merged: delivered.')];
  if (next.status === 'stopped') return mission.status === 'stopped' ? [] : [said('stopped', `The mission stopped: ${next.waitingOn ?? 'nothing can move'}`)];
  const waits = newWait(mission, next);
  return waits === null ? [] : [said('waits', `Waits on a person: ${waits}`)];
}

/** What the mission now waits on a person for, when it changed while it runs or waits; else null. */
function newWait(mission: Mission, next: Concluded): string | null {
  if (next.status !== 'running' && next.status !== 'waiting') return null;
  return next.waitingOn !== mission.waitingOn ? next.waitingOn : null;
}

/** Where the mission's jobs go, in words: its fleet's runners when one holds its repository, else any runner of the workspace. */
export const whereOf = (mission: Pick<Mission, 'fleet'>, toFleet: boolean): string => (toFleet ? `the ${mission.fleet} fleet's runners` : 'any runner of the workspace');

/** The events this run records, in the order they happened, none already recorded. */
export function eventsOf({
  mission,
  facts,
  states,
  runs,
  next,
  toFleet,
  skill = 'yolo',
  recorded,
  joins = [],
  landings = [],
  committees = [],
  asks = [],
  repairs = NO_REPAIRS,
  qa = NO_QA,
}: {
  mission: Mission;
  facts: readonly PrdFacts[];
  states: ReadonlyMap<PrdNumber, PrdState>;
  runs: readonly Run[];
  next: Concluded;
  toFleet: boolean;
  skill?: BuildSkill;
  recorded: ReadonlySet<string>;
  /** The PRDs this run joined to the mission branch (PRD 2896). */
  joins?: readonly Joined[];
  /** The PRDs this run read landed on the default branch by the mission pull request (PRD 2896 s6). */
  landings?: readonly Landed[];
  /** The committees the mission sent (PRD 2896 s9), each with its decision once recorded. */
  committees?: readonly Committee[];
  /** The item committees the mission sent (PRD 2896 s10), each with its decision once recorded. */
  asks?: readonly ItemCommittee[];
  /** The mission's repairs (PRD 2980): each repair sent, its retro, its end and its Omni Loop bug report. */
  repairs?: RepairView;
  /** The QA pair as the run read it (PRD 3001): each fix's feature branch and landing. */
  qa?: QaView;
}): NewEvent[] {
  const keys = new Set(recorded);
  const where = whereOf(mission, toFleet);
  const base = baseOf(mission, skill === 'ultra-yolo');
  const all = [
    ...committeeEvents(committees, where),
    ...answerEvents(asks, where),
    ...runEvents(runs, where, { skill, base, repairs: repairs.budget > 0, qa }),
    ...repairEvents(repairs, { where, mission: mission.number }, sentAfterOf(runs)),
    ...joinEvents(joins, base),
    ...landEvents(landings),
    ...prdEvents(facts, states),
    ...missionEvents(mission, next),
  ];
  return unrecorded(all, keys);
}

/** `events`, each whose keys none of `recorded` holds, in order, its sentence cut to what the database keeps; `recorded` gains their keys. */
export function unrecorded(events: readonly NewEvent[], recorded: Set<string>): NewEvent[] {
  return events.flatMap((event) => {
    const own = keysOf(event);
    if (own.some((key) => recorded.has(key))) return [];
    for (const key of own) recorded.add(key);
    return [{ ...event, sentence: cut(event.sentence) }];
  });
}
