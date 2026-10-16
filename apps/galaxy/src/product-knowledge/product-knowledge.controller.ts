import 'server-only';
import type { MemberSession } from '../data/member-session';
import { viewer } from '../data/viewer';
import { memberWorkspace } from '../data/workspace';
import { KNOWLEDGE_REFUSALS, KnowledgeWriteSchema, type KnowledgeRefusal, type KnowledgeWrite } from './product-knowledge.contract';
import { knowledgeReads, type KnowledgeService, type KnowledgeTab } from './product-knowledge.service';
import { demoKnowledgeTab, type KnowledgeTabView } from './KnowledgeTab';

// The product home's Knowledge tab, its controller (PRD 1795 s2; ADR-0095).
//
// The page, /app/products/<id>/knowledge: who reads it decides what it draws, checked first. The demo in
// development (or OMNI_LOOP_DEMO=1); with no database, closed; signed out, the sign-in card, and no service
// runs; an account in no workspace says so. Signed in, the service reads as that person, so row-level
// security has the last word; a product the workspace does not hold is not found; a failed read is the
// unreadable notice, logged.
//
// The route the tab's browser client calls (product-knowledge.client.ts), in the shapes of
// product-knowledge.contract.ts: POST …/knowledge/changes. The session is checked first, from the
// request's cookie claims, as viewer() reads them: signed out (or the demo, or no database here), 401 and
// no service runs. Signed in, the service writes as that person, so the database decides who may.

type SignedIn = Extract<MemberSession, { kind: 'signed-in' }>;

/** What the page needs beside the session: the person's workspace, and the tab read as them. */
export interface KnowledgeTabDeps {
  workspace(session: SignedIn): Promise<{ id: string } | null>;
  tab(session: SignedIn, workspace: string, product: string): Promise<KnowledgeTab | null>;
}

const why = (err: unknown) => (err instanceof Error ? err.message : String(err));

const shown = (source: 'demo' | 'live', tab: KnowledgeTab | null): KnowledgeTabView => (tab === null ? { kind: 'not-found' } : { kind: 'tab', source: { kind: source }, tab });

/** The tab read as the signed-in person: their workspace first, then the product in it. */
async function liveView(session: SignedIn, product: string, deps: KnowledgeTabDeps): Promise<KnowledgeTabView> {
  try {
    const workspace = await deps.workspace(session);
    return workspace ? shown('live', await deps.tab(session, workspace.id, product)) : { kind: 'no-workspace' };
  } catch (err) {
    console.error(`product knowledge: ${product} could not be read (${why(err)})`);
    return { kind: 'unreadable' };
  }
}

export function knowledgeTabViewOf(session: MemberSession, product: string, deps: KnowledgeTabDeps): Promise<KnowledgeTabView> {
  if (session.kind === 'demo') return Promise.resolve(shown('demo', demoKnowledgeTab(product)));
  return session.kind === 'signed-in' ? liveView(session, product, deps) : Promise.resolve(session);
}

/** The live reads: the workspace the person joined first, as /app's, and the tab on their client. */
export const LIVE_KNOWLEDGE_TAB: KnowledgeTabDeps = {
  workspace: (session) => memberWorkspace(session.db, session.user.id),
  tab: (session, workspace, product) => knowledgeReads(session.db).tab(workspace, product),
};

// ── The route ──

export type KnowledgeHandlerDeps = {
  /** The service as the signed-in person, or null when nobody is signed in. */
  signedIn: () => Promise<KnowledgeService | null>;
  log: (line: string) => void;
};

const NO_STORE = { 'cache-control': 'no-store' };
const MAX_BODY_CHARS = 16 * 1024;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SIGNED_OUT = 'Sign in first to change this product.';
const NO_PRODUCT = 'No such product.';
const MALFORMED = 'The body must be a change, a decision or a naming of an owner, as the Knowledge tab sends it.';
const COULD_NOT_SAVE = 'Couldn’t save this. Try again in a moment.';

const reply = (status: number, body: unknown): Response => Response.json(body, { status, headers: NO_STORE });
const refuse = (kind: KnowledgeRefusal, error: string): Response => reply(KNOWLEDGE_REFUSALS[kind], { error });

/** A request's JSON body, or undefined when it is too large or no JSON. */
const bodyOf = (request: Request): Promise<unknown> =>
  request.text().then((text): unknown => (text.length > MAX_BODY_CHARS ? undefined : JSON.parse(text))).catch(() => undefined);

export function knowledgeHandlers(deps: KnowledgeHandlerDeps) {
  return {
    /** POST …/changes: a change, a decision or a naming, as the signed-in person. */
    async change(request: Request, product: string): Promise<Response> {
      const service = await deps.signedIn();
      if (!service) return refuse('signed-out', SIGNED_OUT);
      if (!UUID.test(product)) return refuse('missing', NO_PRODUCT);
      const parsed = KnowledgeWriteSchema.safeParse(await bodyOf(request));
      if (!parsed.success) return refuse('malformed', MALFORMED);
      const write: KnowledgeWrite = parsed.data;
      try {
        const done = await service.change(product, write);
        if (done.ok) return reply(200, done.value);
        if (done.kind !== 'database') return refuse(done.kind, done.error);
        deps.log(`product knowledge: ${done.error} (${product})`);
      } catch (err) {
        deps.log(`product knowledge: ${why(err)} (${product})`);
      }
      return refuse('database', COULD_NOT_SAVE);
    },
  };
}

const live = knowledgeHandlers({
  async signedIn() {
    const seen = await viewer();
    return seen.kind === 'signed-in' ? knowledgeReads(seen.db) : null;
  },
  log: (line) => { console.error(line); },
});

type Params = { params: Promise<{ id: string }> };

/** POST /app/products/<id>/knowledge/changes */
export const postChange = async (request: Request, { params }: Params): Promise<Response> => live.change(request, (await params).id);
