// A mission that stops moving gets a stuck repair (PRD 3065 s4, spec sections 1, 2 and 4): the supervisor's stuck decisions, pure,
// over the mission's events in order and what one run read of its stuck repairs. No database, no GitHub, no clock: ./stuck-run.ts
// reads and writes, ./job.ts asks `stuckNext` once a run's events are known.
//
//   the counter   the jobs that ended since something last moved, read from the mission's events in the order they happened: a
//                 PRD's job that ended (its last attempt, once) counts one; a PRD reaching a step further than any it reached (the
//                 build, QA, a QA fix, the Reviewer, the fix after it), a ready, a join or a merge moves, and so does a Resume of the
//                 mission or a stuck repair sent or a pause by stuck: the count starts again. A step sent again (a hold, a stop
//                 mid-way, a resume, a provider limit, a flake retried) moves nothing; a retro job (a repair, a milestone retro), a
//                 committee or a PM job counts nothing; waiting on a person counts nothing, since no job ends
//   stuck         at STUCK_JOBS ended jobs in a row with nothing moved, one stuck repair, `/omni:repair --mission <m> --stuck --jobs
//                 <the last five>`, first in line; none while one is at work, a code fix of one still on its way included
//   its record    the same four ways as a PRD's repair (./repair.ts), with no step to send again: `code` lands its fix on the mission
//                 branch, `flake` and `omni-loop` (its report filed) let the mission go on, `person` pauses it by stuck. Its row is
//                 `fixed` once something moved after it, `not fixed` once the mission was stuck again first
//   the budget    a stuck repair is a repair: the same 3 per cause in a round and 9 per mission (BR-PRODUCT-139). A cause spent, or
//                 the 9 spent when the mission is stuck, pauses it by stuck and asks once; a Resume opens a new round
//   the pause     asked once: a stuck repair sent before the last pause by stuck is the past, so a replay, or a Resume, asks nothing
//                 again
import { createHash } from 'node:crypto';
import type { PrdNumber } from 'omni-loop/kit/lib/ids.ts';
import {
  bare,
  CAUSE_REPAIRS,
  asMissionEvent,
  isStuckPause,
  linkOf,
  MISSION_REPAIRS,
  prWords,
  reportEvent,
  short,
  triedWords,
  type BugReport,
  type FixLanding,
  type Refused,
  type RepairOutcome,
  type RepairRow,
  type StuckJob,
} from './repair.ts';
import { endOf, stepRank, type NewEvent, type RecordedEvent, type Run } from './supervisor.ts';

/** The jobs in a row that end with nothing moved before a mission is stuck: `stuckNext`'s count, which 0 turns off. */
export const STUCK_JOBS = 5;

const KEY = /^mission:([0-9a-f-]{36}):stuck:([1-9][0-9]*)$/;

/** The key of the mission's k-th stuck repair: never sent twice. */
export const stuckKey = (mission: string, k: number): string => `mission:${mission}:stuck:${String(k)}`;

/** The number a stuck repair's key names; null for any other text. */
export function stuckOfKey(key: string): number | null {
  const match = KEY.exec(key);
  return match ? Number(match[2]) : null;
}

/** A job as a stuck repair's line names it: its first 8 characters, so five fit in the 200 a runner's line takes. */
const NAMED = 8;

/** The line a stuck repair is sent as: the mission by its number, and the jobs that ended with nothing moved, the fifth last. */
export const stuckSkillLine = (mission: number, jobs: readonly string[]): string => `/omni:repair --mission ${String(mission)} --stuck --jobs ${jobs.map((job) => job.slice(0, NAMED)).join(',')}`;

/** The jobs a stuck repair's line names; null when it is no stuck repair's. */
export function stuckJobsOf(line: string): string[] | null {
  const jobs = /^\/omni:repair .*--stuck --jobs (\S+)/.exec(line)?.[1];
  return jobs === undefined ? null : jobs.split(',').filter((one) => one.length > 0);
}

/** The fingerprint a stuck repair whose record line cannot be read is kept under: one for the mission, so 3 in a round pause it. */
export const unreadableStuck = (): string => createHash('sha256').update('omni repair: unreadable\nstuck', 'utf8').digest('hex');

// ── The counter ─────────────────────────────────────────────────────────────────

/**
 * One beat of the mission, in the order it happened: a PRD's job that ended, something that moved, a Resume of the mission, or a
 * stuck repair sent (its job) or a pause by stuck (no job).
 */
