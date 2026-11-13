import type { Metadata } from 'next';
import '../../../../../../../src/products/products.css';
import '../../../../../../../src/product-home/product-home.css';
import '../../../../../../../src/product-knowledge/knowledge.css';
import '../../../../../../../src/product-knowledge/search/search.css';
import '../../../../../../../src/product-knowledge/search/categories/categories.css';
import { KnowledgePage } from '../../../../../../../src/product-knowledge/KnowledgePage';
import { CategoriesSection } from '../../../../../../../src/product-knowledge/search/categories/CategoriesSection';

// /app/products/<id>/knowledge/search/categories (PRD omni-loop-7 s4): the topics agents asked the product's MCP
// server over 7, 30 or 90 days (?days=), each category opening (?category=) to its most-asked groups of questions.
// Rendered per request, as the signed-in person, so only the workspace's members read a row (KnowledgePage.tsx).

export const metadata: Metadata = { title: 'Product search categories · OMNI LOOP' };

type Props = { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function ProductKnowledgeSearchCategoriesRoute({ params, searchParams }: Props) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  return <KnowledgePage id={id} section="search">{(tab) => <CategoriesSection tab={tab} query={query} />}</KnowledgePage>;
}
