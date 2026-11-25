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
//   stuck         a stuck repair (PRD 3065, ./stuck.ts) is a row of the same table, `trigger` stuck, its PRD the one its cause sits in or
//                 none: it counts toward the same 3 and 9, and a stuck repair at work spends one as a PRD's does. A PRD's repair never
//                 reads a stuck row as its own
//   the way back  PRD 3088 s5 (spec section 6): a PRD stopped waiting on an Omni Loop bug follows the bug, in any round:
//                   open       it stays stopped, as before; a person's Resume of the mission sends it again in the new round
//                   fixed      released in v0.0.N: with the kit its repository pins (on the mission branch, else the default
//                              branch) at 0.0.N or later the step is sent again, spending no repair; older, or unread, it waits,
//                              `Fixed in v0.0.N: update the kit to resume (omni update)`, and goes again at the first wake that
//                              reads a kit new enough. A paused or stopped mission waits for its own Resume
//                   wont-fix   it stays stopped, `take this PRD by hand`, in any round
//                 the room is told once per bug, `bug-fixed`, linking the public issue, and once more when the PRD goes again: the
//                 issue, the version and the PRD only, never a workspace, a repository or a login of another mission (BR-PRODUCT-163)
import { createHash } from 'node:crypto';
import { isProductPrdId, type IssueNumber } from 'omni-loop/kit/lib/ids.ts';
import type { RepairRetro } from 'omni-loop/kit/lib/repair/retro.ts';
import { compareVersions, parseVersion } from 'omni-loop/kit/lib/version/version.ts';
import { checksOf, type PullRead } from './gate.ts';
import { PrdIdSchema, type MissionPrd } from './store.prd.ts';
import type { Attempt, NewEvent, RecordedEvent } from './supervisor.ts';

/** An event a repair records: its PRD a repository's number or a product's id (bug #3302); ./job.ts records a product's apart. */
export type RepairEvent = Omit<NewEvent, 'prd'> & { prd: MissionPrd | null };

/** The repairs one cause gets in a round. */
export const CAUSE_REPAIRS = 3;
/** The repairs a mission runs at most, every round counted. 0 turns repairs off: a failure stops its PRD, as before PRD 2980. */
export const MISSION_REPAIRS = 9;

/** How a repair ended (mission_repairs.outcome): null while it runs. */
export type RepairOutcome = 'fixed' | 'not fixed' | 'stopped' | 'lost';

/** What sent a repair (mission_repairs.trigger): a step that failed (PRD 2980), or a mission stuck (PRD 3065). */
export type RepairTrigger = 'failure' | 'stuck';

/**
 * A repair the database kept (a mission_repairs row). `retro` is null when its record line could not be read. `trigger` absent reads
 * `failure`; only a stuck repair may name no PRD.
 */
