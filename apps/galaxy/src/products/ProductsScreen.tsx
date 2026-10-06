import type { ReactNode } from 'react';
import { Notice } from '../ask/page/Notice';
import { SectionTabs } from '../nav/SectionTabs';
import { SETTINGS_TABS } from '../nav/section-tabs';
import { APP_HOME } from '../switch/switch';
import { PRODUCTS_HREF, type ProductRow } from './model';
import { ProductPage, type ProductPageProps } from './ProductPage';
import { ProductsView } from './ProductsView';

// Settings › Products in each situation (PRD 859 s1), decided once by the page: no database here;
// signed out (sign in on /app, then come back); an account in no workspace; the products that could
// not be read; a product the workspace does not hold; or the list, or one product's page. Every
// situation starts with the Settings tabs, Products marked.

/** The demo's two products: one in each look, so both read as they will. */
export const DEMO_PRODUCTS: ProductRow[] = [
  { id: 'demo-product-1', name: 'Widgets', look: 'arcade' },
  { id: 'demo-product-2', name: 'Legacy', look: 'keynote' },
];

type Situation = { kind: 'closed' } | { kind: 'sign-in' } | { kind: 'no-workspace' } | { kind: 'unreadable' };

export type ProductsScreenView = Situation | { kind: 'products'; products: ProductRow[] };

export type ProductScreenView = Situation | { kind: 'not-found' } | ({ kind: 'product' } & ProductPageProps);

function Tabs() {
  return <SectionTabs label="Settings" tabs={SETTINGS_TABS} current={PRODUCTS_HREF} />;
}

function SituationNotice({ view }: { view: Situation }): ReactNode {
  switch (view.kind) {
    case 'closed':
      return (
        <Notice title="Products are not open here">
          <p className="ask-muted">This deployment has no database, so it holds no workspace’s products.</p>
        </Notice>
      );
    case 'sign-in':
      return (
        <Notice title="Sign in to see your products">
          <p className="ask-muted">Your workspace’s products are for its members. <a href={APP_HOME}>Sign in on your dashboard</a>, then come back.</p>
        </Notice>
      );
    case 'no-workspace':
      return (
        <Notice title="Your account is not in a workspace">
          <p className="ask-muted">Products belong to a workspace. Sign in with your GitHub account to see yours.</p>
        </Notice>
      );
    case 'unreadable':
      return (
        <Notice title="Couldn’t load your products" tone="error">
          <p className="ask-muted">Reload in a moment.</p>
        </Notice>
      );
  }
}

export function ProductsScreen({ view }: { view: ProductsScreenView }) {
  return (
    <>
      <Tabs />
      {view.kind === 'products' ? <ProductsView products={view.products} /> : <SituationNotice view={view} />}
    </>
  );
}

function ProductBody({ view }: { view: ProductScreenView }) {
  if (view.kind === 'not-found') {
    return (
      <Notice title="No such product">
        <p className="ask-muted">This workspace holds no product at this address. <a href={PRODUCTS_HREF}>See its products</a>.</p>
      </Notice>
    );
  }
  if (view.kind === 'product') {
    return <ProductPage source={view.source} editable={view.editable} product={view.product} />;
  }
  return <SituationNotice view={view} />;
}

export function ProductScreen({ view }: { view: ProductScreenView }) {
  return (
    <>
      <Tabs />
      <ProductBody view={view} />
    </>
  );
}
