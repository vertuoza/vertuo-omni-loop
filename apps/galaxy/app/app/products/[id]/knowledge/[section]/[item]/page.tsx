import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import '../../../../../../../src/products/products.css';
import '../../../../../../../src/product-home/product-home.css';
import '../../../../../../../src/product-knowledge/knowledge.css';
import { KnowledgePage } from '../../../../../../../src/product-knowledge/KnowledgePage';
import { KnowledgeEntry, entryExists } from '../../../../../../../src/product-knowledge/KnowledgeItem';
import { listSectionOf, segmentOf } from '../../../../../../../src/product-knowledge/knowledge-sections';

// /app/products/<id>/knowledge/legal/<code> and /glossary/<entry> (PRD 2240 s3): one entry read whole, with
// the controls the reader's role allows and its history. An entry the product does not hold is the 404
// page. `← Legal` returns to the list with the sort the address carried. Rendered per request, as the
// signed-in person (KnowledgePage.tsx).

export const metadata: Metadata = { title: 'Product knowledge · OMNI LOOP' };

type Props = {
  params: Promise<{ id: string; section: string; item: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ProductKnowledgeItemRoute({ params, searchParams }: Props) {
  const [{ id, section: segment, item: raw }, query] = await Promise.all([params, searchParams]);
  const section = listSectionOf(segment);
  if (section === null) notFound();
  const item = segmentOf(raw);
  return (
    <KnowledgePage id={id} section={section} found={(tab) => entryExists(tab, section, item)}>
      {(tab, source) => <KnowledgeEntry section={section} item={item} tab={tab} source={source} query={query} />}
    </KnowledgePage>
  );
}
