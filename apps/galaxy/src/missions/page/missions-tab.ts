import { isProductPrdId, parseIssue, PrdNumberSchema, ProductPrdIdSchema, type IssueNumber, type PrdNumber, type ProductPrdId } from 'omni-loop/kit/lib/ids.ts';
import { COMMITTEE_ONLY_WORDS, type MissionLevel } from 'omni-loop/kit/lib/mission/brief.ts';
import { decisionsOf, trustLine, type DecisionPrd } from 'omni-loop/kit/lib/mission/overturn.ts';
import { waitsOnReview } from 'omni-loop/kit/lib/mission/send-back.ts';
import { isWaitWords, type WaitLine } from '../limit-wait';
import type { RepairLine } from '../repair';
import { NO_PRD_WORDS, waitsOnNoPrd, type MissionAction, type MissionStatus } from '../missions.contract';
import { capWords, spentWords } from '../token-words';
import { itemCardsOf, NO_RETROS, RETRO_WORDS, retroCardsOf, stuckGoingOf, stuckPausedOf, type ItemCard, type RetroCard, type RetroRead, type StuckGoing, type StuckPaused } from './retros';

// The Missions tab's rules (PRD 2842 s7, the `mission-start` screen), pure so each is tested without a
// browser: a mission's status in words, its progress (`2 of 4 merged · 1 ready`), each PRD it waits a person
// on (what to do and where), and the one button its status allows. A mission is never shown as a person's.

export const WORDS = {
  tab: 'Missions',
  start: 'Start',
  pause: 'Pause',
  resume: 'Resume',
  starting: 'Starting…',
  pausing: 'Pausing…',
  resuming: 'Resuming…',
  empty: 'No mission yet.',
  // The New mission box (PRD omni-loop-24 s6, `mission-start` 1.A to 1.D)
  newMission: 'New mission',
  boxHint: 'Back as one pull request.',
  worksAloneOnly: 'Works alone only. Ask an owner.',
  writingMission: 'Writing the mission',
  writingRoadmap: 'Writing the roadmap',
  noPrdWritten: 'No PRD written',
  why: 'Why',
  brief: 'Brief',
  notStarted: 'Not started',
  noPrd: 'No PRD sent yet',
  level: 'Level',
  changeLevel: 'Change for this mission',
  branch: 'Branch',
  upToDate: 'up to date',
  behind: 'behind the default branch',
  noneOnBranch: 'no PRD on it yet',
  pull: 'Mission pull request',
  waitingOnYou: 'Waiting on you',
  decideBugs: 'Waits for you · Decide the bugs',
  sendOn: 'Send on to the Reviewer',
  stopPrd: 'Stop this PRD',
  sendBack: 'Send back to the PM',
  addedByFleet: 'added by the fleet',
  // The token caps (PRD 3040)
  dailyCap: 'Tokens per day',
  noDailyCap: 'No daily cap',
  lastDay: 'in the last 24 hours',
  noBudget: 'No token budget',
  change: 'Change',
  save: 'Save',
  cancel: 'Cancel',
  budgetFor: 'Token budget for this mission',
  budgetReached: 'Paused: budget reached',
  raise: 'Raise the cap',
  raiseTo: 'New cap, in tokens',
  tomorrow: 'Resume tomorrow',
  stopMission: 'Stop the mission',
  stopMissions: 'Stop the missions',
} as const;

/** Whose cap, as the mission's page says it (the supervisor's own words, apps/omni-app/src/missions/budget.ts). */
const WHOSE = { mission: "this mission's budget", fleet: "this fleet's daily cap" } as const;

/** A level in the words the fleet's drawer and this tab use (PRD 2896). */
export const LEVEL_WORDS: Readonly<Record<MissionLevel, string>> = {
  'with-you': 'Reviews with you',
  'own-branch': 'Own branch',
  alone: 'Works alone',
};
const LEVELS: readonly MissionLevel[] = ['with-you', 'own-branch', 'alone'];

const STATUS_WORDS: Readonly<Record<MissionStatus, string>> = {
  draft: 'Draft',
  running: 'Running',
  waiting: 'Waiting on you',
  paused: 'Paused',
  delivered: 'Delivered',
  stopped: 'Stopped',
};

/** The one move a status allows, or null when none (a delivered or stopped mission is moved by hand). */
const ACTION: Readonly<Record<MissionStatus, MissionAction | null>> = {
  draft: 'start',
  running: 'pause',
  waiting: 'pause',
  paused: 'resume',
  delivered: null,
  stopped: null,
};

