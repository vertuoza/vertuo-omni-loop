import Link from 'next/link';
import { SectionTabs } from '../../nav/SectionTabs';
import type { SectionTab } from '../../nav/section-tabs';
import { KnowledgeTabScreen } from '../../product-knowledge/KnowledgeTab';
import { knowledgeTabHref } from '../../product-knowledge/product-knowledge.contract';
import { graphHref, LIST_LIMIT, type EdgeLine, type GraphPageData, type NodeLine, type Picked, type RepositoryLine } from './graph-page';
import type { GraphPageView } from './graph-page.controller';

// The product's knowledge graph, drawn (PRD 1798 s6): /app/products/<id>/knowledge/graph, reached from the
// Knowledge tab's heading, which stays the marked tab. The product's name, the product home's tabs, then the
// repositories strip, the search and the node list, a picked node's neighbourhood, and the unresolved list.
// Read-only and without script: the search and the depth are a GET form, a node is a link, so the address
// holds what is shown.

const GRAPH_LABEL = 'Knowledge graph';
export const NO_REPOSITORY = 'This product links no repository yet.';
export const NO_MATCH = 'No node matches this search.';
export const NO_NODE = 'No such node in this graph.';
export const NOT_SERVED = 'Its knowledge is not pushed here.';

const PRODUCTS_HOME_HREF = '/app/products';

export interface KnowledgeGraphScreenProps {
  view: GraphPageView;
  /** The product home's tabs, Knowledge among them. */
  tabs: SectionTab[];
}

/** `2026-12-14T09:30:00.000Z` as `2026-12-14 09:30` (UTC). */
const pushedTime = (iso: string): string => `${iso.slice(0, 10)} ${iso.slice(11, 16)}`;

function RepositoryRow({ line }: { line: RepositoryLine }) {
  return (
    <li className="links-row" data-repository={line.repo}>
      <strong>{line.repo}</strong>
      {line.state === 'pushed' && (
        <span className="ask-muted">@{line.commit} · pushed {pushedTime(line.pushedAt)}{line.pushedBy ? ` by @${line.pushedBy}` : ''}</span>
      )}
      {line.state === 'never' && <span className="ask-muted">never pushed · run <code>{line.command}</code></span>}
      {line.state === 'not-served' && <span className="ask-muted">{NOT_SERVED}</span>}
    </li>
  );
}

function Origin({ node }: { node: NodeLine }) {
  return <span className="kgraph-origin" data-from={node.from}>{node.from}</span>;
}

function NodeItem({ node }: { node: NodeLine }) {
  return (
    <li className="links-row" data-node={node.id}>
      <Link href={node.href}><strong>{node.id}</strong></Link>
      <Origin node={node} />
      <span className="ask-muted">{node.kind}{node.label ? ` · ${node.label}` : ''}</span>
    </li>
  );
}

function Neighbourhood({ picked, data }: { picked: Picked; data: GraphPageData }) {
  if ('missing' in picked) return <p className="products-empty" role="status">{NO_NODE}</p>;
  const line = (edge: EdgeLine) => `${edge.from} → ${edge.kind} → ${edge.to}`;
  const own = picked.nodes.find((node) => node.id === picked.id);
  return (
    <>
      <p className="ask-muted" data-picked={picked.id}>
        {own?.label ?? picked.id}
      </p>
      <nav className="kgraph-depths" aria-label="Depth">
        {[1, 2, 3].map((depth) => (
          <Link key={depth} href={graphHref(data.product.id, { ...data.query, node: picked.id, depth })} aria-current={depth === picked.depth ? 'true' : undefined}>
            {`Depth ${String(depth)}`}
          </Link>
        ))}
      </nav>
      <ul className="links-list" aria-label="Neighbours">
        {picked.nodes.map((node) => (
          <li key={node.id} className="links-row" data-node={node.id} data-hop={node.hop}>
            <Link href={node.href}><strong>{node.id}</strong></Link>
            <Origin node={node} />
            <span className="ask-muted">{node.hop === 0 ? 'picked' : `${String(node.hop)} away`} · {node.kind}{node.label ? ` · ${node.label}` : ''}</span>
          </li>
        ))}
      </ul>
      {picked.edges.length > 0 && (
        <ul className="links-list" aria-label="Edges">
          {picked.edges.map((edge) => <li key={line(edge)} className="links-row ask-muted">{line(edge)}</li>)}
        </ul>
      )}
    </>
  );
}