export type Beat = { beat: 'end'; job: string } | { beat: 'moved' } | { beat: 'resumed' } | { beat: 'stuck'; job: string | null };

/** The kinds of event a PRD's job's end is recorded as (supervisor.ts › KEYS: `end:<job>`), a ready apart: a ready moves. */
const ENDS: ReadonlySet<string> = new Set(['job-ended', 'held', 'reviewed', 'checked']);
/** The kinds of event that say a PRD moved on its own: ready, joined to the mission branch, merged. */
const MOVES: ReadonlySet<string> = new Set(['prd-ready', 'prd-joined', 'prd-merged']);

/** What the beats are read against: each run by its job, and the attempt each run ended on. */
type Reading = { byJob: ReadonlyMap<string, Run>; endedOn: ReadonlySet<string>; reached: Map<PrdNumber, number>; counted: Set<string> };

/** A dispatch: moved when it sends its PRD to a step further than any it was sent to; nothing otherwise. */
function dispatchBeat(job: string | null, at: Reading): Beat | null {
  const run = job === null ? undefined : at.byJob.get(job);
  if (run === undefined) return null;
  const rank = stepRank(run.step);
  const furthest = at.reached.get(run.prd) ?? -1;
  if (rank <= furthest) return null;
  at.reached.set(run.prd, rank);
  return { beat: 'moved' };
}

/** A job's end: one, the first time its run's last attempt is said to have ended; nothing for a lost runner or any other job. */
function endBeat(job: string | null, at: Reading): Beat | null {
  if (job === null || !at.endedOn.has(job) || at.counted.has(job)) return null;
  at.counted.add(job);
  return { beat: 'end', job };
}

function beatOf(event: RecordedEvent, at: Reading): Beat | null {
  const { kind, prd, job } = event;
  if (kind === 'dispatched') return dispatchBeat(job, at);
  if (MOVES.has(kind)) return { beat: 'moved' };
  if (ENDS.has(kind)) return endBeat(job, at);
  if (kind === 'resumed' && prd === null) return { beat: 'resumed' };
  return kind === 'stuck' && prd === null ? { beat: 'stuck', job: isStuckPause(event) ? null : job } : null;
}

/** The mission's beats, from its events in the order they happened and the PRDs' runs. */
export function beatsOf(events: readonly RecordedEvent[], runs: readonly Run[]): Beat[] {
  const endedOn = new Set(runs.flatMap((one) => {
    const last = one.attempts.at(-1);
    return last !== undefined && endOf(last) !== null ? [last.id] : [];
  }));
  const at: Reading = { byJob: new Map(runs.map((one) => [one.job, one])), endedOn, reached: new Map(), counted: new Set() };
  return events.flatMap((event) => {
    const beat = beatOf(event, at);
    return beat === null ? [] : [beat];
  });
}

/** The jobs that ended since something last moved, in order. */
export function stuckSince(beats: readonly Beat[]): string[] {
  let jobs: string[] = [];
  for (const beat of beats) jobs = beat.beat === 'end' ? [...jobs, beat.job] : [];
  return jobs;
}

// ── Where a stuck mission goes ─────────────────────────────────────────────────

/** What a run read of the mission's stuck repairs: the round, the jobs sent, the rows kept, and each job's refusal, landing and report. */
export type StuckView = {
  round: number;
  jobs: readonly StuckJob[];
  /** The stuck repairs' rows (`trigger` stuck). */
  rows: readonly RepairRow[];
  refused: ReadonlyMap<string, Refused>;
  landings: ReadonlyMap<string, FixLanding>;
  reports: ReadonlyMap<string, BugReport>;
};

/** No stuck repair: the stuck count is off, or none was ever sent. */
export const NO_STUCK: StuckView = { round: 1, jobs: [], rows: [], refused: new Map(), landings: new Map(), reports: new Map() };

/** Where a stuck mission goes: nothing, a stuck repair to send, one at work, or paused by stuck, saying why. */
export type StuckNext = { next: 'none' } | { next: 'send'; k: number; jobs: string[] } | { next: 'repairing'; number: number; left: number; why: string | null } | { next: 'pause'; why: string };

const status = (job: StuckJob): string | undefined => job.attempts.at(-1)?.status;
const ended = (job: StuckJob): boolean => ['done', 'failed', 'cancelled'].includes(status(job) ?? '');

