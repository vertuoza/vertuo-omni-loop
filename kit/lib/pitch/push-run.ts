// A pitch run's folder, as `/omni:pitch` leaves it (PRD 859's spec, "The run"): `pitch.json` and the five
// files every pitch holds. `readPitchRun()` reads it and refuses, before anything is sent, everything the
// app's two calls would refuse: a PRD other than the one named, an audience other than customers or
// inside, a look other than arcade or keynote, a commit that is not a hash, empty or long words, a file
// of the five missing (400), and a file over 50 MB (413).
//
// pitch.json: { prd, audience, look, commit, hook, benefit, kicker, closing, files }. `files` is what the
// run wrote, for the person; the push sends the five by their fixed names.
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { isOneOf, keysOf } from '../narrow.ts';
import type { PrdNumber } from '../ids.ts';

export const PITCH_RUN_FILE = 'pitch.json';
/** The largest file the app's bucket takes. */
const PITCH_FILE_MAX_BYTES = 50 * 1024 * 1024;
/** The five files of every pitch, by name, and the type each is sent as. */
const PITCH_FILES = Object.freeze({
  'slide.png': 'image/png',
  'slide-square.png': 'image/png',
  'pitch.mp4': 'video/mp4',
  'pitch-square.mp4': 'video/mp4',
  'pitch.gif': 'image/gif',
});
const AUDIENCES = Object.freeze(['customers', 'inside'] as const);
const LOOKS = Object.freeze(['arcade', 'keynote'] as const);
/** The longest each of a pitch's words may be, as the app's table says. */
const WORD_MAX: Readonly<Record<keyof PitchWords, number>> = Object.freeze({ hook: 200, benefit: 400, kicker: 100, closing: 300 });
const COMMIT = /^[0-9a-f]{7,64}$/;

/** A pitch's words, trimmed. */
export type PitchWords = { hook: string; benefit: string; kicker: string; closing: string };
/** One file of the five, ready to upload. */
export type PitchFile = { name: string; path: string; bytes: number; type: string };
/** A run read from its folder, ready to send. */
export type PitchRun = PitchWords & {
  audience: (typeof AUDIENCES)[number];
  look: (typeof LOOKS)[number];
  commit: string;
  files: PitchFile[];
};

/** What the app would refuse, found before anything is sent: `status` is the one it would answer. */
export class PitchRunRefused extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'PitchRunRefused';
    this.status = status;
  }
}

const refuse = (message: string, status = 400): never => {
  throw new PitchRunRefused(status, message);
};
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

/** A value sent, as `String()` prints it. */
const shown = (value: unknown): string => String(value);

/** The JSON `text` holds, or null when it is not JSON. */
function parsedOrNull(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** The file `name` of the folder, with its size and type, or the refusal. */
function fileOf(dir: string, name: keyof typeof PITCH_FILES): PitchFile {
  const path = join(dir, name);
  if (!existsSync(path) || !statSync(path).isFile()) refuse(`${name}: not in the run folder`);
  const { size } = statSync(path);
  if (size > PITCH_FILE_MAX_BYTES) refuse(`${name}: over ${PITCH_FILE_MAX_BYTES / 1024 / 1024} MB`, 413);
  return { name, path, bytes: size, type: PITCH_FILES[name] };
}

/** The pitch's words, trimmed, or the refusal. */
function wordsOf(sent: Record<string, unknown>): PitchWords {
  const word = (key: keyof PitchWords): string => {
    const value = sent[key];
    const max = WORD_MAX[key];
    if (typeof value !== 'string' || !value.trim() || value.trim().length > max) return refuse(`${PITCH_RUN_FILE}: ${key} is 1 to ${max} characters`);
    return value.trim();
  };
  return { hook: word('hook'), benefit: word('benefit'), kicker: word('kicker'), closing: word('closing') };
}

/**
 * The run in `dir`, ready to send for PRD `prd`, or null when the folder holds no `pitch.json`. Throws
 * `PitchRunRefused` for anything the app would refuse.
 */
export function readPitchRun(dir: string, prd: PrdNumber): PitchRun | null {
  const file = join(dir, PITCH_RUN_FILE);
  if (!existsSync(file)) return null;
  const sent = parsedOrNull(readFileSync(file, 'utf8'));
  if (!isRecord(sent)) return refuse(`${PITCH_RUN_FILE} is not a JSON object`);
  const { audience, look, commit } = sent;
  if (sent.prd !== undefined && sent.prd !== prd) refuse(`${PITCH_RUN_FILE} is for PRD ${shown(sent.prd)}, not ${prd}`);
  if (!isOneOf(AUDIENCES, audience)) return refuse(`${PITCH_RUN_FILE}: audience is customers or inside, not ${String(audience)}`);
  if (!isOneOf(LOOKS, look)) return refuse(`${PITCH_RUN_FILE}: look is arcade or keynote, not ${String(look)}`);
  if (typeof commit !== 'string' || !COMMIT.test(commit)) return refuse(`${PITCH_RUN_FILE}: commit is the hash of the commit the pitch was made at`);
  const words = wordsOf(sent);
  const files = keysOf(PITCH_FILES).map((name) => fileOf(dir, name));
  return { audience, look, commit, ...words, files };
}
