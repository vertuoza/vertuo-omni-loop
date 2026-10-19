import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { MemberSession } from '../../data/member-session';
import { demoJoinedGraph } from './graph-page.demo';
import { graphHref, graphPageOf, graphQueryOf, LIST_LIMIT, PUSH_COMMAND, originOf } from './graph-page';
import { graphPageViewOf, type GraphPageDeps, type GraphPageView } from './graph-page.controller';
import { KnowledgeGraphScreen, NO_MATCH, NO_NODE, NO_REPOSITORY, NOT_SERVED } from './KnowledgeGraph';

vi.mock('server-only', () => ({}));

// The product's knowledge graph page (PRD 1798 s6) as the server renders it: the repositories strip (one
// pushed, one never pushed, one not served, none), the search and the node list, a node's neighbourhood
// labelled by repository, Legal and Glossary, the unresolved list, no control that edits anything; and the
// controller, in each situation, on a fake reader.

const PRODUCT = { id: 'demo-product-1', name: 'Widgets' };
const TABS = [
  { href: `/app/products/${PRODUCT.id}`, label: 'Ledger' },
  { href: `/app/products/${PRODUCT.id}/knowledge`, label: 'Knowledge' },
];
const NONE = graphQueryOf({});

const view = (query = NONE, graph = demoJoinedGraph()): GraphPageView => ({ kind: 'graph', demo: true, data: graphPageOf(PRODUCT, graph, query) });
const render = (v: GraphPageView) => renderToStaticMarkup(createElement(KnowledgeGraphScreen, { view: v, tabs: TABS }));
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, '\'').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const sectionOf = (html: string, id: string) => {
  const from = html.indexOf(`aria-labelledby="${id}"`);
  const next = html.indexOf('<section', from + 1);
  return html.slice(from, next < 0 ? undefined : next);
};

describe('the query', () => {
  it('keeps a depth of 1 to 3, and reads 1 for any other', () => {
    expect(graphQueryOf({ depth: '3' }).depth).toBe(3);
    for (const depth of ['0', '4', 'x', '1.5', null]) expect(graphQueryOf({ depth }).depth).toBe(1);
    expect(graphQueryOf({ q: '  rule ', node: '' })).toEqual({ q: 'rule', node: null, depth: 1 });
  });

  it('writes the address a search, a node and a depth make', () => {
    expect(graphHref('p 1', NONE)).toBe('/app/products/p%201/knowledge/graph');
    expect(graphHref('p', { q: 'a b', node: 'x/y', depth: 2 })).toBe('/app/products/p/knowledge/graph?q=a+b&node=x%2Fy&depth=2');
  });
});

describe('the page', () => {
  const html = render(view());

  it('is headed with the product, its tabs marking Knowledge, and says it is read-only', () => {
    expect(/<h1[^>]*>([^<]*)<\/h1>/.exec(html)?.[1]).toBe('Widgets');
    expect(text(/<a [^>]*aria-current="page"[^>]*>([^<]*)<\/a>/.exec(html)?.[1] ?? '')).toBe('Knowledge');
    expect(text(html)).toContain('Read-only');
  });

  it('strips the repositories: one pushed with its commit, time and pusher, one never pushed with the command', () => {
    const strip = text(sectionOf(html, 'graph-repositories-title'));
    expect(strip).toContain('billing @9086e70 · pushed 2026-12-14 09:30 by @anna');
    expect(strip).toContain(`portal never pushed · run ${PUSH_COMMAND}`);
  });

  it('says a link whose knowledge is not served, and a product with no link', () => {
    const graph = { ...demoJoinedGraph(), repositories: [{ repo: 'design', commit: null, pushedAt: null, pushedBy: null, graph: 'none' as const }] };
    expect(text(sectionOf(render(view(NONE, graph)), 'graph-repositories-title'))).toContain(`design ${NOT_SERVED}`);
    expect(text(sectionOf(render(view(NONE, { ...graph, repositories: [] })), 'graph-repositories-title'))).toContain(NO_REPOSITORY);
  });

  it('lists every node with where it comes from: its repository, Legal, Glossary', () => {
    const list = sectionOf(html, 'graph-nodes-title');
    expect(list).toMatch(/data-node="billing\/BR-BILLING-1"[^>]*>.*?data-from="billing"/s);
    expect(list).toMatch(/data-node="L-INVOICING-1"[^>]*>.*?data-from="Legal"/s);
    expect(list).toMatch(/data-node="term:credit note"[^>]*>.*?data-from="Glossary"/s);
    expect(list).toMatch(/data-node="never#1"[^>]*>.*?data-from="Never"/s);
    expect(text(list)).toContain('4 nodes');
  });

  it('searches by id, words or origin, and says when nothing matches', () => {
    const found = render(view(graphQueryOf({ q: 'GLOSSARY' })));
    expect(text(sectionOf(found, 'graph-nodes-title'))).toContain('1 of 4 nodes');
    expect(found).toContain('data-node="term:credit note"');
    expect(found).not.toContain('data-node="L-INVOICING-1"');
    expect(text(render(view(graphQueryOf({ q: 'zzz' }))))).toContain(NO_MATCH);
  });

  it('lists the first nodes of a long graph only, and says so', () => {
    const base = demoJoinedGraph();
    const nodes = Array.from({ length: LIST_LIMIT + 5 }, (_, n) => ({ ...(base.nodes[0] as (typeof base.nodes)[number]), id: `billing/N-${String(n)}` }));
    const long = render(view(NONE, { ...base, nodes }));
    expect(long.match(/data-node=/g)).toHaveLength(LIST_LIMIT);
    expect(text(long)).toContain(`the first ${String(LIST_LIMIT)} are listed`);
  });

  it('lists the unresolved edges under their own heading, and no heading when there are none', () => {
    expect(text(sectionOf(html, 'graph-unresolved-title'))).toContain('L-INVOICING-9 named by billing/BR-BILLING-1 in billing');
    expect(render(view(NONE, { ...demoJoinedGraph(), unresolved: [] }))).not.toContain('graph-unresolved-title');
  });

  it('offers no control that edits anything: one GET search form, no other form, no other button', () => {
    expect(html.match(/<form\b/g)).toHaveLength(1);
    expect(html).toMatch(/<form[^>]*method="get"/);
    expect([...html.matchAll(/<button\b[^>]*>([^<]*)<\/button>/g)].map((m) => m[1])).toEqual(['Search']);
    expect(html).not.toMatch(/method="post"/i);
  });
});

