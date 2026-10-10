import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import MarkdownIt from 'markdown-it';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { MetaData, StaticSource } from 'fumadocs-core/source';
import type { TOCItemType } from 'fumadocs-core/toc';
import { describe, expect, it, vi } from 'vitest';
import { badgedBlock, codeKinds, type HastNode } from './badges';
import { diagramFigure, isDiagramPath, readSvg } from './diagrams';
import { DocsPage } from './DocsPage';
import { plain } from './DocsSearch';
import { readGuide } from './guide';
import { skillNames, skillPage, skillsOverview } from './skills';
import { SkillBody, SkillsOverview, skillSidebar, skillToc } from './skills-view';
import { guideLoader, sidebarItems } from './tree';
import { sure } from '../arcade/test/sure';

vi.mock('server-only', () => ({}));

// The guide's pages as /docs serves them (PRD 346): fumadocs-core's loader over docs/guide/, in
// meta.json's order, each page drawn by DocsPage with the sidebar, its title, its body and its table
// of contents. In the app fumadocs-mdx compiles the bodies at build time; here markdown-it stands in
// for it, over the same files, since a test runs no bundler. The compile step's badges (PRD 373) are
// set above each block by the same badgedBlock the rehype plugin calls, around markdown-it's <pre>; and
// each diagram is set in the page by the same readSvg and diagramFigure the remark plugin calls.

const GUIDE = fileURLToPath(new URL('../../../../docs/guide', import.meta.url));
const markdown = new MarkdownIt();

