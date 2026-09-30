// The proof half of the contract (PRD 798's spec, "The Omni page"), as plain functions of a Request, so
// they are tested on the fake store (./store.fake.ts) and the routes under app/api/proofs/ stay one line:
//
//   POST /api/proofs/uploads {repo, prd, files: [{name, bytes, type}]}        → 200 {run, files: [{name, path, url}]}
//   POST /api/proofs         {repo, prd, run, commit, url, criteria: [{text, verdict, note?, video?, script?}]}
//                                                                               → 200 {url}
//   GET  /api/proofs/<run>/preview.gif                                         → 302 to a 5-minute signed link
//
// The first two take the kit's sign-in, as `omni dossier push` does. An upload call mints the run's id
// (a random UUID) and signs one upload link per file, under `<dossier id>/<run id>/<name>` of the private
// `proof-videos` bucket; each link takes one PUT. The register call stores the run once its files are
// up, and a file named in it that the run's folder does not hold is refused. `preview.gif`, when the run
// uploaded one, is its GIF. The GIF's link is the only one read without sign-in (GitHub's image proxy
// cannot sign in): it is reached by the run's unguessable id alone.
//
// Refusals follow ADR-0029, each `{error}` in plain words: 400 a malformed body (a file's type other than
// video/webm, image/gif or text/plain, a name not of its type, more than 25 files, a verdict other than
// the three, a file not uploaded), 401 no valid sign-in, 403 the database's refusal by membership, 404 a
// PRD without a dossier the caller may read (or, for the GIF, no such run or no GIF), 409 a run registered
// already, 413 a body over its cap or a file over 50 MB, 503 no database here.
import { randomUUID } from 'node:crypto';
import { authenticate, callerOrigin as origin, type TokenCheck } from '../ask/auth';
import {
  GIF_LINK_SECONDS, isProofType, isVerdict, PROOF_CRITERIA_MAX, PROOF_FILE_MAX_BYTES, PROOF_FILE_NAME, PROOF_FILES_MAX, PROOF_GIF_NAME,
  PROOF_TYPES, ProofStoreError, VERDICTS, type ProofCriterion, type ProofPublic, type ProofStore,
} from './store';

/** A client acting as one access token: the Auth server's check and the proof store. */
export type ProofClient = TokenCheck & { proofs: ProofStore };

export type ProofDeps = {
  /** A client acting as the given access token, or null when no database is configured. */
  connect: ((token: string) => ProofClient) | null;
  /** The service role's GIF store, or null when this deployment has no service key. */
  open: (() => ProofPublic) | null;
};

/** The largest upload request: 25 files' names, sizes and types. */
export const MAX_UPLOADS_BYTES = 64 * 1024;
/** The largest register request: 10 criteria with their texts, notes and names. */
export const MAX_REGISTER_BYTES = 256 * 1024;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REPO = /^[\w.-]+\/[\w.-]+$/;
const COMMIT = /^[0-9a-f]{7,64}$/;
const PRD_MAX = 2 ** 31 - 1;
const TEXT_MAX = 2000;
const NOTE_MAX = 1000;
const URL_MAX = 2000;

const noStore = { 'cache-control': 'no-store' };
const reply = (status: number, body: unknown) => Response.json(body, { status, headers: noStore });
const refuse = (status: number, error: string) => reply(status, { error });

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Where a run is read: the Proof tab of its PRD's page. */
const proofTab = (request: Request, dossierId: string) => `${origin(request)}/prd/${dossierId}?tab=proof`;

/** The database's refusal as the contract's answer; a failure is a 500, never a guess. */
function refusal(error: ProofStoreError): Response {
  if (error.code === '42501') return refuse(403, error.reason);
  if (error.code === 'P0002') return refuse(404, 'No such dossier.');
  if (error.code === '23505') return refuse(409, 'This run is registered already: upload a new one.');
  if (error.code === '22023' || error.code === '23514') return refuse(400, error.reason);
  console.error(`proof: ${error.message}`);
  return refuse(500, 'The proof database could not answer. Try again.');
}

