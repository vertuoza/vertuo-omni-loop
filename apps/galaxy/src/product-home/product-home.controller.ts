import 'server-only';
import { log } from 'omni-loop/kit/lib/log/log.ts';
import type { MemberSession } from '../data/member-session';
import { viewer } from '../data/viewer';
import { memberWorkspace } from '../data/workspace';
import { ARCHIVE_REFUSALS } from './product-archive.contract';
import { productHomeReads, type ArchiveOutcome, type ProductHome, type ProductHomeService } from './product-home.service';
import { demoProductHome, type ProductHomeView } from './ProductHome';

// /app/products/<id>'s controller (PRD 1364 s9; ADR-0095): who reads the page decides what it draws,
// checked first. The demo in development (or OMNI_LOOP_DEMO=1); with no database, closed; signed out, the
// sign-in card, and no service runs; an account in no workspace says so. Signed in, the service reads as
// that person, on their own client, so row-level security has the last word; a product the workspace does
// not hold is not found; a failed read is the unreadable notice, logged. Both tabs (Ledger, PRDs) draw
// from the one view. A member reads no archived product (row-level security), so its home is not found.
//
// Since PRD 2232 s1, the routes the head card's Archive and the archived banner's Restore call
// (product-archive.client.ts), in the shapes of product-archive.contract.ts: POST …/archive and POST
// …/restore. The session is checked first, from the request's cookie claims, as viewer() reads them:
// signed out (or the demo, or no database here), 401 and no service runs. Signed in, the service writes as
// that person, so the database decides who may (an owner).

type SignedIn = Extract<MemberSession, { kind: 'signed-in' }>;

/** What the page needs beside the session: the person's workspace, and the product home read as them. */
export interface ProductHomeDeps {
  workspace(session: SignedIn): Promise<{ id: string } | null>;
  home(session: SignedIn, workspace: string, product: string): Promise<ProductHome | null>;
}

const why = (err: unknown) => (err instanceof Error ? err.message : String(err));

export async function productHomeViewOf(session: MemberSession, product: string, deps: ProductHomeDeps): Promise<ProductHomeView> {
  if (session.kind === 'demo') {
    const demo = demoProductHome(product);
    return demo === null ? { kind: 'not-found' } : { kind: 'home', home: demo, demo: true };
  }
  if (session.kind !== 'signed-in') return session;
  try {
    const workspace = await deps.workspace(session);
    if (!workspace) return { kind: 'no-workspace' };
    const home = await deps.home(session, workspace.id, product);
    return home === null ? { kind: 'not-found' } : { kind: 'home', home };
  } catch (err) {
    console.error(`product home: ${product} could not be read (${why(err)})`);
    return { kind: 'unreadable' };
  }
}

/** The live reads: the workspace the person joined first, as /app's, and the product home on their client. */
export const LIVE_PRODUCT_HOME: ProductHomeDeps = {
  workspace: (session) => memberWorkspace(session.db, session.user.id),
  home: (session, workspace, product) => productHomeReads(session.db).home({ product, workspace, me: session.user.id }),
};

// ── The routes ──

export type ProductArchiveHandlerDeps = {
  /** The service as the signed-in person, or null when nobody is signed in. */
  signedIn: () => Promise<ProductHomeService | null>;
  log: (line: string) => void;
};

const NO_STORE = { 'cache-control': 'no-store' };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SIGNED_OUT = 'Sign in first to change this product.';
const NO_PRODUCT = 'No such product.';
const COULD_NOT_CHANGE = 'Couldn’t change this product. Try again in a moment.';

const reply = (status: number, body: unknown): Response => Response.json(body, { status, headers: NO_STORE });

export function productArchiveHandlers(deps: ProductArchiveHandlerDeps) {
  /** Runs `change` on `product` as the signed-in person. */
  async function run(product: string, change: (service: ProductHomeService) => Promise<ArchiveOutcome>): Promise<Response> {
    const service = await deps.signedIn();
    if (!service) return reply(ARCHIVE_REFUSALS['signed-out'], { error: SIGNED_OUT });
    if (!UUID.test(product)) return reply(ARCHIVE_REFUSALS.missing, { error: NO_PRODUCT });
    try {
      const done = await change(service);
      if (done.ok) return reply(200, done.value);
      if (done.kind !== 'database') return reply(ARCHIVE_REFUSALS[done.kind], { error: done.error });
      deps.log(`product archive: ${done.error} (${product})`);
    } catch (err) {
      deps.log(`product archive: ${why(err)} (${product})`);
    }
    return reply(ARCHIVE_REFUSALS.database, { error: COULD_NOT_CHANGE });
  }
  return {
    /** POST …/archive: an owner archives the product. */
    archive: (_request: Request, product: string) => run(product, (s) => s.archive(product)),
    /** POST …/restore: an owner restores it as it was. */
    restore: (_request: Request, product: string) => run(product, (s) => s.restore(product)),
  };
}

const live = productArchiveHandlers({
  async signedIn() {
    const seen = await viewer();
    return seen.kind === 'signed-in' ? productHomeReads(seen.db) : null;
  },
  log: (message) => { log.error({ event: 'product-archive', outcome: 'failed', message }); },
});

type Params = { params: Promise<{ id: string }> };

/** POST /app/products/<id>/archive */
export const postArchive = async (request: Request, { params }: Params): Promise<Response> => live.archive(request, (await params).id);
/** POST /app/products/<id>/restore */
export const postRestore = async (request: Request, { params }: Params): Promise<Response> => live.restore(request, (await params).id);
