// The pitch half of the contract (PRD 859's spec, "Push" and "The Pitch tab"), as plain functions of a
// Request, so they are tested on the fake store (./store.fake.ts) and the routes under app/api/pitches/
// stay one line:
//
//   POST /api/pitches/uploads {repo, prd, files: [{name, bytes, type}]}       → 200 {run, files: [{name, path, url}]}
//   POST /api/pitches         {repo, prd, run, audience, look, commit, hook, benefit, kicker, closing}
//                                                                              → 200 {url, gif}
//   GET  /api/pitches/<run>/pitch.gif                                          → 302 to a 5-minute signed link
//
// The first two take the kit's sign-in, as `omni proof push` does. An upload call takes exactly the five
// files of a pitch (slide.png, slide-square.png, pitch.mp4, pitch-square.mp4, pitch.gif), mints the
// run's id (a random UUID) and signs one upload link per file, under `<dossier id>/<run id>/<name>` of
// the private `pitches` bucket; each link takes one PUT. The register call stores the run once its five
// files are up. Both refuse a PRD that is not shipped or retro before anything else is done. The GIF's
// link is the only one read without sign-in, like Proof's: it is reached by the run's unguessable id.
//
// Refusals follow ADR-0029, each `{error}` in plain words: 400 a malformed body (a file other than the
// five, of another type, twice; an audience other than customers or inside; a look other than arcade or
// keynote; empty or long words; a file not uploaded), 401 no valid sign-in, 403 the database's refusal
// by membership, 404 a PRD without a dossier the caller may read (or, for the GIF, no such run), 409 a
// run registered already, 413 a body over its cap or a file over 50 MB, 422 a PRD not shipped, 503 no
// database here.
import 'server-only';
import { keysOf } from 'vertuo-omni-plan/kit/lib/narrow.ts';
import { randomUUID } from 'node:crypto';
import { authenticate, callerOrigin as origin, type TokenCheck } from '../ask/auth';
import { refuse, reply } from '../business-api/reply';
import {
  isAudience, isLook, isPitchFile, PITCH_FILE_MAX_BYTES, PITCH_FILE_NAMES, PITCH_FILES, PITCH_GIF, PITCH_GIF_LINK_SECONDS,
  PitchStoreError, WORD_MAX, type PitchStore, type PitchPublic, type PitchRunNew, type PitchWords,
} from './store';
import { type PrdNumber, parsePrd } from 'vertuo-omni-plan/kit/lib/ids.ts';

/** A client acting as one access token: the Auth server's check and the pitch store. */
export type PitchClient = TokenCheck & { pitches: PitchStore };

export type PitchDeps = {
  /** A client acting as the given access token, or null when no database is configured. */
  connect: ((token: string) => PitchClient) | null;
  /** The service role's GIF store, or null when this deployment has no service key. */
  open: (() => PitchPublic) | null;
};

const MAX_UPLOADS_BYTES = 16 * 1024;
const MAX_REGISTER_BYTES = 16 * 1024;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REPO = /^[\w.-]+\/[\w.-]+$/;
const COMMIT = /^[0-9a-f]{7,64}$/;
const PRD_MAX = 2 ** 31 - 1;
const NOT_SHIPPED = 'This PRD is not shipped: a pitch is for shipped PRDs.';

const noStore = { 'cache-control': 'no-store' };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Where a pitch is read: the Pitch tab of its PRD's page. */
const pitchTab = (request: Request, dossierId: string) => `${origin(request)}/prd/${dossierId}?tab=pitch`;
/** The GIF's stable link, which opens without signing in. */
const gifLink = (request: Request, runId: string) => `${origin(request)}/api/pitches/${runId}/${PITCH_GIF}`;

/** The database's refusal as the contract's answer; a failure is a 500, never a guess. */
function refusal(error: PitchStoreError): Response {
  if (error.code === '42501') return refuse(403, error.reason);
  if (error.code === 'P0002') return refuse(404, 'No such dossier.');
  if (error.code === '55000') return refuse(422, NOT_SHIPPED);
  if (error.code === '23505') return refuse(409, 'This run is registered already: upload a new one.');
  if (error.code === '22023' || error.code === '23514') return refuse(400, error.reason);
  console.error(`pitch: ${error.message}`);
  return refuse(500, 'The pitch database could not answer. Try again.');
}