export type RepairRow = {
  id: string;
  /** A repository PRD's number, or a product PRD's id (bug #3302); null for a stuck repair's own cause. */
  prd: MissionPrd | null;
  trigger?: RepairTrigger;
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
export type RepairJob = { prd: MissionPrd; k: number; job: string; failedJob: string; attempts: Attempt[] };

/** A stuck repair the mission sent (PRD 3065): its key's number, the five jobs its line names, the fifth last, and its attempts. */
export type StuckJob = { k: number; job: string; jobs: readonly string[]; attempts: Attempt[] };

/** Whether a kept row is a stuck repair's (PRD 3065), never a PRD's own. */
export const isStuckRow = (row: RepairRow): boolean => row.trigger === 'stuck';

/** A code repair's fix on its way to the mission branch: landed, waiting on what it lacks, or refused, with why. */
export type FixLanding = { state: 'landed' } | { state: 'waits'; lacks: readonly string[] } | { state: 'refused'; why: string };

/**
 * Where the Omni Loop bug a report was filed as stands (PRD 3088): not released yet (`open`, whatever the team does with it), released
 * fixed in kit `version` (0.0.N), or closed as not planned.
 */
export type BugFix = { state: 'open' } | { state: 'fixed'; version: string } | { state: 'wont-fix' };

/** An omni-loop repair's report: filed as an issue (where its bug stands, `fix`, absent read open), being filed, or refused by the scrub, with why. */
export type BugReport = { state: 'filed'; repo: string; issue: IssueNumber; fix?: BugFix } | { state: 'filing' } | { state: 'refused'; why: string };

/** A bug's state and version as `omni_bug_reports` keeps them, as the way back reads them: `fixed` with no version that reads is still open. */
export function bugFixOf(state: string, fixedIn: string | null): BugFix {
  const version = parseVersion(fixedIn);
  if (state === 'fixed' && version !== null) return { state: 'fixed', version };
  return state === 'wont-fix' ? { state: 'wont-fix' } : { state: 'open' };
}

/** A repair whose row the budget refused: the cause spent its 3 in the round, or the mission its 9. */
export type Refused = { spent: 'cause' | 'mission'; fingerprint: string; retro: RepairRetro | null };

/** What a run read of the mission's repairs. */
export type RepairView = {
  /** The mission's repairs, every round counted: MISSION_REPAIRS, or 0 when repairs are off. */
  budget: number;
  /** The mission's round of repairs: 1, and one more for each Resume of the stopped mission. */
  round: number;
  jobs: readonly RepairJob[];
  /** Every row the mission kept, a stuck repair's too (PRD 3065): the 9 count them all. */
  rows: readonly RepairRow[];
  /** The stuck repairs the mission sent (PRD 3065): one at work and with no row yet spends one, as a PRD's does. */
  stuck: readonly StuckJob[];
  /** By repair job: its row refused by the budget. */
  refused: ReadonlyMap<string, Refused>;
  /** By repair job: its fix's landing on the mission branch. */
  landings: ReadonlyMap<string, FixLanding>;
  /** By repair job: its Omni Loop bug report. */
  reports: ReadonlyMap<string, BugReport>;
  /**
   * The kit the mission's repository pins (PRD 3088), read only while a PRD waits on a fixed bug: `0.0.N`, null when it did not read,
   * absent when it was not read. Either of the two last reads older than any fix.
   */
  kit?: string | null;
  /** Whether the mission is paused or stopped (PRD 3088): a PRD whose bug was fixed then waits for the mission's own Resume. */
  held?: boolean;
};

/** No repairs: a failure stops its PRD, as before PRD 2980. */
export const NO_REPAIRS: RepairView = { budget: 0, round: 1, jobs: [], rows: [], stuck: [], refused: new Map(), landings: new Map(), reports: new Map() };

/** Where a PRD goes once its step failed: a repair to send, one at work, its step again, stopped, or paused by a cancel. */
export type RepairNext =
  | { next: 'repair'; k: number; failedJob: string }
  | { next: 'repairing'; number: number; left: number; why: string | null }
  | { next: 'again' }
  | { next: 'stops'; why: string }
  | { next: 'paused' }
  /** Its Omni Loop bug is fixed in a kit newer than the one its repository pins (PRD 3088): it waits for the kit, saying so. */
  | { next: 'kit'; why: string };

const KEY = /^mission:([0-9a-f-]{36}):prd:([^:]+):repair:([1-9][0-9]*)$/;

/** The key of the PRD's k-th repair job: never sent twice. A product PRD's names its id (bug #3302): `…:prd:omni-loop-27:repair:1`. */
export const repairKey = (mission: string, prd: MissionPrd, k: number): string => `mission:${mission}:prd:${String(prd)}:repair:${String(k)}`;

/** The PRD (a number or a product's id) and number a repair key names; null for any other text. */
export function repairOfKey(key: string): { prd: MissionPrd; k: number } | null {
  const match = KEY.exec(key);
  const prd = PrdIdSchema.safeParse(match?.[2]);
  return match && prd.success ? { prd: prd.data, k: Number(match[3]) } : null;
}

/** The line a repair is sent as: the mission by its number, the PRD (a product's by its id), and the job whose failure it repairs. */
export const repairSkillLine = (mission: number, prd: MissionPrd, failedJob: string): string => `/omni:repair --mission ${String(mission)} --prd ${String(prd)} --job ${failedJob}`;

/** The failed job a repair line names; null when it names none. */
export const failedJobOf = (line: string): string | null => /^\/omni:repair .*--job (\S+)/.exec(line)?.[1] ?? null;

/**
 * The fingerprint a repair whose record line cannot be read is kept under: one per PRD, so 3 such repairs in a round stop that
 * PRD, whatever the cause.
 */
export const unreadableFingerprint = (prd: MissionPrd): string => createHash('sha256').update(`omni repair: unreadable\n${String(prd)}`, 'utf8').digest('hex');

/** Whether an event is the supervisor pausing the mission by stuck (PRD 3065): a `stuck` of the mission naming no job. */
export const isStuckPause = ({ kind, prd, job }: RecordedEvent): boolean => kind === 'stuck' && prd === null && job === null;

/**
 * The mission's round of repairs, from its events in order: 1, and one more for each Resume that follows the mission stopping, or
 * the supervisor pausing it by stuck (PRD 3065). A Resume of a mission a person or a budget paused opens none, and neither does a
 * person sending one PRD on after QA (PRD 3001: a `resumed` naming it).
 */
export function roundOf(events: readonly RecordedEvent[]): number {
  let round = 1;
  let stopped = false;
  for (const event of events) {
    const { kind, prd } = event;
    if ((kind === 'stopped' && prd === null) || isStuckPause(event)) stopped = true;
    else if (kind === 'resumed' && prd === null && stopped) {
      round += 1;
      stopped = false;
    }
  }
  return round;
}

const ended = (job: { attempts: readonly Attempt[] }): boolean => {
  const status = job.attempts.at(-1)?.status;
  return status === 'done' || status === 'failed' || status === 'cancelled';
};

const rowOf = (view: RepairView, job: string): RepairRow | undefined => view.rows.find((row) => row.job === job);

/** The repairs the mission spent: every row not lost, and every repair job at work that has none yet, a stuck one's too. */
function spentOf(view: RepairView): number {
  const kept = view.rows.filter((row) => row.outcome !== 'lost').length;
  const atWork = [...view.jobs, ...view.stuck].filter((job) => !ended(job) && rowOf(view, job.job) === undefined).length;
  return kept + atWork;
}

/** The repairs the mission has left. */
export const leftOf = (view: RepairView): number => Math.max(0, view.budget - spentOf(view));

/** `abcd1234`: a cause as the pages name it. */
export const short = (fingerprint: string): string => fingerprint.slice(0, 8);

/** `#12`, the pull request a link names; null when none. */
export const prWords = (url: string | null): string | null => {
  const number = /\/pull\/(\d+)$/.exec(url ?? '')?.[1];
  return number === undefined ? null : `#${number}`;
};

/** `Resume gives each cause 3 more (6 of 9 left in this mission)`: the end of a why, which the mission's stopped line ends. */
const resumeWords = (view: RepairView): string => `Resume gives each cause ${String(CAUSE_REPAIRS)} more (${String(leftOf(view))} of ${String(view.budget)} left in this mission)`;

/** A sentence without its final stop, for the end of a why, which the mission's stopped line ends. */
export const bare = (text: string): string => text.replace(/[.!?]+$/, '');

/** What a repair tried and how it ended: `#12 not fixed`, `retry fixed`. */
export function triedWords(row: RepairRow): string {
  const what = prWords(row.fixPr) ?? (row.retro?.class === 'flake' ? 'retry' : row.retro === null ? 'unreadable' : 'no fix');
  return `${what} ${row.outcome ?? 'running'}`;
}

/** Why a PRD stops when the budget refused its repair: the cause, what was tried, the proposed fix, how to resume. */
function spentWords(view: RepairView, prd: MissionPrd, refused: Refused): string {
  const cause = refused.retro === null ? 'its repairs left no record that could be read.' : refused.retro.cause;
  const fix = refused.retro === null ? '' : ` Proposed fix: ${refused.retro.proposedFix}`;
  if (refused.spent === 'mission') return bare(`the mission spent its ${String(view.budget)} repairs [${short(refused.fingerprint)}]: ${cause}${fix}`);
  const tried = view.rows.filter((row) => row.prd === prd && row.round === view.round && row.fingerprint === refused.fingerprint).sort((a, b) => a.number - b.number);
  return `its cause [${short(refused.fingerprint)}] was repaired ${String(CAUSE_REPAIRS)} times: ${cause} Tried: ${tried.map(triedWords).join(', ')}.${fix} ${resumeWords(view)}`;
}

/** The PRD's next repair number: one more than the last it was sent. */
const nextK = (view: RepairView, prd: MissionPrd): number => Math.max(0, ...view.jobs.filter((job) => job.prd === prd).map((job) => job.k)) + 1;

/** Where a PRD goes when its failure has no repair at work: a repair while the mission has some left, else it stops. */
function sendOrStop(view: RepairView, prd: MissionPrd, failedJob: string, failure: string): RepairNext {
  if (leftOf(view) === 0) return { next: 'stops', why: `${failure}, and the mission spent its ${String(view.budget)} repairs` };
  return { next: 'repair', k: nextK(view, prd), failedJob };
}

/**
 * The cause's number a repair at work counts as: its row's, once kept; else one more than the PRD's last repair in this round when
 * that one ended not fixed (the cause came back), else 1.
 */
function numberOf(view: RepairView, prd: MissionPrd, row: RepairRow | undefined): number {
  if (row !== undefined) return row.number;
  const last = view.rows.filter((one) => one.prd === prd && one.round === view.round && !isStuckRow(one)).at(-1);
  return last?.outcome === 'not fixed' ? Math.min(CAUSE_REPAIRS, last.number + 1) : 1;
}

const repairing = (view: RepairView, prd: MissionPrd, row: RepairRow | undefined, why: string | null = null): RepairNext => ({ next: 'repairing', number: numberOf(view, prd, row), left: leftOf(view), why });

/** Where an omni-loop repair leaves its PRD: waiting on the Omni Loop bug it was filed as, or why no report was sent. */
function reportWords(view: RepairView, row: RepairRow): string {
  const report = view.reports.get(row.job ?? '');
  if (report?.state === 'filed') return `Waits on Omni Loop bug #${String(report.issue)}`;
  if (report?.state === 'refused') return `its Omni Loop bug report [${short(row.fingerprint)}] was not sent: ${report.why}`;
  return `its Omni Loop bug report [${short(row.fingerprint)}] is being filed`;
}

/** The Omni Loop bug an omni-loop repair's report was filed as, and where it stands; null while it is not filed. */
function filedOf(view: RepairView, row: RepairRow): { issue: IssueNumber; repo: string; fix: BugFix } | null {
  const report = view.reports.get(row.job ?? '');
  return report?.state === 'filed' ? { issue: report.issue, repo: report.repo, fix: report.fix ?? { state: 'open' } } : null;
}

/** Whether the kit a repository pins holds a fix released in `version`: an unread kit does not. */
const runsFix =(kit: string | null | undefined, version: string): boolean => {
  const pinned = parseVersion(kit);
  return pinned !== null && compareVersions(pinned, version) >= 0;
};

/** `Fixed in v0.0.N: update the kit to resume (omni update)`: what a PRD waiting on a kit older than its bug's fix reads. */
const updateKitWords =(version: string): string => `Fixed in v${version}: update the kit to resume (omni update)`;

/** `Omni Loop bug #N won't be fixed: take this PRD by hand`. */
const wontFixWords = (issue: IssueNumber): string => `Omni Loop bug #${String(issue)} won't be fixed: take this PRD by hand`;

/**
 * Where a PRD stopped on an Omni Loop bug goes once the bug moved (PRD 3088), in any round: its step again on a kit that runs the fix,
 * spending no repair; waiting for the kit on an older one; waiting for the mission's own Resume while it is paused or stopped; stopped
 * for good when the bug will not be fixed. Null for any other repair, or while the bug is open: the PRD goes as before.
 */
function wayBack(view: RepairView, row: RepairRow): RepairNext | null {
  const moved = movedOf(view, row);
  if (moved === null) return null;
  if (moved.fix.state === 'wont-fix') return { next: 'stops', why: wontFixWords(moved.issue) };
  const { version } = moved.fix;
  if (view.held === true) return { next: 'stops', why: `Omni Loop bug #${String(moved.issue)} is fixed in v${version}: resume the mission to carry on` };
  return runsFix(view.kit, version) ? { next: 'again' } : { next: 'kit', why: updateKitWords(version) };
}

/** Where a repair's kept row leaves its PRD, by its retro's class. */
function afterRow(view: RepairView, prd: MissionPrd, row: RepairRow, failure: string): RepairNext {
  const retro = row.retro;
  if (retro === null) return sendOrStop(view, prd, row.failedJob, failure);
  const back = wayBack(view, row);
  if (back !== null) return back;
  if (row.round < view.round && row.outcome === 'stopped') return { next: 'again' };
  const cause = `[${short(row.fingerprint)}]`;
  switch (retro.class) {
    case 'flake':
      return { next: 'again' };
    case 'person':
      return { next: 'stops', why: `its repair ${cause} needs a person: ${retro.cause} ${bare(retro.proposedFix)}` };
    case 'omni-loop':
      return { next: 'stops', why: reportWords(view, row) };
    case 'code':
      return afterFix(view, prd, row, retro);
  }
}

/** Where a code repair leaves its PRD: its fix landed (the step again), on its way, or unable to land. */
function afterFix(view: RepairView, prd: MissionPrd, row: RepairRow, retro: RepairRetro): RepairNext {
  const fix = prWords(row.fixPr);
  if (fix === null) return { next: 'stops', why: `its repair [${short(row.fingerprint)}] found the cause but opened no fix: ${retro.cause} Proposed fix: ${bare(retro.proposedFix)}` };
  const landing = view.landings.get(row.job ?? '');
  if (landing?.state === 'landed') return { next: 'again' };
  if (landing?.state === 'refused') return { next: 'stops', why: `its fix ${fix} cannot land on the mission branch: ${landing.why}` };
  return repairing(view, prd, row, landing === undefined ? `its fix ${fix} lands once green` : `its fix ${fix} waits: ${landing.lacks.join('; ')}`);
}

/**
 * Where a PRD goes once its step failed (`failedJob` the job that failed, `failure` why it stops without a repair): null when repairs
 * are off, and the PRD stops as before.
 */
export function repairNext(view: RepairView, prd: MissionPrd, failedJob: string, failure: string): RepairNext | null {
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
export const linkOf = (url: string | null): string | null => (url !== null && /^https:\/\//.test(url) && url.length <= 500 ? url : null);

/** `the night-shift fleet's runners`, or any runner of the workspace. */
type Where = { where: string; mission: number };

/** What a repair job's dispatch says. */
const startedEvent = (job: RepairJob, { where, mission }: Where): RepairEvent => ({
  kind: 'repair-started',
  role: 'supervisor',
  prd: job.prd,
  job: job.job,
  link: null,
  sentence: `Sent ${repairSkillLine(mission, job.prd, job.failedJob)} to ${where} (repair ${String(job.k)}).`,
});

/** What a kept row says: its retro, once read, and its end. */
function rowEvents(row: RepairRow): RepairEvent[] {
  const n = `PRD ${String(row.prd)}`;
  const cause = `[${short(row.fingerprint)}]`;
  const said = (kind: 'retro' | 'repair-ended', role: NewEvent['role'], sentence: string): RepairEvent => ({ kind, role, prd: row.prd, job: row.job, link: linkOf(row.fixPr), sentence });
  const retro = row.retro === null ? [] : [said('retro', 'engineer', `${n}'s retro ${cause} reads ${row.retro.class}: ${row.retro.cause}`)];
  if (row.outcome === null) return retro;
  const how = row.retro === null ? 'not fixed: its record line could not be read.' : `${row.outcome}.`;
  return [...retro, said('repair-ended', 'supervisor', `${n}'s repair${row.retro === null ? '' : ` ${cause}`} ended ${how}`)];
}

/** What a filed report says, linking its issue: `who` met it, the PRD by default, the mission for a stuck repair (./stuck.ts). */
export function reportEvent(row: RepairRow, report: BugReport | undefined, who = `PRD ${String(row.prd)}`): RepairEvent[] {
  if (report?.state !== 'filed') return [];
  const link = linkOf(`https://github.com/${report.repo}/issues/${String(report.issue)}`);
  return [{ kind: 'bug-reported', role: 'supervisor', prd: row.prd, job: row.job, link, sentence: `${who} met an Omni Loop bug [${short(row.fingerprint)}]: reported as #${String(report.issue)}.` }];
}

/** A repair event a repository PRD's run records (./supervisor.ts › eventsOf): its PRD a number, or none; a product PRD's is recorded apart. */
export const ofRepository = (event: RepairEvent): event is NewEvent => event.prd === null || !isProductPrdId(event.prd);

/** A stuck repair's event (./stuck.ts), the mission's own: a product PRD its cause sits in is named in its sentence, not its row. */
export const asMissionEvent = (event: RepairEvent): NewEvent => ({ ...event, prd: ofRepository(event) ? event.prd : null });

/** Every repair event a run may record, in order: each dispatch, then each PRD's row's retro, end and report (a stuck one's are ./stuck.ts's). */
export function repairEvents(view: RepairView, where: Where, sentAfter: SentAfter = () => null): RepairEvent[] {
  const own = view.rows.filter((row) => !isStuckRow(row));
  return [...view.jobs.map((job) => startedEvent(job, where)), ...own.flatMap((row) => [...rowEvents(row), ...reportEvent(row, view.reports.get(row.job ?? ''))]), ...bugFixedEvents(view, sentAfter)];
}

// ── The way back (PRD 3088) ─────────────────────────────────────────────────────

/** The job of the step a repair's PRD was sent after its failed one (./supervisor.ts reads it from the run's jobs); null when none was. */
export type SentAfter = (row: RepairRow) => string | null;

/** What the room is told of a bug that moved, once per bug: fixed in its version (and to update the kit when it must), or won't be fixed. */
function toldWords(view: RepairView, issue: IssueNumber, fix: Moved['fix']): string {
  if (fix.state === 'wont-fix') return `${wontFixWords(issue)}.`;
  const fixed = `Omni Loop bug #${String(issue)} is fixed in v${fix.version}.`;
  return view.held === true || runsFix(view.kit, fix.version) ? fixed : `${fixed} ${updateKitWords(fix.version)}.`;
}

/** A PRD's repair that stopped on an Omni Loop bug which was fixed or will not be: its row, with its job, and where the bug stands. */
type Moved = { row: RepairRow & { job: string }; issue: IssueNumber; repo: string; fix: Exclude<BugFix, { state: 'open' }> };

/** The repair as a bug that moved, when it is one: a PRD's omni-loop repair, its bug filed and fixed or not planned; else null. */
function movedOf(view: RepairView, row: RepairRow): Moved | null {
  const job = row.job;
  if (job === null || isStuckRow(row) || row.retro?.class !== 'omni-loop') return null;
  const filed = filedOf(view, row);
  return filed === null || filed.fix.state === 'open' ? null : { ...filed, row: { ...row, job }, fix: filed.fix };
}

/** The event saying a PRD went again on a kit that runs its bug's fix, keyed by that step's job; none before it was sent. */
function resumedEvent(view: RepairView, moved: Moved, sentAfter: SentAfter, said: (job: string, sentence: string) => RepairEvent): RepairEvent[] {
  if (moved.fix.state !== 'fixed' || view.held === true || !runsFix(view.kit, moved.fix.version)) return [];
  const job = sentAfter(moved.row);
  return job === null ? [] : [said(job, `PRD ${String(moved.row.prd)} resumed: the kit is at v${moved.fix.version}.`)];
}

/**
 * The `bug-fixed` events (PRD 3088): one per bug the mission's PRDs stopped on, once it is fixed or will not be, keyed by the first repair
 * that met it, linking the public issue; and, for each PRD sent its step again on a kit that runs the fix, one saying so, keyed by that
 * step's job. The issue, the version and the PRD only.
 */
function bugFixedEvents(view: RepairView, sentAfter: SentAfter): RepairEvent[] {
  const told = new Set<string>();
  return view.rows.flatMap((row) => {
    const moved = movedOf(view, row);
    if (moved === null) return [];
    const link = linkOf(`https://github.com/${moved.repo}/issues/${String(moved.issue)}`);
    const said = (job: string, sentence: string): RepairEvent => ({ kind: 'bug-fixed', role: 'supervisor', prd: row.prd, job, link, sentence });
    const first = told.has(row.fingerprint) ? [] : [said(moved.row.job, toldWords(view, moved.issue, moved.fix))];
    told.add(row.fingerprint);
    return [...first, ...resumedEvent(view, moved, sentAfter, said)];
  });
}

/** A repair row the missions to tell are read from: its mission, its job and the bug's fingerprint. */
export type HolderRow = { mission: string; job: string; fingerprint: string };

/**
 * The missions to tell that a bug moved (PRD 3088): each holding a PRD on a bug none of whose repairs of that bug has a `bug-fixed`
 * event yet (`told`, by repair job), in the order first met.
 */
export function untold(rows: readonly HolderRow[], told: ReadonlySet<string>): string[] {
  const heard = new Set(rows.filter((one) => told.has(one.job)).map((one) => `${one.mission} ${one.fingerprint}`));
  return [...new Set(rows.filter((one) => !heard.has(`${one.mission} ${one.fingerprint}`)).map((one) => one.mission))];
}
