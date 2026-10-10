import 'server-only';
import type { MemberSession } from '../data/member-session';
import { memberWorkspace } from '../data/workspace';
import { productHomeReads, type ProductHome } from './product-home.service';
import { demoProductHome, type ProductHomeView } from './ProductHome';

// /app/products/<id>'s controller (PRD 1364 s9; ADR-0095): who reads the page decides what it draws,
// checked first. The demo in development (or OMNI_LOOP_DEMO=1); with no database, closed; signed out, the
// sign-in card, and no service runs; an account in no workspace says so. Signed in, the service reads as
// that person, on their own client, so row-level security has the last word; a product the workspace does
// not hold is not found; a failed read is the unreadable notice, logged. Both tabs (Ledger, PRDs) draw
// from the one view.

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
    return demo === null ? { kind: 'not-found' } : { kind: 'home', home: demo };
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
