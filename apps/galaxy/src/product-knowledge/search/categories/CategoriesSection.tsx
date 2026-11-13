import { Section } from '../../KnowledgeLists';
import { Unreadable } from '../../constituents/Unreadable';
import type { Query } from '../../../nav/query';
import type { KnowledgeTab } from '../../product-knowledge.contract';
import { periodOf } from '../search-stats';
import { loadCategorized } from './categories-load';
import { CATEGORIES_LEDE, CATEGORIES_TITLE, CategoriesView, SearchViews } from './CategoriesView';

// The Search section's Categories page (PRD omni-loop-7 s4), read as the signed-in person (categories-load.ts)
// and drawn by CategoriesView.tsx; a log that cannot be read says so, and the page still opens.

export async function CategoriesSection({ tab, query }: { tab: KnowledgeTab; query: Query }) {
  const now = Date.now();
  const product = tab.product.id;
  const read = await loadCategorized(product, now);
  return (
    <>
      <SearchViews product={product} shown="categories" />
      {read === null
        ? <Section id="search-categories-title" title={CATEGORIES_TITLE} lede={CATEGORIES_LEDE}><Unreadable what="searches" /></Section>
        : <CategoriesView product={product} rows={read.rows} groups={read.groups} days={periodOf(query)} now={now} query={query} domains={tab.domains.entries} />}
    </>
  );
}