/** A mission as the repository read it. */
export interface MissionRow {
  id: string;
  repo: string;
  number: number;
  title: string;
  goal: string;
  status: MissionStatus;
  waitingOn: string | null;
  prds: readonly PrdNumber[];
  /** What it runs at: `with-you` for a mission whose brief names none. */
  level: MissionLevel;
  /** Whether its repository is a product's plan repository (PRD 2896 s14): no mission branch, no `own-branch`. */
  inPlan: boolean;
  /** Its token budget (PRD 3040), the brief's mandate `tokens`; null or absent, none. */
  tokens?: number | null;
  /** `stuck` while the supervisor holds it paused by stuck (PRD 3065); null or absent otherwise. */
  pausedBy?: 'stuck' | null;
  /** Whether its scope names no PRD and no roadmap and it runs at `alone` (PRD omni-loop-24): the PM writes its PRDs from its goal. */
  goalOnly?: boolean;
  /** The `plan` and `tech` decisions the fleet took and approved on its PM's product PRDs (PRD omni-loop-26); absent, none. */
  planDecisions?: number;
}

/** A press of Start whose mission is not pushed yet (PRD omni-loop-24): its goal as typed, `Writing the mission`. */
export interface RequestLine {
  id: string;
  goal: string;
  words: string;
}

/** The New mission box: whether this person may press Start, and why not in words (`Works alone only. Ask an owner.`). */
export interface NewMissionBox {
  canStart: boolean;
  refusal: string | null;
}

/** The box a person gets: an owner always, any member on a fleet at `alone`; the database refuses the rest again (mission_request_make()). */
export function boxOf(level: MissionLevel, owner: boolean): NewMissionBox {
  const canStart = owner || level === 'alone';
  return { canStart, refusal: canStart ? null : WORDS.worksAloneOnly };
}

/** One of its events, as far as the tab reads: which PRD reached which point, a repository's number or a product's id (`omni-loop-27`). */
export interface TabEvent {
  mission: string;
  kind: string;
  prd: DecisionPrd | null;
  link: string | null;
  /** What it says: a join names the mission branch it went onto. */
  sentence: string;
}

/** A PRD that waits for a person: what to do, and where. */
export interface Waits {
  prd: PrdNumber;
  on: string;
  href: string;
  /** A PRD on `Decide the bugs` (PRD 3001): QA's bugs still there, each linked to its issue; null for any other wait. */
  bugs: { issue: IssueNumber; href: string }[] | null;
}

/** A PM product PRD that waits on a person after its review (bug #3302): its id and what it waits on, as the supervisor wrote it. */
export interface SendBackWait {
  prd: ProductPrdId;
  on: string;
}

/** A budget stop still waiting for its answer (PRD 3040): whose cap, its value, what was spent and the missions it paused. */
export interface OpenStop {
  id: string;
  cap: 'mission' | 'fleet';
  capTokens: number;
  spent: number;
  missions: readonly string[];
}

/** What the tab reads of the token caps (PRD 3040): who the person is, the fleet's cap and spending, each mission's spending, the open stops. */
export interface BudgetRead {
  owner: boolean;
  dailyCap: number | null;
  fleetSpent: number;
  spent: ReadonlyMap<string, number>;
  stops: readonly OpenStop[];
}

export const NO_BUDGET: BudgetRead = { owner: false, dailyCap: null, fleetSpent: 0, spent: new Map(), stops: [] };

/** A mission's budget line: `412k of 2M tokens`, or `No token budget` (PRD 3040, AC-10). */
export interface BudgetLine {
  words: string;
  tokens: number | null;
  /** A draft's budget is set for this mission alone, by any member. */
  canChange: boolean;
}

/** `Paused: budget reached` and what it was: the spending and whose cap; its actions when this stop is the mission's own. */
export interface StopView {
  id: string;
  headline: string;
  detail: string;
  /** The answers the mission's own row offers: its own stop only (a fleet's cap is answered once, above the list). */
  actions: ('raised' | 'stopped')[];
  canRaise: boolean;
}

/** The fleet's daily cap (PRD 3040): `Tokens per day: No daily cap`, or `1.3M of 2M in the last 24 hours`, and the one notice a stop of it asks. */
export interface DailyView {
  words: string;
  window: string | null;
  cap: number | null;
  /** An owner of the workspace alone changes it. */
  canChange: boolean;
  notice: FleetNotice | null;
}