/** The pitch store as the call's signed-in caller, or the Response that refuses the call (503, 401). */
async function callerPitches(request: Request, { connect }: PitchDeps): Promise<PitchStore | Response> {
  if (connect === null) return refuse(503, 'Pitches are not available here: this deployment has no database.');
  const auth = await authenticate(request.headers.get('authorization'), connect);
  return auth.ok ? connect(auth.caller.token).pitches : refuse(auth.status, auth.error);
}

/** Runs a handler as the signed-in caller, turning the database's refusals into the contract's. */
async function handle(request: Request, deps: PitchDeps, run: (pitches: PitchStore) => Promise<Response>): Promise<Response> {
  const pitches = await callerPitches(request, deps);
  if (pitches instanceof Response) return pitches;
  return run(pitches).catch((error: unknown) => {
    if (error instanceof PitchStoreError) return refusal(error);
    throw error;
  });
}

/** The JSON object a call sent, or the Response that refuses it (400, or 413 past `max` bytes). */
async function body(request: Request, max: number): Promise<Record<string, unknown> | Response> {
  const tooLarge = () => refuse(413, `This call carries ${max / 1024} KiB at most.`);
  if (Number(request.headers.get('content-length') ?? 0) > max) return tooLarge();
  const text = await request.text();
  if (new TextEncoder().encode(text).length > max) return tooLarge();
  try {
    const value: unknown = JSON.parse(text);
    return isRecord(value) ? value : refuse(400, 'The body must be a JSON object.');
  } catch {
    return refuse(400, 'The body must be a JSON object.');
  }
}

/** The repository and PRD a call names, or the problem. */
function prdOf(sent: Record<string, unknown>): { repo: string; prd: PrdNumber } | { problem: string } {
  const repo = sent.repo;
  if (typeof repo !== 'string' || repo.length > 200 || !REPO.test(repo)) return { problem: 'A pitch names its repository as owner/name.' };
  const prd = sent.prd;
  if (!isWhole(prd) || prd <= 0 || prd > PRD_MAX) return { problem: '`prd` is the PRD\'s number.' };
  return { repo, prd: parsePrd(prd) };
}

/** `Number.isInteger`, as the type guard it is: true only for a number. */
const isWhole = (value: unknown): value is number => Number.isInteger(value);

type FileProblem = { status: 400 | 413; problem: string };
const malformed = (problem: string): FileProblem => ({ status: 400, problem });
const FIVE = PITCH_FILE_NAMES.join(', ');

type UploadFile = { name: string; bytes: number };

/** One file of an upload call, as its name and size, or why it is refused. */
function fileOf(file: unknown, names: readonly string[]): UploadFile | FileProblem {
  if (!isRecord(file) || !isPitchFile(file.name)) return malformed(`A pitch uploads its five files: ${FIVE}.`);
  const { name, bytes } = file;
  if (!isWhole(bytes) || bytes < 0) return malformed(`${name}: \`bytes\` is its size, a whole number.`);
  if (file.type !== PITCH_FILES[name]) return malformed(`${name}: it is sent as ${PITCH_FILES[name]}, not ${String(file.type)}.`);
  if (names.includes(name)) return malformed(`Each file is sent once: ${name} came twice.`);
  return { name, bytes };
}

/** The five files an upload call asks for, or why they are refused: `status` 400 or 413. */
function filesOf(value: unknown): { names: string[] } | FileProblem {
  if (!Array.isArray(value) || value.length !== PITCH_FILE_NAMES.length) return malformed(`\`files\` is the pitch's five files: ${FIVE}.`);
  const names: string[] = [];
  const files: UploadFile[] = [];
  for (const sent of value) {
    const file = fileOf(sent, names);
    if ('problem' in file) return file;
    names.push(file.name);
    files.push(file);
  }
  const large = files.find((file) => file.bytes > PITCH_FILE_MAX_BYTES);
  if (large) return { status: 413, problem: `A pitch file holds ${PITCH_FILE_MAX_BYTES / 1024 / 1024} MB at most: ${large.name} is larger.` };
  return { names };
}

