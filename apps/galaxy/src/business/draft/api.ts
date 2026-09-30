import { refuse, reply } from '../../business-api/reply';
import { PageRefused } from './page';
import { DraftStoreError, type DraftRow, type DraftStore } from './run';

// The draft's two member routes (PRD 774, s2), as plain functions of a Request so each route file stays
// one line. Both act as the signed-in person: the database's functions decide who is a member.
//
//   POST   /api/business/draft   {workspace}          202 {draft, running: false}: a draft started, run after the answer
//                                                     200 {draft, running: true}: one already runs (decision 10)
//   POST   /api/business/sources {workspace, url}     201 {source}: a web page added (https, public, three at most)
//   DELETE /api/business/sources {workspace, source}  200 {removed}: a web page removed
//
// Refusals, each `{error}` in plain words: 400 a malformed body, a URL that may not be read or a fourth
// page, 401 signed out, 403 not a member of the workspace, 404 no business (or no such page), 500 the
// database failed.

/** A draft still running after this long has died with its function (item s1-01); a new one may start. */
const STUCK_MS = 15 * 60_000;

export interface DraftRouteDeps {
  /** The store as the signed-in person, or null when nobody is signed in (or no database). */
  store: () => Promise<DraftStore | null>;
  /** Runs a started draft after the answer is sent. */
  later: (store: DraftStore, workspace: string, draft: DraftRow) => void;
  now?: () => number;
}

/** A web page on a business: a public.business_sources row. */
export interface WebPage {
  id: string;
  url: string;
  added_at: string;
}

export interface SourcesStore {
  add(workspace: string, url: string): Promise<WebPage>;
  remove(workspace: string, source: string): Promise<void>;
}

export interface SourcesRouteDeps {
  store: () => Promise<SourcesStore | null>;
  /** Refuses a URL the draft may not read (./page.ts checkUrl); throws PageRefused. */
  check: (url: string) => Promise<unknown>;
}

const NOT_JSON = Symbol('not JSON');

const id = (value: unknown) => (typeof value === 'string' && value.length > 0 && value.length <= 64 ? value : null);

async function bodyOf(request: Request): Promise<Record<string, unknown> | Response> {
  const sent: unknown = await request.json().catch(() => NOT_JSON);
  if (sent === NOT_JSON || !sent || typeof sent !== 'object' || Array.isArray(sent)) return refuse(400, 'The body must be a JSON object.');
  return sent as Record<string, unknown>;
}

function refusal(error: unknown, what: string, gone = 'This workspace has no business yet.'): Response {
  const code = error instanceof DraftStoreError ? error.code : undefined;
  if (code === '42501') return refuse(403, 'Only a member of the workspace can change its business.');
  if (code === 'P0002') return refuse(404, gone);
  console.error(`business: ${what} failed (${error instanceof Error ? error.message : String(error)})`);
  return refuse(500, 'The business database could not answer. Try again.');
}

export async function draftRoute(request: Request, deps: DraftRouteDeps): Promise<Response> {
  const store = await deps.store();
  if (!store) return refuse(401, 'Sign in first.');
  const body = await bodyOf(request);
  if (body instanceof Response) return body;
  const workspace = id(body.workspace);
  if (!workspace) return refuse(400, '`workspace` must be the id the page shows.');
  const now = (deps.now ?? Date.now)();
  try {
    const running = await store.running(workspace);
    if (running && now - Date.parse(running.started_at) < STUCK_MS) return reply(200, { draft: running, running: true });
    const draft = await store.start(workspace, 'draft');
    if (running && draft.id === running.id) return reply(200, { draft, running: true });
    deps.later(store, workspace, draft);
    return reply(202, { draft, running: false });
  } catch (error) {
    return refusal(error, 'starting a draft');
  }
}

export async function addSourceRoute(request: Request, deps: SourcesRouteDeps): Promise<Response> {
  const store = await deps.store();
  if (!store) return refuse(401, 'Sign in first.');
  const body = await bodyOf(request);
  if (body instanceof Response) return body;
  const workspace = id(body.workspace);
  if (!workspace || typeof body.url !== 'string' || body.url.length > 2000) return refuse(400, '`workspace` and `url` must be sent.');
  const url = body.url.trim();
  try {
    await deps.check(url);
  } catch (error) {
    if (error instanceof PageRefused) return refuse(400, error.message);
    return refusal(error, 'checking a web page');
  }
  try {
    return reply(201, { source: await store.add(workspace, url) });
  } catch (error) {
    if (error instanceof DraftStoreError && error.code === '22023') return refuse(400, error.message.replace(/^Could not [^:]+: /, ''));
    return refusal(error, 'adding a web page');
  }
}

export async function removeSourceRoute(request: Request, deps: SourcesRouteDeps): Promise<Response> {
  const store = await deps.store();
  if (!store) return refuse(401, 'Sign in first.');
  const body = await bodyOf(request);
  if (body instanceof Response) return body;
  const workspace = id(body.workspace);
  const source = id(body.source);
  if (!workspace || !source) return refuse(400, '`workspace` and `source` must be the ids the page shows.');
  try {
    await store.remove(workspace, source);
    return reply(200, { removed: source });
  } catch (error) {
    return refusal(error, 'removing a web page', 'That web page is no longer on this business. Reload the page.');
  }
}
