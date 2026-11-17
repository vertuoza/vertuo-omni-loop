// A mission repairs a failed step, then stops and explains (PRD 2980 s5, spec sections 1, 4, 5 and 6): the supervisor's repair
// decisions, pure, over what one run read of the mission's repairs. No database, no GitHub, no clock: ./repair-run.ts reads and
// writes, ./supervisor.ts asks `repairNext` where it stopped a PRD before.
//
//   the budget    3 repairs per cause (its fingerprint) in a round, 9 per mission across every round. A person's Resume of a
//                 stopped mission opens a new round: each cause gets 3 again, the mission's 9 stay counted. A lost repair (its
//                 runner lost, its resume carrying it) spends nothing; one that failed or whose record line cannot be read spends
//                 one. The database holds the same caps (mission_repairs), so a supervisor bug cannot loop
//   a failure     a failed job, a second hold or a second stop mid-way sends a repair job, `/omni:repair --mission <m> --prd <n>
//                 --job <failed job>`, claimed first in line, while the mission has repairs left; the PRD reads
//                 `repairing (1 of 3) · 8 left in this mission`. With the 9 spent it stops, as before. A cancel sends nothing
//   its record    once the repair ended, its row says what it found, by class:
//                   code       its fix pull request lands on the mission branch once green, then the step is sent again; a fix
//                              that cannot land (red, closed, refused by GitHub) stops the PRD, saying why
//                   flake      the step is sent again, with no fix
//                   person     the PRD stops with the question
//                   omni-loop  the PRD stops and waits on the Omni Loop bug the App files, or says why no report was sent
//                 A record that cannot be read ends `not fixed` and the failure is repaired again, within the budget. A cause
//                 repaired 3 times in the round, or the mission's 10th repair, stops the PRD with the cause, the repairs tried,
//                 the proposed fix and how to resume
//   a new round   a PRD stopped by its repair in an earlier round is sent its step again: a person resumed it
//   the events    repair-started, retro, repair-ended and bug-reported: one sentence and one link each, never a log, naming the
//                 cause by its fingerprint's first 8 characters
import { createHash } from 'node:crypto';
import type { PrdNumber } from 'omni-loop/kit/lib/ids.ts';
import type { RepairRetro } from 'omni-loop/kit/lib/repair/retro.ts';
import { checksOf, type PullRead } from './gate.ts';
import type { Attempt, NewEvent, RecordedEvent } from './supervisor.ts';

/** The repairs one cause gets in a round. */
const CAUSE_REPAIRS = 3;
/** The repairs a mission runs at most, every round counted. 0 turns repairs off: a failure stops its PRD, as before PRD 2980. */
export const MISSION_REPAIRS = 9;

/** How a repair ended (mission_repairs.outcome): null while it runs. */
export type RepairOutcome = 'fixed' | 'not fixed' | 'stopped' | 'lost';

/** A repair the database kept (a mission_repairs row). `retro` is null when its record line could not be read. */
export type RepairRow = {
  id: string;
  prd: PrdNumber;
  fingerprint: string;
  round: number;
  number: number;
  failedJob: string;
  job: string | null;
  retro: RepairRetro | null;
  fixPr: string | null;
  outcome: RepairOutcome | null;
};

/** A repair job the mission sent: its key's PRD and number, the job whose failure it repairs, and its attempts, the job's first. */
export type RepairJob = { prd: PrdNumber; k: number; job: string; failedJob: string; attempts: Attempt[] };

/** A code repair's fix on its way to the mission branch: landed, waiting on what it lacks, or refused, with why. */
export type FixLanding = { state: 'landed' } | { state: 'waits'; lacks: readonly string[] } | { state: 'refused'; why: string };

/** An omni-loop repair's report: filed as an issue, being filed, or refused by the scrub, with why. */
export type BugReport = { state: 'filed'; repo: string; issue: number } | { state: 'filing' } | { state: 'refused'; why: string };

/** A repair whose row the budget refused: the cause spent its 3 in the round, or the mission its 9. */
export type Refused = { spent: 'cause' | 'mission'; fingerprint: string; retro: RepairRetro | null };

/** What a run read of the mission's repairs. */
export type RepairView = {
  /** The mission's repairs, every round counted: MISSION_REPAIRS, or 0 when repairs are off. */
  budget: number;
  /** The mission's round of repairs: 1, and one more for each Resume of the stopped mission. */
  round: number;
  jobs: readonly RepairJob[];
  rows: readonly RepairRow[];
  /** By repair job: its row refused by the budget. */
  refused: ReadonlyMap<string, Refused>;
  /** By repair job: its fix's landing on the mission branch. */
  landings: ReadonlyMap<string, FixLanding>;
  /** By repair job: its Omni Loop bug report. */
  reports: ReadonlyMap<string, BugReport>;
};

