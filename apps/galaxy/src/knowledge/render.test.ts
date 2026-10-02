import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect } from 'vitest';
import type { KnowledgeGraph } from '../data/knowledge';
import type { KnowledgeView } from './access';
import { GRAPH, SECRETS } from './fixture';
import { KnowledgeMap } from './KnowledgeMap';
import { KnowledgeScreen } from './KnowledgeScreen';
import { OrreryDiagram } from './OrreryDiagram';
import { repoHref } from './RepoPicker';
import { select, tabEntries } from './view';
import { sure } from '../arcade/sure';

// The /knowledge page as the server renders it: what a person sees before any script runs.

const SUPABASE = { url: 'https://db.example', key: 'anon' };
type Wanted = { domain?: string | null; entry?: string | null };

const screen = (view: KnowledgeView, wanted: Wanted = {}) =>
  renderToStaticMarkup(createElement(KnowledgeScreen, {
    view,
    wanted: { domain: wanted.domain ?? null, entry: wanted.entry ?? null },
    supabase: SUPABASE,
    signinError: null,
  }));

const map = (wanted: Wanted = {}) => screen({ kind: 'map', graph: GRAPH, menu: null }, wanted);

/** The part of the markup between two markers. */
const between = (html: string, start: string, end: string) => {
  const from = html.indexOf(start);
  expect(from, start).toBeGreaterThanOrEqual(0);
  const to = html.indexOf(end, from + start.length);
  return html.slice(from, to < 0 ? undefined : to);
};
/** The orrery: the page's diagram. */
const diagram = (html: string) => between(html, '<svg class="km-orrery"', '</svg>');
const index = (html: string) => between(html, 'class="km-index"', '</section>');
const panel = (html: string) => between(html, 'class="km-panel"', '</section>');
/** Every `data-entry` in the markup, in order. */
const entries = (html: string) => [...html.matchAll(/data-entry="([^"]+)"/g)].map((m) => m[1]);
const count = (html: string, pattern: RegExp) => html.match(new RegExp(pattern.source, 'g'))?.length ?? 0;

describe('the map, for the crew', () => {
  const html = map();

  it('heads the page with the repository it reads, as a chip, and the star chart', () => {
    const head = between(html, '<div class="km-page-head">', '</div>');
    expect(head).toContain('<code class="km-repo">acme/widgets</code>');
    expect(head).toMatch(/<a class="km-chart" href="\/#chart">Open the star chart →<\/a>/);
  });

  it('shows one tab per domain with its entry count, then Between domains', () => {
    const tabs = between(html, 'class="km-tabs"', '</nav>');
    expect([...tabs.matchAll(/<a [^>]*>([^<]+)<span class="km-count">(\d+)<\/span><\/a>/g)].map((m) => `${sure(m[1], 'm[1]').trim()} ${m[2]}`))
      .toEqual(['product 8', 'billing 2', 'Between domains 1']);
    expect(tabs).toMatch(/<a [^>]*href="\/knowledge\?domain=product"[^>]*aria-current="page"/);
  });

  it('draws every entry of the domain as a dot on its kind’s orbit, filled for a law and hollow for a proposed entry', () => {
    const svg = diagram(html);
    expect(entries(svg).sort()).toEqual(tabEntries(GRAPH, 'product').map((e) => e.id).sort());
    expect(count(svg, /class="km-ring"/)).toBe(3);
    expect(count(svg, /class="km-dot" data-kind="principle"/)).toBe(3);
    expect(count(svg, /class="km-dot" data-kind="rule"/)).toBe(3);
    expect(count(svg, /class="km-dot" data-kind="invariant"/)).toBe(2);
    expect(count(svg, /data-status="law"/)).toBe(2);
    expect(count(svg, /data-status="proposed"/)).toBe(6);
  });

  it('lists every entry in the index, grouped by principle, then the loose entries, then the unserved principles', () => {
    expect(entries(index(html))).toEqual([
      'P-PRODUCT-1', 'BR-PRODUCT-1', 'N-PRODUCT-1', 'P-PRODUCT-2', 'BR-PRODUCT-2',
      'BR-PRODUCT-3', 'N-PRODUCT-2',
      'P-PRODUCT-3',
    ]);
    expect(index(html)).toContain('Loose entries');
    expect(index(html)).toContain('Unserved principles');
    expect(index(html)).toMatch(/data-entry="P-PRODUCT-3"[\s\S]*nothing serves it/);
  });

  it('selects the first principle by default', () => {
    expect(panel(html)).toContain('<code>P-PRODUCT-1</code>');
    expect(count(index(html), /aria-current="true"/)).toBe(1);
    expect(index(html)).toMatch(/aria-current="true"[^>]*data-entry="P-PRODUCT-1"/);
    expect(count(diagram(html), /class="km-selected"/)).toBe(1);
  });

  it('draws every serves link faintly, and the selected entry’s links strong', () => {
    const svg = diagram(html);
    // Three serves links in the product: BR-PRODUCT-2's is faint, the two to P-PRODUCT-1 strong.
    expect(count(svg, /class="km-link"/)).toBe(1);
    expect(count(svg, /class="km-link is-strong"/)).toBe(2);
    expect(count(svg, /data-link="serves"/)).toBe(3);
  });

  it('links a dot and an index row to the address of its entry', () => {
    expect(diagram(html)).toContain('href="/knowledge?domain=product&amp;entry=BR-PRODUCT-2"');
    expect(index(html)).toContain('href="/knowledge?domain=product&amp;entry=BR-PRODUCT-2"');
  });
});

