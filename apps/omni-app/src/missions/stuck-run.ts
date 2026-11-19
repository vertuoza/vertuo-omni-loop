// What one run of a mission reads and writes of its stuck repairs (PRD 3065 s4), around ./stuck.ts's decisions: plain code over the
// mission's store (./store.ts) and, for a fix to land, the joins' GitHub reads and squash-merge (./join.ts), shared with a PRD's
// repair (./repair-run.ts). No model call.
//
//   keep      each stuck repair job that ended (done or failed, never cancelled) and has no row yet: its record line read from its
//             log (kit/lib/repair/line.ts, `"trigger":"stuck"`), then its row kept in this round, `trigger` stuck, inside the same
//             3 per cause and 9 per mission. A record that cannot be read is kept under the mission's unreadable fingerprint and
//             ends `not fixed`; over the budget no row is kept and the mission pauses by stuck. A `person` or `omni-loop` repair,
//             and a `code` one with no fix, end `stopped` at once
//   land      each `code` stuck repair not ended: its fix pull request squash-merged into the mission branch once green, never
//             into the default branch (N-PRODUCT-15). A fix that cannot land ends it `not fixed`
//   report    each `omni-loop` stuck repair of this round: its Omni Loop bug report, as a PRD's repair files it
//   settle    once a run's events are known: each `code` (landed) or `flake` stuck repair `fixed` once something moved after it,
//             `not fixed` once the mission was stuck again first
//   send      one stuck repair, `/omni:repair --mission <m> --stuck --jobs <j1>,…,<j5>`, each job by its first 8 characters so the
//             line stays within a runner's 200, keyed `…:stuck:<k>` and claimed first in line
import { isStuckRow, roundOf, type BugReport, type FixLanding, type Refused, type RepairRow, type StuckJob } from './repair.ts';
import { keepRow, land, recordOfJob, reportOne, spends, type RepairRunAt } from './repair-run.ts';
import type { MissionRecord, MissionRetros, MissionStore } from './store.ts';
import { beatsOf, NO_STUCK, pausedEvent, pausedWords, settleStuck, stuckEvents, stuckNext, stuckWords, unreadableStuck, type Beat, type StuckView } from './stuck.ts';
import { cut, recordedKeys, unrecorded, withWaits, type Concluded, type MissionStatus, type NewEvent, type RecordedEvent, type Run } from './supervisor.ts';

/** What a run reads its stuck repairs with: a PRD's repair's reads, its stuck store, and every repair row it read. */
export type StuckRunAt = RepairRunAt & { retros: MissionRetros; rows: readonly RepairRow[] };

/** A stuck repair's record: its log's last `omni repair:` line, read whole, naming this mission and the stuck trigger. */
const stuckRecord = (at: StuckRunAt, job: StuckJob) => recordOfJob(at, job.attempts, (record) => record.trigger === 'stuck');

/** The whole id of a job a stuck repair's line names by its first characters, from the mission's runs; null when none matches. */
function wholeOf(at: StuckRunAt, named: string | undefined): string | null {
  if (named === undefined || named.length === 0) return null;
  const ids = at.runs.flatMap((one) => one.attempts.map((attempt) => attempt.id));
  return ids.find((id) => id.startsWith(named)) ?? null;
}

/** A stuck repair job's row, kept in round `round` with its trigger, or the cap that refused it. Its failed job is the fifth it names. */
async function keepStuck(at: StuckRunAt, job: StuckJob, held: { round: number; rows: readonly RepairRow[] }): Promise<RepairRow | Refused> {
  const record = await stuckRecord(at, job);
  // The fifth job's whole id; the stuck repair's own when the runs hold it no more (the column takes a job's id, and keeps it).
  const failedJob = wholeOf(at, job.jobs.at(-1)) ?? job.job;
  return keepRow(at, { record, prd: record?.prd ?? null, failedJob, job: job.job, unreadable: unreadableStuck(), trigger: 'stuck' }, held);
}

/** Each code stuck repair's fix not ended yet, landed once green, by stuck job; a fix that cannot land ends its row `not fixed`. */
async function landStuck(at: StuckRunAt, rows: RepairRow[]): Promise<Map<string, FixLanding>> {
  const landings = new Map<string, FixLanding>();
  for (const [n, row] of rows.entries()) {
    if (row.job === null || row.outcome !== null || row.retro?.class !== 'code' || row.fixPr === null) continue;
    const landing = await land(at, row.fixPr, row.prd);
    landings.set(row.job, landing);
    if (landing.state !== 'refused') continue;
    await at.store.endRepair(row.id, 'not fixed');
    rows[n] = { ...row, outcome: 'not fixed' };
  }
  return landings;
}

