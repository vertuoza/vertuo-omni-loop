// The steps' usual times the Supervisor's seat keeps (PRD omni-loop-34 s4, spec "2. The checks"): "the median of that
// step's last 9 durations on the workspace's runners, kept by the seat in long-term memory and sent to the check". Plain
// code, no model call, so it goes on past the token limit too.
//
// - A step is a job's skill, read as the silent-job check reads it (`/omni:wave 7` is `wave`,
//   apps/omni-app/src/supervisor/checks.ts `skillOf`).
// - A duration is a job that ended done: its end less its start. Each job counts once; a step keeps its last 9 by end.
// - A note is written once a step has 9 durations, and again only when its median moved by a tenth or more, so the
//   long-term memory (200 notes at most) is not filled with the same number. Its shape is the one the check reads
//   (`Baseline <skill>: <n> min`, decision s2-04), citing the jobs it was taken from.
// Pure: the seat (./supervisor.ts) reads the jobs from the snapshot and writes the notes through the API.
import type { SeatJob } from './api.ts';

/** How many durations a usual time is the median of. */
const BASELINE_OF = 9;
/** How far the median moves before a new note is written: a tenth of the one kept. */
const MOVED = 0.1;

/** A baseline note as the check reads it: `Baseline wave: 2.5 min`; the words after the minutes are free. */
const BASELINE = /^Baseline ([a-z][a-z0-9-]*): (\d+(?:\.\d+)?) min\b/;

/** A job's step: its skill, as the silent-job check reads it. */
export function stepOf(line: string): string {
  return /^\/(?:omni:)?([a-z][a-z0-9-]*)/.exec(line)?.[1] ?? 'job';
}

/** One duration: the job, when it ended, and how long it ran, in minutes. */
type Duration = { job: string; endedAt: number; minutes: number };

/** The durations seen, by step, kept across looks. */
export type DurationBook = Map<string, Duration[]>;

export const durationBook = (): DurationBook => new Map();

/** Adds the done jobs of a look to the book: each once, each step keeping its last 9 by end. */
export function learnDurations(book: DurationBook, jobs: readonly SeatJob[]): void {
  for (const job of jobs) {
    if (job.status !== 'done' || job.runningAt === null || job.endedAt === null) continue;
    const started = Date.parse(job.runningAt);
    const endedAt = Date.parse(job.endedAt);
    if (!Number.isFinite(started) || !Number.isFinite(endedAt) || endedAt <= started) continue;
    const step = stepOf(job.line);
    const kept = book.get(step) ?? [];
    if (kept.some((duration) => duration.job === job.id)) continue;
    const next = [...kept, { job: job.id, endedAt, minutes: (endedAt - started) / 60_000 }].sort((a, b) => a.endedAt - b.endedAt);
    book.set(step, next.slice(-BASELINE_OF));
  }
}

/** The median of some numbers (at least one). */
function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? (sorted[middle] ?? 0) : ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
}

/** Minutes to one decimal, never under a tenth. */
const rounded = (minutes: number): number => Math.max(0.1, Math.round(minutes * 10) / 10);

/** A note the seat writes: its line, and the jobs it cites. */
export type BaselineNote = { step: string; minutes: number; line: string; cites: string[] };

/** The notes to write now: each step with 9 durations whose median is new or moved by a tenth from the one `kept`. */
export function baselineNotes(book: DurationBook, kept: Readonly<Record<string, number>>): BaselineNote[] {
  return [...book].flatMap(([step, durations]) => {
    if (durations.length < BASELINE_OF) return [];
    const minutes = rounded(median(durations.map((duration) => duration.minutes)));
    const before = kept[step];
    if (before !== undefined && Math.abs(minutes - before) < before * MOVED) return [];
    return [{ step, minutes, line: `Baseline ${step}: ${String(minutes)} min (median of the last ${String(BASELINE_OF)})`, cites: durations.map((duration) => duration.job) }];
  });
}

/** The usual times already kept, by step, from long-term notes given newest first: the newest note of a step wins. */
export function keptBaselines(notesNewestFirst: readonly string[]): Record<string, number> {
  const kept: Record<string, number> = {};
  for (const note of notesNewestFirst) {
    const [, step, minutes] = BASELINE.exec(note) ?? [];
    if (step !== undefined && minutes !== undefined && !(step in kept)) kept[step] = Number(minutes);
  }
  return kept;
}