describe('the page\'s own heading, in every state of the page', () => {
  const states: Array<[string, KnowledgeView]> = [
    ['a build with no database', { kind: 'closed' }],
    ['signed out', { kind: 'sign-in' }],
    ['signed in without a crew account', { kind: 'crew-only' }],
    ['the knowledge out of reach', { kind: 'out-of-reach', menu: null }],
    ['a repository the menu does not offer', { kind: 'not-offered', repo: 'other/secret', menu: null }],
    ['the map', { kind: 'map', graph: GRAPH, menu: null }],
    ['no knowledge yet', { kind: 'map', graph: { ...GRAPH, domains: [], entries: [], links: [], loose: [], unserved: [] }, menu: null }],
  ];

  it.each(states)('%s: draws no bar of its own and no main: the app shell holds them (PRD 438)', (_, view) => {
    const html = screen(view);
    expect(html).not.toMatch(/<header class="(ask-bar|app-bar|top-bar)/);
    expect(html).not.toContain('<main');
    expect(html).not.toContain('OMNI LOOP');
    expect(html).not.toContain('game-mode');
  });

  it.each(states)('%s: keeps the star chart link in the page', (_, view) => {
    expect(screen(view)).toMatch(/^<div class="km-main"><div class="km-page-head">(<code class="km-repo">[^<]+<\/code>)?<a class="km-chart" href="\/#chart">Open the star chart →<\/a><\/div>/);
  });

  it('shows the repository chip only with the map', () => {
    expect(screen({ kind: 'map', graph: GRAPH, menu: null })).toContain('<code class="km-repo">acme/widgets</code>');
    expect(screen({ kind: 'closed' })).not.toContain('km-repo');
  });
});

describe('the address selecting an entry', () => {
  it('shows a rule whole in the panel: statement, serves, cites, its PRD, enforcement and file', () => {
    const html = map({ domain: 'product', entry: 'BR-PRODUCT-1' });
    const p = panel(html);
    expect(p).toContain('<code>BR-PRODUCT-1</code>');
    expect(p).toContain('A draft pull request is the claim, and P-PRODUCT-3 still holds over it.');
    expect(p).toMatch(/Serves<\/dt><dd>[\s\S]*href="\/knowledge\?domain=product&amp;entry=P-PRODUCT-1"[\s\S]*A slice is claimed before it is built\./);
    expect(p).toMatch(/Cites<\/dt><dd>[\s\S]*href="\/knowledge\?domain=product&amp;entry=P-PRODUCT-3"/);
    expect(p).toContain('href="https://github.com/acme/widgets/issues/7"');
    expect(p).toContain('PRD #7');
    expect(p).toMatch(/Enforced by<\/dt><dd>kit\/lib\/claim\.mjs<\/dd>/);
    expect(p).toContain('<code>.omni-loop/knowledge/product/rules.md</code>');
    expect(p).toContain('>rule<');
    expect(p).toContain('>law<');
    expect(index(html)).toMatch(/aria-current="true"[^>]*data-entry="BR-PRODUCT-1"/);
  });

  it('shows a principle’s Why and what serves it', () => {
    const p = panel(map({ entry: 'P-PRODUCT-1' }));
    expect(p).toMatch(/Why<\/dt><dd>Two waves building the same slice waste a day each\.<\/dd>/);
    expect(p).toMatch(/Served by<\/dt><dd>[\s\S]*entry=BR-PRODUCT-1"[\s\S]*entry=N-PRODUCT-1"/);
  });

  it('says so when an entry serves a principle that is not there', () => {
    expect(panel(map({ entry: 'BR-PRODUCT-3' }))).toMatch(/Serves<\/dt><dd>P-PRODUCT-99 <span class="km-muted">names no entry<\/span>/);
  });

  it('opens an entry in its own tab, whatever the domain says', () => {
    const html = map({ domain: 'product', entry: 'BR-BILLING-1' });
    expect(between(html, 'class="km-tabs"', '</nav>')).toMatch(/href="\/knowledge\?domain=billing"[^>]*aria-current="page"/);
    expect(entries(diagram(html)).sort()).toEqual(['BR-BILLING-1', 'P-BILLING-1']);
    expect(index(html)).toMatch(/data-entry="P-PRODUCT-2"[\s\S]*in product/);
  });

  it('opens the entries between domains, with their pair', () => {
    const html = map({ entry: 'X-BILLING-PRODUCT-1' });
    expect(entries(diagram(html))).toEqual(['X-BILLING-PRODUCT-1']);
    expect(panel(html)).toMatch(/Domains<\/dt><dd>billing · product<\/dd>/);
  });
});

describe('the filter', () => {
  it('dims every dot that does not match, by id or by words', () => {
    const svg = renderToStaticMarkup(createElement(OrreryDiagram, {
      graph: GRAPH, entries: tabEntries(GRAPH, 'product'), label: 'product', selected: 'P-PRODUCT-1', query: 'outbox', repo: null, onChoose: () => {},
    }));
    const dim = [...svg.matchAll(/class="km-pick is-dim"[^>]*data-entry="([^"]+)"/g)].map((m) => m[1]).sort();
    expect(dim).toEqual(['BR-PRODUCT-1', 'BR-PRODUCT-3', 'N-PRODUCT-1', 'N-PRODUCT-2', 'P-PRODUCT-1', 'P-PRODUCT-3']);
    expect(count(svg, /class="km-pick"/)).toBe(2);
  });
});

describe('the map of a repository the menu shows (PRD 523)', () => {
  const ANVILS: KnowledgeGraph = { ...GRAPH, repo: 'acme/Anvils' };
  /** The map alone, on one entry, with `repo` as given: left out when undefined. */
  const drawn = (entry: string, repo?: string | null) =>
    renderToStaticMarkup(createElement(KnowledgeMap, { graph: ANVILS, initial: sure(select(ANVILS, { entry }), 'select(ANVILS, { entry })'), ...(repo === undefined ? {} : { repo }) }));
  /** Every address on the map. */
  const addresses = (html: string) => [...html.matchAll(/href="(\/knowledge[^"]*)"/g)].map((m) => m[1]);
  const ids = ANVILS.entries.map((e) => e.id);

  it('carries the repository on every tab, dot, index row and panel link', () => {
    const html = drawn('BR-PRODUCT-1', 'acme/Anvils');
    expect(between(html, 'class="km-tabs"', '</nav>')).toMatch(/href="\/knowledge\?repo=acme%2FAnvils&amp;domain=product"[^>]*aria-current="page"/);
    expect(diagram(html)).toContain('href="/knowledge?repo=acme%2FAnvils&amp;domain=product&amp;entry=BR-PRODUCT-2"');
    expect(index(html)).toContain('href="/knowledge?repo=acme%2FAnvils&amp;domain=product&amp;entry=BR-PRODUCT-2"');
    expect(panel(html)).toMatch(/Serves<\/dt><dd>[\s\S]*href="\/knowledge\?repo=acme%2FAnvils&amp;domain=product&amp;entry=P-PRODUCT-1"/);
    expect(panel(html)).toMatch(/Cites<\/dt><dd>[\s\S]*href="\/knowledge\?repo=acme%2FAnvils&amp;domain=product&amp;entry=P-PRODUCT-3"/);
    expect(panel(html)).toContain('href="https://github.com/acme/Anvils/issues/7"');
    expect(panel(drawn('P-PRODUCT-1', 'acme/Anvils'))).toMatch(/Served by<\/dt><dd>[\s\S]*href="\/knowledge\?repo=acme%2FAnvils&amp;domain=product&amp;entry=BR-PRODUCT-1"/);
  });

  it.each(ids)('on %s, leaves no address without the repository', (id) => {
    const html = drawn(id, 'acme/Anvils');
    expect(addresses(html).length).toBeGreaterThan(0);
    expect(addresses(html).filter((href) => !sure(href, 'href').startsWith('/knowledge?repo=acme%2FAnvils&amp;domain='))).toEqual([]);
    expect(html).not.toMatch(/href="\/knowledge\?domain=/);
  });

  it.each(ids)('on %s, draws exactly today\'s map without a repository, the repository being the only difference', (id) => {
    const today = drawn(id);
    expect(today).not.toContain('repo=');
    expect(drawn(id, null)).toBe(today);
    expect(drawn(id, 'acme/Anvils').replaceAll('repo=acme%2FAnvils&amp;', '')).toBe(today);
  });

  it('pushes the address of a choice in the same repository', () => {
    const source = readFileSync(new URL('./KnowledgeMap.tsx', import.meta.url), 'utf8');
    expect(source).toContain('const href = entryHref(next, repo);');
    expect(source).toContain("window.history.pushState(null, '', href)");
  });
});

describe('everyone else', () => {
  const states: Array<[string, KnowledgeView]> = [
    ['signed out', { kind: 'sign-in' }],
    ['signed in without a crew account', { kind: 'crew-only' }],
    ['a build with no database', { kind: 'closed' }],
    ['the knowledge out of reach', { kind: 'out-of-reach', menu: null }],
    ['a repository the menu does not offer', { kind: 'not-offered', repo: 'other/secret', menu: null }],
  ];

  it.each(states)('%s: the markup holds no entry id and no statement', (_, view) => {
    const html = screen(view);
    for (const secret of SECRETS) expect(html, secret).not.toContain(secret);
    expect(html).not.toContain('acme/widgets');
    expect(html).not.toContain('km-orrery');
  });

  it('asks a visitor who is signed out to sign in, to come back to /knowledge', () => {
    const html = screen({ kind: 'sign-in' });
    expect(html).toContain('Sign in to read the knowledge map');
    expect(html).toContain('Sign in with GitHub');
  });

  it('tells a person without a crew account that the map is for the crew', () => {
    const html = screen({ kind: 'crew-only' });
    expect(html).toContain('The knowledge map is for the crew');
    expect(html).toContain('Sign in with another account');
  });

  it('says the map is not open in a build with no database', () => {
    expect(screen({ kind: 'closed' })).toContain('The knowledge map is not open here');
  });

  it('says the knowledge is out of reach when it cannot be read', () => {
    expect(screen({ kind: 'out-of-reach', menu: null })).toContain('The knowledge is out of reach');
  });

  it('says there is no knowledge yet for a graph without a domain, and how to propose some', () => {
    const html = screen({ kind: 'map', graph: { ...GRAPH, domains: [], entries: [], links: [], loose: [], unserved: [] }, menu: null });
    expect(html).toContain('No knowledge yet');
    expect(html).toContain('<code>/omni:invade</code>');
  });
});

describe('the repository menu', () => {
  const ANVILS: KnowledgeGraph = { ...GRAPH, repo: 'acme/Anvils' };
  const OPTIONS = [{ value: '', label: 'acme/widgets' }, { value: 'acme/Anvils', label: 'acme/Anvils' }];
  const head = (html: string) => between(html, '<div class="km-page-head">', '</form>');
  const options = (html: string) => [...html.matchAll(/<option value="([^"]*)"( selected="")?>([^<]+)<\/option>/g)].map((m) => `${m[3]}${m[2] ? ' *' : ''}`);

  it('replaces the chip, a GET form to /knowledge naming each repository, the deployed checkout first and shown', () => {
    const html = screen({ kind: 'map', graph: GRAPH, menu: { options: OPTIONS, current: '' } });
    expect(head(html)).toMatch(/<form class="km-picker" action="\/knowledge" method="get">/);
    expect(head(html)).toMatch(/<select class="ask-share-pick" name="repo">/);
    expect(options(html)).toEqual(['acme/widgets *', 'acme/Anvils']);
    expect(head(html)).toContain('<button type="submit" class="ask-button quiet">Show</button>');
    expect(html).not.toContain('km-repo');
    expect(html).toContain('<a class="km-chart" href="/#chart">Open the star chart →</a>');
    expect(diagram(html)).toContain('href="/knowledge?domain=product&amp;entry=BR-PRODUCT-2"');
  });

  it('shows a picked repository, every address carrying it, and no star chart, which shows the deployed checkout', () => {
    const html = screen({ kind: 'map', graph: ANVILS, menu: { options: OPTIONS, current: 'acme/Anvils' } });
    expect(options(html)).toEqual(['acme/widgets', 'acme/Anvils *']);
    expect(html).not.toContain('km-chart');
    expect(between(html, 'class="km-tabs"', '</nav>')).toContain('href="/knowledge?repo=acme%2FAnvils&amp;domain=product"');
    expect(diagram(html)).toContain('href="/knowledge?repo=acme%2FAnvils&amp;domain=product&amp;entry=BR-PRODUCT-2"');
    expect(index(html)).toContain('href="/knowledge?repo=acme%2FAnvils&amp;domain=product&amp;entry=BR-PRODUCT-2"');
    expect(panel(html)).toContain('href="/knowledge?repo=acme%2FAnvils&amp;domain=product&amp;entry=BR-PRODUCT-1"');
    expect(panel(html)).toContain('href="https://github.com/acme/Anvils/issues/');
    expect(html.match(/href="\/knowledge\?domain=/g)).toBeNull();
  });

  it('says a picked repository could not be read from GitHub, keeping the menu', () => {
    const html = screen({ kind: 'out-of-reach', menu: { options: OPTIONS, current: 'acme/Anvils' } });
    expect(options(html)).toEqual(['acme/widgets', 'acme/Anvils *']);
    expect(html).toContain('The knowledge of acme/Anvils could not be read from GitHub; this deployment&#x27;s log says why.');
  });

  it('says a repository the menu does not offer is not on it, and reads nothing of it', () => {
    const html = screen({ kind: 'not-offered', repo: 'other/secret', menu: { options: OPTIONS, current: '' } });
    expect(html).toContain('This repository is not on the menu');
    expect(html).toContain('other/secret is not a repository of your workspaces set up with Omni Loop, or the Omni Loop App cannot read it.');
    expect(html).toContain('Pick one from the menu above.');
    expect(options(html)).toEqual(['acme/widgets *', 'acme/Anvils']);
    for (const secret of SECRETS) expect(html, secret).not.toContain(secret);
    expect(screen({ kind: 'not-offered', repo: 'other/secret', menu: null })).not.toContain('Pick one from the menu');
  });

  it('opens a choice at once once scripts run: the deployed checkout at the page\'s own address', () => {
    expect(repoHref('')).toBe('/knowledge');
    expect(repoHref('acme/Anvils')).toBe('/knowledge?repo=acme%2FAnvils');
  });

  it('borrows the version picker\'s look for its select (share.css)', () => {
    const layout = readFileSync(new URL('../../app/knowledge/layout.tsx', import.meta.url), 'utf8');
    expect(layout).toContain("import '../../src/ask/page/share.css';");
  });
});
