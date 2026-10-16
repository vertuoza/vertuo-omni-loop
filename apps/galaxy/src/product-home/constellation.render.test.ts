import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { parsePr, parsePrd } from 'vertuo-omni-plan/kit/lib/ids.ts';
import type { Filter } from './constellation';
import { ConstellationTab, NO_EDGES, NO_REPOSITORIES } from './ConstellationTab';
import { demoProductHome } from './ProductHome';
import type { HomeFlight, HomeRepository, PrChip, ProductHome as Home } from './product-home.service';

// The Constellation tab as the server renders it (PRD 2129 s1): each star a link with its name and role,
// DOCKED, the also-in halo, the legend, the as-of stamp, the read only chip, the edges, and the empty
// states' words and links. Since s2, the Ledger's states on it: the filter chips, the rings, the edge
// labels and their dots, the Now in card, the star card, and the stylesheet's motion.

const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const repo = (name: string, over: Partial<HomeRepository> = {}): HomeRepository =>
  ({ repository: name, role: null, consumes: [], phase0: 'server', alsoIn: [], ...over });
const home = (repositories: HomeRepository[], flights: HomeFlight[] = [], tethers: PrChip[] = []): Home => ({
  product: { id: 'p-1', name: 'Widgets' },
  ledger: { lanes: { 'on-you': [], 'on-review': [], 'on-agent': [] }, summary: { building: 0, waitingOnPerson: 0, drifted: 0 } },
  prds: [], ideas: [], roadmaps: [], bugs: [], visuals: [], questions: [], repositories, flights, tethers,
});
const NOW = new Date('2026-10-16T09:07:42Z');
const render = (repositories: HomeRepository[], flights: HomeFlight[] = [], query: Filter = {}, tethers: PrChip[] = []) =>
  renderToStaticMarkup(createElement(ConstellationTab, { home: home(repositories, flights, tethers), now: NOW, query }));
const flight = (dossier: string, n: number, title: string, over: Partial<HomeFlight> = {}): HomeFlight => ({
  dossier, repo: 'acme/widgets', prd: parsePrd(n), title, birthplace: 'repo',
  stage: 'building', ledger: { state: 'building', lane: 'on-agent' }, stageRepos: [], prs: [], ...over,
});

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

const LIVE = [
  repo('acme/widgets', { role: 'mobile', consumes: ['acme/widgets-api'] }),
  repo('acme/widgets-web', { role: 'web', phase0: 'pr', consumes: ['acme/widgets-api'] }),
  repo('acme/widgets-api', { role: 'api', consumes: ['acme/auth'] }),
  repo('acme/auth', { role: 'auth', alsoIn: ['Platform'] }),
];
const FLIGHTS = [
  flight('d-918', 918, 'Offline photo upload', { ledger: { state: 'approval', lane: 'on-you' }, stage: 'prd', birthplace: 'server' }),
  flight('d-912', 912, 'Quotes on the phone', { prs: [{ repo: 'acme/widgets-api', pr: parsePr(447) }, { repo: 'acme/widgets-web', pr: parsePr(12) }] }),
  flight('d-905', 905, 'Single sign-on', { repo: 'acme/auth', stage: 'inbox', ledger: { state: 'drifted', lane: null }, birthplace: 'server' }),
  flight('d-890', 890, 'Dark mode', { stage: 'shipped', ledger: null }),
];
/** The addresses of the links marked aria-current in `html`. */
const current = (html: string) => [...html.matchAll(/<a [^>]*>/g)].map((m) => m[0]).filter((a) => a.includes('aria-current="true"')).map((a) => /href="([^"]*)"/.exec(a)?.[1]);
/** The inside of the element of class `cls` (an element holding no other of its own tag). */
const section = (html: string, cls: string) => new RegExp(`<([a-z]+) class="${cls}"[^>]*>([\\s\\S]*?)</\\1>`).exec(html)?.[2] ?? '';