/** The dossier of the PRD a call names, or the Response that refuses it (404, or 422 not shipped). */
async function shippedDossier(pitches: PitchStore, repo: string, prd: PrdNumber): Promise<string | Response> {
  const dossierId = await pitches.dossierOf(repo, prd);
  if (!dossierId) return refuse(404, `No dossier for PRD #${prd} of ${repo.toLowerCase()}: push it first (omni dossier push ${prd}).`);
  if (!(await pitches.shipped(dossierId))) return refuse(422, NOT_SHIPPED);
  return dossierId;
}

export function requestPitchUploads(request: Request, deps: PitchDeps): Promise<Response> {
  return handle(request, deps, async (pitches) => {
    const sent = await body(request, MAX_UPLOADS_BYTES);
    if (sent instanceof Response) return sent;
    const which = prdOf(sent);
    if ('problem' in which) return refuse(400, which.problem);
    const read = filesOf(sent.files);
    if ('problem' in read) return refuse(read.status, read.problem);
    const dossierId = await shippedDossier(pitches, which.repo, which.prd);
    if (dossierId instanceof Response) return dossierId;
    const run = randomUUID();
    return reply(200, { run, files: await pitches.signUploads(dossierId, run, read.names) });
  });
}

/** The words a register call sends, trimmed, or the problem. */
function wordsOf(sent: Record<string, unknown>): PitchWords | { problem: string } {
  const words: PitchWords = { hook: '', benefit: '', kicker: '', closing: '' };
  for (const key of keysOf(WORD_MAX)) {
    const value = sent[key];
    const max = WORD_MAX[key];
    if (typeof value !== 'string' || value.trim().length === 0 || value.trim().length > max) return { problem: `\`${key}\` is 1 to ${max} characters.` };
    words[key] = value.trim();
  }
  return words;
}

type RunHeader = Omit<PitchRunNew, 'dossierId'> & { repo: string; prd: PrdNumber };

/** What a register call names before the store is asked, or the problem. */
function runHeaderOf(sent: Record<string, unknown>): RunHeader | { problem: string } {
  const which = prdOf(sent);
  if ('problem' in which) return which;
  if (typeof sent.run !== 'string' || !UUID.test(sent.run)) return { problem: '`run` is the id the upload call gave.' };
  if (!isAudience(sent.audience)) return { problem: `A pitch is for customers or inside, not ${String(sent.audience)}.` };
  if (!isLook(sent.look)) return { problem: `A pitch's look is arcade or keynote, not ${String(sent.look)}.` };
  if (typeof sent.commit !== 'string' || !COMMIT.test(sent.commit)) return { problem: '`commit` is the hash of the commit the pitch was made at.' };
  const words = wordsOf(sent);
  if ('problem' in words) return words;
  return { ...which, ...words, id: sent.run.toLowerCase(), audience: sent.audience, look: sent.look, commit: sent.commit };
}

export function registerPitch(request: Request, deps: PitchDeps): Promise<Response> {
  return handle(request, deps, async (pitches) => {
    const sent = await body(request, MAX_REGISTER_BYTES);
    if (sent instanceof Response) return sent;
    const header = runHeaderOf(sent);
    if ('problem' in header) return refuse(400, header.problem);
    const { repo, prd, ...run } = header;
    const dossierId = await shippedDossier(pitches, repo, prd);
    if (dossierId instanceof Response) return dossierId;
    const held = await pitches.uploaded(dossierId, run.id);
    const missing = PITCH_FILE_NAMES.find((name) => !held.includes(name));
    if (missing) return refuse(400, `${missing} was not uploaded to this run.`);
    await pitches.register({ ...run, dossierId });
    return reply(200, { url: pitchTab(request, dossierId), gif: gifLink(request, run.id) });
  });
}

/** The GIF's stable link: a redirect to a fresh signed one, or 404. */
export async function pitchGif(_request: Request, runId: string, deps: PitchDeps): Promise<Response> {
  if (!deps.open) return refuse(503, 'Pitches are not available here: this deployment has no service key.');
  const open = deps.open();
  const path = UUID.test(runId) ? await open.gifPath(runId.toLowerCase()) : null;
  const link = path ? await open.link(path, PITCH_GIF_LINK_SECONDS) : null;
  return link ? new Response(null, { status: 302, headers: { location: link, ...noStore } }) : refuse(404, 'No such pitch GIF.');
}
