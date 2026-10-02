import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { readGuide } from '../docs/guide';
import { pageUrl } from '../docs/paths';
import { skillNames, SKILLS_PATH } from '../docs/skills';
import { SITE } from '../releases/page/address';
import { docsMetadata, docsPaths, PUBLIC_PATHS, robotsRules, siteUrl, sitemapEntries } from './seo';

// One address for the public pages (PRD 983, s1): galaxy answers on two hosts, and every canonical
// address, Open Graph url, robots line and sitemap entry it prints names www.omni-loop.xyz, whichever
// host served the page.

const GUIDE = fileURLToPath(new URL('../../../../docs/guide', import.meta.url));
const guideUrls = () => readGuide(GUIDE).pages.map((page) => pageUrl(page.slug));
const { metadata: rootMetadata } = await import('../../app/layout.tsx');
const { default: robots } = await import('../../app/robots.ts');

describe('the site address', () => {
  it('is www.omni-loop.xyz', () => {
    expect(SITE).toBe('https://www.omni-loop.xyz');
  });

  it('is the root layout\'s metadataBase, so every relative address resolves on it', () => {
    expect(String(rootMetadata.metadataBase)).toBe('https://www.omni-loop.xyz/');
  });

  it('turns a path into its address on the site', () => {
    expect(siteUrl('/')).toBe('https://www.omni-loop.xyz/');
    expect(siteUrl('/docs/install')).toBe('https://www.omni-loop.xyz/docs/install');
  });
});

describe('a docs page\'s metadata', () => {
  const metadata = docsMetadata('/docs/install', 'Install', 'Install the kit.');

  it('keeps its title and description', () => {
    expect(metadata).toMatchObject({ title: 'Install', description: 'Install the kit.' });
  });

  it('names its canonical address and og:url on the site', () => {
    expect(metadata.alternates).toEqual({ canonical: 'https://www.omni-loop.xyz/docs/install' });
    expect(metadata.openGraph).toMatchObject({
      type: 'website', url: 'https://www.omni-loop.xyz/docs/install', siteName: 'Omni Loop', title: 'Install', description: 'Install the kit.',
    });
  });

  it.each(['app/docs/[[...slug]]/page.tsx', 'app/docs/skills/page.tsx', 'app/docs/skills/[name]/page.tsx'])(
    '%s builds its metadata through docsMetadata',
    (file) => {
      const source = readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8');
      expect(source).toMatch(/docsMetadata\(/);
    },
  );
});

describe('robots.txt', () => {
  const rules = robotsRules();

  it('allows the public pages: the home page, /releases and /docs', () => {
    expect(PUBLIC_PATHS).toEqual(['/', '/releases', '/docs']);
    expect(rules.rules).toMatchObject({ userAgent: '*', allow: ['/', '/releases', '/docs'] });
  });

  it.each(['/app', '/prd', '/ask', '/knowledge', '/play', '/signup', '/auth', '/api', '/bugs', '/visual', '/design'])(
    'disallows the signed-in route %s',
    (path) => expect(rules.rules.disallow).toContain(path),
  );

  it('disallows none of the public pages', () => {
    for (const path of PUBLIC_PATHS) expect(rules.rules.disallow).not.toContain(path);
  });

  it('names the sitemap on the site', () => {
    expect(rules.sitemap).toBe('https://www.omni-loop.xyz/sitemap.xml');
  });

  it('is what app/robots.ts serves', () => {
    expect(robots()).toEqual(rules);
  });
});

describe('the sitemap', () => {
  const docs = docsPaths(guideUrls());
  const urls = sitemapEntries(docs).map((entry) => entry.url);

  it('lists every docs page: the guide\'s pages, the skills overview and each skill\'s page', () => {
    expect(docs).toContain('/docs');
    expect(docs).toContain('/docs/install');
    expect(docs).toContain(SKILLS_PATH);
    for (const name of skillNames()) expect(docs).toContain(`${SKILLS_PATH}/${name}`);
    expect(new Set(docs).size).toBe(docs.length);
  });

  it('lists the home page, /releases and every docs page, each on the site', () => {
    expect(urls.slice(0, 2)).toEqual(['https://www.omni-loop.xyz/', 'https://www.omni-loop.xyz/releases']);
    for (const path of docs) expect(urls).toContain(siteUrl(path));
    expect(urls).toHaveLength(2 + docs.length);
    for (const url of urls) expect(url.startsWith('https://www.omni-loop.xyz/')).toBe(true);
  });

  it('lists only allowed pages', () => {
    const disallowed = robotsRules().rules.disallow;
    for (const url of urls) {
      const path = new URL(url).pathname;
      expect(disallowed.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))).toBe(false);
    }
  });
});
