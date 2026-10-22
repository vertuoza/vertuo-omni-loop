import type { Metadata } from 'next';
import '../../../../../../../src/products/products.css';
import '../../../../../../../src/product-home/product-home.css';
import '../../../../../../../src/product-knowledge/knowledge.css';
import '../../../../../../../src/business/business.css';
import '../../../../../../../src/business/constituents.css';
import { KnowledgePage } from '../../../../../../../src/product-knowledge/KnowledgePage';
import { ConstituentItem } from '../../../../../../../src/product-knowledge/constituents/ConstituentsPages';
import { segmentOf } from '../../../../../../../src/product-knowledge/knowledge-sections';

// /app/products/<id>/knowledge/constituents/<statement | never-n> (PRD 2240 s4): one line read whole, with
// its edit, remove and history. A line the product does not hold is the 404 page. `← Constituents` returns
// to the list with the sort the address carried. Rendered per request, as the signed-in person.

export const metadata: Metadata = { title: 'Product knowledge · OMNI LOOP' };

type Props = { params: Promise<{ id: string; item: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function ProductKnowledgeConstituentRoute({ params, searchParams }: Props) {
  const [{ id, item }, query] = await Promise.all([params, searchParams]);
  return <KnowledgePage id={id} section="constituents">{(tab) => <ConstituentItem tab={tab} item={segmentOf(item)} query={query} />}</KnowledgePage>;
}
