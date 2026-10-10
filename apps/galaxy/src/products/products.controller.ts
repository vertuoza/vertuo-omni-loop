import 'server-only';
import type { MemberSession } from '../data/member-session';
import { memberWorkspace } from '../data/workspace';
import { productsReads, type ProductsList } from './products.service';
import { DEMO_PRODUCTS_LIST, type ProductsHomeView } from './ProductsHome';

// /app/products's controller (PRD 1364 s8; ADR-0095): who reads the page decides what it draws, checked
// first. The demo in development (or OMNI_LOOP_DEMO=1); with no database, closed; signed out, the sign-in
// card, and no service runs; an account in no workspace says so. Signed in, the service reads as that
// person, on their own client, so row-level security has the last word; a failed read is the unreadable
// notice, logged.

type SignedIn = Extract<MemberSession, { kind: 'signed-in' }>;

/** What the page needs beside the session: the person's workspace, and the list read as them. */
export interface ProductsHomeDeps {
  workspace(session: SignedIn): Promise<{ id: string } | null>;
  list(session: SignedIn, workspace: string): Promise<ProductsList>;
}

const why = (err: unknown) => (err instanceof Error ? err.message : String(err));

export async function productsHomeViewOf(session: MemberSession, deps: ProductsHomeDeps): Promise<ProductsHomeView> {
  if (session.kind === 'demo') return { kind: 'products', list: DEMO_PRODUCTS_LIST };
  if (session.kind !== 'signed-in') return session;
  try {
    const workspace = await deps.workspace(session);
    if (!workspace) return { kind: 'no-workspace' };
    return { kind: 'products', list: await deps.list(session, workspace.id) };
  } catch (err) {
    console.error(`products: the list could not be read (${why(err)})`);
    return { kind: 'unreadable' };
  }
}

/** The live reads: the workspace the person joined first, as /app's, and the list on their client. */
export const LIVE_PRODUCTS_HOME: ProductsHomeDeps = {
  workspace: (session) => memberWorkspace(session.db, session.user.id),
  list: (session, workspace) => productsReads(session.db).list(workspace),
};
