// The PM's own PRDs in a mission's run (PRD 2896 s12, spec "7. The PM's own PRDs, at `alone`"): pure functions over what one run
// read. No database, no model call: ./job.ts reads, calls these, then writes.
//
//   who it runs for   a mission at `alone` whose `mandate.ownPrds` is above 0 and whose fleet added fewer PRDs than that: the
//                     mission sends its PM one job for its goal, under `mission:<id>:pm:1`, once. `/omni:brainstorm` when one PRD
//                     is left under the cap, `/omni:roadmap` for several, their mega forms in a plan repository, each naming the
//                     mission and the cap (kit/lib/virtual-fleet/pm.ts). At 0, or below `alone`, no PM job is ever sent
//   what it adds      the job's record line, read from its log once it ended: at most the cap it was sent with, never a PRD the
//                     mission already holds, each a `prd-added` event (`added by the fleet`), and each row it left unwritten a
//                     `not-written` event (`not written: the cap is <k>`). A job that failed or left no record adds nothing
//   after             a PRD added joins the mission's scope, read from those events, and goes to the committee like any other at
//                     `alone`, but with the PM sitting out: the Architect and the Reviewer approve it (`--author pm`)
//   the events        the dispatch, signed `supervisor`; what it added, signed `pm`; all by `agent`, never in a person's name
//   goal-only         a mission whose scope names no PRD and no roadmap (PRD omni-loop-24) is sent the roadmap first, at any cap.
//                     A job of it that ended with no PRD is sent once more under the next round, within `mandate.resumes`; then
//                     the mission waits on a person with `the PM wrote no PRD for the goal: <why>`, never stopped or delivered.
//                     A person's Resume of it then (#3203) sends the same roadmap once more, one round each; with none again, it
//                     waits again with its reason
//   on a product     a repository whose phase 0 is on the server and that belongs to a product (PRD omni-loop-26): the PM's line ends
//                    with `--product <key>`, its record names product ids, each added as a product PRD of the mission, planned,
//                    approved and reviewed (./tech.ts) before its build. Such a repository that belongs to no product sends no PM
//                    job: the mission waits with `this repository has no product: a goal-only mission needs one`
import { isPmSkill, keptIdsOf, keptOf, notWrittenWords, planOfLine, pmJobLine, pmRecordOf, pmSkillFor, type PmSkill } from 'omni-loop/kit/lib/virtual-fleet/pm.ts';
import type { PrdNumber, ProductPrdId } from 'omni-loop/kit/lib/ids.ts';
import { sendsCommittees } from './committee.ts';
import { resumeCap } from './resume.ts';
import type { MissionPrd } from './store.prd.ts';
import type { MissionRecord } from './store.ts';
import { cut, type Attempt, type Concluded, type Mission, type NewEvent, type RecordedEvent } from './supervisor.ts';

/** The PM job for the mission's own PRDs: its round in the key. A plan job takes a later one (./pm.plan.ts). */
export const PM_ROUND = 1;

/** A PM job the mission sent: its round, its job, its line and the job's attempt. */
export type PmJob = { round: number; job: string; line: string; attempt: Attempt };

const KEY = /^mission:([0-9a-f-]{36}):pm:([1-9][0-9]*)$/;

/** The key of the k-th PM job of mission `mission`: never sent twice. */
export const pmKey = (mission: string, round: number): string => `mission:${mission}:pm:${String(round)}`;

/** The round a PM job's key names; null for any other key. */
export function pmRoundOfKey(key: string): number | null {
  const match = KEY.exec(key);
  return match ? Number(match[2]) : null;
}

/** The PRDs the mission's fleet added, in the order they were added: its `prd-added` events, once each. */
export function addedOf(recorded: readonly RecordedEvent[]): PrdNumber[] {
  const added: PrdNumber[] = [];
  for (const event of recorded) if (event.kind === 'prd-added' && event.prd !== null && !added.includes(event.prd)) added.push(event.prd);
  return added;
}

/** What the mission's PM is sent this run, or nothing. */
export type PmNext = { next: 'none' } | { next: 'send'; round: number; skill: PmSkill; cap: number; line: string };

