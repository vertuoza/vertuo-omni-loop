import type { Metadata } from 'next';
import '../../../../../../../src/products/products.css';
import '../../../../../../../src/product-home/product-home.css';
import '../../../../../../../src/product-knowledge/knowledge.css';
import '../../../../../../../src/product-knowledge/search/search.css';
import '../../../../../../../src/product-knowledge/search/categories/categories.css';
import '../../../../../../../src/product-knowledge/search/eval/eval.css';
import { KnowledgePage } from '../../../../../../../src/product-knowledge/KnowledgePage';
import { EvalSection } from '../../../../../../../src/product-knowledge/search/eval/EvalSection';

// /app/products/<id>/knowledge/search/eval (PRD omni-loop-8 s5): top@1, top@5, recall@5 and recall@10 over time
// (?category= for one category), the latest run's misses, and the set of questions with their right answers, which
// a member fixes. Rendered per request, as the signed-in person, so only the workspace's members read a row
// (KnowledgePage.tsx).

export const metadata: Metadata = { title: 'Product search eval · OMNI LOOP' };

type Props = { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function ProductKnowledgeSearchEvalRoute({ params, searchParams }: Props) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  return <KnowledgePage id={id} section="search">{(tab) => <EvalSection tab={tab} query={query} />}</KnowledgePage>;
}