export interface FleetNotice {
  id: string;
  headline: string;
  detail: string;
  missions: number;
  canRaise: boolean;
}

export interface MissionView {
  id: string;
  title: string;
  goal: string;
  status: MissionStatus;
  statusWords: string;
  /** `2 of 4 merged · 1 ready`, or why there is none yet. */
  progress: string;
  waits: Waits[];
  /** The PM product PRDs that wait on a person after their review, each offered Send back to the PM (bug #3302); none below alone. */
  sendBacks: SendBackWait[];
  /** The PRDs that wait out a provider limit or for room (PRD 2949), as the room says them. */
  limitWaits: WaitLine[];
  /** The PRDs that repair, wait on an Omni Loop bug, or stopped after repairs (PRD 2980), as the room says them. */
  repairs: RepairLine[];
  /** Why a stopped mission stopped, and how to carry on. */
  stopped: string | null;
  briefHref: string;
  action: MissionAction | null;
  level: MissionLevel;
  levelWords: string;
  /** The levels a draft may be changed to: not `own-branch` in a plan repository (PRD 2896 s14). */
  levels: readonly MissionLevel[];
  /** `committee only: a person merges each target's pull request` for a plan-repository mission at `alone`; null otherwise. */
  committeeOnly: string | null;
  /** A draft's level is changed for this mission alone. */
  canChangeLevel: boolean;
  /** The Branch line (PRD 2896 s8); null for a mission at `with-you`, which has no branch. */
  branch: BranchLine | null;
  /** The trust line (PRD 2896 s11), `14 decisions by the fleet · 1 overturned`; null below `alone`. */
  trust: string | null;
  /** The PRDs the fleet's PM wrote (PRD 2896 s12), and the rows its cap left unwritten; null when it wrote none and left none. */
  fleetPrds: FleetPrds | null;
  /** The token budget line (PRD 3040). */
  budget: BudgetLine;
  /** The budget stop that paused it and waits for an answer (PRD 3040); null when none. */
  stop: StopView | null;
  /** `Stuck: 5 jobs, nothing moved` while a stuck repair works (PRD 3065); null otherwise. */
  stuck: StuckGoing | null;
  /** The question of a mission paused by stuck, asked once, with Resume and Stop the mission (PRD 3065); null otherwise. */
  stuckPaused: StuckPaused | null;
  /** One card per milestone retro (PRD 3065). */
  retros: RetroCard[];
  /** One card per question of the mission's own outbox (PRD 3065). */
  questions: ItemCard[];
  /** `No PRD written` with the PM's reason, once a goal-only mission's PM wrote none twice (PRD omni-loop-24); null otherwise. */
  noPrd: { why: string } | null;
}

/** What the fleet's PM added to the mission (PRD 2896 s12): `PRD 50, PRD 51 added by the fleet`, then each row the cap left. */
export interface FleetPrds {
  added: DecisionPrd[];
  /** `PRD 50, PRD 51 added by the fleet`; null when it added none. */
  words: string | null;
  /** Each row of its roadmap the cap left, as the supervisor wrote it: `Refunds by card: not written: the cap is 2.` */
  notWritten: string[];
}

/** The mission branch as the Missions tab says it: the PRDs on it, whether it follows the default branch, the mission pull request. */
export interface BranchLine {
  /** The PRDs on the branch, in the order they joined. */
  prds: DecisionPrd[];
  upToDate: boolean;
  /** Why the branch waits on a person (it cannot follow the default branch, or it is red), as the supervisor wrote it. */
  hold: string | null;
  /** The mission pull request: the open pull requests from the branch, null while no join named the branch. */
  pullHref: string | null;
  words: string;
}

/** The tab's view: the workspace the moves are made in (null in the demo) and the fleet's missions, newest first. */
export interface MissionsView {
  workspace: string | null;
  fleet: string;
  missions: MissionView[];
  /** The fleet's daily token cap (PRD 3040); absent in the demo, which has none. */
  daily?: DailyView;
  /** The New mission box (PRD omni-loop-24); absent in the demo, which starts no mission. */
  box?: NewMissionBox;
  /** The requests whose mission is not pushed yet, newest first (PRD omni-loop-24). */
  requests?: readonly RequestLine[];
}

const issueHref = (repo: string, number: number) => `https://github.com/${repo}/issues/${String(number)}`;

