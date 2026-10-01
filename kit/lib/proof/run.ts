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
const PROOF_GIF_NAME = 'preview.gif';
/** The largest file the app's bucket takes. */
export const PROOF_FILE_MAX_BYTES = 50 * 1024 * 1024;
/** The most files one run uploads. */
const PROOF_FILES_MAX = 25;
/** The most criteria one run films. */
const PROOF_CRITERIA_MAX = 10;
const VERDICTS = Object.freeze(['pass', 'fail', 'unfilmable'] as const);

export type ProofVerdict = (typeof VERDICTS)[number];
/** One criterion of a run, as the app registers it. */
export type ProofCriterion = { text: string; verdict: ProofVerdict; note?: string; video?: string; script?: string };
/** One file of the run's folder, ready to upload. */
export type ProofFile = { name: string; path: string; bytes: number; type: string };
/** A run read from its folder, ready to send. */
export type ProofRun = { commit: string; url: string; criteria: ProofCriterion[]; files: ProofFile[] };

type Sent = Record<string, unknown>;

/** Each extension the bucket takes, and the type it is sent as. */
const TYPES: Readonly<Record<string, string>> = Object.freeze({ webm: 'video/webm', gif: 'image/gif', ts: 'text/plain', txt: 'text/plain' });
/** A plain file name inside the run's folder, as the app takes it. */
const FILE_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const COMMIT = /^[0-9a-f]{7,64}$/;
const TEXT_MAX = 2000;
const NOTE_MAX = 1000;
const URL_MAX = 2000;

/** What the app would refuse, found before anything is sent: `status` is the one it would answer. */
export class ProofRunRefused extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ProofRunRefused';
    this.status = status;
  }
}

const refuse = (message: string, status = 400): never => {
  throw new ProofRunRefused(status, message);
};
const isRecord = (value: unknown): value is Sent => typeof value === 'object' && value !== null && !Array.isArray(value);

function isHttpUrl(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > URL_MAX) return false;
  try {
    return ['http:', 'https:'].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

const KNOWN_VERDICTS: readonly unknown[] = VERDICTS;
const isVerdict = (value: unknown): value is ProofVerdict => KNOWN_VERDICTS.includes(value);

const isBlank = (value: unknown): value is null | undefined => value === undefined || value === null;

/** A criterion's trimmed text and the criterion as a record, or the refusal. */
function textOf(item: unknown, at: string): { text: string; sent: Sent } {
  const text = isRecord(item) ? item.text : undefined;
  const valid = isRecord(item) && typeof text === 'string' && text.trim() && text.length <= TEXT_MAX;
  if (!valid) return refuse(`${at}: its text is 1 to ${TEXT_MAX} characters`);
  return { text: text.trim(), sent: item };
}

/** A criterion's verdict, or the refusal. */
function verdictOf(item: Sent, at: string): ProofVerdict {
  const { verdict } = item;
  if (!isVerdict(verdict)) return refuse(`${at}: a verdict is ${VERDICTS.slice(0, -1).join(', ')} or ${VERDICTS.at(-1)}, not ${String(item.verdict)}`);
  return verdict;
}

/** A criterion's optional note and file names, copied onto `criterion`, or the refusal. */
function extrasOf(item: Sent, at: string, criterion: ProofCriterion): ProofCriterion {
  const { note } = item;
  if (!isBlank(note)) {
    if (typeof note !== 'string' || note.length > NOTE_MAX) return refuse(`${at}: its note is at most ${NOTE_MAX} characters`);
    criterion.note = note;
  }
  for (const key of ['video', 'script'] as const) {
    const name = item[key];
    if (isBlank(name)) continue;
    if (typeof name !== 'string' || !FILE_NAME.test(name)) return refuse(`${at}: its ${key} is a file name in the run folder`);
    criterion[key] = name;
  }
  return criterion;
}

function criterionOf(item: unknown, index: number): ProofCriterion {
  const at = `criterion ${index + 1}`;
  const { text, sent } = textOf(item, at);
  return extrasOf(sent, at, { text, verdict: verdictOf(sent, at) });
}

/** The file `name` of the folder, with its size and type, or the refusal. */
function fileOf(dir: string, name: string): ProofFile {
  const path = join(dir, name);
  if (!existsSync(path) || !statSync(path).isFile()) refuse(`${name}: not in the run folder`);
  const type = TYPES[name.slice(name.lastIndexOf('.') + 1).toLowerCase()];
  if (!type) return refuse(`${name}: a proof takes .webm, .gif, .ts or .txt files`);
  const { size } = statSync(path);
  if (size > PROOF_FILE_MAX_BYTES) refuse(`${name}: over ${PROOF_FILE_MAX_BYTES / 1024 / 1024} MB`, 413);
  return { name, path, bytes: size, type };
}

/**
 * The run in `dir`, ready to send, or null when the folder holds no `run.json`. Throws `ProofRunRefused`
 * for anything the app would refuse.
 */
export function readRun(dir: string): ProofRun | null {
  const file = join(dir, RUN_FILE);
  if (!existsSync(file)) return null;
  let sent: unknown;
  try {
    sent = JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    sent = null;
  }
  if (!isRecord(sent)) return refuse(`${RUN_FILE} is not a JSON object`);
  const { commit, url, criteria: given } = sent;
  if (typeof commit !== 'string' || !COMMIT.test(commit)) return refuse(`${RUN_FILE}: commit is the hash of the commit the run proved`);
  if (!isHttpUrl(url)) return refuse(`${RUN_FILE}: url is the http(s) address the run was recorded on`);
  if (!Array.isArray(given) || given.length === 0 || given.length > PROOF_CRITERIA_MAX) {
    return refuse(`${RUN_FILE}: criteria is a list of 1 to ${PROOF_CRITERIA_MAX} {text, verdict, note?, video?, script?}`);
  }
  const criteria = given.map(criterionOf);

  const names = [...new Set(criteria.flatMap((c) => [c.video, c.script]).filter((name): name is string => Boolean(name)))];
  if (existsSync(join(dir, PROOF_GIF_NAME)) && !names.includes(PROOF_GIF_NAME)) names.push(PROOF_GIF_NAME);
  if (names.length > PROOF_FILES_MAX) refuse(`a run uploads ${PROOF_FILES_MAX} files at most: this one has ${names.length}`);
  const files = names.map((name) => fileOf(dir, name));
  return { commit, url, criteria, files };
}