function Repositories({ data }: { data: GraphPageData }) {
  return (
    <section className="ask-card products-section" aria-labelledby="graph-repositories-title">
      <h2 id="graph-repositories-title">Repositories</h2>
      {data.repositories.length === 0 ? <p className="products-empty">{NO_REPOSITORY}</p> : (
        <ul className="links-list">{data.repositories.map((line) => <RepositoryRow key={line.repo} line={line} />)}</ul>
      )}
    </section>
  );
}

function Nodes({ data }: { data: GraphPageData }) {
  const { query, picked } = data;
  const keep = picked && 'depth' in picked ? picked : null;
  return (
    <section className="ask-card products-section" aria-labelledby="graph-nodes-title">
      <h2 id="graph-nodes-title">Nodes</h2>
      <form method="get" action={graphHref(data.product.id, { q: '', node: null, depth: 1 })} role="search" className="links-form" aria-label="Search the graph">
        <label className="links-field">
          <span>Search</span>
          <input className="links-input" type="search" name="q" defaultValue={query.q} maxLength={200} />
        </label>
        {keep ? <input type="hidden" name="node" value={keep.id} /> : null}
        {keep ? <input type="hidden" name="depth" value={keep.depth} /> : null}
        <span className="links-actions"><button className="ask-button" type="submit">Search</button></span>
      </form>
      <p className="ask-muted" data-count>
        {data.matching === data.total ? `${String(data.total)} nodes` : `${String(data.matching)} of ${String(data.total)} nodes`}
        {data.matching > LIST_LIMIT ? ` · the first ${String(LIST_LIMIT)} are listed, search to narrow` : ''}
      </p>
      {data.list.length === 0 ? <p className="products-empty">{NO_MATCH}</p> : (
        <ul className="links-list">{data.list.map((node) => <NodeItem key={node.id} node={node} />)}</ul>
      )}
    </section>
  );
}

function Unresolved({ data }: { data: GraphPageData }) {
  if (data.unresolved.length === 0) return null;
  return (
    <section className="ask-card products-section" aria-labelledby="graph-unresolved-title">
      <h2 id="graph-unresolved-title">Unresolved</h2>
      <p className="ask-muted">Missing from the product’s <Link href={knowledgeTabHref(data.product.id)}>Knowledge</Link>.</p>
      <ul className="links-list">
        {data.unresolved.map((u) => <li key={`${u.node} ${u.id}`} className="links-row" data-unresolved={u.id}><strong>{u.id}</strong><span className="ask-muted">named by {u.node} in {u.repo}</span></li>)}
      </ul>
    </section>
  );
}

function KnowledgeGraphPage({ data }: { data: GraphPageData }) {
  return (
    <>
      <Repositories data={data} />
      <Nodes data={data} />
      {data.picked && (
        <section className="ask-card products-section" aria-labelledby="graph-picked-title">
          <h2 id="graph-picked-title">{data.picked.id}</h2>
          <Neighbourhood picked={data.picked} data={data} />
        </section>
      )}
      <Unresolved data={data} />
    </>
  );
}

export function KnowledgeGraphScreen({ view, tabs }: KnowledgeGraphScreenProps) {
  if (view.kind === 'graph') {
    const { data } = view;
    return (
      <div className="ask-col products product-home">
        <section className="ask-card products-head" aria-labelledby="product-home-title">
          <Link className="products-back" href={PRODUCTS_HOME_HREF}>← Products</Link>
          <h1 id="product-home-title">{data.product.name}</h1>
          <p className="ask-muted">{GRAPH_LABEL}. Read-only.</p>
          <p><Link href={knowledgeTabHref(data.product.id)}>← Knowledge</Link></p>
        </section>
        <SectionTabs label={data.product.name} tabs={tabs} current={knowledgeTabHref(data.product.id)} />
        <KnowledgeGraphPage data={data} />
      </div>
    );
  }
  return <KnowledgeTabScreen view={view} tabs={tabs} />;
}
