import { SectionTabs } from '../nav/SectionTabs';
import { countsOf, knowledgeSectionTabs, sectionHref, type SectionKey } from './knowledge-sections';
import type { KnowledgeTab } from './product-knowledge.contract';

// The Knowledge home's sub-menu (PRD 2240 s3): a second row of tabs under the product home's, one per
// section in the order of knowledge-sections.ts, each list section with its count of active items, the
// section showing marked.

export function KnowledgeNav({ tab, current }: { tab: KnowledgeTab; current: SectionKey | null }) {
  const { id, name } = tab.product;
  return <SectionTabs label={`${name} knowledge`} tabs={knowledgeSectionTabs(id, countsOf(tab))} current={current === null ? '' : sectionHref(id, current)} />;
}