/** Runs a handler as the signed-in caller, turning the database's refusals into the contract's. */
async function handle(request: Request, deps: ProofDeps, run: (proofs: ProofStore) => Promise<Response>): Promise<Response> {
  if (!deps.connect) return refuse(503, 'Proofs are not available here: this deployment has no database.');
  const auth = await authenticate(request.headers.get('authorization'), deps.connect);
  if (!auth.ok) return refuse(auth.status, auth.error);
  try {
    return await run(deps.connect(auth.caller.token).proofs);
  } catch (error) {
    if (!(error instanceof ProofStoreError)) throw error;
    return refusal(error);
  }
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
function prdOf(sent: Record<string, unknown>): { repo: string; prd: number } | { problem: string } {
  const repo = sent.repo;
  if (typeof repo !== 'string' || repo.length > 200 || !REPO.test(repo)) return { problem: 'A proof names its repository as owner/name.' };
  const prd = sent.prd;
  if (!Number.isInteger(prd) || (prd as number) <= 0 || (prd as number) > PRD_MAX) return { problem: '`prd` is the PRD\'s number.' };
  return { repo, prd: prd as number };
}

const extensionOf = (name: string) => name.slice(name.lastIndexOf('.') + 1).toLowerCase();

/** The files an upload call asks for, or why they are refused: `status` 400 or 413. */
function filesOf(value: unknown): { names: string[] } | { status: 400 | 413; problem: string } {
  const malformed = (problem: string) => ({ status: 400 as const, problem });
  if (!Array.isArray(value) || value.length === 0) return malformed('`files` is a list of 1 to 25 {name, bytes, type}.');
  if (value.length > PROOF_FILES_MAX) return malformed(`A run uploads ${PROOF_FILES_MAX} files at most: this one has ${value.length}.`);
  const names: string[] = [];
  for (const file of value) {
    if (!isRecord(file) || typeof file.name !== 'string' || !PROOF_FILE_NAME.test(file.name)) {
      return malformed('Each file is {name, bytes, type}, its name a plain file name of at most 128 characters.');
    }
    const { name } = file;
    if (!Number.isInteger(file.bytes) || (file.bytes as number) < 0) return malformed(`${name}: \`bytes\` is its size, a whole number.`);
    if (!isProofType(file.type)) {
      return malformed(`${name}: a proof takes ${Object.keys(PROOF_TYPES).join(', ')}, not ${String(file.type)}.`);
    }
    if (!(PROOF_TYPES[file.type] as readonly string[]).includes(extensionOf(name))) {
      return malformed(`${name}: a ${file.type} file is named .${PROOF_TYPES[file.type].join(' or .')}.`);
    }
    if (names.includes(name)) return malformed(`Each file is sent once: ${name} came twice.`);
    names.push(name);
  }
  const large = value.find((file) => (file.bytes as number) > PROOF_FILE_MAX_BYTES);
  if (large) return { status: 413, problem: `A proof file holds ${PROOF_FILE_MAX_BYTES / 1024 / 1024} MB at most: ${large.name} is larger.` };
  return { names };
}

export function requestUploads(request: Request, deps: ProofDeps): Promise<Response> {
  return handle(request, deps, async (proofs) => {
    const sent = await body(request, MAX_UPLOADS_BYTES);
    if (sent instanceof Response) return sent;
    const which = prdOf(sent);
    if ('problem' in which) return refuse(400, which.problem);
    const read = filesOf(sent.files);
    if ('problem' in read) return refuse(read.status, read.problem);
    const dossierId = await proofs.dossierOf(which.repo, which.prd);
    if (!dossierId) return refuse(404, `No dossier for PRD #${which.prd} of ${which.repo.toLowerCase()}: push it first (omni dossier push ${which.prd}).`);
    const run = randomUUID();
    const files = await proofs.signUploads(dossierId, run, read.names);
    return reply(200, { run, files });
  });
}

/** The criteria a register call sends, or the problem. */
function criteriaOf(value: unknown): { criteria: ProofCriterion[] } | { problem: string } {
  if (!Array.isArray(value) || value.length === 0 || value.length > PROOF_CRITERIA_MAX) {
    return { problem: `\`criteria\` is a list of 1 to ${PROOF_CRITERIA_MAX} {text, verdict, note?, video?, script?}.` };
  }
  const criteria: ProofCriterion[] = [];
  for (const [i, item] of value.entries()) {
    const at = `criterion ${i + 1}`;
    if (!isRecord(item) || typeof item.text !== 'string' || item.text.trim().length === 0 || item.text.length > TEXT_MAX) {
      return { problem: `${at}: its text is 1 to ${TEXT_MAX} characters.` };
    }
    if (!isVerdict(item.verdict)) return { problem: `${at}: a verdict is ${VERDICTS.join(', ')}, not ${String(item.verdict)}.` };
    const criterion: ProofCriterion = { text: item.text.trim(), verdict: item.verdict };
    if (item.note !== undefined && item.note !== null) {
      if (typeof item.note !== 'string' || item.note.length > NOTE_MAX) return { problem: `${at}: its note is at most ${NOTE_MAX} characters.` };
      criterion.note = item.note;
    }
    for (const key of ['video', 'script'] as const) {
      const name = item[key];
      if (name === undefined || name === null) continue;
      if (typeof name !== 'string' || !PROOF_FILE_NAME.test(name)) return { problem: `${at}: its ${key} is a file name of this run.` };
      criterion[key] = name;
    }
    criteria.push(criterion);
  }
  return { criteria };
}

function urlOf(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > URL_MAX) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? value : null;
  } catch {
    return null;
  }
}

