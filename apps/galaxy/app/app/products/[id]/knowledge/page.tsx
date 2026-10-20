import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { FIRST_SECTION, sectionHref } from '../../../../../src/product-knowledge/knowledge-sections';

// /app/products/<id>/knowledge (PRD 1795 s2, PRD 2240 s3): the product home's Knowledge tab opens on its
// first section, Constituents. Each section has its own address under this one (knowledge-sections.ts), and
// the sub-menu on every one of them.

export const metadata: Metadata = { title: 'Product knowledge · OMNI LOOP' };

type Props = { params: Promise<{ id: string }> };

export default async function ProductKnowledgeRoute({ params }: Props) {
  const { id } = await params;
  redirect(sectionHref(id, FIRST_SECTION));
}
