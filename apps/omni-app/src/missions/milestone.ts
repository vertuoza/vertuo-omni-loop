// A mission's milestone retros (PRD 3065 s4, spec sections 3, 5 and 6): the supervisor's milestone decisions, pure, over what one
// run read of the mission's scope, its retro jobs and the rows kept of them. No database, no GitHub, no clock: ./milestone-run.ts
// reads and writes, ./job.ts asks `milestoneNext` once a run knows where each PRD is.
//
//   a milestone   each roadmap of the scope once every PRD of it is merged or on the mission branch, then the mission once it is
//                 delivered: one `/omni:mission-retro --mission <m> --milestone <roadmap n | mission>` each, keyed so a replay sends
//                 it once, one at a time per mission (ADR-0034's one retro at a time)
//   the caps      over a token cap (PRD 3040) nothing is sent, a retro neither: it waits until the mission is under every cap. A
//                 delivered mission sends nothing more, so a retro a cap holds back then is skipped: `Retro skipped: budget reached`
//   its record    the skill's `omni retro:` line (kit/lib/mission/retro.ts) becomes a mission_retros row, its file on the mission
//                 branch (none at `with-you`), and one mission_items row per change it proposes, always high: what it would change,
//                 the wording, the evidence. A line that cannot be read is a row saying why it was skipped, never a retro
//   the events    `milestone-retro` for each retro recorded or skipped and `item-proposed` for each change, signed `supervisor`
//                 and `agent`: one sentence each, never a log, a credential or a person's words. A milestone retro never pauses
//                 anything and never sends a repair
import type { IssueNumber, PrdNumber } from 'omni-loop/kit/lib/ids.ts';
import type { RetroRecord } from 'omni-loop/kit/lib/mission/retro.ts';
import type { Attempt, NewEvent } from './supervisor.ts';

/** A milestone: a roadmap of the scope, by its number, or `mission`. */
export type Milestone = string;

/** A milestone retro: what went well and what to change, each sentence cited (kit/lib/mission/retro.ts › MissionRetroSchema). */
export type MissionRetro = RetroRecord['retro'];

/** The milestone of the mission delivered. */
const MISSION_MILESTONE = 'mission';

const KEY = /^mission:([0-9a-f-]{36}):retro:([1-9][0-9]*|mission)$/;

/** The key of a milestone's retro job: never sent twice. */
export const retroKey = (mission: string, milestone: Milestone): string => `mission:${mission}:retro:${milestone}`;

/** The milestone a retro job's key names; null for any other text. */
export const retroOfKey = (key: string): Milestone | null => KEY.exec(key)?.[2] ?? null;

/** The line a milestone retro is sent as: the mission by its number, and its milestone. */
export const retroSkillLine = (mission: number, milestone: Milestone): string => `/omni:mission-retro --mission ${String(mission)} --milestone ${milestone}`;

/** `roadmap #2790 delivered`, `mission delivered`: a milestone, as the room says it. */
export const milestoneWords = (milestone: Milestone): string => (milestone === MISSION_MILESTONE ? 'mission delivered' : `roadmap #${milestone} delivered`);

/** A roadmap of the mission's scope, with its PRDs. */
export type RoadmapScope = { roadmap: IssueNumber; prds: readonly PrdNumber[] };

/** A milestone retro job the mission sent: its milestone, and its attempts, the job's first. */
export type RetroJob = { milestone: Milestone; job: string; attempts: Attempt[] };

/** A milestone's retro the database kept (a mission_retros row): written, or skipped saying why. */
export type RetroRow = { id: string; milestone: Milestone; job: string | null; skipped: string | null; file: string | null };

/** What a run read of the mission's milestones: its scope's roadmaps, the retro jobs it sent, the rows kept. */
export type MilestoneView = { roadmaps: readonly RoadmapScope[]; jobs: readonly RetroJob[]; rows: readonly RetroRow[] };

/** What holds the retros back: a token cap reached (`budget`), the mission paused or not running (`paused`), or nothing. */
export type Held = 'budget' | 'paused' | null;

/** What a run does of the milestones: the one to send, those to skip (budget reached), and whether one is at work. */
export type MilestoneNext = { send: Milestone | null; skip: Milestone[]; atWork: boolean };

/** The milestones reached, in order: each roadmap whose PRDs are all done, then the mission once delivered. */
function reachedOf(roadmaps: readonly RoadmapScope[], done: (prd: PrdNumber) => boolean, delivered: boolean): Milestone[] {
  const roads = roadmaps.filter(({ prds }) => prds.length > 0 && prds.every(done)).map(({ roadmap }) => String(roadmap));
  return delivered ? [...roads, MISSION_MILESTONE] : roads;
}

