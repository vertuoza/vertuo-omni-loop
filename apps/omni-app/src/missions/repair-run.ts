// What one run of a mission reads and writes of its repairs (PRD 2980 s5), before ./supervisor.ts decides: plain code over the
// mission's store (./store.ts) and, for a fix to land, the joins' GitHub reads and squash-merge (./join.ts). No model call.
//
//   keep      each repair job that ended (done or failed, never cancelled) and has no row yet: its record line read from its log
//             (kit/lib/repair/line.ts; the fingerprint computed again from its retro), then its row kept in this round. A record
//             that cannot be read, or one naming another mission or PRD, is kept under the PRD's unreadable fingerprint and ends
//             `not fixed`: it spends one. Over the budget (the cause's 3 in the round, the mission's 9) no row is kept: the PRD
//             stops on it, and a later round tries again. A `person` or `omni-loop` repair, and a `code` one with no fix, end
//             `stopped` at once
//   land      each `code` repair whose step was not sent again yet: its fix pull request read and, once green, squash-merged
//             into the mission branch (./repair.ts › judgeFix), never into the default branch (N-PRODUCT-15)
//   settle    each `code` or `flake` repair whose step was sent again and ended: `fixed` when that step went on, `not fixed`
//             when it failed again (its failure is a new retro)
//   report    each `omni-loop` repair of this round: the Omni Loop bug its fingerprint was filed as, else its report scrubbed with
//             the workspace's names and added to the ledger once per repair (../bug-reports/job.ts); a report the scrub
//             refuses is never sent, and says why on the workspace's own pages only (never#5, never#11, never#12)
import type { PrNumber } from 'omni-loop/kit/lib/ids.ts';
import { PrNumberSchema } from 'omni-loop/kit/lib/ids.ts';
import { repairLine as readRepairLine, type RepairRecord } from 'omni-loop/kit/lib/repair/line.ts';
import { submitBugReport } from '../bug-reports/job.ts';
import type { MissionJoins } from './join.ts';
import {
  CAUSE_REPAIRS,
  judgeFix,
  NO_REPAIRS,
  roundOf,
  unreadableFingerprint,
  type BugReport,
  type FixLanding,
  type Refused,
  type RepairJob,
  type RepairOutcome,
  type RepairRow,
  type RepairView,
} from './repair.ts';
import type { MissionRecord, MissionStore } from './store.ts';
import { after, endOf, outcome, type RecordedEvent, type Run } from './supervisor.ts';

/** What a run reads its repairs with. */
export type RepairRunAt = {
  store: MissionStore;
  mission: MissionRecord;
  runs: readonly Run[];
  recorded: readonly RecordedEvent[];
  /** The mission branch a fix lands on; null at `with-you` or in a plan repository. */
  branch: string | null;
  installation: number | null;
  joins: MissionJoins | null;
  /** The mission's repairs: MISSION_REPAIRS, or 0 when repairs are off. */
  budget: number;
};

/** Whether a repair job ended in a way that spends: done or failed. A cancelled one spends nothing; a lost one is carried by its resume. */
const spends = (job: RepairJob): boolean => {
  const status = job.attempts.at(-1)?.status;
  return status === 'done' || status === 'failed';
};

/** The record a repair job's log ends on, when it reads whole and names this mission and PRD; null otherwise. */
function recordOf(log: string | null, mission: MissionRecord, prd: number): RepairRecord | null {
  if (log === null) return null;
  const read = readRepairLine(log);
  return read.readable && read.record.mission === mission.number && read.record.prd === prd ? read.record : null;
}

/** The outcome a kept row ends on at once: `not fixed` when unread, `stopped` for a person, an Omni Loop bug or a code repair with no fix. */
function endsAt(row: RepairRow): RepairOutcome | null {
  if (row.retro === null) return 'not fixed';
  if (row.retro.class === 'person' || row.retro.class === 'omni-loop') return 'stopped';
  return row.retro.class === 'code' && row.fixPr === null ? 'stopped' : null;
}

