import 'server-only';
import type { MemberSession } from '../../data/member-session';
import type { Situation } from '../../products/ProductsScreen';
import type { productGraphService } from '../product-graph.service';
import { demoJoinedGraph, DEMO_PRODUCT } from './graph-page.demo';
import { graphPageOf, type GraphPageData, type GraphQuery } from './graph-page';

// The product's knowledge graph page, its controller (PRD 1798 s6; ADR-0095): /app/products/<id>/knowledge/graph.
// Who reads it decides what it draws, checked first. The demo in development (or OMNI_LOOP_DEMO=1); with no
// database, closed; signed out, the sign-in card. Signed in, the graph is read as that person (s3's reader on
// their client), so row-level security has the last word: a product they cannot read is not found, and a
// failed read is the unreadable notice, logged. Read-only: nothing here writes.

export type GraphPageView = Situation | { kind: 'not-found' } | { kind: 'graph'; data: GraphPageData; demo: boolean };

type SignedIn = Extract<MemberSession, { kind: 'signed-in' }>;

/** The product's whole joined graph as the signed-in person reads it; null when they read no such product. */
export interface GraphPageDeps {
  read(session: SignedIn, product: string): ReturnType<ReturnType<typeof productGraphService>['graph']>;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function liveView(session: SignedIn, product: string, query: GraphQuery, deps: GraphPageDeps): Promise<GraphPageView> {
  if (!UUID.test(product)) return { kind: 'not-found' };
  try {
    const read = await deps.read(session, product);
    return read === null ? { kind: 'not-found' } : { kind: 'graph', demo: false, data: graphPageOf({ id: read.product.id, name: read.product.name }, read.graph, query) };
  } catch (err) {
    console.error(`knowledge graph: ${product} could not be read (${err instanceof Error ? err.message : String(err)})`);
    return { kind: 'unreadable' };
  }
}

export function graphPageViewOf(session: MemberSession, product: string, query: GraphQuery, deps: GraphPageDeps): Promise<GraphPageView> {
  if (session.kind === 'demo') {
    return Promise.resolve(product === DEMO_PRODUCT.id ? { kind: 'graph', demo: true, data: graphPageOf(DEMO_PRODUCT, demoJoinedGraph(), query) } : { kind: 'not-found' });
  }
  return session.kind === 'signed-in' ? liveView(session, product, query, deps) : Promise.resolve(session);
}
