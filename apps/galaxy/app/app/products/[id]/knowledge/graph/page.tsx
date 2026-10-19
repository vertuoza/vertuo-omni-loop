import type { Metadata } from 'next';
import '../../../../../../src/products/products.css';
import '../../../../../../src/product-home/product-home.css';
import '../../../../../../src/knowledge-graph/tab/graph-page.css';
import { firstParam, memberSession } from '../../../../../../src/data/member-session';
import { LIVE_PRODUCT_HOME, productHomeViewOf } from '../../../../../../src/product-home/product-home.controller';
import { ProductHome, productHomeTabs } from '../../../../../../src/product-home/ProductHome';
import { graphQueryOf } from '../../../../../../src/knowledge-graph/tab/graph-page';
import { graphPageViewOf } from '../../../../../../src/knowledge-graph/tab/graph-page.controller';
import { LIVE_GRAPH_PAGE } from '../../../../../../src/knowledge-graph/tab/graph-page-live';
import { KnowledgeGraphScreen } from '../../../../../../src/knowledge-graph/tab/KnowledgeGraph';

// /app/products/<id>/knowledge/graph (PRD 1798 s6): the product's knowledge graph, reached from the
// Knowledge tab's heading. Every repository's pushed graph joined with the product's Legal, Glossary and
// Never lines, searched and walked from a picked node (?q=…&node=…&depth=1..3). Rendered per request, as the
// signed-in person, so row-level security decides what the reads return. Read-only. In development (or
// OMNI_LOOP_DEMO=1), the demo.

export const metadata: Metadata = { title: 'Knowledge graph · OMNI LOOP' };

type Props = { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function ProductKnowledgeGraphRoute({ params, searchParams }: Props) {
  const [{ id }, raw, session] = await Promise.all([params, searchParams, memberSession()]);
  const query = graphQueryOf({ q: firstParam(raw.q), node: firstParam(raw.node), depth: firstParam(raw.depth) });
  const [home, view] = await Promise.all([
    productHomeViewOf(session, id, LIVE_PRODUCT_HOME),
    graphPageViewOf(session, id, query, LIVE_GRAPH_PAGE),
  ]);
  if (home.kind !== 'home') return <ProductHome tab="ledger" view={home} />;
  return <KnowledgeGraphScreen view={view} tabs={productHomeTabs(home.home)} />;
}