describe('the Constellation tab, live (s2)', () => {
  const html = render(LIVE, FLIGHTS);

  it('draws the filter chips, Everything first and in force, then each PRD in flight, newest first', () => {
    const chips = section(html, 'constellation-chips');
    expect(text(chips)).toBe('Everything 918 Offline photo upload 912 Quotes on the phone 905 Single sign-on');
    expect(current(chips)).toEqual(['/app/products/p-1/constellation']);
    expect(chips).toContain('href="/app/products/p-1/constellation?prd=d-912"');
  });

  it('marks the chip in force with ?prd=, and fades what that PRD does not touch', () => {
    const lit = render(LIVE, FLIGHTS, { dossier: 'd-905' });
    expect(current(section(lit, 'constellation-chips'))).toEqual(['/app/products/p-1/constellation?prd=d-905']);
    expect(lit.match(/data-faded="true"/g)).toHaveLength(3 + 3);
    expect(/data-star="acme\/auth"[^>]*data-faded/.test(lit)).toBe(false);
  });

  it('rings each star in its state: building, waits on you, drifted', () => {
    expect(/data-star="acme\/widgets"[^>]*data-state="on-you"/.test(html)).toBe(true);
    expect(/data-star="acme\/widgets-api"[^>]*data-state="building"/.test(html)).toBe(true);
    expect(/data-star="acme\/auth"[^>]*data-state="drifted"/.test(html)).toBe(true);
    expect(html.match(/class="constellation-ring"/g)).toHaveLength(4);
  });

  it('labels each edge with what crosses it now', () => {
    expect(text(html)).toContain('widgets → widgets-api · 1 PRD in flight');
    expect(text(html)).toContain('widgets-web → widgets-api · 1 PRD in flight');
    expect(text(html)).toContain('widgets-api → auth · nothing in flight');
    const two = render(LIVE, [...FLIGHTS, flight('d-913', 913, 'More', { prs: [{ repo: 'acme/widgets-api', pr: parsePr(9) }] })]);
    expect(text(two)).toContain('widgets → widgets-api · 2 PRDs in flight');
  });

  it('puts dots only on an edge between two building stars', () => {
    expect(html.match(/class="constellation-flow"/g)).toHaveLength(1);
    expect(html).toMatch(/class="constellation-flow"[^>]*data-consumer="acme\/widgets-web"/);
  });

  it('lists Now in the product worst first, each PRD linking to its page, and says it is read only', () => {
    const card = section(html, 'constellation-card');
    expect(text(card)).toContain('Now in Widgets');
    expect(text(card)).toContain('905 drifted · auth 918 waits on you · widgets 912 building · 3 repositories');
    expect(card).toContain('href="/prd/d-918"');
    expect(text(card)).toContain('Read only. Links live on Repositories & approvers.');
  });

  it('opens a star\'s card with ?star=: role, phase 0, also in, consumes, consumed by, now, and its two links', () => {
    const card = section(render(LIVE, FLIGHTS, { star: 'acme/widgets-api' }), 'constellation-card');
    const words = text(card);
    expect(words).toContain('acme/widgets-api');
    expect(words).toContain('role api');
    expect(words).toContain('phase 0 ◆ approved on the PRD page');
    expect(words).toContain('also in no other product');
    expect(words).toContain('consumes auth · nothing in flight');
    expect(words).toContain('consumed by widgets · 1 PRD in flight widgets-web · 1 PRD in flight');
    expect(words).toContain('now 912 building');
    expect(card).toContain('href="/prd/d-912"');
    expect(card).toContain('href="/app/products/p-1">Ledger rows →');
    expect(card).toContain('href="/app/products/p-1/repositories">Its links →');
    expect(words).toContain('Read only.');
    expect(words).not.toContain('Now in Widgets');
  });

  it('names a docked star\'s phase 0 and the products a star is also in', () => {
    expect(text(section(render(LIVE, FLIGHTS, { star: 'acme/widgets-web' }), 'constellation-card'))).toContain('phase 0 ◇ docs-only phase-0 pull request');
    expect(text(section(render(LIVE, FLIGHTS, { star: 'acme/auth' }), 'constellation-card'))).toContain('also in Platform');
  });

  it('keeps the filter on a star\'s link and the star on a chip\'s', () => {
    const both = render(LIVE, FLIGHTS, { dossier: 'd-912', star: 'acme/auth' });
    expect(both).toContain('href="/app/products/p-1/constellation?prd=d-912&amp;star=acme/widgets"');
    expect(both).toContain('href="/app/products/p-1/constellation?prd=d-918&amp;star=acme/auth"');
  });

  it('reads an unknown ?prd= and ?star= as none', () => {
    const unknown = render(LIVE, FLIGHTS, { dossier: 'd-404', star: 'acme/gone' });
    expect(unknown).not.toContain('data-faded');
    expect(text(section(unknown, 'constellation-card'))).toContain('Now in Widgets');
  });

  it('draws the legend of the states', () => {
    expect(text(section(html, 'constellation-legend'))).toContain('building waits on you drifted');
  });
});