/** `2 of 4 merged · 1 ready`: the PRDs of the scope and those the mission has met, merged and ready counted once each. */
export function progressOf(status: MissionStatus, prds: readonly PrdNumber[], events: readonly TabEvent[], level: MissionLevel = 'with-you', goalOnly = false): string {
  if (status === 'draft') return WORDS.notStarted;
  const merged = new Set(events.filter((e) => e.kind === 'prd-merged' && e.prd !== null).map((e) => e.prd));
  const ready = new Set(events.filter((e) => e.kind === 'prd-ready' && e.prd !== null && !merged.has(e.prd)).map((e) => e.prd));
  const known = new Set<DecisionPrd>(prds);
  for (const event of events) if (event.prd !== null) known.add(event.prd);
  if (known.size === 0) return goalOnly && status === 'running' ? WORDS.writingRoadmap : WORDS.noPrd;
  // Above `with-you` a PRD is `joined` on the branch before it is `on main` (PRD 2896 s8).
  if (level !== 'with-you') return `${String(merged.size)} of ${String(known.size)} on main · ${String(onBranchOf(events).length)} joined`;
  return `${String(merged.size)} of ${String(known.size)} merged · ${String(ready.size)} ready`;
}

/** The PRDs on the mission branch, in join order: joined, until dropped or on main. `events` are newest first. */
export function onBranchOf(events: readonly TabEvent[]): DecisionPrd[] {
  const on: DecisionPrd[] = [];
  for (const event of events.toReversed()) {
    if (event.prd === null) continue;
    if (event.kind === 'prd-joined' && !on.includes(event.prd)) on.push(event.prd);
    else if (event.kind === 'prd-dropped' || event.kind === 'prd-merged') {
      const at = on.indexOf(event.prd);
      if (at >= 0) on.splice(at, 1);
    }
  }
  return on;
}

