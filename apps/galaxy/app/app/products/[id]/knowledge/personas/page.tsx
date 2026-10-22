import type { Metadata } from 'next';
import '../../../../../../src/products/products.css';
import '../../../../../../src/product-home/product-home.css';
import '../../../../../../src/product-knowledge/knowledge.css';
import '../../../../../../src/business/business.css';
import { KnowledgePage } from '../../../../../../src/product-knowledge/KnowledgePage';
import { PersonasList } from '../../../../../../src/product-knowledge/personas/PersonasPages';

// /app/products/<id>/knowledge/personas (PRD 2240 s4): the product's personas as a
// list sortable through the address (?sort=<column>&dir=asc|desc), each opening its own page.
// Rendered per request, as the signed-in person (KnowledgePage.tsx).

export const metadata: Metadata = { title: 'Product knowledge · OMNI LOOP' };

type Props = { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function ProductKnowledgePersonasRoute({ params, searchParams }: Props) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  return <KnowledgePage id={id} section="personas">{(tab) => <PersonasList tab={tab} query={query} />}</KnowledgePage>;
}
