import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { parsePr, parsePrd } from 'vertuo-omni-plan/kit/lib/ids.ts';
import type { Filter } from './constellation';
import { ConstellationTab, NO_EDGES, NO_REPOSITORIES } from './ConstellationTab';
import { demoProductHome } from './ProductHome';
import type { HomeFlight, HomeRepository, PrChip, ProductHome as Home } from './product-home.service';

// The Constellation tab as the server renders it (PRD 2129 s1, PRD 2174 s3): each star a link with its name and
// role, DOCKED, the also-in halo, the legend, the as-of stamp, the count, the plan lines (a link each with its
// title, dots when in flight) and the consumes lines apart, the empty states' words, the rings, the Now in card
// capped at 8, the star card, the line card, and the stylesheet's motion. PRD 2174 s4 draws the night sky.

const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&#x27;/g, "'").replace(/\s+/g, ' ').trim();
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
  stage: 'building', ledger: { state: 'building', lane: 'on-agent' }, stageRepos: [], prs: [], targets: [], ...over,
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

  it('docks a star with no word on its core, and only that one', () => {
    expect(html).not.toContain('DOCKED');
    expect(html).toContain('aria-label="acme/widgets-web, web, docked"');
    expect(/data-star="acme\/widgets-web" data-docked="true"/.test(html)).toBe(true);
    expect(/data-star="acme\/widgets"\s+data-docked/.test(html)).toBe(false);
  });

  it('gives a star also in another product the halo, and no other', () => {
    expect(html.match(/constellation-halo/g)).toHaveLength(1);
  });

  it('draws one consumes line per entry, consumer to provider, apart from the plan lines', () => {
    expect(html.match(/class="constellation-consumes"/g)).toHaveLength(1);
    expect(html).toContain('data-consumer="acme/widgets" data-provider="acme/widgets-api"');
    expect(html).not.toContain('constellation-plan');
  });

  it('says read only, the as-of time in UTC, the count and what the sky shows', () => {
    expect(text(html)).toContain('read only');
    expect(text(html)).toContain('as of 09:07 UTC');
    expect(text(html)).toContain('4 repositories · 1 lines');
    expect(html).toContain('role="img"');
    expect(html).toContain('aria-label="Widgets: 4 repositories, 0 plan lines"');
  });

  it('draws the legend under the sky, and says no PRD\'s plan names two repositories yet', () => {
    expect(text(/<ul class="constellation-legend"[^>]*>([\s\S]*?)<\/ul>/.exec(html)?.[1] ?? '')).toContain('also in another product');
    expect(text(html)).toContain(NO_EDGES);
  });
});