const JOINED = /^PRD \d+ joined (\S+):/;
const HOLD = /cannot follow|must follow|is red \(/;

/** The Branch line: the PRDs on the branch, up to date or not, and the pull requests from it; the branch's name is read from the join that named it. */
export function branchOf(row: Pick<MissionRow, 'repo' | 'waitingOn' | 'status'>, events: readonly TabEvent[]): BranchLine {
  const prds = onBranchOf(events);
  const named = events.map((event) => (event.kind === 'prd-joined' ? JOINED.exec(event.sentence)?.[1] : undefined)).find((name) => name !== undefined);
  const waiting = row.status === 'running' || row.status === 'waiting';
  const hold = waiting && row.waitingOn !== null && HOLD.test(row.waitingOn) ? row.waitingOn : null;
  const upToDate = hold === null || !/follow/.test(hold);
  const pullHref = named === undefined ? null : `https://github.com/${row.repo}/pulls?q=${encodeURIComponent(`is:pr head:${named}`)}`;
  const on = prds.length === 0 ? WORDS.noneOnBranch : prds.map((prd) => `PRD ${String(prd)}`).join(', ');
  return { prds, upToDate, hold, pullHref, words: `${on} · ${upToDate ? WORDS.upToDate : WORDS.behind}` };
}

const WAIT = /PRD (\d+): ([^·]+)/g;
const DECIDE_BUGS = /^decide bugs? ((?:#\d+ ?)+)$/;

/** The bugs a wait's words name (`decide bugs #13 #14`), each with its issue's address; null when the wait is another. */
function bugsOfWait(on: string, repo: string): Waits['bugs'] {
  const named = DECIDE_BUGS.exec(on)?.[1];
  return named === undefined ? null : [...named.matchAll(/#(\d+)/g)].map((one) => ({ issue: parseIssue(Number(one[1])), href: issueHref(repo, Number(one[1])) }));
}

/** The PRDs a mission waits a person on, read from what the supervisor wrote (`PRD 2803: approve it · PRD 2804: merge it`), each linked to its latest event's link, else to its issue. */
export function waitsOf(waitingOn: string | null, repo: string, events: readonly TabEvent[]): Waits[] {
  if (waitingOn === null) return [];
  return [...waitingOn.matchAll(WAIT)].flatMap((match) => {
    const prd = PrdNumberSchema.safeParse(Number(match[1]));
    const on = (match[2] ?? '').trim();
    if (!prd.success || on === '') return [];
    const linked = events.find((e) => e.prd === prd.data && e.link !== null)?.link ?? null;
    return [{ prd: prd.data, on, href: linked ?? issueHref(repo, prd.data), bugs: bugsOfWait(on, repo) }];
  });
}

const PRODUCT_WAIT = /PRD ([a-z][a-z0-9]*(?:-[a-z][a-z0-9]*)*-[1-9][0-9]*): ([^·]+)/g;

/**
 * The PM product PRDs a mission at `alone` waits a person on after their review (bug #3302), read from what the supervisor wrote, each
 * with what it waits on: a person may send each back to the PM. None for a mission below `alone`, or one that neither runs nor waits.
 */
function sendBacksOf(row: Pick<MissionRow, 'waitingOn' | 'level' | 'status'>): SendBackWait[] {
  if (row.level !== 'alone' || (row.status !== 'running' && row.status !== 'waiting') || row.waitingOn === null) return [];
  return [...row.waitingOn.matchAll(PRODUCT_WAIT)].flatMap((match) => {
    const prd = ProductPrdIdSchema.safeParse(match[1]);
    return prd.success && waitsOnReview(match[0], prd.data) ? [{ prd: prd.data, on: (match[2] ?? '').trim() }] : [];
  });
}

/** What the fleet's PM added and left unwritten (PRD 2896 s12), oldest first; null when neither. `events` are newest first. */
export function fleetPrdsOf(events: readonly TabEvent[]): FleetPrds | null {
  const oldest = events.toReversed();
  const added: DecisionPrd[] = [];
  for (const event of oldest) if (event.kind === 'prd-added' && event.prd !== null && !added.includes(event.prd)) added.push(event.prd);
  const notWritten = oldest.filter((event) => event.kind === 'not-written').map((event) => event.sentence);
  if (added.length === 0 && notWritten.length === 0) return null;
  const words = added.length === 0 ? null : `${added.map((prd) => `PRD ${String(prd)}`).join(', ')} ${WORDS.addedByFleet}`;
  return { added, words, notWritten };
}

/** The budget line of a mission that spent `spent` (PRD 3040). */
function budgetOf(row: Pick<MissionRow, 'status' | 'tokens'>, spent: number): BudgetLine {
  const tokens = row.tokens ?? null;
  return { tokens, canChange: row.status === 'draft', words: tokens === null ? WORDS.noBudget : `${spentWords(spent)} of ${capWords(tokens)} tokens` };
}

/** What a stop says: `2.0M of 2M tokens · this mission's budget`, the fleet's adding its window. */
const stopDetail = (stop: OpenStop): string => `${spentWords(stop.spent)} of ${capWords(stop.capTokens)} tokens${stop.cap === 'fleet' ? ` ${WORDS.lastDay}` : ''} · ${WHOSE[stop.cap]}`;

/** The stop that paused a mission, as its row says it; a fleet's carries no action there (PRD 3040). */
function stopOf(missionId: string, read: BudgetRead): StopView | null {
  const stop = read.stops.find((one) => one.missions.includes(missionId));
  if (stop === undefined) return null;
  return { id: stop.id, headline: WORDS.budgetReached, detail: stopDetail(stop), actions: stop.cap === 'mission' ? ['raised', 'stopped'] : [], canRaise: read.owner };
}

/** The fleet's daily cap line, and the one notice a stop of it asks, above the list (PRD 3040). */
export function dailyOf(read: BudgetRead): DailyView {
  const stop = read.stops.find((one) => one.cap === 'fleet');
  const notice = stop === undefined ? null : {
    id: stop.id,
    headline: `Paused: ${WHOSE.fleet} reached (${capWords(stop.capTokens)})`,
    detail: stopDetail(stop),
    missions: stop.missions.length,
    canRaise: read.owner,
  };
  return {
    words: read.dailyCap === null ? WORDS.noDailyCap : `${spentWords(read.fleetSpent)} of ${capWords(read.dailyCap)}`,
    window: read.dailyCap === null ? null : WORDS.lastDay,
    cap: read.dailyCap,
    canChange: read.owner,
    notice,
  };
}

/**
 * A mission's status in words, the one move it allows and the budget stop that paused it. A mission paused by stuck asks one question,
 * with its own Resume and Stop (PRD 3065). A goal-only mission whose PM wrote no PRD offers Resume, which sends the PM once more (#3203).
 */
function statusParts(row: MissionRow, budget: BudgetRead): Pick<MissionView, 'statusWords' | 'action' | 'stop'> {
  if (row.status === 'paused' && row.pausedBy === 'stuck') return { statusWords: RETRO_WORDS.pausedStuck, action: null, stop: null };
  if (noPrdOf(row) !== null) return { statusWords: STATUS_WORDS[row.status], action: 'resume', stop: null };
  // A stopped mission with repairs has its Resume in the Stopped block (PRD 2980), not here.
  return { statusWords: STATUS_WORDS[row.status], action: ACTION[row.status], stop: row.status === 'paused' ? stopOf(row.id, budget) : null };
}

/** What the tab adds of PRD 3065 to a mission: its stuck line, the question a stuck pause asks, its retros and its questions. */
function retroParts(row: MissionRow, retro: RetroRead): Pick<MissionView, 'stuck' | 'stuckPaused' | 'retros' | 'questions'> {
  return {
    stuck: stuckGoingOf(row, retro.repairs),
    stuckPaused: stuckPausedOf({ id: row.id, status: row.status, pausedBy: row.pausedBy ?? null }, retro.repairs),
    retros: retroCardsOf(row, retro.retros),
    questions: itemCardsOf(row.id, retro.items),
  };
}

/** The PM's reason a goal-only mission waits with no PRD, when its waiting line is the supervisor's `the PM wrote no PRD for the goal: <why>`. */
function noPrdOf(row: MissionRow): MissionView['noPrd'] {
  if (row.goalOnly !== true || row.waitingOn === null || !waitsOnNoPrd(row)) return null;
  return { why: row.waitingOn.slice(row.waitingOn.indexOf(NO_PRD_WORDS)) };
}

/** A repository PRD's number, or null for a product PRD's id: the committee's decisions name a number. */
const numbered = (prd: DecisionPrd | null): PrdNumber | null => (prd === null || isProductPrdId(prd) ? null : prd);

/**
 * The trust line: the committee's decisions read from the events, then the `plan` and `tech` decisions the fleet approved on its
 * PM's product PRDs (PRD omni-loop-26), which no person overturns there.
 */
const trustOf = (events: readonly TabEvent[], plans: number): string =>
  trustLine(decisionsOf(events.toReversed().map((event) => ({ ...event, prd: numbered(event.prd) }))), plans);

/** One mission as the tab shows it; `events` are its own, newest first. */
export function missionOf(row: MissionRow, events: readonly TabEvent[], limitWaits: readonly WaitLine[] = [], repairs: readonly RepairLine[] = [], budget: BudgetRead = NO_BUDGET, retro: RetroRead = NO_RETROS): MissionView {
  const own = repairs.filter((line) => line.mission === row.id);
  const waiting = row.status === 'waiting' || row.status === 'running';
  return {
    id: row.id,
    title: row.title,
    goal: row.goal,
    status: row.status,
    progress: noPrdOf(row) === null ? progressOf(row.status, row.prds, events, row.level, row.goalOnly === true) : WORDS.noPrdWritten,
    noPrd: noPrdOf(row),
    waits: waiting ? waitsOf(row.waitingOn, row.repo, events).filter((wait) => !isWaitWords(wait.on)) : [],
    sendBacks: sendBacksOf(row),
    limitWaits: waiting ? limitWaits.filter((wait) => wait.mission === row.id) : [],
    repairs: own,
    stopped: row.status === 'stopped' && !own.some((line) => line.kind === 'stopped') ? row.waitingOn : null,
    briefHref: issueHref(row.repo, row.number),
    level: row.level,
    levelWords: LEVEL_WORDS[row.level],
    levels: row.inPlan ? LEVELS.filter((each) => each !== 'own-branch') : LEVELS,
    committeeOnly: row.inPlan && row.level === 'alone' ? COMMITTEE_ONLY_WORDS : null,
    canChangeLevel: row.status === 'draft',
    branch: row.level === 'with-you' || row.status === 'draft' ? null : branchOf(row, events),
    trust: row.level === 'alone' && row.status !== 'draft' ? trustOf(events, row.planDecisions ?? 0) : null,
    fleetPrds: fleetPrdsOf(events),
    budget: budgetOf(row, budget.spent.get(row.id) ?? 0),
    ...statusParts(row, budget),
    ...retroParts(row, retro),
  };
}

/** The button's words for an action, and while it is being done. */
export const ACTION_WORDS: Readonly<Record<MissionAction, { idle: string; busy: string }>> = {
  start: { idle: WORDS.start, busy: WORDS.starting },
  pause: { idle: WORDS.pause, busy: WORDS.pausing },
  resume: { idle: WORDS.resume, busy: WORDS.resuming },
};
