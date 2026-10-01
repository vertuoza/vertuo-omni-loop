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
const AUDIENCES = Object.freeze(['customers', 'inside']);
const LOOKS = Object.freeze(['arcade', 'keynote']);
/** The longest each of a pitch's words may be, as the app's table says. */
const WORD_MAX = Object.freeze({ hook: 200, benefit: 400, kicker: 100, closing: 300 });
const COMMIT = /^[0-9a-f]{7,64}$/;

/** What the app would refuse, found before anything is sent: `status` is the one it would answer. */
export class PitchRunRefused extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'PitchRunRefused';
    this.status = status;
  }
}

const refuse = (message, status = 400) => {
  throw new PitchRunRefused(status, message);
};
const isRecord = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);

/** The JSON `text` holds, or null when it is not JSON. */
function parsedOrNull(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** The file `name` of the folder, with its size and type, or the refusal. */
function fileOf(dir, name) {
  const path = join(dir, name);
  if (!existsSync(path) || !statSync(path).isFile()) refuse(`${name}: not in the run folder`);
  const { size } = statSync(path);
  if (size > PITCH_FILE_MAX_BYTES) refuse(`${name}: over ${PITCH_FILE_MAX_BYTES / 1024 / 1024} MB`, 413);
  return { name, path, bytes: size, type: PITCH_FILES[name] };
}

/** The pitch's words, trimmed, or the refusal. */
function wordsOf(sent) {
  const words = {};
  for (const [key, max] of Object.entries(WORD_MAX)) {
    const value = sent[key];
    if (typeof value !== 'string' || !value.trim() || value.trim().length > max) refuse(`${PITCH_RUN_FILE}: ${key} is 1 to ${max} characters`);
    words[key] = value.trim();
  }
  return words;
}

/**
 * The run in `dir`, ready to send for PRD `prd`, or null when the folder holds no `pitch.json`. Throws
 * `PitchRunRefused` for anything the app would refuse.
 * @returns {{ audience: string, look: string, commit: string, hook: string, benefit: string, kicker: string, closing: string,
 *   files: Array<{ name: string, path: string, bytes: number, type: string }> } | null}
 */
export function readPitchRun(dir, prd) {
  const file = join(dir, PITCH_RUN_FILE);
  if (!existsSync(file)) return null;
  const sent = parsedOrNull(readFileSync(file, 'utf8'));
  if (!isRecord(sent)) refuse(`${PITCH_RUN_FILE} is not a JSON object`);
  if (sent.prd !== undefined && sent.prd !== prd) refuse(`${PITCH_RUN_FILE} is for PRD ${String(sent.prd)}, not ${prd}`);
  if (!AUDIENCES.includes(sent.audience)) refuse(`${PITCH_RUN_FILE}: audience is customers or inside, not ${String(sent.audience)}`);
  if (!LOOKS.includes(sent.look)) refuse(`${PITCH_RUN_FILE}: look is arcade or keynote, not ${String(sent.look)}`);
  if (typeof sent.commit !== 'string' || !COMMIT.test(sent.commit)) refuse(`${PITCH_RUN_FILE}: commit is the hash of the commit the pitch was made at`);
  const words = wordsOf(sent);
  const files = Object.keys(PITCH_FILES).map((name) => fileOf(dir, name));
  return { audience: sent.audience, look: sent.look, commit: sent.commit, ...words, files };
}
