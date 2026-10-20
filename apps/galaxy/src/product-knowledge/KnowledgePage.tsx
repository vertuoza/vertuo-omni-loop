import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { memberSession } from '../data/member-session';
import { LIVE_PRODUCT_HOME, productHomeViewOf } from '../product-home/product-home.controller';
import type { SectionTab } from '../nav/section-tabs';
import { ProductHome, productHomeTabs, type ProductHomeView } from '../product-home/ProductHome';
import type { SectionKey } from './knowledge-sections';
import { LIVE_KNOWLEDGE_TAB, knowledgeTabViewOf } from './product-knowledge.controller';
import { KnowledgeScreen, type KnowledgeTabView } from './KnowledgeTab';
import type { TabSource } from './KnowledgeTabPage';
import type { KnowledgeTab } from './product-knowledge.contract';

// A page of the Knowledge home (PRD 2240 s3), read as the signed-in person: the product home beside the
// product's knowledge, so row-level security decides what the reads return. An archived product (PRD 2232)
// has no Knowledge: its home's Ledger answers. `found` says whether the page's item exists once the product
// is read; one that does not is the 404 page. In development (or OMNI_LOOP_DEMO=1), the demo.

export interface KnowledgePageProps {
  id: string;
  section: SectionKey;
  found?: (tab: KnowledgeTab) => boolean;
  children: (tab: KnowledgeTab, source: TabSource) => ReactNode;
}

/** An entry the page names that the product does not hold. */
const missing = (view: KnowledgeTabView, found: KnowledgePageProps['found']): boolean => view.kind === 'tab' && found !== undefined && !found(view.tab);

/** The product home's tabs, or null when there is no home or it is archived: the Ledger answers then. */
const tabsOf = (home: ProductHomeView): SectionTab[] | null => (home.kind === 'home' && home.home.archived === null ? productHomeTabs(home.home) : null);

export async function KnowledgePage({ id, section, found, children }: KnowledgePageProps) {
  const session = await memberSession();
  const [home, view] = await Promise.all([
    productHomeViewOf(session, id, LIVE_PRODUCT_HOME),
    knowledgeTabViewOf(session, id, LIVE_KNOWLEDGE_TAB),
  ]);
  const tabs = tabsOf(home);
  if (tabs === null) return <ProductHome tab="ledger" view={home} />;
  if (missing(view, found)) notFound();
  return <KnowledgeScreen view={view} tabs={tabs} section={section}>{children}</KnowledgeScreen>;
}
