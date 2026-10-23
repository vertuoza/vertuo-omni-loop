import { Section } from '../KnowledgeLists';
import { Unreadable } from '../constituents/Unreadable';
import type { KnowledgeTab } from '../product-knowledge.contract';
import { loadRepositoriesData } from './repositories-load';
import { LEDE } from './repositories-section';
import { RepositoriesView } from './RepositoriesPages';

// The Repositories section's page (PRD 2419 s1), read as the signed-in person (repositories-load.ts) and
// drawn by RepositoriesPages.tsx; a section that cannot be read says so, and the page still opens.

export async function RepositoriesSection({ tab }: { tab: KnowledgeTab }) {
  const data = await loadRepositoriesData(tab.product.id);
  if (data === null) return <Section id="repositories-title" title="Repositories" lede={LEDE}><Unreadable what="repositories" /></Section>;
  return <RepositoriesView data={data} />;
}