describe('a picked node', () => {
  const picked = (node: string, depth = 1) => render(view(graphQueryOf({ node, depth: String(depth) })));

  it('shows its neighbourhood, each node labelled, the picked one first', () => {
    const html = picked('billing/BR-BILLING-1');
    const section = sectionOf(html, 'graph-picked-title');
    expect(text(section)).toContain('billing/BR-BILLING-1');
    expect(section).toMatch(/data-node="billing\/BR-BILLING-1" data-hop="0"/);
    expect(section).toMatch(/data-node="L-INVOICING-1" data-hop="1"[^>]*>.*?data-from="Legal"/s);
    expect(section).toMatch(/data-node="term:credit note" data-hop="1"[^>]*>.*?data-from="Glossary"/s);
    expect(text(section)).toContain('billing/BR-BILLING-1 → serves → L-INVOICING-1');
  });

  it('links each depth, marking the one shown, and keeps the search', () => {
    const html = render(view(graphQueryOf({ q: 'inv', node: 'L-INVOICING-1', depth: '2' })));
    const depths = sectionOf(html, 'graph-picked-title');
    expect(depths).toMatch(/aria-current="true"[^>]*>Depth 2</);
    expect(depths).toContain('href="/app/products/demo-product-1/knowledge/graph?q=inv&amp;node=L-INVOICING-1&amp;depth=3"');
    expect(html).toContain('name="node" value="L-INVOICING-1"');
  });

  it('walks further at a greater depth', () => {
    const one = picked('L-INVOICING-1', 1).match(/data-hop=/g)?.length ?? 0;
    const two = picked('L-INVOICING-1', 2).match(/data-hop=/g)?.length ?? 0;
    expect(one).toBe(2);
    expect(two).toBeGreaterThan(one);
  });

  it('says a node the graph does not hold', () => {
    expect(text(picked('nope'))).toContain(NO_NODE);
  });

  it('names a node\'s origin: repository, Legal, Glossary, Never', () => {
    expect([originOf({ kind: 'rule', repo: 'api' }), originOf({ kind: 'legal', repo: null }), originOf({ kind: 'term', repo: null }), originOf({ kind: 'never', repo: null })]).toEqual(['api', 'Legal', 'Glossary', 'Never']);
  });
});

describe('the situations', () => {
  it('says what is wrong when there is no graph to show', () => {
    expect(text(render({ kind: 'not-found' }))).toContain('No such product');
    expect(text(render({ kind: 'sign-in' }))).toContain('Sign in to see your products');
    expect(text(render({ kind: 'unreadable' }))).toContain('Couldn’t load your products');
  });
});

describe('the controller', () => {
  const PRODUCT_ID = '22222222-2222-4222-8222-222222222221';
  const signedIn = { kind: 'signed-in', db: {}, env: { url: 'u', key: 'k' }, user: { id: 'u-1' } } as unknown as MemberSession;
  const read = vi.fn<GraphPageDeps['read']>();

  it('reads as the signed-in person and draws what they read, a product they cannot read as not found', async () => {
    read.mockResolvedValueOnce({ product: { id: PRODUCT_ID, key: 'w', name: 'Widgets' }, graph: demoJoinedGraph() });
    expect(await graphPageViewOf(signedIn, PRODUCT_ID, NONE, { read })).toMatchObject({ kind: 'graph', demo: false, data: { product: { name: 'Widgets' }, total: 4 } });
    read.mockResolvedValueOnce(null);
    expect(await graphPageViewOf(signedIn, PRODUCT_ID, NONE, { read })).toEqual({ kind: 'not-found' });
  });

  it('does not read for a bad address, a signed-out reader or a closed deployment; the demo has its own product', async () => {
    read.mockClear();
    expect(await graphPageViewOf(signedIn, 'not-an-id', NONE, { read })).toEqual({ kind: 'not-found' });
    for (const kind of ['closed', 'sign-in'] as const) expect(await graphPageViewOf({ kind }, PRODUCT_ID, NONE, { read })).toEqual({ kind });
    expect(read).not.toHaveBeenCalled();
    expect(await graphPageViewOf({ kind: 'demo' }, 'demo-product-1', NONE, { read })).toMatchObject({ kind: 'graph', demo: true });
    expect(await graphPageViewOf({ kind: 'demo' }, 'demo-product-9', NONE, { read })).toEqual({ kind: 'not-found' });
  });

  it('says a failed read as unreadable, logged', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    read.mockRejectedValueOnce(new Error('down'));
    expect(await graphPageViewOf(signedIn, PRODUCT_ID, NONE, { read })).toEqual({ kind: 'unreadable' });
    expect(log).toHaveBeenCalledWith(expect.stringContaining('down'));
  });
});
