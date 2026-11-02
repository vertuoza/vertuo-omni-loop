import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import '../../../../../../src/products/products.css';
import '../../../../../../src/product-home/product-home.css';
import '../../../../../../src/product-knowledge/knowledge.css';
import { KnowledgePage } from '../../../../../../src/product-knowledge/KnowledgePage';
import { DomainsSection } from '../../../../../../src/product-knowledge/DomainsSection';
import { KnowledgeList } from '../../../../../../src/product-knowledge/KnowledgeLists';
import { listSectionOf } from '../../../../../../src/product-knowledge/knowledge-sections';

// /app/products/<id>/knowledge/legal, /glossary (PRD 2240 s3) and /domains (PRD 2583 s1): a section of the
// Knowledge home as a list (Domains also with its Not on the list region, PRD 2583 s3) sortable through the address (?sort=<column>&dir=asc|desc), its retired items
// behind ?show=retired.
// Constituents, Personas, Pitch and Settings have a folder of their own beside this one. Rendered per
// request, as the signed-in person (KnowledgePage.tsx).

export const metadata: Metadata = { title: 'Product knowledge · OMNI LOOP' };

type Props = { params: Promise<{ id: string; section: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function ProductKnowledgeSectionRoute({ params, searchParams }: Props) {
  const [{ id, section: segment }, query] = await Promise.all([params, searchParams]);
  const section = listSectionOf(segment);
  if (section === null) notFound();
  return (
    <KnowledgePage id={id} section={section}>
      {(tab, source) => (section === 'domains'
        ? <DomainsSection tab={tab} source={source} query={query} />
        : <KnowledgeList section={section} tab={tab} source={source} query={query} />)}
    </KnowledgePage>
  );
}
