import { Section } from '../KnowledgeLists';
import { Unreadable } from '../constituents/Unreadable';
import type { Query } from '../../nav/query';
import type { KnowledgeTab } from '../product-knowledge.contract';
import { SearchViews } from './categories/CategoriesView';
import { loadSearches } from './search-load';
import { periodOf } from './search-stats';
import { LEDE, SearchView, TITLE } from './SearchView';

// The Search section's page (PRD omni-loop-6 s3), read as the signed-in person (search-load.ts) and drawn by
// SearchView.tsx; a log that cannot be read says so, and the page still opens. Its views' links lead to the
// Categories view (PRD omni-loop-7 s4).

export async function SearchSection({ tab, query }: { tab: KnowledgeTab; query: Query }) {
  const now = Date.now();
  const rows = await loadSearches(tab.product.id, now);
  return (
    <>
      <SearchViews product={tab.product.id} shown="overview" />
      {rows === null
        ? <Section id="search-title" title={TITLE} lede={LEDE}><Unreadable what="searches" /></Section>
        : <SearchView product={tab.product.id} rows={rows} days={periodOf(query)} now={now} />}
    </>
  );
}
