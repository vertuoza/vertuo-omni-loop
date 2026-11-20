// The `commander-notebook` job (PRD 3107 s4, spec "Long-term memory: two notebooks", AC-6, AC-7, AC-15): a schedule of the
// ledger (../jobs/schedule.ts), once a day, 3 tries, around ./notebook.ts's rules. Each run, for the day before its slot (UTC):
//
//   mission lines   each running, waiting or paused mission of a Virtual Fleet whose mission notebook holds no batch of that
//                   day and that had events that day: one batch of at most 5 lines from them
//   fleet lines     each mission delivered or stopped in the last 3 days whose fleet notebook holds no batch of it: one batch
//                   of at most 5 lines from its last 100 events and its mission notebook
//   the caps        a fleet that used up its daily tokens (fleet_tokens_24h(), teams.daily_tokens) is left for the next run
//   the model       the App's own OpenRouter key (BR-PRODUCT-59): none, and the run is skipped. The model's answer is screened
//                   (./notebook.ts › screenLines): what is left is written, citing its events; nothing left, nothing written
//   at most         6 batches a run: then it asks to run again in a minute, with the missions it read as its progress, so a
//                   mission it read is never asked twice in a slot, and the next run carries on
//
// A batch is written once (the database's unique batch index): a replay writes nothing twice. The payload holds the slot only,
// the progress mission ids only: never a token, a line or a person's words, and no line is logged (L-GDPR-2).
import { askModel, type OpenRouterSettings } from 'omni-loop/kit/lib/openrouter.ts';
import { noteTo } from '../run-log/run-log.ts';
import type { JobHandler, JobResult } from '../jobs/worker.ts';
import {
  BATCH_MAX, dayOf, NOTEBOOK_MODEL, NOTEBOOK_REPLY_SCHEMA, NOTEBOOK_SYSTEM, NotebookReplySchema, notebookPrompt, screenLines, yesterdayOf,
  type Candidate, type Notebook, type NoteEvent, type NoteLine, type NoteMission,
} from './notebook.ts';

/** The most batches one run asks the model for, before it asks to run again. */
export const BATCHES_PER_RUN = 6;
/** How long after its end a mission's fleet lines are still written. */
const ENDED_WITHIN_MS = 3 * 24 * 60 * 60 * 1000;
/** The most events a fleet batch reads, and the most lines of a notebook a batch is shown. */
const EVENTS_READ = 100;
const LINES_SHOWN = 50;
/** How long a run that read its quota waits before the next. */
const AGAIN_MS = 60_000;
/** The most missions a run's progress keeps. */
const PROGRESS_MAX = 300;

/** A line to write, as the database keeps it. */
export type NoteRow = { workspace: string; fleet: string; notebook: Notebook; mission: string; day: string; place: number; line: string; events: string[] };

/** What the job reads and writes, as the service role. */
export type NotebookStore = {
  /** The missions of Virtual Fleets that run, wait or are paused. */
  active(): Promise<NoteMission[]>;
  /** The missions of Virtual Fleets delivered or stopped since `since`. */
  ended(since: string): Promise<NoteMission[]>;
  /** One mission's events, oldest first: those in [`from`, `to`) when given, the last `limit` of them. */
  events(mission: string, range: { from: string | null; to: string | null; limit: number }): Promise<NoteEvent[]>;
  /** The lines a notebook holds that are not deleted, newest first, at most `limit`: a mission's, or its fleet's. */
  lines(of: { notebook: 'mission'; mission: string } | { notebook: 'fleet'; workspace: string; fleet: string }, limit: number): Promise<string[]>;
  /** Whether a batch was written: a mission's day, or a mission's end (any day). */
  written(batch: { notebook: Notebook; mission: string; day: string | null }): Promise<boolean>;
  /** Whether the fleet used up its daily tokens at `at`. */
  over(workspace: string, fleet: string, at: Date): Promise<boolean>;
  /** Writes a batch whole; the lines written, 0 when its batch was written already. */
  write(rows: readonly NoteRow[]): Promise<number>;
};

/** What the model answers a batch: its candidate lines, or why there are none. */
export type NotebookModel = (prompt: { user: string }) => Promise<{ ok: true; lines: Candidate[] } | { ok: false; why: string }>;

/** The notebook's model on the App's own OpenRouter key (BR-PRODUCT-59), its reply checked against its shape; null with no key. */
export function liveNotebookModel(openrouter: OpenRouterSettings | null, fetch: typeof globalThis.fetch = globalThis.fetch): NotebookModel | null {
  if (!openrouter?.key) return null;
  return async ({ user }) => {
    const answer = await askModel({
      system: NOTEBOOK_SYSTEM, user, check: NotebookReplySchema, schema: NOTEBOOK_REPLY_SCHEMA,
      openrouter: { key: openrouter.key, model: NOTEBOOK_MODEL }, fetch, title: 'omni loop notebook',
    });
    const read = NotebookReplySchema.safeParse(answer.reply);
    return answer.ok && read.success ? { ok: true, lines: read.data.lines } : { ok: false, why: answer.reason ?? 'its reply did not fit the shape asked for' };
  };
}

/** A batch to ask for: whose notebook, which mission, which day, and its events' range. */
type Batch = { notebook: Notebook; mission: NoteMission; day: string; from: string | null; to: string | null };

