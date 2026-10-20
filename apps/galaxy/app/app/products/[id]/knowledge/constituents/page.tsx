import type { Metadata } from 'next';
import '../../../../../../src/products/products.css';
import '../../../../../../src/product-home/product-home.css';
import '../../../../../../src/product-knowledge/knowledge.css';
import '../../../../../../src/business/business.css';
import '../../../../../../src/business/constituents.css';
import { KnowledgePage } from '../../../../../../src/product-knowledge/KnowledgePage';
import { ConstituentsList } from '../../../../../../src/product-knowledge/constituents/ConstituentsPages';

// /app/products/<id>/knowledge/constituents (PRD 2240 s4): the product's Statement and Never lines as a
// list sortable through the address (?sort=<column>&dir=asc|desc), the removed ones behind ?show=retired.
// Rendered per request, as the signed-in person (KnowledgePage.tsx).

export const metadata: Metadata = { title: 'Product knowledge · OMNI LOOP' };

type Props = { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function ProductKnowledgeConstituentsRoute({ params, searchParams }: Props) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  return <KnowledgePage id={id} section="constituents">{(tab) => <ConstituentsList tab={tab} query={query} />}</KnowledgePage>;
}