/** No repairs: a failure stops its PRD, as before PRD 2980. */
export const NO_REPAIRS: RepairView = { budget: 0, round: 1, jobs: [], rows: [], refused: new Map(), landings: new Map(), reports: new Map() };

/** Where a PRD goes once its step failed: a repair to send, one at work, its step again, stopped, or paused by a cancel. */
export type RepairNext =
  | { next: 'repair'; k: number; failedJob: string }
  | { next: 'repairing'; number: number; left: number; why: string | null }
  | { next: 'again' }
  | { next: 'stops'; why: string }
  | { next: 'paused' };

const KEY = /^mission:([0-9a-f-]{36}):prd:([1-9][0-9]*):repair:([1-9][0-9]*)$/;

/** The key of the PRD's k-th repair job: never sent twice. */
export const repairKey = (mission: string, prd: PrdNumber, k: number): string => `mission:${mission}:prd:${String(prd)}:repair:${String(k)}`;

/** The PRD and number a repair key names; null for any other text. */
export function repairOfKey(key: string): { prd: number; k: number } | null {
  const match = KEY.exec(key);
  return match ? { prd: Number(match[2]), k: Number(match[3]) } : null;
}

/** The line a repair is sent as: the mission by its number, the PRD, and the job whose failure it repairs. */
export const repairLine = (mission: number, prd: PrdNumber, failedJob: string): string => `/omni:repair --mission ${String(mission)} --prd ${String(prd)} --job ${failedJob}`;

/** The failed job a repair line names; null when it names none. */
export const failedJobOf = (line: string): string | null => /^\/omni:repair .*--job (\S+)/.exec(line)?.[1] ?? null;

/**
 * The fingerprint a repair whose record line cannot be read is kept under: one per PRD, so 3 such repairs in a round stop that
 * PRD, whatever the cause.
 */
export const unreadableFingerprint = (prd: PrdNumber): string => createHash('sha256').update(`omni repair: unreadable\n${String(prd)}`, 'utf8').digest('hex');

/**
 * The mission's round of repairs, from its events in order: 1, and one more for each Resume that follows the mission stopping.
 * A Resume of a paused mission opens none.
 */
export function roundOf(events: readonly RecordedEvent[]): number {
  let round = 1;
  let stopped = false;
  for (const { kind, prd } of events) {
    if (kind === 'stopped' && prd === null) stopped = true;
    else if (kind === 'resumed' && stopped) {
      round += 1;
      stopped = false;
    }
  }
  return round;
}

const ended = (job: RepairJob): boolean => {
  const status = job.attempts.at(-1)?.status;
  return status === 'done' || status === 'failed' || status === 'cancelled';
};

const rowOf = (view: RepairView, job: string): RepairRow | undefined => view.rows.find((row) => row.job === job);

/** The repairs the mission spent: every row not lost, and every repair job at work that has none yet. */
function spentOf(view: RepairView): number {
  const kept = view.rows.filter((row) => row.outcome !== 'lost').length;
  const atWork = view.jobs.filter((job) => !ended(job) && rowOf(view, job.job) === undefined).length;
  return kept + atWork;
}

/** The repairs the mission has left. */
const leftOf = (view: RepairView): number => Math.max(0, view.budget - spentOf(view));

/** `abcd1234`: a cause as the pages name it. */
const short = (fingerprint: string): string => fingerprint.slice(0, 8);

/** `#12`, the pull request a link names; null when none. */
const prWords = (url: string | null): string | null => {
  const number = /\/pull\/(\d+)$/.exec(url ?? '')?.[1];
  return number === undefined ? null : `#${number}`;
};

/** `Resume gives each cause 3 more (6 of 9 left in this mission).` */
const resumeWords = (view: RepairView): string => `Resume gives each cause ${String(CAUSE_REPAIRS)} more (${String(leftOf(view))} of ${String(view.budget)} left in this mission).`;

/** What a repair tried and how it ended: `#12 not fixed`, `retry fixed`. */
function triedWords(row: RepairRow): string {
  const what = prWords(row.fixPr) ?? (row.retro?.class === 'flake' ? 'retry' : row.retro === null ? 'unreadable' : 'no fix');
  return `${what} ${row.outcome ?? 'running'}`;
}

/** Why a PRD stops when the budget refused its repair: the cause, what was tried, the proposed fix, how to resume. */
function spentWords(view: RepairView, prd: PrdNumber, refused: Refused): string {
  const cause = refused.retro === null ? 'its repairs left no record that could be read.' : refused.retro.cause;
  const fix = refused.retro === null ? '' : ` Proposed fix: ${refused.retro.proposedFix}`;
  if (refused.spent === 'mission') return `the mission spent its ${String(view.budget)} repairs [${short(refused.fingerprint)}]: ${cause}${fix}`;
  const tried = view.rows.filter((row) => row.prd === prd && row.round === view.round && row.fingerprint === refused.fingerprint).sort((a, b) => a.number - b.number);
  return `its cause [${short(refused.fingerprint)}] was repaired ${String(CAUSE_REPAIRS)} times: ${cause} Tried: ${tried.map(triedWords).join(', ')}.${fix} ${resumeWords(view)}`;
}