/**
 * What a run reads to decide on the PM's job: the mission (its scope, its resumes, its kind), its cap, the PRDs its fleet added, its
 * PM jobs, and whether its repository is a plan repository.
 */
export type PmView = {
  mission: Pick<MissionRecord, 'level' | 'status' | 'number' | 'scope' | 'resumes' | 'kind' | 'products'>;
  ownPrds: number;
  added: number;
  jobs: readonly PmJob[];
  inPlan: boolean;
  /** The rounds a person asked for by resuming the mission once its PM's jobs were spent ({@link pmAsks}, #3203); none when absent. */
  asks?: number;
  /** Where the mission's repository approves its phase 0, and the product it belongs to (PRD omni-loop-26); absent, `pr` and none. */
  home?: Home;
};

/** Where a repository approves its phase 0 (`pr`, `server`), and the key of the one product it belongs to, null when none. */
export type Home = { phase0: 'pr' | 'server'; product: string | null };

/** What a mission waits on when its repository is on `phase 0: server` and belongs to no product (PRD omni-loop-26). */
const NO_PRODUCT_WORDS = 'this repository has no product: a goal-only mission needs one';

/** Whether the PM writes on a product: its repository on `phase 0: server`, with the product's key, null when it belongs to none. */
const serverOf = (home: Home | undefined): { product: string | null } | null => (home?.phase0 === 'server' ? { product: home.product } : null);

const NONE: PmNext = { next: 'none' };

/**
 * Whether a mission is goal-only (PRD omni-loop-24): a mission of PRDs whose scope names no PRD and no roadmap, a product's neither.
 * Its scope as a run reads it holds the PRDs its fleet added, so a goal-only mission whose PM wrote one reads goal-only no more.
 */
export function goalOnly({ scope, products, kind }: Pick<PmView['mission'], 'scope' | 'products' | 'kind'>): boolean {
  const named = scope.prds.length + scope.roadmaps.length + (products?.prds.length ?? 0) + (products?.roadmaps.length ?? 0);
  return kind !== 'omni-bugs' && named === 0;
}

/** How many own jobs a goal-only mission's PM is sent: the first, and once more within `mandate.resumes` (none at 0). */
const triesOf = (mission: PmView['mission']): number => 1 + Math.min(1, resumeCap(mission) ?? 0);

/** The own jobs a goal-only mission's PM is sent in all: its tries, and one more for each round a person asked for (#3203). */
const allowedOf = (mission: PmView['mission'], asks: number | undefined): number => triesOf(mission) + (asks ?? 0);

/**
 * The rounds a person asked of a goal-only mission's PM (#3203): each Resume of the mission (a `resumed` event of no PRD) recorded once
 * every own PM job sent so far had ended and they were spent, so the mission waited on `the PM wrote no PRD for the goal`. A Resume
 * while a job works, or before the tries are spent, asks nothing. `recorded` in the order the events were recorded.
 */
export function pmAsks(mission: PmView['mission'], recorded: readonly RecordedEvent[], jobs: readonly PmJob[]): number {
  const own = new Set(ownOf(jobs).map((one) => one.job));
  const sent = new Set<string>();
  const ended = new Set<string>();
  let asks = 0;
  for (const { kind, prd, job } of recorded) {
    if (job !== null && own.has(job)) (kind === 'dispatched' ? sent : ended).add(job);
    else if (kind === 'resumed' && prd === null && sent.size > 0 && [...sent].every((one) => ended.has(one)) && ended.size >= triesOf(mission) + asks) asks += 1;
  }
  return asks;
}

/** The mission's own PM jobs: every PM job but a plan or a replan. */
const ownOf = (jobs: readonly PmJob[]): PmJob[] => jobs.filter(isOwnJob);

/** Whether a PM job is the one for the mission's own PRDs: any PM job but a plan or a replan of a PRD (PRD omni-loop-21 s9). */
export const isOwnJob = ({ line }: Pick<PmJob, 'line'>): boolean => planOfLine(line) === null;

/**
 * Whether the mission sends its PM a job: at `alone`, under its cap, while it runs or waits, and once (a plan job counts none). A
 * goal-only mission's is the roadmap at any cap, sent once more under the next round when the last ended with no PRD (PRD
 * omni-loop-24).
 */
