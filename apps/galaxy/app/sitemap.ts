import type { MetadataRoute } from 'next';
import { guide } from '../src/docs/source';
import { docsPaths, sitemapEntries } from '../src/seo/seo';

// /sitemap.xml (PRD 983): the home page, /releases and every docs page, each on the site's one
// address. Built at build time from the guide fumadocs compiled; the entries are src/seo/seo.ts's.

export default function sitemap(): MetadataRoute.Sitemap {
  return sitemapEntries(docsPaths(guide.getPages().map((page) => page.url)));
}
