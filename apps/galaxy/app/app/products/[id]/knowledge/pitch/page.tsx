import type { Metadata } from 'next';
import '../../../../../../src/products/products.css';
import '../../../../../../src/product-home/product-home.css';
import '../../../../../../src/product-knowledge/knowledge.css';
import { KnowledgePage } from '../../../../../../src/product-knowledge/KnowledgePage';
import { PitchPanel } from '../../../../../../src/product-knowledge/pitch/PitchPanel';

// /app/products/<id>/knowledge/pitch (PRD 2240 s5): the product's Pitch settings, moved whole from
// Settings › Products: the controls for whoever may edit the business (BR-PRODUCT-70), every value as text
// for anyone else. Rendered per request, as the signed-in person (KnowledgePage.tsx).

export const metadata: Metadata = { title: 'Product pitch · OMNI LOOP' };

type Props = { params: Promise<{ id: string }> };

export default async function ProductKnowledgePitchRoute({ params }: Props) {
  const { id } = await params;
  return <KnowledgePage id={id} section="pitch">{() => <PitchPanel id={id} />}</KnowledgePage>;
}
