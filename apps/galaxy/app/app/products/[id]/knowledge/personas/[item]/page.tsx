import type { Metadata } from 'next';
import '../../../../../../../src/products/products.css';
import '../../../../../../../src/product-home/product-home.css';
import '../../../../../../../src/product-knowledge/knowledge.css';
import '../../../../../../../src/business/business.css';
import { KnowledgePage } from '../../../../../../../src/product-knowledge/KnowledgePage';
import { PersonaItem } from '../../../../../../../src/product-knowledge/personas/PersonasPages';
import { segmentOf } from '../../../../../../../src/product-knowledge/knowledge-sections';

// /app/products/<id>/knowledge/personas/<id> (PRD 2240 s4): one persona read whole, with
// its edit drawer and delete. A persona the product does not hold is the 404 page. `← Personas` returns
// to the list with the sort the address carried. Rendered per request, as the signed-in person.

export const metadata: Metadata = { title: 'Product knowledge · OMNI LOOP' };

type Props = { params: Promise<{ id: string; item: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function ProductKnowledgePersonaRoute({ params, searchParams }: Props) {
  const [{ id, item }, query] = await Promise.all([params, searchParams]);
  return <KnowledgePage id={id} section="personas">{(tab) => <PersonaItem tab={tab} item={segmentOf(item)} query={query} />}</KnowledgePage>;
}