/** The few hast nodes badgedBlock builds, as HTML; `raw` is markdown-it's own <pre>. */
const toHtml = (node: HastNode): string => {
  if (node.type === 'text' || node.type === 'raw') return node.type === 'raw' ? node.value ?? '' : markdown.utils.escapeHtml(node.value ?? '');
  if (!('tagName' in node)) return '';
  const attributes = Object.entries(node.properties).map(([name, value]) => name === 'className'
    ? ` class="${(value as string[]).join(' ')}"`
    : ` ${/^data[A-Z]/.test(name) ? name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`) : name}="${markdown.utils.escapeHtml(String(value))}"`).join('');
  return `<${node.tagName}${attributes}>${node.children.map(toHtml).join('')}</${node.tagName}>`;
};
const fence = sure(markdown.renderer.rules.fence, 'markdown.renderer.rules.fence');
markdown.renderer.rules.fence = (tokens, i, options, env, self) => {
  const pre = fence(tokens, i, options, env, self);
  const kinds = codeKinds(sure(tokens[i], 'tokens[i]').info.trim().split(/\s+/).slice(1).join(' '));
  return kinds.length > 0 ? toHtml(badgedBlock(kinds, { type: 'raw', value: pre })) : pre;
};
const image = sure(markdown.renderer.rules.image, 'markdown.renderer.rules.image');
markdown.renderer.rules.image = (tokens, i, options, env, self) => {
  const src = String(sure(tokens[i], 'tokens[i]').attrGet('src') ?? '');
  if (!isDiagramPath(src)) return image(tokens, i, options, env, self);
  const alt = self.renderInlineAsText(sure(tokens[i], 'tokens[i]').children ?? [], options, env);
  return toHtml(diagramFigure(readSvg(readFileSync(join(GUIDE, src), 'utf8')), alt));
};
/** A page's body as the app compiles it: a diagram's figure in place of its paragraph. */
const renderBody = (body: string) => markdown.render(body).replace(/<p>(<figure [\s\S]*?<\/figure>)<\/p>/g, '$1');

/** A page as the test hands it to the loader: its body as markdown-it's HTML. */
type TestPage = { title?: string | undefined; html: string; toc: TOCItemType[] };

/** docs/guide/ as a fumadocs source: its meta.json, and each page with a body markdown-it renders. */
function source(): StaticSource<{ pageData: TestPage; metaData: MetaData }> {
  const meta = JSON.parse(readFileSync(join(GUIDE, 'meta.json'), 'utf8')) as MetaData;
  const pages = readGuide(GUIDE).pages.map((page) => ({
    type: 'page' as const,
    path: `${page.slug}.md`,
    data: {
      title: page.title ?? undefined,
      html: renderBody(page.body),
      toc: [...page.body.matchAll(/^(#{2,4}) (.+)$/gm)].map(([, hashes, title]) => ({
        title, url: `#${sure(title, 'title').toLowerCase().replace(/[^a-z0-9]+/g, '-')}`, depth: sure(hashes, 'hashes').length,
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
  it('lists the sixteen pages, in order, at /docs and under it', () => {
    expect(items).toEqual([
      { name: 'Getting started', url: '/docs' },
      { name: 'Install', url: '/docs/install' },
      { name: 'Join a team', url: '/docs/join' },
      { name: 'Invade', url: '/docs/invade' },
      { name: 'How the loop works', url: '/docs/loop' },
      { name: 'Your first PRD', url: '/docs/first-prd' },
      { name: 'Drive the loop', url: '/docs/drive' },
      { name: 'Products', url: '/docs/products' },
      { name: 'Several repositories', url: '/docs/several-repositories' },
      { name: 'Roadmaps', url: '/docs/roadmaps' },
      { name: 'Ideas board', url: '/docs/ideas' },
      { name: 'Landings', url: '/docs/landings' },
      { name: 'Repository flow', url: '/docs/flow' },
      { name: 'Validate with e2e (beta)', url: '/docs/validate-e2e' },
      { name: 'Use cases', url: '/docs/use-cases' },
      { name: 'When something goes wrong', url: '/docs/troubleshooting' },
    ]);
  });

  it('is what every page shows, the page shown marked current', () => {
    const html = render(['install']);
    expect(html).toContain('<nav class="docs-nav" aria-label="Guide">');
    expect(sure([...html.matchAll(/<nav class="docs-nav"[\s\S]*?<\/nav>/g)][0], 'the docs nav')[0].match(/<a [^>]*>[^<]*<\/a>/g)).toEqual([
      '<a href="/docs">Getting started</a>',
      '<a href="/docs/install" aria-current="page">Install</a>',
      '<a href="/docs/join">Join a team</a>',
      '<a href="/docs/invade">Invade</a>',
      '<a href="/docs/loop">How the loop works</a>',
      '<a href="/docs/first-prd">Your first PRD</a>',
      '<a href="/docs/drive">Drive the loop</a>',
      '<a href="/docs/products">Products</a>',
      '<a href="/docs/several-repositories">Several repositories</a>',
      '<a href="/docs/roadmaps">Roadmaps</a>',
      '<a href="/docs/ideas">Ideas board</a>',
      '<a href="/docs/landings">Landings</a>',
      '<a href="/docs/flow">Repository flow</a>',
      '<a href="/docs/validate-e2e">Validate with e2e (beta)</a>',
      '<a href="/docs/use-cases">Use cases</a>',
      '<a href="/docs/troubleshooting">When something goes wrong</a>',
    ]);
  });
});