export function pmNext(view: PmView): PmNext {
  const next = pmWanted(view);
  const server = serverOf(view.home);
  if (next.next !== 'send' || server === null) return next;
  if (server.product === null) return NONE;
  return { ...next, line: pmJobLine(next.skill, view.mission.number, next.cap, server.product) };
}

/** Whether a goal-only mission whose PM's own jobs wrote no PRD sends it once more: within its tries, none at work (PRD omni-loop-24). */
const sendsAgain = ({ mission, added, asks }: { mission: PmView['mission']; added: number; asks: number | undefined }, own: readonly PmJob[], goal: boolean): boolean =>
  goal && added === 0 && own.length < allowedOf(mission, asks) && !own.some(pmWorking);

/** The PM job the mission would send, wherever its repository approves its phase 0. */
function pmWanted({ mission, ownPrds, added, jobs, inPlan, asks }: PmView): PmNext {
  if (mission.level !== 'alone' || !sendsCommittees(mission.status)) return NONE;
  const own = ownOf(jobs);
  const goal = goalOnly(mission);
  if (own.length > 0 && !sendsAgain({ mission, added, asks }, own, goal)) return NONE;
  const left = ownPrds - added;
  const skill = pmSkillFor(left, inPlan, goal);
  if (skill === null) return NONE;
  const round = own.length === 0 ? PM_ROUND : Math.max(PM_ROUND, ...jobs.map((one) => one.round)) + 1;
  return { next: 'send', round, skill, cap: left, line: pmJobLine(skill, mission.number, left) };
}

/** What the mission waits on once its PM wrote no PRD for its goal (PRD omni-loop-24). */
const NO_PRD_WORDS = 'the PM wrote no PRD for the goal';

/** `once`, `twice`, `3 times`. */
const timesWords = (count: number): string => (count === 1 ? 'once' : count === 2 ? 'twice' : `${String(count)} times`);

/** How a PM job that added nothing ended. */
const endWords = ({ status, reason }: Pick<Attempt, 'status' | 'reason'>): string => {
  if (status === 'cancelled') return 'was cancelled';
  if (status !== 'done') return reason === null || reason === '' ? 'failed' : `failed (${reason})`;
  return 'ended with no PRD in its record';
};

/**
 * What a goal-only mission waits on once its PM's jobs are spent and none wrote a PRD: `the PM wrote no PRD for the goal: <why>`,
 * its last job's end; null while a job works or is still to send, once its fleet added a PRD, or for any other mission.
 */
export function pmWait(view: PmView): string | null {
  const { mission, added, jobs, asks } = view;
  if (mission.level !== 'alone' || added > 0 || !goalOnly(mission)) return null;
  if (serverOf(view.home)?.product === null && pmWanted(view).next === 'send') return NO_PRODUCT_WORDS;
  const own = ownOf(jobs);
  const last = own.reduce<PmJob | undefined>((latest, one) => (latest === undefined || one.round > latest.round ? one : latest), undefined);
  if (last === undefined || own.some(pmWorking) || own.length < allowedOf(mission, asks)) return null;
  return cut(`${NO_PRD_WORDS}: ${skillWords(last.line)} ${endWords(last.attempt)}, sent ${timesWords(own.length)}.`);
}

/** Whether a job is still to end: queued, claimed or running. */
export const pmWorking = ({ attempt }: Pick<PmJob, 'attempt'>): boolean => attempt.status === 'queued' || attempt.status === 'claimed' || attempt.status === 'running';

/** The cap a PM job's line was sent with; 0 for a line that names none. */
const capOf = (line: string): number => Number(/ --cap ([1-9][0-9]*)/.exec(line)?.[1] ?? 0);

/** The skill a PM job's line names, `the PM's job` for one that names none. */
const skillWords = (line: string): string => {
  const skill = /^\/omni:([a-z-]+)/.exec(line)?.[1] ?? '';
  return isPmSkill(skill) ? `/omni:${skill}` : 'the PM\'s job';
};