/** The PRD's next repair number: one more than the last it was sent. */
const nextK = (view: RepairView, prd: PrdNumber): number => Math.max(0, ...view.jobs.filter((job) => job.prd === prd).map((job) => job.k)) + 1;

/** Where a PRD goes when its failure has no repair at work: a repair while the mission has some left, else it stops. */
function sendOrStop(view: RepairView, prd: PrdNumber, failedJob: string, failure: string): RepairNext {
  if (leftOf(view) === 0) return { next: 'stops', why: `${failure}, and the mission spent its ${String(view.budget)} repairs` };
  return { next: 'repair', k: nextK(view, prd), failedJob };
}

/**
 * The cause's number a repair at work counts as: its row's, once kept; else one more than the PRD's last repair in this round when
 * that one ended not fixed (the cause came back), else 1.
 */
function numberOf(view: RepairView, prd: PrdNumber, row: RepairRow | undefined): number {
  if (row !== undefined) return row.number;
  const last = view.rows.filter((one) => one.prd === prd && one.round === view.round).at(-1);
  return last?.outcome === 'not fixed' ? Math.min(CAUSE_REPAIRS, last.number + 1) : 1;
}

const repairing = (view: RepairView, prd: PrdNumber, row: RepairRow | undefined, why: string | null = null): RepairNext => ({ next: 'repairing', number: numberOf(view, prd, row), left: leftOf(view), why });

/** Where an omni-loop repair leaves its PRD: waiting on the Omni Loop bug it was filed as, or why no report was sent. */
function reportWords(view: RepairView, row: RepairRow): string {
  const report = view.reports.get(row.job ?? '');
  if (report?.state === 'filed') return `Waits on Omni Loop bug #${String(report.issue)}`;
  if (report?.state === 'refused') return `its Omni Loop bug report [${short(row.fingerprint)}] was not sent: ${report.why}`;
  return `its Omni Loop bug report [${short(row.fingerprint)}] is being filed`;
}

/** Where a repair's kept row leaves its PRD, by its retro's class. */
function afterRow(view: RepairView, prd: PrdNumber, row: RepairRow, failure: string): RepairNext {
  const retro = row.retro;
  if (retro === null) return sendOrStop(view, prd, row.failedJob, failure);
  if (row.round < view.round && row.outcome === 'stopped') return { next: 'again' };
  const cause = `[${short(row.fingerprint)}]`;
  switch (retro.class) {
    case 'flake':
      return { next: 'again' };
    case 'person':
      return { next: 'stops', why: `its repair ${cause} needs a person: ${retro.cause} ${retro.proposedFix}` };
    case 'omni-loop':
      return { next: 'stops', why: reportWords(view, row) };
    case 'code':
      return afterFix(view, prd, row, retro);
  }
}

/** Where a code repair leaves its PRD: its fix landed (the step again), on its way, or unable to land. */
function afterFix(view: RepairView, prd: PrdNumber, row: RepairRow, retro: RepairRetro): RepairNext {
  const fix = prWords(row.fixPr);
  if (fix === null) return { next: 'stops', why: `its repair [${short(row.fingerprint)}] found the cause but opened no fix: ${retro.cause} Proposed fix: ${retro.proposedFix}` };
  const landing = view.landings.get(row.job ?? '');
  if (landing?.state === 'landed') return { next: 'again' };
  if (landing?.state === 'refused') return { next: 'stops', why: `its fix ${fix} cannot land on the mission branch: ${landing.why}` };
  return repairing(view, prd, row, landing === undefined ? `its fix ${fix} lands once green` : `its fix ${fix} waits: ${landing.lacks.join('; ')}`);
}

/**
 * Where a PRD goes once its step failed (`failedJob` the job that failed, `failure` why it stops without a repair): null when repairs
 * are off, and the PRD stops as before.
 */
export function repairNext(view: RepairView, prd: PrdNumber, failedJob: string, failure: string): RepairNext | null {
  if (view.budget === 0) return null;
  const mine = view.jobs.filter((job) => job.prd === prd && job.failedJob === failedJob).sort((a, b) => a.k - b.k);
  const last = mine.at(-1);
  if (last === undefined) return sendOrStop(view, prd, failedJob, failure);
  const status = last.attempts.at(-1)?.status;
  if (status === 'cancelled') return { next: 'paused' };
  const row = rowOf(view, last.job);
  if (!ended(last) || (row === undefined && !view.refused.has(last.job))) return repairing(view, prd, row);
  const refused = view.refused.get(last.job);
  if (refused !== undefined) return { next: 'stops', why: spentWords(view, prd, refused) };
  return row === undefined ? repairing(view, prd, row) : afterRow(view, prd, row, failure);
}

