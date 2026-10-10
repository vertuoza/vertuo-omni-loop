import Link from 'next/link';
import { Notice } from '../ask/page/Notice';
import { SectionTabs } from '../nav/SectionTabs';
import type { SectionTab } from '../nav/section-tabs';
import { SituationNotice, type Situation } from '../products/ProductsScreen';
import { repositoriesTabHref, type RepositoriesTab } from './repositories-tab.contract';
import { RepositoriesTabPage, type TabSource } from './RepositoriesTabPage';

// The product home's Repositories & approvers tab, drawn (PRD 1364 s11): /app/products/<id>/repositories,
// the product's name, the product home's tabs, then the product's repositories, each editable by a
// workspace owner (LinksSection.tsx), and under them its Approvers list, moved here from Settings ›
// Products (PRD 1322). Before the tab, every situation of the product home.

/** Products in the sidebar: where the tab goes back to. */
const PRODUCTS_HOME_HREF = '/app/products';

export const TAB_LABEL = 'Repositories & approvers';

export type RepositoriesTabView = Situation | { kind: 'not-found' } | { kind: 'tab'; source: TabSource; tab: RepositoriesTab };

/** The demo's tab: two repositories, one consuming the other, the reader owning the workspace. */
export function demoRepositoriesTab(id: string): RepositoriesTab | null {
  if (id !== 'demo-product-1') return null;
  return {
    product: { id, name: 'Widgets' },
    owner: true,
    links: [
      { repo: 'acme/api', role: 'api', knowledge: 'own', readAt: null, readOnly: true, consumes: [], addedBy: 'person' },
      { repo: 'acme/widgets', role: 'web', knowledge: 'own', readAt: null, readOnly: false, consumes: ['acme/api'], addedBy: 'prd' },
    ],
    addable: ['acme/scripts'],
    approvers: {
      owner: true,
      members: [{ id: 'demo-irisa', name: 'Irisa', login: 'irisa' }, { id: 'demo-paul', name: 'Paul', login: 'paul' }, { id: 'demo-dev', name: 'Dev', login: 'dev' }],
      listed: [{ id: 'demo-irisa', name: 'Irisa', login: 'irisa', state: 'asked' }],
    },
  };
}

export interface RepositoriesTabScreenProps {
  view: RepositoriesTabView;
  /** The product home's tabs, this one among them. */
  tabs: SectionTab[];
  /** The repository Add a repository starts on (`?add=`). */
  add?: string | null;
}

export function RepositoriesTabScreen({ view, tabs, add = null }: RepositoriesTabScreenProps) {
  if (view.kind === 'tab') {
    const { tab } = view;
    return (
      <div className="ask-col products product-home">
        <section className="ask-card products-head" aria-labelledby="product-home-title">
          <Link className="products-back" href={PRODUCTS_HOME_HREF}>← Products</Link>
          <h1 id="product-home-title">{tab.product.name}</h1>
          <p className="ask-muted">The product’s repositories, and who approves its PRDs.</p>
        </section>
        <SectionTabs label={tab.product.name} tabs={tabs} current={repositoriesTabHref(tab.product.id)} />
        <RepositoriesTabPage source={view.source} tab={tab} add={add} />
      </div>
    );
  }
  if (view.kind === 'not-found') {
    return (
      <Notice title="No such product">
        <p className="ask-muted">Your workspace holds no product at this address. <Link href={PRODUCTS_HOME_HREF}>See your products →</Link></p>
      </Notice>
    );
  }
  return <SituationNotice view={view} />;
}
