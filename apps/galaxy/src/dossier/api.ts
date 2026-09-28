// The dossier half of the contract (PRD 216's spec, "The contract"; ADR-0002), as plain functions of
// a Request, so they are tested with a stubbed Supabase client and the routes under app/api/dossiers/
// stay one line each:
//
//   POST /api/dossiers       {title, repo, claudeSessionId?}                         → 201 {id, url}
//   GET  /api/dossiers?repo=<owner/name>&prd=<n>                                      → 200 {id, url}
//   POST /api/dossiers/push  {repo, prd, title, draftId?, artifacts: [{kind, content}]}
//                                             → 200 {id, url, added: [{kind, version}], unchanged: [kind]}
//
// The kit calls both with the terminal's sign-in. A push finds the dossier (the draft named, else the
// one keyed by workspace, repository and PRD, else a new one), numbers a draft — merging it into a
// dossier already keyed the same — and adds a version of each kind only when the hash of its content
// differs from the latest. The database computes the hash, from the content: a hash in the request
// is never read. Each kind it received comes back, added or unchanged. A lookup (PRD 413) only reads:
// the dossier of that repository (lower-cased) and PRD the caller may read, the most recently numbered
// when two of their workspaces hold one, or 404 when there is none.
//
// Refusals follow ADR-0029, each `{error}` in plain words: 400 a malformed body or query (or a draft of
// another repository, or one already another PRD), 401 no valid bearer token, 403 the database's refusal
// by workspace membership (PRD 459: its reason as it wrote it, and the App's install link after its install
// hint; any signed-in account is let through to it, whatever its address), 404 a draft the caller cannot read (or no dossier for a lookup), 413 a body over its cap or an artifact over
// 512 KiB, 503 no database here or the sign-in service down; 500 the database failed.
import type { SupabaseClient } from '@supabase/supabase-js';
import { authenticate, withInstallLink, type TokenCheck } from '../ask/auth';
import {
  ARTIFACT_MAX_BYTES, DOSSIER_KINDS, dossierReader, dossierStore, DossierStoreError, isDossierKind, TITLE_MAX,
  type DossierArtifact,
} from './store';

/** The largest push: three artifacts of 512 KiB and their JSON. */
export const MAX_PUSH_BYTES = 2 * 1024 * 1024;
/** The largest draft to open: a title, a repository and a session id. */
export const MAX_OPEN_BYTES = 64 * 1024;

/** A Supabase client acting as one access token: the Auth server's check, the functions and the tables. */
export type DossierClient = TokenCheck & Pick<SupabaseClient, 'rpc' | 'from'>;