describe('the Constellation tab, empty', () => {
  it('says no repository is in the product, links to Repositories & approvers and draws no sky', () => {
    const html = render([]);
    expect(text(html)).toBe(`${NO_REPOSITORIES} Add one on Repositories & approvers`);
    expect(html).toContain('href="/app/products/p-1/repositories"');
    expect(html).not.toContain('<svg');
  });

  it('draws the stars alone with the no-line note when no PRD\'s plan names two repositories', () => {
    const html = render([repo('acme/a'), repo('acme/b')]);
    expect(html.match(/data-star=/g)).toHaveLength(2);
    expect(html).not.toContain('constellation-edge');
    expect(text(html)).toContain(NO_EDGES);
    expect(text(html)).toContain('2 repositories · 0 lines');
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
const TARGETS = [
  flight('d-918', 918, 'Offline photo upload', { ledger: { state: 'approval', lane: 'on-you' }, stage: 'prd', birthplace: 'server', targets: ['acme/widgets', 'acme/widgets-api'] }),
  flight('d-912', 912, 'Quotes on the phone', {
    targets: ['acme/widgets', 'acme/widgets-api', 'acme/elsewhere'], prs: [{ repo: 'acme/widgets-api', pr: parsePr(447) }, { repo: 'acme/widgets-web', pr: parsePr(12) }],
  }),
  flight('d-905', 905, 'Single sign-on', { repo: 'acme/auth', stage: 'inbox', ledger: { state: 'drifted', lane: null }, birthplace: 'server' }),
  flight('d-890', 890, 'Dark mode', { stage: 'shipped', ledger: null, targets: ['acme/widgets-api', 'acme/auth'] }),
];
/** The inside of the element of class `cls` (an element holding no other of its own tag). */
const section = (html: string, cls: string) => new RegExp(`<([a-z]+) class="${cls}"[^>]*>([\\s\\S]*?)</\\1>`).exec(html)?.[2] ?? '';

describe('the Constellation tab, live', () => {
  const html = render(LIVE, FLIGHTS);
  const planned = render(LIVE, TARGETS);

  it('has no filter row and no ?prd= link', () => {
    expect(html).not.toContain('constellation-chips');
    expect(html).not.toContain('prd=');
  });

  it('rings each star in its state: building, waits on you, drifted', () => {
    expect(/data-star="acme\/widgets"[^>]*data-state="on-you"/.test(html)).toBe(true);
    expect(/data-star="acme\/widgets-api"[^>]*data-state="building"/.test(html)).toBe(true);
    expect(/data-star="acme\/auth"[^>]*data-state="drifted"/.test(html)).toBe(true);
    expect(html.match(/class="constellation-ring"/g)).toHaveLength(4);
  });

  it('draws a plan line per pair, a link with its title, dots only on one in flight', () => {
    expect(planned.match(/class="constellation-plan"/g)).toHaveLength(2);
    expect(planned).toContain('href="/app/products/p-1/constellation?pair=acme/widgets,acme/widgets-api"');
    expect(planned).toContain('<title>widgets ↔ widgets-api · 2 PRDs</title>');
    expect(planned).toContain('<title>auth ↔ widgets-api · 1 PRD</title>');
    expect(planned.match(/class="constellation-flow"/g)).toHaveLength(1);
    expect(text(planned)).toContain('4 repositories · 5 lines');
    expect(text(planned)).not.toContain(NO_EDGES);
  });

  it('lists Now in the product worst first, each PRD linking to its page, and says it is read only', () => {
    const card = section(html, 'constellation-card');
    expect(text(card)).toContain('Now in Widgets');
    expect(text(card)).toContain('905 drifted · auth 918 waits on you · widgets 912 building · 3 repositories');
    expect(card).toContain('href="/prd/d-918"');
    expect(text(card)).toContain('Read only. Links live on Repositories & approvers.');
  });

  it('caps Now at 8 PRDs and links the rest to the Ledger', () => {
    const many = Array.from({ length: 11 }, (_, i) => flight(`d-${String(i)}`, 500 + i, 'Many', { stageRepos: ['acme/widgets'] }));
    const card = section(render(LIVE, many), 'constellation-card');
    expect(card.match(/href="\/prd\//g)).toHaveLength(8);
    expect(text(card)).toContain('+ 3 more on the Ledger →');
    expect(card).toContain('href="/app/products/p-1">+ 3 more');
    expect(text(section(html, 'constellation-card'))).not.toContain('more on the Ledger');
  });

  it('opens a star\'s card with ?star=: role, phase 0, also in, PRDs, lines, consumes, now, targets outside, and its two links', () => {
    const card = section(render(LIVE, TARGETS, { star: 'acme/widgets-api' }), 'constellation-card');
    const words = text(card);
    expect(words).toContain('acme/widgets-api');
    expect(words).toContain('role api');
    expect(words).toContain('phase 0 ◆ approved on the PRD page');
    expect(words).toContain('also in no other product');
    expect(words).toContain('PRDs 3');
    expect(words).toContain('lines widgets ↔ widgets-api · 2 PRDs auth ↔ widgets-api · 1 PRD');
    expect(card).toContain('href="/app/products/p-1/constellation?pair=acme/widgets,acme/widgets-api"');
    expect(words).toContain('consumes auth');
    expect(words).toContain('consumed by widgets widgets-web');
    expect(words).toContain('now 912 building');
    expect(words).toContain('1 target outside the product');
    expect(card).toContain('href="/prd/d-912"');
    expect(card).toContain('href="/app/products/p-1">Ledger rows →');
    expect(card).toContain('href="/app/products/p-1/repositories">Its links →');
    expect(words).not.toContain('Now in Widgets');
  });

  it('opens a plan line\'s card with ?pair=, either order: its PRDs newest first, in flight marked', () => {
    for (const pair of ['acme/widgets,acme/widgets-api', 'acme/widgets-api,acme/widgets']) {
      const card = section(render(LIVE, TARGETS, { pair }), 'constellation-card');
      expect(text(card)).toContain('widgets ↔ widgets-api');
      expect(text(card)).toContain('2 PRDs changed both, newest first.');
      expect(text(card)).toContain('918 Offline photo upload · in flight 912 Quotes on the phone · in flight');
      expect(card).toContain('href="/prd/d-912"');
    }
    const dim = text(section(render(LIVE, TARGETS, { pair: 'acme/auth,acme/widgets-api' }), 'constellation-card'));
    expect(dim).toContain('890 Dark mode');
    expect(dim).not.toContain('in flight');
  });

  it('names a docked star\'s phase 0 and the products a star is also in', () => {
    expect(text(section(render(LIVE, FLIGHTS, { star: 'acme/widgets-web' }), 'constellation-card'))).toContain('phase 0 ◇ docs-only phase-0 pull request');
    expect(text(section(render(LIVE, FLIGHTS, { star: 'acme/auth' }), 'constellation-card'))).toContain('also in Platform');
  });

  it('reads an unknown ?star= and ?pair= as none', () => {
    const unknown = render(LIVE, TARGETS, { pair: 'acme/a,acme/b', star: 'acme/gone' });
    expect(text(section(unknown, 'constellation-card'))).toContain('Now in Widgets');
  });

  it('draws the legend of the states and the two kinds of line', () => {
    expect(text(section(html, 'constellation-legend'))).toContain('building waits on you drifted');
    expect(text(section(html, 'constellation-legend'))).toContain('a plan line');
    expect(text(section(html, 'constellation-legend'))).toContain('a consumes line');
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

  it('draws plan lines from its PRDs\' targets, one in flight', () => {
    expect(html.match(/class="constellation-plan"/g)).toHaveLength(3);
    expect(html.match(/data-in-flight="true"/g)).toHaveLength(1);
    expect(html).toContain('<title>widgets ↔ widgets-api · 2 PRDs</title>');
    expect(text(html)).not.toContain(NO_EDGES);
  });
});

describe('the Constellation stylesheet', () => {
  const css = readFileSync(new URL('./constellation.css', import.meta.url), 'utf8');

  const code = css.replace(/\/\*[\s\S]*?\*\//g, '');

  it('paints the sky in the galaxy\'s --void, --deep and --starfield, and uses no colour of its own', () => {
    expect(code).toMatch(/\.constellation-sky \{[^}]*radial-gradient\([^}]*var\(--deep\)[^}]*var\(--void\)[^}]*var\(--starfield\)/);
    expect(code).toMatch(/\.constellation-nebula-stop\[data-hue='plasma'\] \{[^}]*var\(--plasma\)/);
    expect(code).toMatch(/\.constellation-nebula-stop\[data-hue='cyan'\] \{[^}]*var\(--cyan\)/);
    expect(code).toMatch(/\.constellation-nebula-stop\[data-hue='magenta'\] \{[^}]*var\(--magenta\)/);
    expect(code).not.toContain('--ask-sunk');
    expect(/#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?|color-mix)\(/i.test(code)).toBe(false);
  });

  it('rings building in --green, waits on you in --yellow, drifted in --red, and haloes in --plasma', () => {
    expect(code).toMatch(/\.constellation-ring\[data-state='building'\] \{[^}]*var\(--green\)/);
    expect(code).toMatch(/\.constellation-ring\[data-state='on-you'\] \{[^}]*var\(--yellow\)/);
    expect(code).toMatch(/\.constellation-ring\[data-state='drifted'\] \{[^}]*var\(--red\)/);
    expect(code).toMatch(/\.constellation-halo \{[^}]*var\(--plasma\)/);
  });

  it('draws an in-flight line --cyan and the rest dim, a consumes line thin in --slate, a docked core --slate', () => {
    expect(code).toMatch(/\.constellation-edge \{[^}]*var\(--dim\)/);
    expect(code).toMatch(/\.constellation-plan\[data-in-flight\] \.constellation-edge \{[^}]*var\(--cyan\)/);
    expect(code).toMatch(/\.constellation-consumes \{[^}]*var\(--slate\)[^}]*stroke-width: 1;/);
    expect(code).toMatch(/\.constellation-star\[data-docked\] \.constellation-body \{[^}]*var\(--slate\)/);
  });

  it('pulses only an on-you ring, and stops every motion and hides the dots under reduced motion', () => {
    expect(code.match(/animation: constellation-pulse/g)).toHaveLength(1);
    expect(code).toMatch(/\.constellation-ring\[data-state='on-you'\] \{[^}]*animation: constellation-pulse/);
    const reduced = /@media \(prefers-reduced-motion: reduce\) \{([\s\S]*?)\n\}/.exec(code)?.[1] ?? '';
    expect(reduced).toMatch(/\.constellation-ring \{[^}]*animation: none/);
    expect(reduced).toMatch(/\.constellation-twinkle \{[^}]*animation: none/);
    expect(reduced).toMatch(/\.constellation-flow \{[^}]*display: none/);
  });

  it('pauses every animation while the page is hidden', () => {
    expect(code).toMatch(/\.constellation\[data-paused\] \* \{[^}]*animation-play-state: paused/);
  });

  it('scrolls only the sky\'s frame, sideways, below 600 px', () => {
    expect(css).toMatch(/\.constellation-frame \{[^}]*overflow-x: auto/);
    expect(css).toContain('@media (max-width: 599px)');
    expect(css).toContain('width: 680px');
  });
});

describe('the night sky (s4)', () => {
  const planned = render(LIVE, TARGETS);
  const sizes = render(
    [repo('acme/a', { role: 'api' }), repo('acme/b'), repo('acme/c'), repo('acme/d'), repo('acme/e'), repo('acme/f')],
    [
      flight('d-1', 1, 'One', { targets: ['acme/a', 'acme/b', 'acme/c'] }),
      flight('d-2', 2, 'Two', { targets: ['acme/a', 'acme/b'] }),
      flight('d-3', 3, 'Three', { targets: ['acme/a'] }),
    ],
  );

  it('layers a gradient, a nebula and a field of background stars', () => {
    expect(planned).toContain('class="constellation-sky"');
    expect(planned.match(/constellation-nebula-stop/g)).toHaveLength(6);
    expect(planned).toContain('class="constellation-nebula"');
    expect(planned.match(/class="constellation-speck/g)?.length).toBeGreaterThan(50);
  });

  it('seeds the field by the product: the same for the same id, another for another', () => {
    const field = (html: string) => section(html, 'constellation-field');
    const other = renderToStaticMarkup(createElement(ConstellationTab, { home: { ...home(LIVE, TARGETS), product: { id: 'p-2', name: 'Widgets' } }, now: NOW }));
    expect(field(render(LIVE, TARGETS))).toBe(field(planned));
    expect(field(other)).not.toBe(field(planned));
  });

  it('twinkles at most 60 background stars', () => {
    const twinkling = planned.match(/constellation-twinkle/g)?.length ?? 0;
    expect(twinkling).toBeGreaterThan(0);
    expect(twinkling).toBeLessThanOrEqual(60);
  });

  it('draws star cores in three sizes by weight', () => {
    expect(/data-star="acme\/a"[^>]*data-size="heavy"/.test(sizes)).toBe(true);
    expect(/data-star="acme\/c"[^>]*data-size="medium"/.test(sizes)).toBe(true);
    expect(/data-star="acme\/d"[^>]*data-size="light"/.test(sizes)).toBe(true);
    const radius = (name: string) => new RegExp(`data-star="${name}"[\\s\\S]*?class="constellation-body"[^>]*r="(\\d+)"`).exec(sizes)?.[1];
    expect(Number(radius('acme/a'))).toBeGreaterThan(Number(radius('acme/c')));
    expect(Number(radius('acme/c'))).toBeGreaterThan(Number(radius('acme/d')));
  });

  it('names a star under its core, and its role only when it has one', () => {
    expect(sizes).toContain('class="constellation-name"');
    expect(sizes.match(/class="constellation-role"/g)).toHaveLength(1);
    expect(sizes).not.toContain('no role');
    expect(sizes).toContain('aria-label="acme/b"');
  });

  it('gives every star a link and a title: name, PRDs, phase 0 mark', () => {
    expect(planned).toContain('<title>widgets-api · 3 PRDs · ◆</title>');
    expect(planned).toContain('<title>widgets-web · 0 PRDs · ◇</title>');
    expect(sizes).toContain('<title>a · 3 PRDs · ◆</title>');
    expect(sizes).toContain('<title>c · 1 PRD · ◆</title>');
  });

  it('pulses only the on-you ring, and rings a quiet star not at all', () => {
    expect(planned.match(/class="constellation-ring" data-state="on-you"/g)).toHaveLength(1);
    expect(sizes).not.toContain('constellation-ring');
  });

  it('draws consumes lines with an arrowhead, and plan lines without', () => {
    expect(planned.match(/class="constellation-consumes"[^>]*marker-end="url\(#constellation-arrow\)"/g)).toHaveLength(3);
    expect(section(planned, 'constellation-plan')).not.toContain('marker-end');
    expect(planned).toContain('id="constellation-arrow"');
  });

  it('writes the lede, the count and the as-of stamp, and no filter row', () => {
    expect(text(planned)).toContain('How the product looks now.');
    expect(text(planned)).toContain('4 repositories · 5 lines');
    expect(text(planned)).toContain('as of 09:07 UTC');
    expect(planned).not.toContain('filter');
  });

  it('keeps its one script to a pause while the page is hidden', () => {
    expect(readFileSync(new URL('./ConstellationMotion.tsx', import.meta.url), 'utf8')).toContain('visibilitychange');
  });
});
