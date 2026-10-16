import 'server-only';
import type { MemberSession } from '../data/member-session';
import { viewer } from '../data/viewer';
import { memberWorkspace } from '../data/workspace';
import { ApproverWriteSchema, LinkWriteSchema, MemberQuerySchema, RepoQuerySchema, TAB_REFUSALS, type TabRefusal } from './repositories-tab.contract';
import { repositoriesTabReads, type Outcome, type RepositoriesTab, type RepositoriesTabService } from './repositories-tab.service';
import { demoRepositoriesTab, type RepositoriesTabView } from './RepositoriesTab';

// The product home's Repositories & approvers tab, its controller (PRD 1364 s11; ADR-0095).
//
// The page, /app/products/<id>/repositories: who reads it decides what it draws, checked first. The demo
// in development (or OMNI_LOOP_DEMO=1); with no database, closed; signed out, the sign-in card, and no
// service runs; an account in no workspace says so. Signed in, the service reads as that person, so
// row-level security has the last word; a product the workspace does not hold is not found; a failed
// read is the unreadable notice, logged.
//
// The routes the tab's browser client calls (repositories-tab.client.ts), in the shapes of
// repositories-tab.contract.ts: POST and DELETE …/repositories/links, POST and DELETE
// …/repositories/approvers. The session is checked first, from the request's cookie claims, as viewer()
// reads them: signed out (or the demo, or no database here), 401 and no service runs. Signed in, the
// service writes as that person, so the database functions decide who may (an owner) and what.

type SignedIn = Extract<MemberSession, { kind: 'signed-in' }>;

/** What the page needs beside the session: the person's workspace, and the tab read as them. */
export interface RepositoriesTabDeps {
  workspace(session: SignedIn): Promise<{ id: string } | null>;
  tab(session: SignedIn, workspace: string, product: string): Promise<RepositoriesTab | null>;
}

const why = (err: unknown) => (err instanceof Error ? err.message : String(err));

export async function repositoriesTabViewOf(session: MemberSession, product: string, deps: RepositoriesTabDeps): Promise<RepositoriesTabView> {
  if (session.kind === 'demo') {
    const demo = demoRepositoriesTab(product);
    return demo === null ? { kind: 'not-found' } : { kind: 'tab', source: { kind: 'demo' }, tab: demo };
  }
  if (session.kind !== 'signed-in') return session;
  try {
    const workspace = await deps.workspace(session);
    if (!workspace) return { kind: 'no-workspace' };
    const tab = await deps.tab(session, workspace.id, product);
    return tab === null ? { kind: 'not-found' } : { kind: 'tab', source: { kind: 'live' }, tab };
  } catch (err) {
    console.error(`product repositories: ${product} could not be read (${why(err)})`);
    return { kind: 'unreadable' };
  }
}

/** The live reads: the workspace the person joined first, as /app's, and the tab on their client. */
export const LIVE_REPOSITORIES_TAB: RepositoriesTabDeps = {
  workspace: (session) => memberWorkspace(session.db, session.user.id),
  tab: (session, workspace, product) => repositoriesTabReads(session.db).tab(workspace, product),
};

// ── The routes ──

export type RepositoriesTabHandlerDeps = {
  /** The service as the signed-in person, or null when nobody is signed in. */
  signedIn: () => Promise<RepositoriesTabService | null>;
  log: (line: string) => void;
};

const NO_STORE = { 'cache-control': 'no-store' };
const MAX_BODY_BYTES = 16 * 1024;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SIGNED_OUT = 'Sign in first to change this product.';
const NO_PRODUCT = 'No such product.';
const MALFORMED_LINK = 'The body must be {"repo": "owner/name", "role", "knowledge", "readAt", "readOnly", "consumes"}.';
const MALFORMED_APPROVER = 'The body must be {"member": "<id>", "state": "asked" | "skipped"}.';
const MALFORMED_REPO = 'Name the repository: ?repo=owner/name.';
const MALFORMED_MEMBER = 'Name the member: ?member=<id>.';
const COULD_NOT_SAVE = 'Couldn’t save this. Try again in a moment.';