export type DossierDeps = {
  /** A client acting as the given access token, or null when no database is configured. */
  connect: ((token: string) => DossierClient) | null;
  /** The App's install link, put after the database's install hint; null or missing: the hint alone. */
  installLink?: string | null;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REPO = /^[\w.-]+\/[\w.-]+$/;
const PRD_MAX = 2 ** 31 - 1;

const reply = (status: number, body: unknown) => Response.json(body, { status, headers: { 'cache-control': 'no-store' } });
const refuse = (status: number, error: string) => reply(status, { error });

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const bytesOf = (text: string) => new TextEncoder().encode(text).length;

/** Where the caller reached this app, behind Vercel's proxy too: the dossier's link must use it. */
function origin(request: Request) {
  const url = new URL(request.url);
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? url.host;
  const proto = request.headers.get('x-forwarded-proto') ?? url.protocol.replace(':', '');
  return `${proto}://${host}`;
}

const linkTo = (request: Request, id: string) => `${origin(request)}/prd/${id}`;

/** A client acting as the caller, or the Response that refuses them. */
async function signIn(request: Request, deps: DossierDeps): Promise<DossierClient | Response> {
  if (!deps.connect) return refuse(503, 'Dossiers are not available here: this deployment has no database.');
  const auth = await authenticate(request.headers.get('authorization'), deps.connect);
  if (!auth.ok) return refuse(auth.status, auth.error);
  return deps.connect(auth.caller.token);
}

/** The database's refusal as the contract's answer; a failure is a 500, never a guess. */
function refusal(error: DossierStoreError, deps: DossierDeps): Response {
  if (error.code === '42501') return refuse(403, withInstallLink(error.reason, deps.installLink));
  if (error.code === 'P0002') return refuse(404, 'No such draft dossier.');
  if (error.code === '54000') return refuse(413, `An artifact holds ${ARTIFACT_MAX_BYTES / 1024} KiB at most.`);
  if (error.code === '22023' || error.code === '23514') return refuse(400, error.reason);
  console.error(`dossier: ${error.message}`);
  return refuse(500, 'The dossier database could not answer. Try again.');
}

/** Runs a handler as the signed-in caller, turning the database's refusals into the contract's. */
async function handle(request: Request, deps: DossierDeps, run: (client: DossierClient) => Promise<Response>): Promise<Response> {
  try {
    const client = await signIn(request, deps);
    return client instanceof Response ? client : await run(client);
  } catch (error) {
    if (!(error instanceof DossierStoreError)) throw error;
    return refusal(error, deps);
  }
}

/** The JSON object a call sent, or the Response that refuses it (400, or 413 past `max` bytes). */
async function body(request: Request, max: number): Promise<Record<string, unknown> | Response> {
  const tooLarge = () => refuse(413, `This call carries ${max / 1024 / 1024 >= 1 ? `${max / 1024 / 1024} MiB` : `${max / 1024} KiB`} at most.`);
  if (Number(request.headers.get('content-length') ?? 0) > max) return tooLarge();
  const text = await request.text();
  if (bytesOf(text) > max) return tooLarge();
  try {
    const value: unknown = JSON.parse(text);
    return isRecord(value) ? value : refuse(400, 'The body must be a JSON object.');
  } catch {
    return refuse(400, 'The body must be a JSON object.');
  }
}

/** A title of 1 to 200 characters, trimmed, or null. */
function titleOf(value: unknown): string | null {
  const title = typeof value === 'string' ? value.trim() : '';
  return title.length >= 1 && title.length <= TITLE_MAX ? title : null;
}

const repoOf = (value: unknown): string | null => (typeof value === 'string' && value.length <= 200 && REPO.test(value) ? value : null);

/** A PRD's number as a query sends it: digits only, 1 to 2³¹−1; or null. */
const prdOf = (value: string | null): number | null => {
  if (value === null || !/^\d{1,10}$/.test(value)) return null;
  const prd = Number(value);
  return prd >= 1 && prd <= PRD_MAX ? prd : null;
};

/** Where PRD n of a repository lives: its dossier's id and link, as the caller may read it. */
export function findDossier(request: Request, deps: DossierDeps): Promise<Response> {
  return handle(request, deps, async (client) => {
    const query = new URL(request.url).searchParams;
    const repo = repoOf(query.get('repo'));
    if (!repo) return refuse(400, 'A lookup names its repository as owner/name.');
    const prd = prdOf(query.get('prd'));
    if (prd === null) return refuse(400, '`prd` is the PRD\'s number.');
    const id = await dossierReader(client).numbered(repo, prd);
    if (!id) return refuse(404, `No dossier for PRD #${prd} of ${repo.toLowerCase()}.`);
    return reply(200, { id, url: linkTo(request, id) });
  });
}

export function openDossier(request: Request, deps: DossierDeps): Promise<Response> {
  return handle(request, deps, async (client) => {
    const store = dossierStore(client);
    const sent = await body(request, MAX_OPEN_BYTES);
    if (sent instanceof Response) return sent;
    const title = titleOf(sent.title);
    if (!title) return refuse(400, `A dossier needs a title of 1 to ${TITLE_MAX} characters.`);
    const repo = repoOf(sent.repo);
    if (!repo) return refuse(400, 'A dossier needs its repository as owner/name.');
    const session = sent.claudeSessionId ?? null;
    if (!(session === null || (typeof session === 'string' && session.length >= 1 && session.length <= 200))) {
      return refuse(400, '`claudeSessionId`, when sent, is a text of 1 to 200 characters.');
    }
    const { id } = await store.open({ title, repo, claudeSessionId: session });
    return reply(201, { id, url: linkTo(request, id) });
  });
}

/** The artifacts a push carries, or why they are refused: `status` 400 or 413. */
function artifactsOf(value: unknown): { artifacts: DossierArtifact[] } | { status: 400 | 413; problem: string } {
  const malformed = (problem: string) => ({ status: 400 as const, problem });
  if (!Array.isArray(value)) return malformed('`artifacts` must be a list of {kind, content}.');
  const artifacts: DossierArtifact[] = [];
  for (const item of value) {
    if (!isRecord(item) || !isDossierKind(item.kind) || typeof item.content !== 'string') {
      return malformed(`Each artifact is {kind, content}, its kind one of ${DOSSIER_KINDS.join(', ')}.`);
    }
    if (artifacts.some((a) => a.kind === item.kind)) return malformed(`Each kind is sent once: ${item.kind} came twice.`);
    // Only the kind and the content go on: a hash the caller sent is never read.
    artifacts.push({ kind: item.kind, content: item.content });
  }
  const large = artifacts.find((a) => bytesOf(a.content) > ARTIFACT_MAX_BYTES);
  if (large) return { status: 413, problem: `An artifact holds ${ARTIFACT_MAX_BYTES / 1024} KiB at most: ${large.kind} is larger.` };
  return { artifacts };
}

export function pushDossier(request: Request, deps: DossierDeps): Promise<Response> {
  return handle(request, deps, async (client) => {
    const store = dossierStore(client);
    const sent = await body(request, MAX_PUSH_BYTES);
    if (sent instanceof Response) return sent;
    const repo = repoOf(sent.repo);
    if (!repo) return refuse(400, 'A push names its repository as owner/name.');
    const prd = sent.prd;
    if (!Number.isInteger(prd) || (prd as number) <= 0 || (prd as number) > PRD_MAX) return refuse(400, '`prd` is the PRD\'s number.');
    const title = titleOf(sent.title);
    if (!title) return refuse(400, `A push carries a title of 1 to ${TITLE_MAX} characters.`);
    const draftId = sent.draftId ?? null;
    if (!(draftId === null || (typeof draftId === 'string' && UUID.test(draftId)))) {
      return refuse(400, '`draftId`, when sent, is the id of a draft dossier.');
    }
    const read = artifactsOf(sent.artifacts);
    if ('problem' in read) return refuse(read.status, read.problem);
    const pushed = await store.push({ repo, prd: prd as number, title, draftId, artifacts: read.artifacts });
    return reply(200, { id: pushed.id, url: linkTo(request, pushed.id), added: pushed.added, unchanged: pushed.unchanged });
  });
}