/** The record a repair job's last attempt ended on: read from its log when it is done, none when it failed. */
async function jobRecord(at: RepairRunAt, job: RepairJob): Promise<RepairRecord | null> {
  const last = job.attempts.at(-1);
  return last?.status === 'done' ? recordOf(await at.store.committeeLog(last.id), at.mission, job.prd) : null;
}

/** The cap a new repair of `fingerprint` would pass in round `round`: the mission's, the cause's, or none. */
function overBudget(rows: readonly RepairRow[], { budget, round, fingerprint }: { budget: number; round: number; fingerprint: string }): Refused['spent'] | null {
  const counted = rows.filter((row) => row.outcome !== 'lost');
  if (counted.length >= budget) return 'mission';
  return counted.filter((row) => row.round === round && row.fingerprint === fingerprint).length >= CAUSE_REPAIRS ? 'cause' : null;
}

/** The fix a code record names, as its link on the mission's repository; null when it names none. */
const fixUrlOf = (at: RepairRunAt, record: RepairRecord | null): string | null => (record?.fix == null ? null : `https://github.com/${at.mission.repo}/pull/${String(record.fix)}`);

/** A kept row, ended at once when its class says so (./repair.ts: a person, an Omni Loop bug, a code repair with no fix, an unread record). */
async function endedAtOnce(at: RepairRunAt, kept: RepairRow): Promise<RepairRow> {
  const ends = endsAt(kept);
  if (ends === null) return kept;
  await at.store.endRepair(kept.id, ends);
  return { ...kept, outcome: ends };
}

/** A repair job's row, kept in round `round`, or the cap that refused it. */
async function keep(at: RepairRunAt, job: RepairJob, { round, rows }: { round: number; rows: readonly RepairRow[] }): Promise<RepairRow | Refused> {
  const record = await jobRecord(at, job);
  const fingerprint = record?.fingerprint ?? unreadableFingerprint(job.prd);
  const retro = record?.retro ?? null;
  const spent = overBudget(rows, { budget: at.budget, round, fingerprint });
  if (spent !== null) return { spent, fingerprint, retro };
  const kept = await at.store.keepRepair(at.mission, { prd: job.prd, fingerprint, round, failedJob: job.failedJob, job: job.job, retro, fixPr: fixUrlOf(at, record) });
  return 'spent' in kept ? { spent: kept.spent, fingerprint, retro } : endedAtOnce(at, kept);
}

/** The run of the PRD a repair's failed job belongs to; undefined when the mission sent none. */
const failedRunOf = (runs: readonly Run[], row: RepairRow): Run | undefined => runs.find((one) => one.prd === row.prd && one.attempts.some((attempt) => attempt.id === row.failedJob));

/** The first run of the PRD sent after its failed one: the step sent again once the repair allowed it; null when none was. */
function stepAfter(runs: readonly Run[], row: RepairRow): Run | null {
  const failed = failedRunOf(runs, row);
  if (failed === undefined) return null;
  const later = runs.filter((one) => one.prd === row.prd && after(one, failed));
  return later.reduce<Run | null>((first, one) => (first === null || after(first, one) ? one : first), null);
}

/** The pull request a fix's link names. */
const prOf = (url: string): PrNumber | null => {
  const parsed = PrNumberSchema.safeParse(Number(/\/pull\/(\d+)$/.exec(url)?.[1]));
  return parsed.success ? parsed.data : null;
};

/** A code repair's fix, on its way to the mission branch: read, judged, and squash-merged once green. */
async function land(at: RepairRunAt, fixPr: string, prd: RepairRow['prd']): Promise<FixLanding> {
  const pr = prOf(fixPr);
  if (at.branch === null) return { state: 'refused', why: 'the mission has no branch of its own to land it on' };
  if (pr === null) return { state: 'refused', why: 'its link names no pull request' };
  if (at.joins === null || at.installation === null) return { state: 'waits', lacks: ['the app has no GitHub access here'] };
  const where = { installation: at.installation, repo: at.mission.repo, prd, pr };
  const pull = await at.joins.read(where);
  const judged = judgeFix(pull, at.branch);
  if (judged.state !== 'merge') return judged;
  const merged = await at.joins.merge({ ...where, head: pull.head, title: pull.title, base: pull.base, defaultBranch: pull.defaultBranch });
  return merged.ok ? { state: 'landed' } : { state: 'refused', why: merged.why };
}

