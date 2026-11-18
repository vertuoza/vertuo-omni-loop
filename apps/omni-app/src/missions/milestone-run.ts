// What one run of a mission reads and writes of its milestone retros (PRD 3065 s4), around ./milestone.ts's decisions: plain code
// over the mission's store (./store.ts). No model call, no GitHub.
//
//   record   each retro job that ended and has no row yet, once: its log's `omni retro:` line read by the kit
//            (kit/lib/mission/retro.ts › retroLine), naming this mission and the job's milestone, kept as its mission_retros row
//            (its file on the mission branch, none at `with-you` or for a path the database would refuse) and each change it
//            proposes as a mission_items row, always high. A job cancelled or failed, or a line that cannot be read, is a row saying
//            why it was skipped, read as not done (BL-GATE-1). Adopt applies nothing: no file of the knowledge or the playbook changes
//   send     the milestone `milestoneNext` names, under its key: a replay sends it once
//   skip     each milestone a delivered mission over a cap did not send: its row, `budget reached`
import type { PrdNumber } from 'omni-loop/kit/lib/ids.ts';
import { retroLine, type RetroRecord } from 'omni-loop/kit/lib/mission/retro.ts';
import { fileOf, itemRows, milestoneNext, retroEvents, sentEvent, type Held, type Milestone, type MilestoneNext, type MilestoneView, type RetroJob, type RetroRow } from './milestone.ts';
import type { MissionRecord, MissionRetros, MissionStore } from './store.ts';
import type { NewEvent } from './supervisor.ts';

/** What a run reads and writes its milestone retros with: the store, its retros, the mission, its branch, and where a retro goes. */
export type MilestoneAt = { store: MissionStore; retros: MissionRetros; mission: MissionRecord; branch: string | null; toFleet: boolean; where: string };

/** Why a retro job's milestone was skipped: `budget reached` when a cap held it back on a delivered mission. */
const BUDGET_REACHED = 'budget reached';

/** What a retro job's log says: its record, when it reads whole and names this mission and the job's milestone, or why not. */
function recordIn(log: string | null, mission: MissionRecord, milestone: Milestone): { record: RetroRecord } | { skipped: string } {
  const read = log === null ? null : retroLine(log);
  if (read?.readable !== true) return { skipped: 'its record line could not be read' };
  const fits = read.record.mission === mission.number && read.record.milestone === milestone;
  return fits ? { record: read.record } : { skipped: 'its record line names another mission or milestone' };
}

/** What a retro job that ended wrote: its record, or why none reads. */
async function readRecord(at: MilestoneAt, job: RetroJob): Promise<{ record: RetroRecord } | { skipped: string }> {
  const last = job.attempts.at(-1);
  if (last?.status === 'cancelled') return { skipped: 'its job was cancelled' };
  if (last?.status !== 'done') return { skipped: 'its job failed' };
  return recordIn(await at.store.committeeLog(last.id), at.mission, job.milestone);
}

/** A retro job's row and its items kept, once, and what they say; nothing when a row of its milestone was kept already. */
async function recordOne(at: MilestoneAt, job: RetroJob): Promise<{ row: RetroRow; events: NewEvent[] } | null> {
  const read = await readRecord(at, job);
  const where = { repo: at.mission.repo, branch: at.branch };
  const base = { milestone: job.milestone, job: job.job };
  if ('skipped' in read) {
    const id = await at.retros.keepRetro(at.mission, { ...base, skipped: read.skipped });
    return id === null ? null : { row: { id, ...base, skipped: read.skipped, file: null }, events: retroEvents({ ...base, file: null, skipped: read.skipped, targets: [] }, where) };
  }
  const file = fileOf(read.record.file);
  const id = await at.retros.keepRetro(at.mission, { ...base, retro: read.record.retro, file });
  if (id === null) return null;
  const items = itemRows(read.record);
  const kept = new Set(await at.retros.keepItems(at.mission, id, items));
  const targets = items.filter((item) => kept.has(item.number)).map((item) => item.target);
  return { row: { id, ...base, skipped: null, file }, events: retroEvents({ ...base, file, skipped: null, targets }, where) };
}

/** Whether a retro job ended. */
const ended = (job: RetroJob): boolean => ['done', 'failed', 'cancelled'].includes(job.attempts.at(-1)?.status ?? '');

/** What one run reads of the mission's milestones, each retro job that ended recorded once, and what that says. */
async function readMilestones(at: MilestoneAt): Promise<{ view: MilestoneView; events: NewEvent[] }> {
  const [roadmaps, read] = await Promise.all([at.retros.milestones(at.mission), at.retros.retros(at.mission.id)]);
  const rows = [...read.rows];
  const events: NewEvent[] = [];
  for (const job of read.jobs) {
    if (!ended(job) || rows.some((row) => row.milestone === job.milestone)) continue;
    const recorded = await recordOne(at, job);
    if (recorded === null) continue;
    rows.push(recorded.row);
    events.push(...recorded.events);
  }
  return { view: { roadmaps, jobs: read.jobs, rows }, events };
}

/** What a run does of `next`: its milestone sent, each skipped kept as skipped; the view as it stands then, and what that says. */
async function actOn(at: MilestoneAt, view: MilestoneView, next: MilestoneNext): Promise<{ view: MilestoneView; events: NewEvent[] }> {
  const events: NewEvent[] = [];
  const rows = [...view.rows];
  for (const milestone of next.skip) {
    const id = await at.retros.keepRetro(at.mission, { milestone, job: null, skipped: BUDGET_REACHED });
    if (id === null) continue;
    rows.push({ id, milestone, job: null, skipped: BUDGET_REACHED, file: null });
    events.push(...retroEvents({ milestone, job: null, file: null, skipped: BUDGET_REACHED, targets: [] }, { repo: at.mission.repo, branch: at.branch }));
  }
  const sent = next.send === null ? null : await sendOne(at, next.send);
  if (sent !== null) events.push(sentEvent(sent, { where: at.where, mission: at.mission.number }));
  return { view: { ...view, rows, jobs: sent === null ? view.jobs : [...view.jobs, sent] }, events };
}

/** A milestone's retro job queued under its key; null when its key was held already. */
async function sendOne(at: MilestoneAt, milestone: Milestone): Promise<RetroJob | null> {
  const job = await at.retros.retro({ mission: at.mission, milestone, toFleet: at.toFleet });
  return job === null ? null : { milestone, job, attempts: [{ id: job, status: 'queued', outcome: null, reason: null, prUrl: null }] };
}

/** Whether a milestone retro still works or waits to be recorded: the mission's job keeps watching it. */
const retroAtWork = (view: MilestoneView): boolean => view.jobs.some((job) => !view.rows.some((row) => row.milestone === job.milestone));

/**
 * What the milestone step works from, once a run concluded: where each PRD is, whether the mission is delivered, whether a token cap
 * holds it (`over`), and whether the run may send at all (the mission runs or waits, its branch ready).
 */
export type MilestoneStep = MilestoneAt & { done: (prd: PrdNumber) => boolean; delivered: boolean; over: boolean; sends: boolean };

/** The milestone step of a run: each retro that ended recorded, then one sent or skipped; whether one still works, to keep watching it. */
export async function milestoneStep(at: MilestoneStep): Promise<{ events: NewEvent[]; watching: boolean }> {
  const read = await readMilestones(at);
  const held: Held = at.over ? 'budget' : at.sends ? null : 'paused';
  const acted = await actOn(at, read.view, milestoneNext(read.view, { done: at.done, delivered: at.delivered, held }));
  return { events: [...read.events, ...acted.events], watching: retroAtWork(acted.view) };
}