export function registerRun(request: Request, deps: ProofDeps): Promise<Response> {
  return handle(request, deps, async (proofs) => {
    const sent = await body(request, MAX_REGISTER_BYTES);
    if (sent instanceof Response) return sent;
    const which = prdOf(sent);
    if ('problem' in which) return refuse(400, which.problem);
    if (typeof sent.run !== 'string' || !UUID.test(sent.run)) return refuse(400, '`run` is the id the upload call gave.');
    const run = sent.run.toLowerCase();
    if (typeof sent.commit !== 'string' || !COMMIT.test(sent.commit)) return refuse(400, '`commit` is the hash of the commit the run proved.');
    const url = urlOf(sent.url);
    if (!url) return refuse(400, '`url` is the http(s) address the run was recorded on.');
    const read = criteriaOf(sent.criteria);
    if ('problem' in read) return refuse(400, read.problem);
    const dossierId = await proofs.dossierOf(which.repo, which.prd);
    if (!dossierId) return refuse(404, `No dossier for PRD #${which.prd} of ${which.repo.toLowerCase()}.`);
    const held = await proofs.uploaded(dossierId, run);
    const named = read.criteria.flatMap((c) => [c.video, c.script]).filter((n): n is string => n !== undefined);
    const missing = named.find((name) => !held.includes(name));
    if (missing) return refuse(400, `${missing} was not uploaded to this run.`);
    await proofs.register({
      id: run, dossierId, commit: sent.commit, url, criteria: read.criteria, gif: held.includes(PROOF_GIF_NAME) ? PROOF_GIF_NAME : null,
    });
    return reply(200, { url: proofTab(request, dossierId) });
  });
}

/** The GIF's stable link: a redirect to a fresh signed one, or 404. */
export async function previewGif(_request: Request, runId: string, deps: ProofDeps): Promise<Response> {
  if (!deps.open) return refuse(503, 'Proofs are not available here: this deployment has no service key.');
  const missing = () => refuse(404, 'No such proof GIF.');
  if (!UUID.test(runId)) return missing();
  const open = deps.open();
  const path = await open.gifPath(runId.toLowerCase());
  if (!path) return missing();
  const link = await open.link(path, GIF_LINK_SECONDS);
  if (!link) return missing();
  return new Response(null, { status: 302, headers: { location: link, ...noStore } });
}
