import type { Metadata } from 'next';
import '../../../../../../src/products/products.css';
import '../../../../../../src/product-home/product-home.css';
import '../../../../../../src/product-knowledge/knowledge.css';
import '../../../../../../src/business/business.css';
import { KnowledgePage } from '../../../../../../src/product-knowledge/KnowledgePage';
import { RepositoriesSection } from '../../../../../../src/product-knowledge/repositories/RepositoriesSection';

// /app/products/<id>/knowledge/repositories (PRD 2419 s1): for each repository of the product, its playbook
// pages and decision records read from its newest knowledge pack, each marked with its level and owner.
// Rendered per request, as the signed-in person (KnowledgePage.tsx).

export const metadata: Metadata = { title: 'Product repositories · OMNI LOOP' };

type Props = { params: Promise<{ id: string }> };

export default async function ProductKnowledgeRepositoriesRoute({ params }: Props) {
  const { id } = await params;
  return <KnowledgePage id={id} section="repositories">{(tab) => <RepositoriesSection tab={tab} />}</KnowledgePage>;
}