const reply = (status: number, body: unknown): Response => Response.json(body, { status, headers: NO_STORE });
const refuse = (kind: TabRefusal, error: string): Response => reply(TAB_REFUSALS[kind], { error });

/** A request's JSON body, or null when it is too large or no JSON. */
async function bodyOf(request: Request): Promise<unknown> {
  const text = await request.text();
  if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export function repositoriesTabHandlers(deps: RepositoriesTabHandlerDeps) {
  /** Runs `change` as the signed-in person, once the product id and the request are read. */
  async function run<A, T>(product: string, read: () => Promise<A | null>, malformed: string, change: (service: RepositoriesTabService, asked: A) => Promise<Outcome<T>>): Promise<Response> {
    const service = await deps.signedIn();
    if (!service) return refuse('signed-out', SIGNED_OUT);
    if (!UUID.test(product)) return refuse('missing', NO_PRODUCT);
    const asked = await read();
    if (asked === null) return refuse('malformed', malformed);
    try {
      const done = await change(service, asked);
      if (done.ok) return reply(200, done.value);
      if (done.kind !== 'database') return refuse(done.kind, done.error);
      deps.log(`product repositories: ${done.error} (${product})`);
    } catch (err) {
      deps.log(`product repositories: ${why(err)} (${product})`);
    }
    return refuse('database', COULD_NOT_SAVE);
  }

  const parsed = <T>(schema: { safeParse(v: unknown): { success: true; data: T } | { success: false } }, value: unknown): T | null => {
    const result = schema.safeParse(value);
    return result.success ? result.data : null;
  };
  const query = (request: Request, name: string) => new URL(request.url).searchParams.get(name);

  return {
    /** POST …/links: an owner adds a repository, or sets every field of its link. */
    saveLink: (request: Request, product: string) =>
      run(product, async () => parsed(LinkWriteSchema, await bodyOf(request)), MALFORMED_LINK, (s, write) => s.saveLink(product, write)),
    /** DELETE …/links?repo=: an owner takes a repository out of the product. */
    removeLink: (request: Request, product: string) =>
      run(product, () => Promise.resolve(parsed(RepoQuerySchema, query(request, 'repo'))), MALFORMED_REPO, (s, repo) => s.removeLink(product, repo)),
    /** POST …/approvers: an owner lists a member as asked or skipped. */
    setApprover: (request: Request, product: string) =>
      run(product, async () => parsed(ApproverWriteSchema, await bodyOf(request)), MALFORMED_APPROVER, (s, w) => s.setApprover(product, w.member, w.state)),
    /** DELETE …/approvers?member=: an owner takes a member off the list. */
    removeApprover: (request: Request, product: string) =>
      run(product, () => Promise.resolve(parsed(MemberQuerySchema, query(request, 'member'))), MALFORMED_MEMBER, (s, member) => s.removeApprover(product, member)),
  };
}

const live = repositoriesTabHandlers({
  async signedIn() {
    const seen = await viewer();
    return seen.kind === 'signed-in' ? repositoriesTabReads(seen.db) : null;
  },
  log: (line) => { console.error(line); },
});

type Params = { params: Promise<{ id: string }> };

/** POST /app/products/<id>/repositories/links */
export const postLink = async (request: Request, { params }: Params): Promise<Response> => live.saveLink(request, (await params).id);
/** DELETE /app/products/<id>/repositories/links */
export const deleteLink = async (request: Request, { params }: Params): Promise<Response> => live.removeLink(request, (await params).id);
/** POST /app/products/<id>/repositories/approvers */
export const postApprover = async (request: Request, { params }: Params): Promise<Response> => live.setApprover(request, (await params).id);
/** DELETE /app/products/<id>/repositories/approvers */
export const deleteApprover = async (request: Request, { params }: Params): Promise<Response> => live.removeApprover(request, (await params).id);
