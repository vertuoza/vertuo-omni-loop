import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { DocsPage } from './DocsPage';
import { guide } from './source';
import { sidebarItems } from './tree';

// One page of the guide, drawn (PRD 346): the sidebar, the page and its table of contents. /docs/<page>
// and /docs/api (PRD 2022 s3, which sets the API reference under the guide's page) both render it.

/** The guide page at `slug`, or a 404 when there is none; `after` is set under its body. */
export function GuideRoute({ slug, after }: { slug: string[] | undefined; after?: ReactNode }) {
  const page = guide.getPage(slug);
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
      {after}
    </DocsPage>
  );
}
