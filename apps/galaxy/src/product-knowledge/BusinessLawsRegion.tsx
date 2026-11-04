import type { Query } from '../nav/query';
import { BusinessLawsSection } from './BusinessLawsSection';
import { loadBusinessLaws } from './business-laws-load';
import { KnowledgeEntry } from './KnowledgeItem';
import type { ListSection } from './knowledge-sections';
import type { TabSource } from './KnowledgeTabPage';
import type { KnowledgeTab } from './product-knowledge.contract';

// The Business laws section's page (PRD 2632 s6): the product's laws read as the signed-in person, one read
// shared with the sub-menu's count. A read that fails leaves the section saying so, and the tab still opens.

/** An entry's page; a domain's also lists its business laws, read here (PRD 2632 s6). */
export async function EntryRegion({ section, item, tab, source, query }: { section: ListSection; item: string; tab: KnowledgeTab; source: TabSource; query: Query }) {
  const laws = section === 'domains' ? await loadBusinessLaws(tab.product.id) : undefined;
  return <KnowledgeEntry section={section} item={item} tab={tab} source={source} query={query} {...(laws === undefined ? {} : { laws })} />;
}

export async function BusinessLawsRegion({ tab, query }: { tab: KnowledgeTab; query: Query }) {
  return <BusinessLawsSection tab={tab} read={await loadBusinessLaws(tab.product.id)} query={query} />;
}
