import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import MarkdownIt from 'markdown-it';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { MetaData, Source } from 'fumadocs-core/source';
import type { TOCItemType } from 'fumadocs-core/toc';
import { describe, expect, it } from 'vitest';
import { badgedBlock, codeKinds, type HastNode } from './badges';
import { DocsPage } from './DocsPage';
import { plain } from './DocsSearch';
import { readGuide } from './guide';
import { guideLoader, sidebarItems } from './tree';

// The guide's pages as /docs serves them (PRD 346): fumadocs-core's loader over docs/guide/, in
// meta.json's order, each page drawn by DocsPage with the sidebar, its title, its body and its table
// of contents. In the app fumadocs-mdx compiles the bodies at build time; here markdown-it stands in
// for it, over the same files, since a test runs no bundler. The compile step's badges (PRD 373) are
// set above each block by the same badgedBlock the rehype plugin calls, around markdown-it's <pre>.

const GUIDE = fileURLToPath(new URL('../../../../docs/guide', import.meta.url));
const markdown = new MarkdownIt();

/** The few hast nodes badgedBlock builds, as HTML; `raw` is markdown-it's own <pre>. */
const toHtml = (node: HastNode): string => {
  if (node.type === 'text' || node.type === 'raw') return node.type === 'raw' ? node.value ?? '' : markdown.utils.escapeHtml(node.value ?? '');
  if (!('tagName' in node)) return '';
  const attributes = Object.entries(node.properties).map(([name, value]) => name === 'className'
    ? ` class="${(value as string[]).join(' ')}"`
    : ` ${name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}="${String(value)}"`).join('');
  return `<${node.tagName}${attributes}>${node.children.map(toHtml).join('')}</${node.tagName}>`;
};
const fence = markdown.renderer.rules.fence!;
markdown.renderer.rules.fence = (tokens, i, options, env, self) => {
  const pre = fence(tokens, i, options, env, self);
  const kinds = codeKinds(tokens[i].info.trim().split(/\s+/).slice(1).join(' '));
  return kinds.length > 0 ? toHtml(badgedBlock(kinds, { type: 'raw', value: pre })) : pre;
};

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

describe('a code block', () => {
  /** Every code block of a page: its badges' text, then the start of its code. */
  const blocks = (html: string) => [...html.matchAll(/<div class="docs-code"><div class="docs-badges">([\s\S]*?)<\/div><pre><code[^>]*>([^\n]*)/g)]
    .map(([, badges, code]) => [[...badges.matchAll(/<span class="docs-badge" data-kind="[a-z]+">([^<]*)<\/span>/g)].map((m) => m[1]).join(' + '), code]);

  it('shows where it goes, as badge text above its code, on every page', () => {
    for (const slug of [['install'], ['invade'], ['first-prd'], ['troubleshooting']]) {
      const html = render(slug);
      expect(html.match(/<pre>/g)?.length, slug.join()).toBe(blocks(html).length);
    }
  });

  it('reads TERMINAL, CODING AGENT, FILE · <path> and GITHUB COMMENT', () => {
    const install = blocks(render(['install']));
    expect(install).toContainEqual(['TERMINAL', 'npm install -g github:vertuoza/vertuo-omni-loop']);
    expect(install).toContainEqual(['TERMINAL + CODING AGENT', 'omni --version']);
    expect(install).toContainEqual(['TERMINAL', 'omni init']);
    expect(install).toContainEqual(['TERMINAL + CODING AGENT', 'git switch main']);
    expect(install).toContainEqual(['TERMINAL + CODING AGENT', 'omni config']);
    expect(install).toContainEqual(['CODING AGENT', '/omni:help']);
    const troubleshooting = blocks(render(['troubleshooting']));
    expect(troubleshooting).toContainEqual(['TERMINAL', 'gh auth setup-git']);
    expect(troubleshooting).toContainEqual(['FILE · .omni-loop/config.yml', 'ask:']);
    const firstPrd = blocks(render(['first-prd']));
    expect(firstPrd).toContainEqual(['TERMINAL', 'git switch main']);
    expect(firstPrd).toContainEqual(['CODING AGENT', '/omni:brainstorm Let people export their invoices as a CSV file']);
    expect(firstPrd).toContainEqual(['GITHUB COMMENT', '1: A']);
  });

  it('shows a path that is neither run nor pasted as inline code, not as a block', () => {
    expect(render(['first-prd'])).toContain('<code>.omni-loop/delivery/shipped/&lt;n&gt;-&lt;topic&gt;/release.md</code>.');
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

  it('draws the badges as arcade chips above the code, never copied with it', () => {
    const rule = (selector: string) => new RegExp(`${selector.replace(/[.[\]()]/g, '\\$&')} \\{([^}]*)\\}`).exec(css)?.[1] ?? '';
    expect(rule('.docs-badges')).toMatch(/justify-content: flex-end;/);
    expect(rule('.docs-badges')).toMatch(/user-select: none;/);
    expect(rule('.docs-badges')).toMatch(/gap: 6px;/);
    expect(rule('.docs-badge')).toMatch(/font: 8px\/1 var\(--ask-px\);/);
    expect(rule('.docs-badge')).toMatch(/border: 2px solid currentColor;/);
    expect(rule('.docs-badge')).toMatch(/box-shadow: 2px 2px 0 currentColor;/);
    expect(rule('.docs-badge')).toMatch(/background: var\(--ask-sunk\);/);
    for (const [kind, token] of [['terminal', 'cyan'], ['agent', 'plasma'], ['file', 'muted'], ['github', 'green']]) {
      expect(rule(`.docs-badge[data-kind='${kind}']`)).toMatch(new RegExp(`color: var\\(--ask-${token}\\);`));
    }
  });
});
