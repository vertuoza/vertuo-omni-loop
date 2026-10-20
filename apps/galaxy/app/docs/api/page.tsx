import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ApiReference } from '../../../src/docs/ApiReference';
import { GuideRoute } from '../../../src/docs/GuideRoute';
import { docsMetadata } from '../../../src/seo/seo';
import { guide } from '../../../src/docs/source';

// /docs/api (PRD 2022 s3): the API guide (docs/guide/api.md) and, under it, the reference Scalar renders
// from GET /api/v1/openapi.json. This route is more specific than /docs/[[...slug]], which would
// otherwise serve the guide page alone at the same address; it serves both, in the docs layout. Built
// statically: nothing here reads a session, a cookie or a database.

const SLUG = ['api'];

export function generateMetadata(): Metadata {
  const page = guide.getPage(SLUG);
  if (!page) notFound();
  return docsMetadata(page.url, page.data.title, page.data.description);
}

export default function ApiDocsRoute() {
  return <GuideRoute slug={SLUG} after={<ApiReference />} />;
}
