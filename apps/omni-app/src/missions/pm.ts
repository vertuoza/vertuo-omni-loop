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
import { isPmSkill, keptOf, notWrittenWords, planOfLine, pmJobLine, pmRecordOf, pmSkillFor, type PmSkill } from 'omni-loop/kit/lib/virtual-fleet/pm.ts';
import type { PrdNumber } from 'omni-loop/kit/lib/ids.ts';
import { sendsCommittees } from './committee.ts';
import type { Attempt, Concluded, Mission, NewEvent, RecordedEvent } from './supervisor.ts';

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

/** What a run reads to decide on the PM's job: the mission, its cap, the PRDs its fleet added, its PM jobs, and whether its repository is a plan repository. */
export type PmView = { mission: Pick<Mission, 'level' | 'status' | 'number'>; ownPrds: number; added: number; jobs: readonly PmJob[]; inPlan: boolean };

/** Whether a PM job is the one for the mission's own PRDs: any PM job but a plan or a replan of a PRD (PRD omni-loop-21 s9). */
export const isOwnJob = ({ line }: Pick<PmJob, 'line'>): boolean => planOfLine(line) === null;

/** Whether the mission sends its PM a job: at `alone`, under its cap, while it runs or waits, and once (a plan job counts none). */
export function pmNext({ mission, ownPrds, added, jobs, inPlan }: PmView): PmNext {
  if (mission.level !== 'alone' || !sendsCommittees(mission.status) || jobs.some(isOwnJob)) return { next: 'none' };
  const left = ownPrds - added;
  const skill = pmSkillFor(left, inPlan);
  if (skill === null) return { next: 'none' };
  return { next: 'send', round: PM_ROUND, skill, cap: left, line: pmJobLine(skill, mission.number, left) };
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

/**
 * The events a PM job that ended records, once (none when it is still at work, or any event already names it): each PRD its record
 * adds, at most the cap it was sent with and never one the mission holds, then each row it left unwritten. `held` the mission's
 * PRDs, its scope and what its fleet added.
 */
export function pmEvents(mission: Pick<Mission, 'number'>, one: PmJob, log: string | null, held: ReadonlySet<PrdNumber>, recorded: readonly RecordedEvent[]): NewEvent[] {
  if (pmWorking(one) || recorded.some((event) => event.job === one.job && event.kind !== 'dispatched')) return [];
  const record = one.attempt.status === 'done' && log !== null ? pmRecordOf(log, mission.number) : null;
  const cap = capOf(one.line);
  if (record === null) {
    const why = one.attempt.status === 'done' ? 'ended with no record' : one.attempt.status === 'cancelled' ? 'was cancelled' : 'failed';
    return [{ kind: 'job-ended', role: 'pm', prd: null, job: one.job, link: null, sentence: `${skillWords(one.line)} ${why}: the fleet added no PRD.` }];
  }
  const { added, unwritten } = keptOf(record, cap, held);
  const events: NewEvent[] = added.map((prd) => ({ kind: 'prd-added', role: 'pm', prd, job: one.job, link: null, sentence: `PRD ${String(prd)} added by the fleet.` }));
  for (const title of unwritten) events.push({ kind: 'not-written', role: 'pm', prd: null, job: one.job, link: null, sentence: `${title}: ${notWrittenWords(cap)}.`.slice(0, 300) });
  if (events.length === 0) events.push({ kind: 'job-ended', role: 'pm', prd: null, job: one.job, link: null, sentence: `${skillWords(one.line)} wrote no PRD: the fleet added none.` });
  return events;
}

/** The dispatch of a PM job, signed `supervisor`. */
export const pmDispatched = (job: string, next: Extract<PmNext, { next: 'send' }>): NewEvent => ({
  kind: 'dispatched', role: 'supervisor', prd: null, job, link: null,
  sentence: `Sent the PM /omni:${next.skill} for the mission's goal: ${String(next.cap)} PRD${next.cap === 1 ? '' : 's'} at most.`,
});

/** The PRDs of `scope` with those the fleet added after them, once each. */
export function withAdded(scope: readonly PrdNumber[], added: readonly PrdNumber[]): PrdNumber[] {
  return [...scope, ...added.filter((prd) => !scope.includes(prd))];
}

/** A run's conclusion while its PM writes: a mission is never delivered or stopped while its PM's job is at work; it runs. */
export function withPm(next: Concluded, writing: boolean, wakeAt: string): Concluded {
  if (!writing || next.status === 'paused' || next.status === 'draft' || next.status === 'running') return next;
  return { status: 'running', waitingOn: next.status === 'waiting' ? next.waitingOn : null, nextWakeAt: wakeAt };
}