describe('the pages', () => {
  it('serves Getting started at /docs, and each other page at /docs/<page>', () => {
    expect(guide.generateParams().map((p) => p.slug.join('/')).sort())
      .toEqual(['', 'drive', 'first-prd', 'flow', 'ideas', 'install', 'invade', 'join', 'landings', 'loop', 'products', 'roadmaps', 'several-repositories', 'troubleshooting', 'use-cases', 'validate-e2e']);
    expect(guide.getPage([])?.data.title).toBe('Getting started');
    expect(guide.getPage(['nope'])).toBeUndefined();
  });

  it.each([
    [[], 'Getting started', '/docs/install'],
    [['install'], 'Install', '/docs/join'],
    [['join'], 'Join a team', '/docs/loop'],
    [['invade'], 'Invade', '/docs/loop'],
    [['first-prd'], 'Your first PRD', '/docs/several-repositories'],
    [['drive'], 'Drive the loop', '/docs/several-repositories'],
    [['products'], 'Products', '/docs/several-repositories'],
    [['first-prd'], 'Your first PRD', '/docs/several-repositories'],
    [['several-repositories'], 'Several repositories', '/docs/roadmaps'],
    [['roadmaps'], 'Roadmaps', '/docs/landings'],
    [['ideas'], 'Ideas board', '/docs/landings'],
    [['landings'], 'Landings', '/docs/flow'],
    [['flow'], 'Repository flow', '/docs/validate-e2e'],
    [['validate-e2e'], 'Validate with e2e (beta)', '/docs/use-cases'],
    [['use-cases'], 'Use cases', '/docs/troubleshooting'],
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
    expect(html).toContain('The Omni App on your account or an org of yours.');
  });

  it('asks for no invite, no read access to a private repository and no gh auth setup-git (PRD 459)', () => {
    for (const page of readGuide(GUIDE).pages) {
      expect(page.body, page.slug).not.toMatch(/invit/i);
      expect(page.body, page.slug).not.toMatch(/private|read access/i);
      expect(page.body, page.slug).not.toContain('gh auth setup-git');
      expect(page.body, page.slug).not.toContain('repository not found');
    }
  });

  it('explains the two lines a terminal call answers outside a workspace (PRD 459)', () => {
    const html = render(['troubleshooting']);
    expect(html).toContain('<code>refused (403): you are not a member of &lt;workspace&gt;, which owns &lt;owner/repo&gt;</code>');
    expect(html).toContain('<code>no workspace owns &lt;owner/repo&gt; yet — install the Omni App: &lt;link&gt;</code>');
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

describe('the skills pages (PRD 580)', () => {
  /** A page as the /docs/skills routes draw it. */
  const skills = (name?: string) => {
    const page = name ? skillPage(name) : undefined;
    if (name && !page) throw new Error(`no skill ${name}`);
    return renderToStaticMarkup(createElement(DocsPage, page
      ? { items, skills: skillSidebar(), url: page.url, title: page.command, description: page.summary, toc: skillToc(page), children: createElement(SkillBody, { page }) }
      : { items, skills: skillSidebar(), url: '/docs/skills', title: 'Skills', description: 'Every skill of the Omni Loop, by what you want to do.', toc: [], children: createElement(SkillsOverview, { groups: skillsOverview() }) }));
  };
  const navLinks = (html: string, label: string) => (new RegExp(`<nav class="docs-nav" aria-label="${label}">[\\s\\S]*?</nav>`).exec(html)?.[0] ?? '').match(/<a [^>]*>[^<]*<\/a>/g);

  it('shows the guide\'s sixteen pages, then Skills › All skills, on a guide page', () => {
    const html = render(['install']);
    expect(navLinks(html, 'Guide')).toHaveLength(16);
    expect(html).toMatch(/<\/nav><nav class="docs-nav" aria-label="Skills"><p class="docs-nav-head">Skills<\/p><ol><li><a href="\/docs\/skills">All skills<\/a><\/li><\/ol><\/nav>/);
  });

  it('lists every skill under All skills on a skills page, the one shown marked current', () => {
    const overview = navLinks(skills(), 'Skills');
    expect(overview?.[0]).toBe('<a href="/docs/skills" aria-current="page">All skills</a>');
    expect(overview?.slice(1)).toEqual(skillNames().map((name) => `<a href="/docs/skills/${name}">/omni:${name}</a>`));
    const wave = navLinks(skills('wave'), 'Skills');
    expect(wave?.[0]).toBe('<a href="/docs/skills">All skills</a>');
    expect(wave?.filter((link) => link.includes('aria-current'))).toEqual(['<a href="/docs/skills/wave" aria-current="page">/omni:wave</a>']);
    expect(navLinks(skills('wave'), 'Guide')).toHaveLength(16);
  });

  it('draws the overview: one section per group, a card per skill linking its page', () => {
    const html = skills();
    expect(html).toContain('<h1 class="docs-title">Skills</h1>');
    expect(html).toContain('<p class="docs-lede">Every skill of the Omni Loop, by what you want to do.</p>');
    expect([...html.matchAll(/<h2 id="[a-z-]+">([^<]*)<\/h2>/g)].map((m) => m[1])).toEqual([
      'Start a change', 'Build it', 'Set up a repository', 'Several repositories', 'Every day', 'Run by other skills',
    ]);
    const cards = [...html.matchAll(/<a class="docs-skill-card" href="([^"]*)"><code>([^<]*)<\/code><span>([^<]*)<\/span><\/a>/g)];
    expect(cards.map((m) => m[1])).toEqual(skillNames().map((name) => `/docs/skills/${name}`));
    expect(sure(cards[0], 'cards[0]').slice(1)).toEqual(['/docs/skills/think-big', '/omni:think-big', 'a vast idea, explored by a studio, to a concept PR']);
    expect(sure(cards[5], 'cards[5]').slice(2)).toEqual(['/omni:yolo', 'build a whole PRD: plan, waves, the outbox gate, ship']);
  });

  it('draws a skill page: its sections in order, its usage and example as code, and its SKILL.md', () => {
    const html = skills('wave');
    expect(html).toContain('<h1 class="docs-title">/omni:wave</h1>');
    expect([...html.matchAll(/<h[23] id="([a-z-]+)">/g)].map((m) => m[1]))
      .toEqual(['what-it-does', 'when-to-use-it', 'how-to-use-it', 'example', 'who-runs-it', 'related-skills']);
    expect(html).toContain('<code>/omni:wave &lt;n&gt;</code>');
    expect(html).toContain('<code>/omni:wave 580</code>');
    expect(html).toContain('<p>→ the wave&#x27;s sub-PRs merged into the feature branch, and a report</p>');
    expect(html).toContain('<p>You type it in Claude Code.</p>');
    expect(html).toContain('<a href="/docs/skills/do-work">/omni:do-work</a>');
    expect(html).toContain('href="https://github.com/vertuoza/vertuo-omni-loop/blob/main/kit/plugin/skills/wave/SKILL.md"');
    expect(html).not.toMatch(/\{\w+\}/);
    expect(html).toContain('<a href="#who-runs-it">Who runs it</a>');
  });

  it('names the skills that run a skill run by the skills, and leaves Related skills out when none', () => {
    expect(skills('dossier-push')).toMatch(/<p>Other skills run it:<\/p><ul><li><a href="\/docs\/skills\/brainstorm">\/omni:brainstorm<\/a><\/li><li><a href="\/docs\/skills\/plan">\/omni:plan<\/a><\/li><li><a href="\/docs\/skills\/visual-fix">\/omni:visual-fix<\/a><\/li><li><a href="\/docs\/skills\/bug-fix">\/omni:bug-fix<\/a><\/li><\/ul>/);
    expect(skills('dossier-open')).toMatch(/<p>Other skills run it:<\/p><ul><li><a href="\/docs\/skills\/brainstorm">\/omni:brainstorm<\/a><\/li><li><a href="\/docs\/skills\/think-big">\/omni:think-big<\/a><\/li><\/ul>/);
    expect(skills('pr')).not.toContain('related-skills');
  });
});

describe('a code block', () => {
  /** Every code block of a page: its badges' text, then the start of its code. */
  const blocks = (html: string) => [...html.matchAll(/<div class="docs-code"><div class="docs-badges">([\s\S]*?)<\/div><pre><code[^>]*>([^\n]*)/g)]
    .map(([, badges, code]) => [[...sure(badges, 'badges').matchAll(/<span class="docs-badge" data-kind="[a-z]+">([^<]*)<\/span>/g)].map((m) => m[1]).join(' + '), code]);

  it('shows where it goes, as badge text above its code, on every page', () => {
    for (const slug of [['join'], ['install'], ['invade'], ['loop'], ['first-prd'], ['several-repositories'], ['roadmaps'], ['landings'], ['flow'], ['validate-e2e'], ['use-cases'], ['troubleshooting']]) {
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
    expect(install).toContainEqual(['TERMINAL + CODING AGENT', 'omni signin']);
    expect(install).toContainEqual(['CODING AGENT', '/omni:ask on']);
    expect(install).toContainEqual(['CODING AGENT', '/omni:help']);
    const troubleshooting = blocks(render(['troubleshooting']));
    expect(troubleshooting).toContainEqual(['TERMINAL + CODING AGENT', 'omni signin']);
    expect(troubleshooting).toContainEqual(['FILE · .omni-loop/config.yml', 'ask:']);
    const firstPrd = blocks(render(['first-prd']));
    expect(firstPrd).toContainEqual(['TERMINAL', 'git switch main']);
    expect(firstPrd).toContainEqual(['CODING AGENT', '/omni:brainstorm Let people export their invoices as a CSV file']);
    expect(firstPrd).toContainEqual(['GITHUB COMMENT', '1: A']);
  });

  it('shows the plugin a newcomer installs, from a terminal or from Claude Code, on Install (#890)', () => {
    const install = blocks(render(['install']));
    expect(install).toContainEqual(['TERMINAL', 'claude plugin marketplace add vertuoza/vertuo-omni-loop']);
    expect(install).toContainEqual(['TERMINAL', 'claude plugin install omni@omni-loop']);
    expect(install).toContainEqual(['CODING AGENT', '/plugin marketplace add vertuoza/vertuo-omni-loop']);
  });

  it('shows a path that is neither run nor pasted as inline code, not as a block', () => {
    expect(render(['first-prd'])).toContain('<code>.omni-loop/delivery/shipped/&lt;n&gt;-&lt;topic&gt;/release.md</code>.');
  });
});

describe('a diagram', () => {
  /** Every figure of a page: its drawing's accessible name, and the classes its shapes and words use. */
  const figures = (html: string) => [...html.matchAll(/<figure class="docs-figure"><svg ([^>]*)>([\s\S]*?)<\/svg><\/figure>/g)]
    .map(([, attributes, inside]) => ({
      role: /role="([^"]*)"/.exec(sure(attributes, 'attributes'))?.[1],
      name: /aria-label="([^"]*)"/.exec(sure(attributes, 'attributes'))?.[1],
      classes: [...new Set([...sure(inside, 'inside').matchAll(/class="([^"]*)"/g)].flatMap((m) => sure(m[1], 'm[1]').split(' ')))].sort(),
      inside,
    }));

  it('is drawn in the page itself, three on How the loop works, each named by its alt text', () => {
    const html = render(['loop']);
    const drawn = figures(html);
    expect(drawn.map((figure) => [figure.role, figure.name?.split(':')[0]])).toEqual([
      ['img', 'The Omni Loop'],
      ['img', 'The pull requests of one PRD over time'],
      ['img', 'Which skill runs which'],
    ]);
    expect(html).not.toMatch(/<img /);
  });

  it('leaves the file\'s own style, title and description out: the theme paints it, its alt text names it', () => {
    for (const figure of figures(render(['loop']))) {
      expect(figure.inside).not.toMatch(/<(style|title|desc)[ >]/);
      expect(figure.classes.every((name) => name.startsWith('dg-'))).toBe(true);
    }
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

  it('paints every class a diagram uses, with the theme\'s tokens only, and lets a figure scroll on a phone', () => {
    const rule = (selector: string) => new RegExp(`${selector.replace(/[.[\]()]/g, '\\$&')} \\{([^}]*)\\}`).exec(css)?.[1] ?? '';
    const used = new Set<string>();
    for (const file of readdirSync(join(GUIDE, 'diagrams'))) {
      for (const [, names] of readFileSync(join(GUIDE, 'diagrams', file), 'utf8').matchAll(/class="([^"]*)"/g)) {
        for (const name of sure(names, 'names').split(' ')) used.add(name);
      }
    }
    for (const name of used) expect(rule(`.docs-figure .${name}`), name).toMatch(/var\(--ask-[a-z-]+\)|font-size|stroke-dasharray/);
    const diagramRules = css.slice(css.indexOf('.docs-figure {'), css.indexOf('.docs-toc {'));
    expect(diagramRules).not.toMatch(/#[0-9a-f]{3,6}\b/i);
    expect(rule('.docs-figure')).toMatch(/overflow-x: auto;/);
    expect(rule('.docs-figure svg')).toMatch(/min-width: 600px;/);
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
