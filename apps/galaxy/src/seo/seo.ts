import type { Metadata, MetadataRoute } from 'next';
import { skillNames, SKILLS_PATH } from '../docs/skills';
import { RELEASES_PATH, SITE } from '../releases/page/address';

// What search engines read (PRD 983): galaxy answers on two hosts, so every canonical address, og:url,
// robots line and sitemap entry names the site's one address, SITE, whichever host served the page.
// Only the public pages are indexed; everything behind sign-in stays out. app/robots.ts and
// app/sitemap.ts are thin: the rules and the entries are built and tested here.

/** The pages search engines may index: the home page, the release notes and the guide. */
export const PUBLIC_PATHS = ['/', RELEASES_PATH, '/docs'] as const;

/** Every other top-level route: the app, behind sign-in, and the routes it calls. */
const PRIVATE_PATHS = ['/app', '/prd', '/ask', '/knowledge', '/play', '/signup', '/auth', '/api', '/bugs', '/visual', '/design'];

/** A path's address on the site. */
export const siteUrl = (path: string) => `${SITE}${path}`;

/** A docs page's metadata: its title and description, its canonical address and og:url on the site. */
export function docsMetadata(path: string, title?: string, description?: string): Metadata {
  const url = siteUrl(path);
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { type: 'website', url, siteName: 'Omni Loop', title, description },
  };
}

/** robots.txt: the public pages allowed, every other route disallowed, the sitemap named. */
export function robotsRules() {
  return {
    rules: { userAgent: '*', allow: [...PUBLIC_PATHS], disallow: [...PRIVATE_PATHS] },
    sitemap: siteUrl('/sitemap.xml'),
  } satisfies MetadataRoute.Robots;
}

/** Every docs page's path: the guide's pages, as given, then the skills overview and each skill. */
export function docsPaths(guideUrls: readonly string[]): string[] {
  return [...new Set([...guideUrls, SKILLS_PATH, ...skillNames().map((name) => `${SKILLS_PATH}/${name}`)])];
}

/** The sitemap: the home page, the release notes, then every docs page, each on the site. */
export function sitemapEntries(docs: readonly string[]): MetadataRoute.Sitemap {
  return ['/', RELEASES_PATH, ...docs].map((path) => ({ url: siteUrl(path) }));
}
