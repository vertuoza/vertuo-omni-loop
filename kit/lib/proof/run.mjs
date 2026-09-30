// A proof run's folder, as `/omni:prove` leaves it (PRD 798's spec, "The Omni page"): `run.json`, the
// clips and scripts it names, and `preview.gif` when there is one. `readRun()` reads it and refuses,
// before anything is sent, everything the app's two calls would refuse: a verdict other than the three,
// a file the folder does not hold, a type the bucket does not take (400) and a file over 50 MB (413).
//
// run.json: { commit, url, criteria: [{ text, verdict, note?, video?, script? }] }. `video` and `script`
// are file names in the same folder. The GIF is not named: the app takes `preview.gif`, when the run
// uploaded one, as its GIF.
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

export const RUN_FILE = 'run.json';
/** The GIF excerpt's name in the run's folder, as the app recognises it. */
export const PROOF_GIF_NAME = 'preview.gif';
/** The largest file the app's bucket takes. */
export const PROOF_FILE_MAX_BYTES = 50 * 1024 * 1024;
/** The most files one run uploads. */
export const PROOF_FILES_MAX = 25;
/** The most criteria one run films. */
export const PROOF_CRITERIA_MAX = 10;
export const VERDICTS = Object.freeze(['pass', 'fail', 'unfilmable']);

/** Each extension the bucket takes, and the type it is sent as. */
const TYPES = Object.freeze({ webm: 'video/webm', gif: 'image/gif', ts: 'text/plain', txt: 'text/plain' });
/** A plain file name inside the run's folder, as the app takes it. */
const FILE_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const COMMIT = /^[0-9a-f]{7,64}$/;
const TEXT_MAX = 2000;
const NOTE_MAX = 1000;
const URL_MAX = 2000;

/** What the app would refuse, found before anything is sent: `status` is the one it would answer. */
export class ProofRunRefused extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'ProofRunRefused';
    this.status = status;
  }
}

const refuse = (message, status = 400) => {
  throw new ProofRunRefused(status, message);
};
const isRecord = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);

function isHttpUrl(value) {
  if (typeof value !== 'string' || value.length > URL_MAX) return false;
  try {
    return ['http:', 'https:'].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

function criterionOf(item, index) {
  const at = `criterion ${index + 1}`;
  if (!isRecord(item) || typeof item.text !== 'string' || !item.text.trim() || item.text.length > TEXT_MAX) {
    refuse(`${at}: its text is 1 to ${TEXT_MAX} characters`);
  }
  if (!VERDICTS.includes(item.verdict)) refuse(`${at}: a verdict is ${VERDICTS.slice(0, -1).join(', ')} or ${VERDICTS.at(-1)}, not ${String(item.verdict)}`);
  const criterion = { text: item.text.trim(), verdict: item.verdict };
  if (item.note !== undefined && item.note !== null) {
    if (typeof item.note !== 'string' || item.note.length > NOTE_MAX) refuse(`${at}: its note is at most ${NOTE_MAX} characters`);
    criterion.note = item.note;
  }
  for (const key of ['video', 'script']) {
    const name = item[key];
    if (name === undefined || name === null) continue;
    if (typeof name !== 'string' || !FILE_NAME.test(name)) refuse(`${at}: its ${key} is a file name in the run folder`);
    criterion[key] = name;
  }
  return criterion;
}

/** The file `name` of the folder, with its size and type, or the refusal. */
function fileOf(dir, name) {
  const path = join(dir, name);
  if (!existsSync(path) || !statSync(path).isFile()) refuse(`${name}: not in the run folder`);
  const type = TYPES[name.slice(name.lastIndexOf('.') + 1).toLowerCase()];
  if (!type) refuse(`${name}: a proof takes .webm, .gif, .ts or .txt files`);
  const { size } = statSync(path);
  if (size > PROOF_FILE_MAX_BYTES) refuse(`${name}: over ${PROOF_FILE_MAX_BYTES / 1024 / 1024} MB`, 413);
  return { name, path, bytes: size, type };
}

/**
 * The run in `dir`, ready to send, or null when the folder holds no `run.json`. Throws `ProofRunRefused`
 * for anything the app would refuse.
 * @returns {{ commit: string, url: string, criteria: object[], files: Array<{ name: string, path: string, bytes: number, type: string }> } | null}
 */
export function readRun(dir) {
  const file = join(dir, RUN_FILE);
  if (!existsSync(file)) return null;
  let sent;
  try {
    sent = JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    sent = null;
  }
  if (!isRecord(sent)) refuse(`${RUN_FILE} is not a JSON object`);
  if (typeof sent.commit !== 'string' || !COMMIT.test(sent.commit)) refuse(`${RUN_FILE}: commit is the hash of the commit the run proved`);
  if (!isHttpUrl(sent.url)) refuse(`${RUN_FILE}: url is the http(s) address the run was recorded on`);
  if (!Array.isArray(sent.criteria) || sent.criteria.length === 0 || sent.criteria.length > PROOF_CRITERIA_MAX) {
    refuse(`${RUN_FILE}: criteria is a list of 1 to ${PROOF_CRITERIA_MAX} {text, verdict, note?, video?, script?}`);
  }
  const criteria = sent.criteria.map(criterionOf);

  const names = [...new Set(criteria.flatMap((c) => [c.video, c.script]).filter(Boolean))];
  if (existsSync(join(dir, PROOF_GIF_NAME)) && !names.includes(PROOF_GIF_NAME)) names.push(PROOF_GIF_NAME);
  if (names.length > PROOF_FILES_MAX) refuse(`a run uploads ${PROOF_FILES_MAX} files at most: this one has ${names.length}`);
  const files = names.map((name) => fileOf(dir, name));
  return { commit: sent.commit, url: sent.url, criteria, files };
}
