import type { Metadata } from 'next';
import '../../../../../src/products/products.css';
import '../../../../../src/product-home/product-home.css';
import { memberSession } from '../../../../../src/data/member-session';
import { LIVE_PRODUCT_HOME, productHomeViewOf } from '../../../../../src/product-home/product-home.controller';
import { ProductHome, productHomeTabs } from '../../../../../src/product-home/ProductHome';
import { LIVE_KNOWLEDGE_TAB, knowledgeTabViewOf } from '../../../../../src/product-knowledge/product-knowledge.controller';
import { KnowledgeTabScreen } from '../../../../../src/product-knowledge/KnowledgeTab';

// /app/products/<id>/knowledge (PRD 1795 s2): the product home's Knowledge tab, after Questions: the
// product's Legal entries and Glossary terms, each section naming its owner and delegate, its open
// proposals and the controls the reader's role allows. Rendered per request, as the signed-in person, so
// row-level security decides what the reads return; the product home is read beside it for its tabs. In
// development (or OMNI_LOOP_DEMO=1), the demo, whose changes are not saved.

export const metadata: Metadata = { title: 'Product knowledge · OMNI LOOP' };

type Props = { params: Promise<{ id: string }> };

export default async function ProductKnowledgeRoute({ params }: Props) {
  const [{ id }, session] = await Promise.all([params, memberSession()]);
  const [home, view] = await Promise.all([
    productHomeViewOf(session, id, LIVE_PRODUCT_HOME),
    knowledgeTabViewOf(session, id, LIVE_KNOWLEDGE_TAB),
  ]);
  if (home.kind !== 'home') return <ProductHome tab="ledger" view={home} />;
  return <KnowledgeTabScreen view={view} tabs={productHomeTabs(home.home)} />;
}