/** The stuck repairs sent before the last pause by stuck: the past, which pauses nothing again. */
function pastOf(beats: readonly Beat[]): Set<string> {
  const past = new Set<string>();
  let since: string[] = [];
  for (const beat of beats) {
    if (beat.beat !== 'stuck') continue;
    if (beat.job !== null) since.push(beat.job);
    else {
      for (const job of since) past.add(job);
      since = [];
    }
  }
  return past;
}

/** `Resume gives each cause 3 more (6 of 9 left in this mission)`. */
const resumeWords = (left: number): string => `Resume gives each cause ${String(CAUSE_REPAIRS)} more (${String(left)} of ${String(MISSION_REPAIRS)} left in this mission)`;

/** Why a stuck mission pauses on a row, or on its row refused: the cause, what was tried, the proposed fix, how to resume. */
function pauseWords(view: StuckView, { fingerprint, retro }: Pick<RepairRow, 'fingerprint' | 'retro'>, left: number, spent: Refused['spent'] | null): string {
  const cause = retro === null ? 'its stuck repairs left no record that could be read.' : retro.cause;
  const fix = retro === null ? '' : ` Proposed fix: ${retro.proposedFix}`;
  if (spent === 'mission') return bare(`the mission spent its ${String(MISSION_REPAIRS)} repairs [${short(fingerprint)}]: ${cause}${fix}`);
  const tried = view.rows.filter((row) => row.round === view.round && row.fingerprint === fingerprint).sort((a, b) => a.number - b.number);
  const head = spent === 'cause' ? `its cause [${short(fingerprint)}] was repaired ${String(CAUSE_REPAIRS)} times: ${cause}` : cause;
  return `${head} Tried: ${tried.length === 0 ? 'nothing' : tried.map(triedWords).join(', ')}.${fix} ${resumeWords(left)}`;
}

/** A code stuck repair's fix on its way to the mission branch, which holds the count; null for any other row. */
function fixOnItsWay(view: StuckView, row: RepairRow, left: number): StuckNext | null {
  const fix = row.retro?.class === 'code' && row.outcome === null ? prWords(row.fixPr) : null;
  const why = fix === null ? null : fixWaits(fix, view.landings.get(row.job ?? ''));
  return why === null ? null : { next: 'repairing', number: row.number, left, why };
}

/** What a fix on its way waits for; null once it landed or cannot land. */
function fixWaits(fix: string, landing: FixLanding | undefined): string | null {
  if (landing === undefined) return `its fix ${fix} lands once green`;
  return landing.state === 'waits' ? `its fix ${fix} waits: ${landing.lacks.join('; ')}` : null;
}

/** Where a stuck repair that ended leaves the mission: paused, its fix on its way, or free to count again (null). */
function afterStuck(view: StuckView, job: StuckJob, left: number): StuckNext | null {
  if (status(job) === 'cancelled') return null;
  const refused = view.refused.get(job.job);
  if (refused !== undefined) return { next: 'pause', why: pauseWords(view, refused, left, refused.spent) };
  const row = view.rows.find((one) => one.job === job.job);
  if (row === undefined) return { next: 'repairing', number: 1, left, why: null };
  return row.retro?.class === 'person' ? { next: 'pause', why: pauseWords(view, row, left, null) } : fixOnItsWay(view, row, left);
}

/**
 * Where the mission goes, by its stuck repairs and its beats (this run's included), `left` the repairs it has left: its latest stuck
 * repair since the last pause by stuck first, at work or ended; then the count.
 */
export function stuckNext(view: StuckView, beats: readonly Beat[], left: number, count: number = STUCK_JOBS): StuckNext {
  if (count < 1) return { next: 'none' };
  const past = pastOf(beats);
  const last = view.jobs.filter((job) => !past.has(job.job)).sort((a, b) => a.k - b.k).at(-1);
  if (last !== undefined && !ended(last)) return { next: 'repairing', number: view.rows.find((row) => row.job === last.job)?.number ?? 1, left, why: null };
  return (last === undefined ? null : afterStuck(view, last, left)) ?? countNext(view, stuckSince(beats), left, count);
}

/** At `count` jobs ended with nothing moved, a stuck repair naming the last of them, or, with the 9 spent, a pause; nothing before. */
function countNext(view: StuckView, since: readonly string[], left: number, count: number): StuckNext {
  if (since.length < count) return { next: 'none' };
  if (left === 0) return { next: 'pause', why: `${String(count)} jobs ended and nothing moved, and the mission spent its ${String(MISSION_REPAIRS)} repairs` };
  return { next: 'send', k: Math.max(0, ...view.jobs.map((job) => job.k)) + 1, jobs: since.slice(-count) };
}