/** An event a PM job's end records: its PRD a repository's number or, on a product, its id (PRD omni-loop-26). */
export type PmEvent = Omit<NewEvent, 'prd'> & { prd: MissionPrd | null };

/**
 * The events a PM job that ended records, once (none when it is still at work, or any event already names it): each PRD its record
 * adds, at most the cap it was sent with and never one the mission holds, then each row it left unwritten. `held` the mission's
 * PRDs, its scope and what its fleet added.
 */
export function pmEvents(mission: Pick<Mission, 'number'>, one: PmJob, log: string | null, held: ReadonlySet<MissionPrd>, recorded: readonly RecordedEvent[]): PmEvent[] {
  if (pmWorking(one) || recorded.some((event) => event.job === one.job && event.kind !== 'dispatched')) return [];
  const record = one.attempt.status === 'done' && log !== null ? pmRecordOf(log, mission.number) : null;
  const cap = capOf(one.line);
  if (record === null) {
    const why = one.attempt.status === 'done' ? 'ended with no record' : one.attempt.status === 'cancelled' ? 'was cancelled' : 'failed';
    return [{ kind: 'job-ended', role: 'pm', prd: null, job: one.job, link: null, sentence: `${skillWords(one.line)} ${why}: the fleet added no PRD.` }];
  }
  const numbers = keptOf(record, cap, new Set([...held].filter((prd): prd is PrdNumber => typeof prd === 'number')));
  const ids = keptIdsOf(record, cap, new Set([...held].filter((prd): prd is ProductPrdId => typeof prd === 'string')));
  const added: MissionPrd[] = [...numbers.added, ...ids.added];
  const unwritten = [...new Set([...numbers.unwritten, ...ids.unwritten])];
  const events: PmEvent[] = added.map((prd) => ({ kind: 'prd-added', role: 'pm', prd, job: one.job, link: null, sentence: `PRD ${String(prd)} added by the fleet.` }));
  for (const title of unwritten) events.push({ kind: 'not-written', role: 'pm', prd: null, job: one.job, link: null, sentence: `${title}: ${notWrittenWords(cap)}.`.slice(0, 300) });
  if (events.length === 0) events.push({ kind: 'job-ended', role: 'pm', prd: null, job: one.job, link: null, sentence: `${skillWords(one.line)} wrote no PRD: the fleet added none.` });
  return events;
}

/** The dispatch of a PM job, signed `supervisor`: a goal-only mission's second says it is sent once more (PRD omni-loop-24). */
export const pmDispatched = (job: string, next: Extract<PmNext, { next: 'send' }>): NewEvent => ({
  kind: 'dispatched', role: 'supervisor', prd: null, job, link: null,
  sentence: next.round === PM_ROUND
    ? `Sent the PM /omni:${next.skill} for the mission's goal: ${String(next.cap)} PRD${next.cap === 1 ? '' : 's'} at most.`
    : `Sent the PM /omni:${next.skill} once more for the mission's goal: its last job wrote no PRD.`,
});

/** The PRDs of `scope` with those the fleet added after them, once each. */
export function withAdded(scope: readonly PrdNumber[], added: readonly PrdNumber[]): PrdNumber[] {
  return [...scope, ...added.filter((prd) => !scope.includes(prd))];
}

/**
 * A run's conclusion while its PM writes: a mission is never delivered or stopped while its PM's job is at work; it runs. Once a
 * goal-only mission's PM wrote no PRD (`wait`, {@link pmWait}), it waits on a person with that line first, never delivered or stopped.
 */
export function withPm(next: Concluded, writing: boolean, wakeAt: string, wait: string | null = null): Concluded {
  if (next.status === 'paused' || next.status === 'draft') return next;
  if (writing) return next.status === 'running' ? next : { status: 'running', waitingOn: next.status === 'waiting' ? next.waitingOn : null, nextWakeAt: wakeAt };
  if (wait === null) return next;
  const also = next.status === 'waiting' || next.status === 'running' ? next.waitingOn : null;
  const waitingOn = also === null ? wait : cut(`${wait} · ${also}`);
  return next.status === 'running' ? { ...next, waitingOn } : { status: 'waiting', waitingOn, nextWakeAt: wakeAt };
}

