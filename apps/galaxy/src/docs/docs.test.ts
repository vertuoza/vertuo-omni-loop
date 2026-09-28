import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import MarkdownIt from 'markdown-it';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { MetaData, Source } from 'fumadocs-core/source';
import type { TOCItemType } from 'fumadocs-core/toc';
import { describe, expect, it } from 'vitest';
import { DocsPage } from './DocsPage';
import { plain } from './DocsSearch';
import { readGuide } from './guide';
import { guideLoader, sidebarItems } from './tree';

// The guide's pages as /docs serves them (PRD 346): fumadocs-core's loader over docs/guide/, in
// meta.json's order, each page drawn by DocsPage with the sidebar, its title, its body and its table
// of contents. In the app fumadocs-mdx compiles the bodies at build time; here markdown-it stands in
// for it, over the same files, since a test runs no bundler.

const GUIDE = fileURLToPath(new URL('../../../../docs/guide', import.meta.url));
const markdown = new MarkdownIt();

/** A page as the test hands it to the loader: its body as markdown-it's HTML. */
type TestPage = { title?: string; html: string; toc: TOCItemType[] };

/** docs/guide/ as a fumadocs source: its meta.json, and each page with a body markdown-it renders. */
function source(): Source<{ pageData: TestPage; metaData: MetaData }> {
  const meta = JSON.parse(readFileSync(join(GUIDE, 'meta.json'), 'utf8'));
  const pages = readGuide(GUIDE).pages.map((page) => ({
    type: 'page' as const,
    path: `${page.slug}.md`,
    data: {
      title: page.title ?? undefined,
      html: markdown.render(page.body),
      toc: [...page.body.matchAll(/^(#{2,4}) (.+)$/gm)].map(([, hashes, title]) => ({
        title, url: `#${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`, depth: hashes.length,
      })),
    },
  }));
  return { files: [{ type: 'meta' as const, path: 'meta.json', data: meta }, ...pages] };
}

const guide = guideLoader(source());
const items = sidebarItems(guide.pageTree);

function render(slug: string[]) {
  const page = guide.getPage(slug);
  if (!page) throw new Error(`no page at ${slug.join('/')}`);
  return renderToStaticMarkup(createElement(DocsPage, {
    items, url: page.url, title: page.data.title ?? '', toc: page.data.toc,
    children: createElement('div', { dangerouslySetInnerHTML: { __html: page.data.html } }),
  }));
}

describe('the sidebar', () => {
  it('lists the five pages, in order, at /docs and under it', () => {
    expect(items).toEqual([
      { name: 'Getting started', url: '/docs' },
      { name: 'Install', url: '/docs/install' },
      { name: 'Invade', url: '/docs/invade' },
      { name: 'Your first PRD', url: '/docs/first-prd' },
      { name: 'When something goes wrong', url: '/docs/troubleshooting' },
    ]);
  });

  it('is what every page shows, the page shown marked current', () => {
    const html = render(['install']);
    expect(html).toContain('<nav class="docs-nav" aria-label="Guide">');
    expect([...html.matchAll(/<nav class="docs-nav"[\s\S]*?<\/nav>/g)][0][0].match(/<a [^>]*>[^<]*<\/a>/g)).toEqual([
      '<a href="/docs">Getting started</a>',
      '<a href="/docs/install" aria-current="page">Install</a>',
      '<a href="/docs/invade">Invade</a>',
      '<a href="/docs/first-prd">Your first PRD</a>',
      '<a href="/docs/troubleshooting">When something goes wrong</a>',
    ]);
  });
});

describe('the pages', () => {
  it('serves Getting started at /docs, and each other page at /docs/<page>', () => {
    expect(guide.generateParams().map((p) => p.slug.join('/')).sort()).toEqual(['', 'first-prd', 'install', 'invade', 'troubleshooting']);
    expect(guide.getPage([])?.data.title).toBe('Getting started');
    expect(guide.getPage(['nope'])).toBeUndefined();
  });

  it.each([
    [[], 'Getting started', '/docs/install'],
    [['install'], 'Install', '/docs/invade'],
    [['invade'], 'Invade', '/docs/first-prd'],
    [['first-prd'], 'Your first PRD', '/docs/troubleshooting'],
    [['troubleshooting'], 'When something goes wrong', '/docs'],
  ])('/docs/%s renders its title, its body and its Next link', (slug, title, next) => {
    const html = render(slug);
    expect(html).toContain(`<h1 class="docs-title">${title}</h1>`);
    expect(html).toMatch(/<div class="docs-md"><div><p>/);
    expect(html).toMatch(new RegExp(`<a href="${next}">Next → [^<]+</a>`));
  });

  it('shows Getting started in full, with its table of contents', () => {
    const html = render([]);
    expect(html).toContain('<nav class="docs-toc" aria-label="On this page">');
    expect(html).toContain('<a href="#what-you-will-have-at-the-end">What you will have at the end</a>');
    expect(html).toContain('<a href="#what-you-need-first">What you need first</a>');
    expect(html).toContain('An Omni Loop invite.');
  });

  it('draws no table of contents for a page with no headings', () => {
    // Every page of the guide has headings once written in full, so the page is drawn with none.
    const html = renderToStaticMarkup(createElement(DocsPage, {
      items, url: '/docs/install', title: 'Install', toc: [],
      children: createElement('div', { dangerouslySetInnerHTML: { __html: '<p>Words.</p>' } }),
    }));
    expect(html).not.toContain('docs-toc');
  });

  it('opens with the search box, labelled', () => {
    expect(render([])).toMatch(/<aside class="docs-side"><search class="docs-search"><label class="docs-search-label" for="docs-search">Search the docs<\/label><input id="docs-search"[^>]*type="search"/);
  });
});

describe('a search result', () => {
  it('reads as plain text: no <mark>, no markdown emphasis', () => {
    expect(plain('Run <mark>omni</mark> `signin` **once**')).toBe('Run omni signin once');
  });
});

describe('its stylesheet', () => {
  const css = readFileSync(new URL('./docs.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

  it('sets the sidebar beside the page from 720 px, and the table of contents from 1100 px only', () => {
    expect(css).toMatch(/\.docs-toc \{ display: none;/);
    expect(css).toMatch(/@media \(min-width: 720px\) \{\s*\.docs \{ grid-template-columns: 220px minmax\(0, 1fr\);/);
    expect(css).toMatch(/@media \(min-width: 1100px\) \{[^@]*\.docs-toc \{ display: block;/);
  });
});
