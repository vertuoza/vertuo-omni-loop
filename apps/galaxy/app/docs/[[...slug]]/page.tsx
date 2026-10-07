import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { DocsPage } from '../../../src/docs/DocsPage';
import { docsMetadata } from '../../../src/seo/seo';
import { guide } from '../../../src/docs/source';
import { sidebarItems } from '../../../src/docs/tree';

// /docs and /docs/<page> (PRD 346): one page of the guide, docs/guide/<page>.md (index.md at /docs),
// compiled by fumadocs-mdx and found by fumadocs-core's loader. Every page is built at build time,
// and a slug no page has is a 404: nothing here reads a session, a cookie or a database.

type Params = { params: Promise<{ slug?: string[] }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return guide.generateParams();
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const page = guide.getPage((await params).slug);
  if (!page) notFound();
  return docsMetadata(page.url, page.data.title, page.data.description);
}

export default async function DocsRoute({ params }: Params) {
  const page = guide.getPage((await params).slug);
  if (!page) notFound();
  const Body = page.data.body;
  return (
    <DocsPage
      items={sidebarItems(guide.pageTree)}
      url={page.url}
      title={page.data.title}
      description={page.data.description}
      toc={page.data.toc}
    >
      <Body />
    </DocsPage>
  );
}
