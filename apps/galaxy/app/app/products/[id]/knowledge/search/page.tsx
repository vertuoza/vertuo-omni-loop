import type { Metadata } from 'next';
import '../../../../../../src/products/products.css';
import '../../../../../../src/product-home/product-home.css';
import '../../../../../../src/product-knowledge/knowledge.css';
import '../../../../../../src/product-knowledge/search/search.css';
import { KnowledgePage } from '../../../../../../src/product-knowledge/KnowledgePage';
import { SearchSection } from '../../../../../../src/product-knowledge/search/SearchSection';

// /app/products/<id>/knowledge/search (PRD omni-loop-6 s3): what agents asked the product's MCP server over 7, 30
// or 90 days (?days=), and how well it answered. Rendered per request, as the signed-in person, so only the
// workspace's members read a row (KnowledgePage.tsx).

export const metadata: Metadata = { title: 'Product search · OMNI LOOP' };

type Props = { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function ProductKnowledgeSearchRoute({ params, searchParams }: Props) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  return <KnowledgePage id={id} section="search">{(tab) => <SearchSection tab={tab} query={query} />}</KnowledgePage>;
}