/** Whether a retro job ended. */
const ended = (job: RetroJob): boolean => ['done', 'failed', 'cancelled'].includes(job.attempts.at(-1)?.status ?? '');

/**
 * What a run does of the milestones: `done` says whether a PRD is merged or on the mission branch, `delivered` whether the mission
 * is, `held` what holds the retros back. A delivered mission held by a cap skips what it did not send; none is sent while one works.
 */
export function milestoneNext(view: MilestoneView, { done, delivered, held }: { done: (prd: PrdNumber) => boolean; delivered: boolean; held: Held }): MilestoneNext {
  const kept = new Set(view.rows.map((row) => row.milestone));
  const sent = new Set(view.jobs.map((job) => job.milestone));
  const atWork = view.jobs.some((job) => !kept.has(job.milestone) && !ended(job));
  const pending = reachedOf(view.roadmaps, done, delivered).filter((milestone) => !kept.has(milestone) && !sent.has(milestone));
  if (held === 'budget' && delivered) return { send: null, skip: pending, atWork };
  if (held !== null || atWork) return { send: null, skip: [], atWork };
  return { send: pending[0] ?? null, skip: [], atWork };
}

// ── A retro's record, as rows ───────────────────────────────────────────────────

/** A path the database keeps (mission_retros.file): from the repository's root, plain names, ending `.md`, 300 characters at most. */
const FILE = /^[A-Za-z0-9_.-]+(\/[A-Za-z0-9_.-]+)*\.md$/;

/** A retro's file as the database keeps it; null when it names none, or one the database would refuse. */
export function fileOf(path: string | null): string | null {
  if (path === null || path.length > 300 || !FILE.test(path)) return null;
  return path.split('/').some((part) => part === '.' || part === '..') ? null : path;
}

/** What an item proposes to change, as the page and the room say it: `law BR-PRODUCT-12`, `the roadmap form: Prerequisites`. */
export function targetWords(target: RetroRecord['items'][number]['target']): string {
  if (target.kind === 'form') return `the ${target.form} form: ${target.section}`;
  return `${target.kind} ${target.id}`;
}

/** The most items one retro raises (mission_items.number), and the longest target the database keeps. */
const ITEMS_MAX = 20;
const TARGET_MAX = 200;
const EVIDENCE_MAX = 10;

/** An item to keep: its number, its target, its wording and its evidence's sentences. */
export type ItemRow = { number: number; target: string; wording: string; evidence: string[] };

/** Each change a retro proposes, as the rows the database keeps, numbered in order, 20 at most. */
export const itemRows = (record: RetroRecord): ItemRow[] =>
  record.items.slice(0, ITEMS_MAX).map((item, n) => ({
    number: n + 1,
    target: targetWords(item.target).slice(0, TARGET_MAX),
    wording: item.wording,
    evidence: item.evidence.slice(0, EVIDENCE_MAX).map((sentence) => sentence.text),
  }));

// ── The events ──────────────────────────────────────────────────────────────────

/** A retro recorded: its milestone, its job (none when skipped before one was sent), its file or why it was skipped, and its items' targets. */
export type Recorded = { milestone: Milestone; job: string | null; file: string | null; skipped: string | null; targets: readonly string[] };

/** A file on the mission branch, as a link; none at `with-you` or for a link too long to keep. */
function fileLink(file: string | null, { repo, branch }: { repo: string; branch: string | null }): string | null {
  if (file === null || branch === null) return null;
  const link = `https://github.com/${repo}/blob/${branch}/${file}`;
  return link.length <= 500 ? link : null;
}

/** What a retro recorded says, then each change it proposes. */
export function retroEvents(one: Recorded, at: { repo: string; branch: string | null }): NewEvent[] {
  const said = (kind: 'milestone-retro' | 'item-proposed', sentence: string, link: string | null = null): NewEvent => ({ kind, role: 'supervisor', prd: null, job: one.job, link, sentence });
  const words = milestoneWords(one.milestone);
  if (one.skipped !== null) return [said('milestone-retro', `Retro skipped: ${one.skipped} (${words}).`)];
  const retro = said('milestone-retro', `Retro: ${words}.`, fileLink(one.file, at));
  return [retro, ...one.targets.map((target) => said('item-proposed', `Proposes a change to ${target}.`))];
}

/** What a retro job's dispatch says. */
export const sentEvent = (job: RetroJob, { where, mission }: { where: string; mission: number }): NewEvent => ({
  kind: 'dispatched',
  role: 'supervisor',
  prd: null,
  job: job.job,
  link: null,
  sentence: `Sent ${retroSkillLine(mission, job.milestone)} to ${where} (${milestoneWords(job.milestone)}).`,
});