/** What the mission says while its stuck repair works: `Stuck: 5 jobs, nothing moved · repairing (1 of 3) · 7 left in this mission`. */
export const stuckWords = ({ number, left, why }: { number: number; left: number; why: string | null }): string =>
  `Stuck: ${String(STUCK_JOBS)} jobs, nothing moved · repairing (${String(number)} of ${String(CAUSE_REPAIRS)}) · ${String(left)} left in this mission${why === null ? '' : `: ${why}`}`;

// ── A stuck repair's end ───────────────────────────────────────────────────────

/** What came first after a stuck repair was sent: something moved, or the mission was stuck again; null while neither. */
function firstAfter(beats: readonly Beat[], job: string | null): RepairOutcome | null {
  const from = beats.findIndex((beat) => beat.beat === 'stuck' && beat.job === job);
  if (from < 0) return null;
  for (const beat of beats.slice(from + 1)) {
    if (beat.beat === 'moved') return 'fixed';
    if (beat.beat === 'stuck') return 'not fixed';
  }
  return null;
}

/**
 * Each code or flake stuck row not ended yet, by row: `fixed` once something moved after its repair was sent, `not fixed` once the
 * mission was stuck again first. A code repair settles once its fix landed.
 */
export function settleStuck(rows: readonly RepairRow[], beats: readonly Beat[], landings: ReadonlyMap<string, FixLanding>): Map<string, RepairOutcome> {
  const settled = new Map<string, RepairOutcome>();
  for (const row of rows) {
    const kind = row.retro?.class;
    if (row.outcome !== null || (kind !== 'flake' && kind !== 'code')) continue;
    if (kind === 'code' && landings.get(row.job ?? '')?.state !== 'landed') continue;
    const outcome = firstAfter(beats, row.job);
    if (outcome !== null) settled.set(row.id, outcome);
  }
  return settled;
}

// ── The events ──────────────────────────────────────────────────────────────────

/** Where the stuck repairs went, and the mission by its number. */
type Where = { where: string; mission: number };

/** What a stuck repair's dispatch says. */
const sentEvent = (job: StuckJob, { where, mission }: Where): NewEvent => ({
  kind: 'stuck',
  role: 'supervisor',
  prd: null,
  job: job.job,
  link: null,
  sentence: `Stuck: ${String(job.jobs.length)} jobs, nothing moved. Sent /omni:repair --mission ${String(mission)} --stuck to ${where} (stuck repair ${String(job.k)}).`,
});

/** What a stuck row says: its retro, once read, and its end. */
function rowEvents(row: RepairRow): NewEvent[] {
  const cause = `[${short(row.fingerprint)}]`;
  const said = (kind: 'retro' | 'repair-ended', role: NewEvent['role'], sentence: string): NewEvent => asMissionEvent({ kind, role, prd: row.prd, job: row.job, link: linkOf(row.fixPr), sentence });
  const retro = row.retro === null ? [] : [said('retro', 'engineer', `The stuck repair's retro ${cause} reads ${row.retro.class}: ${row.retro.cause}`)];
  if (row.outcome === null) return retro;
  const how = row.retro === null ? 'ended not fixed: its record line could not be read.' : `${cause} ended ${row.outcome}.`;
  return [...retro, said('repair-ended', 'supervisor', `The stuck repair ${how}`)];
}

/** Every stuck event a run may record, in order: each stuck repair sent, then each row's retro, end and report. */
export function stuckEvents(view: StuckView, where: Where): NewEvent[] {
  return [...view.jobs.map((job) => sentEvent(job, where)), ...view.rows.flatMap((row) => [...rowEvents(row), ...reportEvent(row, view.reports.get(row.job ?? ''), 'The mission').map(asMissionEvent)])];
}

/** The pause by stuck, as its event: the mission's own, naming no job, so a run reads it back as the pause (./repair.ts › isStuckPause). */
export const pausedEvent = (why: string): NewEvent => ({ kind: 'stuck', role: 'supervisor', prd: null, job: null, link: null, sentence: `Paused: stuck: ${why}` });

/** What a mission paused by stuck waits on: `Paused: stuck · <why>`. */
export const pausedWords = (why: string): string => `Paused: stuck · ${why}`;