/** What a run of the mission keeps of a PRD at work on a repair, in words: `repairing (2 of 3) · 7 left in this mission`. */
export const repairingWords = ({ number, left, why }: { number: number; left: number; why: string | null }): string =>
  `repairing (${String(number)} of ${String(CAUSE_REPAIRS)}) · ${String(left)} left in this mission${why === null ? '' : `: ${why}`}`;

// ── A fix's landing ─────────────────────────────────────────────────────────────

/** Whether a code repair's fix lands on mission branch `branch`: landed, merge it now, wait, or refused. */
export function judgeFix(pull: PullRead, branch: string): FixLanding | { state: 'merge' } {
  const pr = `#${String(pull.number)}`;
  if (pull.merged) return pull.base === branch ? { state: 'landed' } : { state: 'refused', why: `${pr} was merged into ${pull.base}, not ${branch}` };
  if (pull.base !== branch || pull.base === pull.defaultBranch) return { state: 'refused', why: `${pr} targets ${pull.base}, not ${branch}` };
  if (pull.state !== 'open') return { state: 'refused', why: `${pr} is closed` };
  const checks = checksOf(pull.runs, pull.statuses);
  const failed = checks.filter(({ state }) => state === 'fail');
  if (failed.length > 0) return { state: 'refused', why: `${pr} is red: ${failed.map(({ name }) => `${name} failed`).join(', ')}` };
  const lacks = [
    ...(pull.draft ? [`${pr} is a draft`] : []),
    ...(checks.length === 0 ? ['no check has run on its head'] : []),
    ...checks.flatMap(({ name, state }) => (state === 'not-finished' ? [`${name} not finished`] : state === 'not-judged' ? [`${name} not judged`] : [])),
  ];
  return lacks.length === 0 ? { state: 'merge' } : { state: 'waits', lacks };
}

// ── The events ──────────────────────────────────────────────────────────────────

/** A link an event may carry: a web address of at most 500 characters, else none. */
const linkOf = (url: string | null): string | null => (url !== null && /^https:\/\//.test(url) && url.length <= 500 ? url : null);

/** `the night-shift fleet's runners`, or any runner of the workspace. */
type Where = { where: string; mission: number };

/** What a repair job's dispatch says. */
const startedEvent = (job: RepairJob, { where, mission }: Where): NewEvent => ({
  kind: 'repair-started',
  role: 'supervisor',
  prd: job.prd,
  job: job.job,
  link: null,
  sentence: `Sent ${repairLine(mission, job.prd, job.failedJob)} to ${where} (repair ${String(job.k)}).`,
});

/** What a kept row says: its retro, once read, and its end. */
function rowEvents(row: RepairRow): NewEvent[] {
  const n = `PRD ${String(row.prd)}`;
  const cause = `[${short(row.fingerprint)}]`;
  const said = (kind: 'retro' | 'repair-ended', role: NewEvent['role'], sentence: string): NewEvent => ({ kind, role, prd: row.prd, job: row.job, link: linkOf(row.fixPr), sentence });
  const retro = row.retro === null ? [] : [said('retro', 'engineer', `${n}'s retro ${cause} reads ${row.retro.class}: ${row.retro.cause}`)];
  if (row.outcome === null) return retro;
  const how = row.retro === null ? 'not fixed: its record line could not be read.' : `${row.outcome}.`;
  return [...retro, said('repair-ended', 'supervisor', `${n}'s repair${row.retro === null ? '' : ` ${cause}`} ended ${how}`)];
}

/** What a filed report says, linking its issue. */
function reportEvent(row: RepairRow, report: BugReport | undefined): NewEvent[] {
  if (report?.state !== 'filed') return [];
  const link = linkOf(`https://github.com/${report.repo}/issues/${String(report.issue)}`);
  return [{ kind: 'bug-reported', role: 'supervisor', prd: row.prd, job: row.job, link, sentence: `PRD ${String(row.prd)} met an Omni Loop bug [${short(row.fingerprint)}]: reported as #${String(report.issue)}.` }];
}

/** Every repair event a run may record, in order: each dispatch, then each row's retro, end and report. */
export function repairEvents(view: RepairView, where: Where): NewEvent[] {
  return [...view.jobs.map((job) => startedEvent(job, where)), ...view.rows.flatMap((row) => [...rowEvents(row), ...reportEvent(row, view.reports.get(row.job ?? ''))])];
}