/** Each code repair's fix whose step was not sent again yet, by repair job. */
async function landAll(at: RepairRunAt, rows: readonly RepairRow[]): Promise<Map<string, FixLanding>> {
  const landings = new Map<string, FixLanding>();
  for (const row of rows) {
    if (row.job === null || row.outcome !== null || row.retro?.class !== 'code' || row.fixPr === null || stepAfter(at.runs, row) !== null) continue;
    landings.set(row.job, await land(at, row.fixPr, row.prd));
  }
  return landings;
}

/** How a repair ended once its step was sent again: fixed when the step went on, not fixed when it failed again; null while unknown. */
function settledOf(runs: readonly Run[], row: RepairRow): RepairOutcome | null {
  const next = stepAfter(runs, row);
  const last = next?.attempts.at(-1);
  const end = last === undefined ? null : endOf(last);
  if (next === null || last === undefined || end === null || end === 'cancelled') return null;
  return outcome(end, next.run, last.reason, next.step).next === 'stops' ? 'not fixed' : 'fixed';
}

/** Each code or flake repair whose step was sent again and ended, its outcome set once. */
async function settleAll(at: RepairRunAt, rows: RepairRow[]): Promise<void> {
  for (const [n, row] of rows.entries()) {
    if (row.outcome !== null || (row.retro?.class !== 'code' && row.retro?.class !== 'flake')) continue;
    const settled = settledOf(at.runs, row);
    if (settled === null) continue;
    await at.store.endRepair(row.id, settled);
    rows[n] = { ...row, outcome: settled };
  }
}

/** One omni-loop repair's report: the bug its fingerprint was filed as, else its report scrubbed again and submitted once, or why none was sent. */
async function reportOne(at: RepairRunAt, row: RepairRow & { job: string }, job: RepairJob | undefined): Promise<BugReport> {
  const filed = await at.store.bugIssue(row.fingerprint);
  if (filed !== null) return { state: 'filed', ...filed };
  const report = job === undefined ? null : ((await jobRecord(at, job))?.report ?? null);
  if (report === null) return { state: 'refused', why: 'its repair could not make one it could prove clean' };
  const known = await at.store.names(at.mission);
  const input = { kitVersion: report.kitVersion, command: report.command, class: report.class, message: report.message, fingerprint: row.fingerprint, known };
  const submitted = await submitBugReport({ input, attempt: row.job, add: at.store.addJob });
  return submitted.ok ? { state: 'filing' } : { state: 'refused', why: submitted.reason };
}

/** Each omni-loop repair of this round's report, by repair job. */
async function reportAll(at: RepairRunAt, rows: readonly RepairRow[], jobs: readonly RepairJob[], round: number): Promise<Map<string, BugReport>> {
  const reports = new Map<string, BugReport>();
  for (const row of rows) {
    const id = row.job;
    if (id === null || row.round !== round || row.retro?.class !== 'omni-loop') continue;
    reports.set(id, await reportOne(at, { ...row, job: id }, jobs.find((one) => one.job === id)));
  }
  return reports;
}

/** What one run reads of the mission's repairs, each ended repair kept, each fix landed, each step's end settled, each report sent. */
export async function readRepairs(at: RepairRunAt): Promise<RepairView> {
  if (at.budget === 0) return NO_REPAIRS;
  const round = roundOf(at.recorded);
  const read = await at.store.repairs(at.mission.id);
  const rows = [...read.rows];
  const refused = new Map<string, Refused>();
  for (const job of read.jobs) {
    if (!spends(job) || rows.some((row) => row.job === job.job)) continue;
    const kept = await keep(at, job, { round, rows });
    if ('spent' in kept) refused.set(job.job, kept);
    else rows.push(kept);
  }
  const landings = await landAll(at, rows);
  await settleAll(at, rows);
  const reports = await reportAll(at, rows, read.jobs, round);
  return { budget: at.budget, round, jobs: read.jobs, rows, refused, landings, reports };
}