/** Each omni-loop stuck repair of this round's report, by stuck job. */
async function reportStuck(at: StuckRunAt, rows: readonly RepairRow[], jobs: readonly StuckJob[], round: number): Promise<Map<string, BugReport>> {
  const reports = new Map<string, BugReport>();
  for (const row of rows) {
    const job = jobs.find((one) => one.job === row.job);
    if (job === undefined || row.round !== round || row.retro?.class !== 'omni-loop') continue;
    reports.set(job.job, await reportOne(at, { ...row, job: job.job }, () => stuckRecord(at, job)));
  }
  return reports;
}

/** What one run reads of the mission's stuck repairs: each one that ended kept, each code fix landed, each Omni Loop report sent. */
export async function readStuck(at: StuckRunAt): Promise<StuckView> {
  const round = roundOf(at.recorded);
  const jobs = at.budget === 0 ? [] : await at.retros.stucks(at.mission.id);
  if (jobs.length === 0) return { ...NO_STUCK, round, rows: at.rows.filter(isStuckRow) };
  const rows = [...at.rows];
  const refused = new Map<string, Refused>();
  for (const job of jobs) {
    if (!spends(job) || rows.some((row) => row.job === job.job)) continue;
    const kept = await keepStuck(at, job, { round, rows });
    if ('spent' in kept) refused.set(job.job, kept);
    else rows.push(kept);
  }
  const own = rows.filter(isStuckRow);
  const landings = await landStuck(at, own);
  const reports = await reportStuck(at, own, jobs, round);
  return { round, jobs, rows: own, refused, landings, reports };
}

/** The stuck view once the run's beats are known: each code (landed) or flake stuck repair settled, `fixed` or `not fixed`. */
async function settleAll(store: MissionStore, view: StuckView, beats: readonly Beat[]): Promise<StuckView> {
  const settled = settleStuck(view.rows, beats, view.landings);
  if (settled.size === 0) return view;
  for (const [id, outcome] of settled) await store.endRepair(id, outcome);
  return { ...view, rows: view.rows.map((row) => ({ ...row, outcome: settled.get(row.id) ?? row.outcome })) };
}

/**
 * What the stuck step works from, once a run's events are known: the mission as the run holds it (paused while a cap holds it), what
 * the run concluded, its runs (those it sent included), the events recorded and those it records, its stuck repairs, the repairs left,
 * where a job goes, and whether its PRDs could be built at all.
 */
export type StuckStep = {
  store: MissionStore;
  retros: MissionRetros;
  mission: MissionRecord;
  next: Concluded;
  runs: readonly Run[];
  recorded: readonly RecordedEvent[];
  events: readonly NewEvent[];
  stuck: StuckView;
  left: number;
  toFleet: boolean;
  where: string;
  sends: boolean;
};

/** What the step leaves the run: what it concludes now, the events it adds, and whether a stuck repair is at work. */
export type Stepped = { next: Concluded; events: NewEvent[]; running: boolean };

const moving = (status: MissionStatus): boolean => status === 'running' || status === 'waiting';

/** The run's conclusion with a stuck repair at work: running, saying so before what it waits on. */
const repairingNext = (next: Concluded, words: string): Concluded => ({ ...withWaits(next, [words]), status: 'running' });

/** The run's conclusion, paused by stuck: asked once, nothing new sent, waking only when a person resumes it. */
const pausedNext = (why: string): Concluded => ({ status: 'paused', waitingOn: cut(pausedWords(why)), nextWakeAt: null, pausedBy: 'stuck' });

/** The stuck step of a run: its stuck repairs settled, then one sent, one at work said, or the mission paused by stuck. */
export async function stuckStep(at: StuckStep): Promise<Stepped> {
  const timeline = [...at.recorded, ...at.events.map(({ kind, prd, job }) => ({ kind, prd, job }))];
  const beats = beatsOf(timeline, at.runs);
  let view = await settleAll(at.store, at.stuck, beats);
  const decided = at.sends && moving(at.mission.status) && moving(at.next.status) ? stuckNext(view, beats, at.left) : ({ next: 'none' } as const);
  let next = at.next;
  const pause: NewEvent[] = [];
  if (decided.next === 'send') {
    const job = await at.retros.stuck({ mission: at.mission, k: decided.k, jobs: decided.jobs, toFleet: at.toFleet });
    if (job !== null) view = { ...view, jobs: [...view.jobs, { k: decided.k, job, jobs: decided.jobs, attempts: [{ id: job, status: 'queued', outcome: null, reason: null, prUrl: null }] }] };
    next = repairingNext(next, stuckWords({ number: 1, left: Math.max(0, at.left - 1), why: null }));
  } else if (decided.next === 'repairing') next = repairingNext(next, stuckWords(decided));
  else if (decided.next === 'pause') {
    next = pausedNext(decided.why);
    pause.push(pausedEvent(decided.why));
  }
  const events = unrecorded([...stuckEvents(view, { where: at.where, mission: at.mission.number }), ...pause], recordedKeys(timeline));
  return { next, events, running: view.jobs.some((job) => !['done', 'failed', 'cancelled'].includes(job.attempts.at(-1)?.status ?? '')) };
}
