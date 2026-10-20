import Link from 'next/link';
import { Notice } from '../ask/page/Notice';
import { SectionTabs } from '../nav/SectionTabs';
import type { SectionTab } from '../nav/section-tabs';
import { SituationNotice, type Situation } from '../products/ProductsScreen';
import { knowledgeTabHref, type KnowledgeTab } from './product-knowledge.contract';
import { KnowledgeTabPage, type TabSource } from './KnowledgeTabPage';

// The product home's Knowledge tab, drawn (PRD 1795 s2): /app/products/<id>/knowledge, the product's name,
// the product home's tabs, then the Legal section and the Glossary section (KnowledgeTabPage.tsx). Before
// the tab, every situation of the product home.

/** Products in the sidebar: where the tab goes back to. */
const PRODUCTS_HOME_HREF = '/app/products';

export const KNOWLEDGE_LABEL = 'Knowledge';

/** The product's knowledge graph (PRD 1798 s6), read-only, linked from this tab's heading. */
export const knowledgeGraphHref = (product: string) => `${knowledgeTabHref(product)}/graph`;
export const GRAPH_LINK = 'Explore the knowledge graph →';

export type KnowledgeTabView = Situation | { kind: 'not-found' } | { kind: 'tab'; source: TabSource; tab: KnowledgeTab };

/** The demo's tab: a Legal owner, one entry and one term, each with who added it and when; the reader a member. */
export function demoKnowledgeTab(id: string): KnowledgeTab | null {
  if (id !== 'demo-product-1') return null;
  const anna = { user: 'demo-anna', login: 'anna' };
  return {
    product: { id, name: 'Widgets' },
    canName: false,
    latestEventId: null,
    members: [],
    legal: {
      owner: anna,
      delegate: null,
      decides: false,
      entries: [{
        entry: 'demo-legal-1', id: 'L-INVOICING-1', code: 'INVOICING', number: 1, statement: 'Invoice numbers follow each other with no gaps.',
        source: 'Belgian VAT Code, art. 53', owner: anna, retiredAt: null,
        createdBy: anna, createdAt: '2026-11-02T09:00:00Z', updatedAt: '2026-11-20T14:30:00Z',
      }],
      proposals: [],
    },
    glossary: {
      owner: anna,
      delegate: null,
      decides: false,
      entries: [{
        entry: 'demo-term-1', term: 'Credit note', meaning: 'A document that cancels all or part of an invoice.', avoid: ['refund'], removedAt: null,
        createdBy: anna, createdAt: '2026-11-04T10:15:00Z', updatedAt: '2026-11-04T10:15:00Z',
      }],
      proposals: [],
    },
  };
}

export interface KnowledgeTabScreenProps {
  view: KnowledgeTabView;
  /** The product home's tabs, this one among them. */
  tabs: SectionTab[];
}

export function KnowledgeTabScreen({ view, tabs }: KnowledgeTabScreenProps) {
  if (view.kind === 'tab') {
    const { tab } = view;
    return (
      <div className="ask-col products product-home">
        <section className="ask-card products-head" aria-labelledby="product-home-title">
          <Link className="products-back" href={PRODUCTS_HOME_HREF}>← Products</Link>
          <h1 id="product-home-title">{tab.product.name}</h1>
          <p className="ask-muted">What the law requires, and the product’s words, shared by every repository of the product.</p>
          <p><Link href={knowledgeGraphHref(tab.product.id)}>{GRAPH_LINK}</Link></p>
        </section>
        <SectionTabs label={tab.product.name} tabs={tabs} current={knowledgeTabHref(tab.product.id)} />
        <KnowledgeTabPage source={view.source} tab={tab} />
      </div>
    );
  }
  if (view.kind === 'not-found') {
    return (
      <Notice title="No such product">
        <p className="ask-muted">Your workspace holds no product at this address.</p>
        <p><Link href={PRODUCTS_HOME_HREF}>See your products →</Link></p>
      </Notice>
    );
  }
  return <SituationNotice view={view} />;
}