describe('the phase-0 tethers (s3)', () => {
  const tethers = [{ repo: 'acme/widgets-web', pr: parsePr(31) }, { repo: 'acme/widgets-web', pr: parsePr(35) }];
  const html = render(LIVE, [], {}, tethers);

  it('reads each tether as its pull request and links it to GitHub', () => {
    expect(text(html)).toContain('◇ widgets-web#31 · phase 0');
    expect(text(html)).toContain('◇ widgets-web#35 · phase 0');
    expect(html).toContain('href="https://github.com/acme/widgets-web/pull/31"');
    expect(html).toContain('href="https://github.com/acme/widgets-web/pull/35"');
  });

  it('draws no tether for a docked star with none, and none for a star that is not docked', () => {
    expect(render(LIVE)).not.toContain('constellation-tether');
    expect(render(LIVE, [], {}, [{ repo: 'acme/widgets', pr: parsePr(7) }])).not.toContain('github.com/acme/widgets/pull/7');
  });

  it('lists each docked star with its phase-0 pull requests in the Now in card', () => {
    const card = text(section(html, 'constellation-card'));
    expect(card).toContain('widgets-web · docked: ◇ widgets-web#31 · phase 0 , ◇ widgets-web#35 · phase 0');
    expect(text(section(render(LIVE), 'constellation-card'))).toContain('widgets-web · docked: no open phase-0 pull request');
  });
});

describe('the demo\'s Constellation (s3)', () => {
  const demo = demoProductHome('demo-product-1');
  if (demo === null) throw new Error('the demo has a product home');
  const html = renderToStaticMarkup(createElement(ConstellationTab, { home: demo, now: NOW }));

  it('has four linked repositories and draws every state: building, waits on you, drifted, docked and also in', () => {
    expect(demo.repositories.map((r) => r.repository)).toEqual(['acme/widgets', 'acme/widgets-api', 'acme/widgets-web', 'acme/auth']);
    const state = (name: string) => new RegExp(`data-star="${name}"[^>]*data-state="([a-z-]+)"`).exec(html)?.[1];
    expect(state('acme/widgets-api')).toBe('building');
    expect(state('acme/widgets')).toBe('on-you');
    expect(state('acme/widgets-web')).toBe('drifted');
    expect(html).toMatch(/data-star="acme\/widgets-web" data-docked="true"/);
    expect(html).toContain('href="https://github.com/acme/widgets-web/pull/31"');
    expect(html.match(/constellation-halo/g)).toHaveLength(1);
    expect(text(html)).toContain('◇ widgets-web#31 · phase 0');
  });
});

describe('the Constellation stylesheet', () => {
  const css = readFileSync(new URL('./constellation.css', import.meta.url), 'utf8');

  it('paints the sky with --ask-sunk and uses no colour of its own', () => {
    expect(css).toContain('background: var(--ask-sunk)');
    expect(/#[0-9a-f]{3,8}\b|\brgba?\(/i.test(css)).toBe(false);
  });

  it('rings building in --ask-green, waits on you in --ask-yellow, drifted in --ask-red', () => {
    expect(css).toMatch(/\.constellation-ring\[data-state='building'\] \{[^}]*var\(--ask-green\)/);
    expect(css).toMatch(/\.constellation-ring\[data-state='on-you'\] \{[^}]*var\(--ask-yellow\)/);
    expect(css).toMatch(/\.constellation-ring\[data-state='drifted'\] \{[^}]*var\(--ask-red\)/);
  });

  it('pulses only an on-you ring, and stops the pulse and hides the dots under reduced motion', () => {
    expect(css.match(/animation: constellation-pulse/g)).toHaveLength(1);
    expect(css).toMatch(/\.constellation-ring\[data-state='on-you'\] \{[^}]*animation: constellation-pulse/);
    const reduced = /@media \(prefers-reduced-motion: reduce\) \{([\s\S]*?)\n\}/.exec(css)?.[1] ?? '';
    expect(reduced).toMatch(/\.constellation-ring \{[^}]*animation: none/);
    expect(reduced).toMatch(/\.constellation-flow \{[^}]*display: none/);
  });

  it('scrolls only the sky\'s frame, sideways, below 600 px', () => {
    expect(css).toMatch(/\.constellation-frame \{[^}]*overflow-x: auto/);
    expect(css).toContain('@media (max-width: 599px)');
    expect(css).toContain('width: 680px');
  });
});
