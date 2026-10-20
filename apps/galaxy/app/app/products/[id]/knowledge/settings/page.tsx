import type { Metadata } from 'next';
import '../../../../../../src/products/products.css';
import '../../../../../../src/product-home/product-home.css';
import '../../../../../../src/product-knowledge/knowledge.css';
import '../../../../../../src/business/business.css';
import { KnowledgePage } from '../../../../../../src/product-knowledge/KnowledgePage';
import { SettingsPanel } from '../../../../../../src/product-knowledge/settings/SettingsPanel';

// /app/products/<id>/knowledge/settings (PRD 2240 s6): Region (shared by every product), the picks, the
// claim lists, To check and the draft from repos, moved whole from Settings › Business. Rendered per
// request, as the signed-in person (KnowledgePage.tsx).

export const metadata: Metadata = { title: 'Product settings · OMNI LOOP' };

type Props = { params: Promise<{ id: string }> };

export default async function ProductKnowledgeSettingsRoute({ params }: Props) {
  const { id } = await params;
  return <KnowledgePage id={id} section="settings">{() => <SettingsPanel id={id} />}</KnowledgePage>;
}
