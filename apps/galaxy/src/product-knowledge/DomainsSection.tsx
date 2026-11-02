import type { Query } from '../nav/query';
import { loadFoundDomains } from './found-domains-load';
import { DomainList } from './KnowledgeLists';
import { NotOnList } from './NotOnList';
import type { TabSource } from './KnowledgeTabPage';
import type { KnowledgeTab } from './product-knowledge.contract';

// The Domains section's page (PRD 2583 s1, s3): the product's list, then the folders its repositories hold
// that the list does not, read as the signed-in person (found-domains-load.ts), one read shared with the
// sub-menu's count. A read that fails leaves the region saying so, and the list still opens.

export async function DomainsSection({ tab, source, query }: { tab: KnowledgeTab; source: TabSource; query: Query }) {
  const found = await loadFoundDomains(tab);
  return (
    <>
      <DomainList tab={tab} source={source} query={query} />
      <NotOnList product={tab.product.id} source={source} decides={tab.domains.decides} found={found} />
    </>
  );
}