/** What one run did, counted: the batches written and their lines, those that wrote nothing, and the lines dropped. */
type NotebookSummary = { batches: number; lines: number; empty: number; dropped: number };

/** The batches due at `now`, missions in a steady order: each running mission's yesterday, then each mission that ended. */
async function batchesDue(store: NotebookStore, now: Date): Promise<Batch[]> {
  const yesterday = yesterdayOf(now);
  const [active, ended] = await Promise.all([store.active(), store.ended(new Date(now.getTime() - ENDED_WITHIN_MS).toISOString())]);
  const byId = (a: NoteMission, b: NoteMission) => a.id.localeCompare(b.id);
  return [
    ...[...active].sort(byId).map((mission): Batch => ({ notebook: 'mission', mission, day: yesterday.day, from: yesterday.from, to: yesterday.to })),
    ...[...ended].sort(byId).map((mission): Batch => ({ notebook: 'fleet', mission, day: dayOf(now), from: null, to: null })),
  ];
}

/** The rows of a batch's lines. */
const rowsOf = (batch: Batch, lines: readonly NoteLine[]): NoteRow[] =>
  lines.map((line, n) => ({ workspace: batch.mission.workspace, fleet: batch.mission.fleet, notebook: batch.notebook, mission: batch.mission.id, day: batch.day, place: n + 1, line: line.line, events: line.events }));

/** What one batch did: asked nothing (written already, no event, over the cap), or the lines it wrote and dropped. */
type Done = { asked: false } | { asked: true; written: number; dropped: number };

/** One batch: read, asked, screened and written, once. */
async function runBatch(store: NotebookStore, model: NotebookModel, batch: Batch, at: Date): Promise<Done> {
  const { mission, notebook } = batch;
  if (await store.written({ notebook, mission: mission.id, day: notebook === 'mission' ? batch.day : null })) return { asked: false };
  const events = await store.events(mission.id, { from: batch.from, to: batch.to, limit: EVENTS_READ });
  if (events.length === 0 || (await store.over(mission.workspace, mission.fleet, at))) return { asked: false };
  const missionLines = await store.lines({ notebook: 'mission', mission: mission.id }, LINES_SHOWN);
  const kept = notebook === 'mission' ? missionLines : await store.lines({ notebook: 'fleet', workspace: mission.workspace, fleet: mission.fleet }, LINES_SHOWN);
  const prompt = notebookPrompt({ notebook, mission, day: batch.day, events, kept, ...(notebook === 'fleet' ? { learned: missionLines } : {}) });
  const answer = await model({ user: prompt.user });
  if (!answer.ok) throw new Error(`the notebook's model gave no answer: ${answer.why}`);
  const screened = screenLines({ candidates: answer.lines, refs: prompt.refs, kept, max: BATCH_MAX });
  const dropped = Object.values(screened.dropped).reduce((sum, n) => sum + n, 0);
  return { asked: true, written: screened.lines.length === 0 ? 0 : await store.write(rowsOf(batch, screened.lines)), dropped };
}

/** The missions an earlier run of this slot read, from its progress. */
function readBefore(progress: Record<string, unknown> | undefined): Set<string> {
  const read = progress?.read;
  return new Set(Array.isArray(read) ? read.filter((id): id is string => typeof id === 'string') : []);
}

/** The slot a job runs for, from its payload: its start; `clock()` when it carries none. */
function slotOf(payload: Record<string, unknown>, clock: () => number): Date {
  const slot = typeof payload.slot === 'string' ? Date.parse(payload.slot) : Number.NaN;
  return new Date(Number.isNaN(slot) ? clock() : slot);
}

/** The handler of the `commander-notebook` kind: `store` is the database, `model` the notebook's model or null with no key. */
export function notebookHandler({
  store,
  model,
  clock = Date.now,
  log = noteTo('commander-notebook'),
}: {
  store: NotebookStore;
  model: NotebookModel | null;
  clock?: () => number;
  log?: (line: string) => void;
}): JobHandler {
  return async (job): Promise<JobResult> => {
    if (model === null) return { outcome: 'skipped', reason: 'no model key: the notebooks write nothing' };
    const now = slotOf(job.payload, clock);
    const read = readBefore(job.progress);
    const summary: NotebookSummary = { batches: 0, lines: 0, empty: 0, dropped: 0 };
    let asked = 0;
    for (const batch of await batchesDue(store, now)) {
      const key = `${batch.notebook}:${batch.mission.id}`;
      if (read.has(key)) continue;
      if (asked >= BATCHES_PER_RUN) {
        log(`commander notebook: ${String(summary.batches)} batches, ${String(summary.lines)} lines, ${String(summary.empty)} empty, ${String(summary.dropped)} dropped; more to read`);
        return { outcome: 'later', at: new Date(clock() + AGAIN_MS), progress: { read: [...read].slice(-PROGRESS_MAX) } };
      }
      const done = await runBatch(store, model, batch, new Date(clock()));
      read.add(key);
      if (!done.asked) continue;
      asked += 1;
      summary.dropped += done.dropped;
      if (done.written > 0) {
        summary.batches += 1;
        summary.lines += done.written;
      } else summary.empty += 1;
    }
    log(`commander notebook: ${String(summary.batches)} batches, ${String(summary.lines)} lines, ${String(summary.empty)} empty, ${String(summary.dropped)} dropped`);
    return { outcome: 'done' };
  };
}
