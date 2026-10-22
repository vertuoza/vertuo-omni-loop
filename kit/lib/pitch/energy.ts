// A track's measure (PRD 2038): its length, the moments it rises and falls, and its energy in 2-second
// blocks, so the music's key moment is measured rather than assumed. The method of `release-videos`
// (`scripts/probe.ts`, `probeAudio`), PRD 1108's inspiration: the track decoded by ffmpeg into mono
// 16-bit samples at 8 kHz, the power of every 50 ms window in dB, a rise where the next second is at
// least 3 dB louder than the 4 seconds before it, the strongest within 8 seconds either side kept, and a
// fall the same, quieter. Pure but for `decodeTrack`, which runs ffmpeg through the exec it is given.
import type { Exec } from './providers/types.ts';

/** The rate the track is decoded at, in samples per second. */
export const SAMPLE_RATE = 8000;

const WINDOW_SECONDS = 0.05;
const WINDOWS_PER_SECOND = Math.round(1 / WINDOW_SECONDS);
const WINDOW = SAMPLE_RATE * WINDOW_SECONDS;
const AHEAD = 1 * WINDOWS_PER_SECOND;
const BEHIND = 4 * WINDOWS_PER_SECOND;
const SPACING = 8 * WINDOWS_PER_SECOND;
const BLOCK = 2 * WINDOWS_PER_SECOND;
const THRESHOLD_DB = 3;
/** The level of a silent window: a power floor, so silence is a number. */
const FLOOR_DB = -120;
const FULL_SCALE = 32768;
/** A decoded track of several minutes is a few megabytes: room for an hour's. */
const MAX_BUFFER = SAMPLE_RATE * 2 * 3600;

/** A moment of a track, `at` seconds into it, and its level in dB: a rise's gain, a fall's loss (below 0), a block's energy. */
export type Moment = { at: number; db: number };
/** A track measured: its length in seconds, its rises and falls in order, and its energy per 2-second block. */
export type Measure = { seconds: number; rises: Moment[]; falls: Moment[]; energy: Moment[] };

const seconds = (value: number): number => Math.round(value * 100) / 100;
/** A level to 0.1 dB, never -0. */
const decibels = (value: number): number => Math.round(value * 10) / 10 || 0;

/** The power of every whole 50 ms window, in dB of full scale. */
function powers(samples: Int16Array): number[] {
  const count = Math.floor(samples.length / WINDOW);
  const levels: number[] = [];
  for (let window = 0; window < count; window += 1) {
    let sum = 0;
    for (let n = window * WINDOW; n < (window + 1) * WINDOW; n += 1) {
      const sample = (samples[n] ?? 0) / FULL_SCALE;
      sum += sample * sample;
    }
    const power = sum / WINDOW;
    levels.push(power > 0 ? Math.max(FLOOR_DB, 10 * Math.log10(power)) : FLOOR_DB);
  }
  return levels;
}

/** The mean of `levels[from..to)`. */
function mean(levels: readonly number[], from: number, to: number): number {
  let sum = 0;
  for (let index = from; index < to; index += 1) sum += levels[index] ?? FLOOR_DB;
  return sum / (to - from);
}

/** How much louder the next second is than the 4 seconds before, at each window where both are whole. */
function changes(levels: readonly number[]): { window: number; db: number }[] {
  const found: { window: number; db: number }[] = [];
  for (let window = BEHIND; window + AHEAD <= levels.length; window += 1) {
    found.push({ window, db: mean(levels, window, window + AHEAD) - mean(levels, window - BEHIND, window) });
  }
  return found;
}

/** Whether `other` outranks `change` in the direction `sign`: stronger, or as strong and earlier. */
const outranks = (other: { window: number; db: number }, change: { window: number; db: number }, sign: 1 | -1): boolean =>
  sign * other.db > sign * change.db || (other.db === change.db && other.window < change.window);

/** The index of the first change at or after `window`, the changes being in order. */
function firstAt(changes: readonly { window: number }[], window: number): number {
  let low = 0;
  let high = changes.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if ((changes[middle]?.window ?? Infinity) < window) low = middle + 1;
    else high = middle;
  }
  return low;
}

/** The changes past 3 dB in the direction `sign`, each kept only when it is the strongest within 8 s either side (the earlier one on a tie). */
function strongest(all: readonly { window: number; db: number }[], sign: 1 | -1): Moment[] {
  const candidates = all.filter(({ db }) => sign * db >= THRESHOLD_DB);
  const kept = candidates.filter((change) => {
    const near = candidates.slice(firstAt(candidates, change.window - SPACING), firstAt(candidates, change.window + SPACING + 1));
    return !near.some((other) => outranks(other, change, sign));
  });
  return kept.map(({ window, db }) => ({ at: seconds(window / WINDOWS_PER_SECOND), db: decibels(db) }));
}

/** The energy of each 2-second block, the last one shorter when the track does not end on a block. */
function blocks(levels: readonly number[]): Moment[] {
  const energy: Moment[] = [];
  for (let start = 0; start < levels.length; start += BLOCK) {
    energy.push({ at: seconds(start / WINDOWS_PER_SECOND), db: decibels(mean(levels, start, Math.min(start + BLOCK, levels.length))) });
  }
  return energy;
}

/** A track's measure from its samples: mono, 16-bit, at 8 kHz. */
export function measure(samples: Int16Array): Measure {
  const levels = powers(samples);
  const all = changes(levels);
  return { seconds: seconds(samples.length / SAMPLE_RATE), rises: strongest(all, 1), falls: strongest(all, -1), energy: blocks(levels) };
}

/** What an exec's failure says: ffmpeg's stderr, else the error's message. */
function reasonOf(error: unknown): string {
  const stderr = (error as { stderr?: unknown } | null)?.stderr;
  const text = typeof stderr === 'string' ? stderr : Buffer.isBuffer(stderr) ? stderr.toString('utf8') : '';
  return text.trim() || (error instanceof Error ? error.message : String(error));
}

/** The track at `file` decoded by ffmpeg, run through `exec`, into mono 16-bit samples at 8 kHz. */
export function decodeTrack(file: string, exec: Exec): Int16Array {
  let output: string | Buffer;
  try {
    output = exec('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-i', file, '-ac', '1', '-ar', String(SAMPLE_RATE), '-f', 's16le', '-acodec', 'pcm_s16le', '-'], {
      encoding: 'buffer',
      maxBuffer: MAX_BUFFER,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (error) {
    if ((error as { code?: unknown } | null)?.code === 'ENOENT') throw new Error(`ffmpeg is not installed: it decodes the track to measure it (${reasonOf(error)})`, { cause: error });
    throw new Error(`ffmpeg could not decode ${file}: ${reasonOf(error)}`, { cause: error });
  }
  const bytes = typeof output === 'string' ? Buffer.from(output, 'binary') : output;
  const samples = new Int16Array(Math.floor(bytes.length / 2));
  for (let index = 0; index < samples.length; index += 1) samples[index] = bytes.readInt16LE(index * 2);
  return samples;
}

/** The track at `file`, decoded through `exec` and measured. */
export const measureTrack = (file: string, exec: Exec): Measure => measure(decodeTrack(file, exec));
