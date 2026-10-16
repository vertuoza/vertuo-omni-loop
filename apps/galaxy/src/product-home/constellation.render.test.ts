import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ConstellationTab, NO_EDGES, NO_REPOSITORIES } from './ConstellationTab';
import type { HomeRepository, ProductHome as Home } from './product-home.service';

// The Constellation tab as the server renders it (PRD 2129 s1): each star a link with its name and role,
// DOCKED, the also-in halo, the legend, the as-of stamp, the read only chip, the edges, and the empty
// states' words and links.

const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const repo = (name: string, over: Partial<HomeRepository> = {}): HomeRepository =>
  ({ repository: name, role: null, consumes: [], phase0: 'server', alsoIn: [], ...over });
const home = (repositories: HomeRepository[]): Home => ({
  product: { id: 'p-1', name: 'Widgets' },
  ledger: { lanes: { 'on-you': [], 'on-review': [], 'on-agent': [] }, summary: { building: 0, waitingOnPerson: 0, drifted: 0 } },
  prds: [], ideas: [], roadmaps: [], bugs: [], visuals: [], questions: [], repositories,
});
const NOW = new Date('2026-10-16T09:07:42Z');
const render = (repositories: HomeRepository[]) => renderToStaticMarkup(createElement(ConstellationTab, { home: home(repositories), now: NOW }));

const FULL = [
  repo('acme/widgets', { role: 'web', consumes: ['acme/widgets-api'] }),
  repo('acme/widgets-api', { role: 'api' }),
  repo('acme/widgets-web', { role: 'web', phase0: 'pr' }),
  repo('acme/auth', { role: 'auth', alsoIn: ['Other'] }),
];

describe('the Constellation tab, filled', () => {
  const html = render(FULL);

  it('draws each star as a link to its card, labelled with its name and role', () => {
    expect(html).toContain('href="/app/products/p-1/constellation?star=acme/widgets-api"');
    expect(html).toContain('aria-label="acme/widgets-api, api"');
    expect(html).toContain('aria-label="acme/auth, auth"');
    expect(text(html)).toContain('widgets-api api');
  });

  it('marks a docked star DOCKED, and only that one', () => {
    expect(html.match(/DOCKED/g)).toHaveLength(2);
    expect(html).toContain('aria-label="acme/widgets-web, web, docked"');
    expect(/data-star="acme\/widgets-web" data-docked="true"/.test(html)).toBe(true);
    expect(/data-star="acme\/widgets"\s+data-docked/.test(html)).toBe(false);
  });

  it('gives a star also in another product the halo, and no other', () => {
    expect(html.match(/constellation-halo/g)).toHaveLength(1);
  });

  it('draws one edge per consumes entry, consumer to provider', () => {
    expect(html.match(/class="constellation-edge"/g)).toHaveLength(1);
    expect(html).toContain('data-consumer="acme/widgets" data-provider="acme/widgets-api"');
  });

  it('says read only, the as-of time in UTC and what the sky shows', () => {
    expect(text(html)).toContain('read only');
    expect(text(html)).toContain('as of 09:07 UTC');
    expect(html).toContain('role="img"');
    expect(html).toContain('aria-label="Widgets: 4 repositories, 1 edges"');
  });

  it('draws the legend under the sky', () => {
    expect(text(/<ul class="constellation-legend"[^>]*>([\s\S]*?)<\/ul>/.exec(html)?.[1] ?? '')).toContain('also in another product');
    expect(text(html)).not.toContain(NO_EDGES);
  });
});

describe('the Constellation tab, empty', () => {
  it('says no repository is in the product, links to Repositories & approvers and draws no sky', () => {
    const html = render([]);
    expect(text(html)).toBe(`${NO_REPOSITORIES} Add one on Repositories & approvers`);
    expect(html).toContain('href="/app/products/p-1/repositories"');
    expect(html).not.toContain('<svg');
  });

  it('draws the stars alone and says where to declare edges when no repository consumes another', () => {
    const html = render([repo('acme/a'), repo('acme/b')]);
    expect(html.match(/data-star=/g)).toHaveLength(2);
    expect(html).not.toContain('constellation-edge');
    expect(text(html)).toContain(`${NO_EDGES} Declare edges on Repositories & approvers`);
    expect(html).toContain('href="/app/products/p-1/repositories"');
  });
});

describe('the Constellation stylesheet', () => {
  const css = readFileSync(new URL('./constellation.css', import.meta.url), 'utf8');

  it('paints the sky with --ask-sunk and uses no colour of its own', () => {
    expect(css).toContain('background: var(--ask-sunk)');
    expect(/#[0-9a-f]{3,8}\b|\brgba?\(/i.test(css)).toBe(false);
  });

  it('scrolls only the sky\'s frame, sideways, below 600 px', () => {
    expect(css).toMatch(/\.constellation-frame \{[^}]*overflow-x: auto/);
    expect(css).toContain('@media (max-width: 599px)');
    expect(css).toContain('width: 680px');
  });
});
