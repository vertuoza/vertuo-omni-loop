// The steps' usual times the seat keeps (PRD omni-loop-34 s4, spec "2. The checks"): the median of a step's last 9
// durations, written to long-term memory in the one shape the silent-job check reads (`Baseline <skill>: <n> min`, item
// s2-04), only once 9 are seen and only when it moved.
import { describe, expect, it } from 'vitest';
import type { SeatJob } from './api.ts';
import { baselineNotes, durationBook, keptBaselines, learnDurations, stepOf } from './supervisor-baselines.ts';

const T0 = Date.parse('2026-11-25T08:00:00.000Z');
const at = (minutes: number): string => new Date(T0 + minutes * 60_000).toISOString();
const uuid = (n: number): string => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

/** A done job of `line` that ran `minutes`, ending `end` minutes after T0. */
const job = (n: number, line: string, minutes: number, end = n * 10, status = 'done'): SeatJob => ({
  id: uuid(n), line, status, runningAt: at(end - minutes), endedAt: at(end),
});

// The silent-job check's own reading of a note (apps/omni-app/src/supervisor/baselines.ts): the seat writes to it.
const CHECK_READS = /^Baseline ([a-z][a-z0-9-]*): (\d+(?:\.\d+)?) min\b/;

describe('the step of a job', () => {
  it('reads the skill as the silent-job check does', () => {
    expect(stepOf('/omni:wave 7')).toBe('wave');
    expect(stepOf('/omni:do-work 7 s2 --in-wave')).toBe('do-work');
    expect(stepOf('/qa-sweep')).toBe('qa-sweep');
    expect(stepOf('hello')).toBe('job');
  });
});

describe('the baselines the seat writes', () => {
  it('writes nothing with fewer than 9 durations of a step: the check keeps its 20 min default', () => {
    const book = durationBook();
    learnDurations(book, Array.from({ length: 8 }, (_, i) => job(i + 1, '/omni:wave 7', 2)));
    expect(baselineNotes(book, {})).toEqual([]);
  });

  it('writes the median of the last 9 done durations, in the shape the check reads, citing the jobs', () => {
    const book = durationBook();
    const minutes = [1, 2, 2, 2.5, 2.5, 3, 3, 4, 60];
    learnDurations(book, minutes.map((m, i) => job(i + 1, '/omni:wave 7', m)));
    const [note, ...rest] = baselineNotes(book, {});
    expect(rest).toEqual([]);
    expect(note?.line).toBe('Baseline wave: 2.5 min (median of the last 9)');
    expect(CHECK_READS.exec(note?.line ?? '')?.slice(1)).toEqual(['wave', '2.5']);
    expect(note?.cites).toHaveLength(9);
  });

  it('keeps only the last 9 by their end, counts a job once, and leaves out jobs that did not end done', () => {
    const book = durationBook();
    learnDurations(book, Array.from({ length: 9 }, (_, i) => job(i + 1, '/omni:wave 7', 30)));
    learnDurations(book, [...Array.from({ length: 9 }, (_, i) => job(i + 20, '/omni:wave 7', 3)), job(1, '/omni:wave 7', 30), job(40, '/omni:wave 7', 1, 400, 'failed')]);
    expect(baselineNotes(book, {}).map((note) => note.line)).toEqual(['Baseline wave: 3 min (median of the last 9)']);
  });

  it('writes again only when the usual time moved by a tenth or more', () => {
    const book = durationBook();
    learnDurations(book, Array.from({ length: 9 }, (_, i) => job(i + 1, '/omni:do-work 7 s1', 10)));
    expect(baselineNotes(book, { 'do-work': 10.5 })).toEqual([]);
    expect(baselineNotes(book, { 'do-work': 12 }).map((note) => note.line)).toEqual(['Baseline do-work: 10 min (median of the last 9)']);
  });

  it('reads the baselines already kept, the newest note of a step first', () => {
    expect(keptBaselines(['Baseline wave: 3 min (median of the last 9)', 'Watching atlas-01', 'Baseline wave: 9 min', 'Baseline qa: 1.5 min'])).toEqual({ wave: 3, qa: 1.5 });
  });
});
