import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect } from 'vitest';
import type { KnowledgeView } from './access';
import { GRAPH, SECRETS } from './fixture';
import { KnowledgeScreen } from './KnowledgeScreen';
import { OrreryDiagram } from './OrreryDiagram';
import { tabEntries } from './view';

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

const map = (wanted: Wanted = {}) => screen({ kind: 'map', graph: GRAPH }, wanted);

/** The part of the markup between two markers. */
const between = (html: string, start: string, end: string) => {
  const from = html.indexOf(start);
  expect(from, start).toBeGreaterThanOrEqual(0);
  const to = html.indexOf(end, from + start.length);
  return html.slice(from, to < 0 ? undefined : to);
};
/** The orrery: the page's diagram (the header's Game mode glyph is an svg too). */
const diagram = (html: string) => between(html, '<svg class="km-orrery"', '</svg>');
const index = (html: string) => between(html, 'class="km-index"', '</section>');
const panel = (html: string) => between(html, 'class="km-panel"', '</section>');
/** Every `data-entry` in the markup, in order. */
const entries = (html: string) => [...html.matchAll(/data-entry="([^"]+)"/g)].map((m) => m[1]);
const count = (html: string, pattern: RegExp) => html.match(new RegExp(pattern.source, 'g'))?.length ?? 0;

describe('the map, for the crew', () => {
  const html = map();

  it('shows the top bar: OMNI LOOP · Knowledge map, the repository, the star chart and the theme switch', () => {
    const bar = between(html, '<header', '</header>');
    expect(bar).toContain('OMNI LOOP');
    expect(bar).toContain('Knowledge map');
    expect(bar).toContain('acme/widgets');
    expect(bar).toMatch(/<a [^>]*href="\/#chart"/);
    expect(bar).toContain('aria-label="Theme"');
  });

  it('shows one tab per domain with its entry count, then Between domains', () => {
    const tabs = between(html, 'class="km-tabs"', '</nav>');
    expect([...tabs.matchAll(/<a [^>]*>([^<]+)<span class="km-count">(\d+)<\/span><\/a>/g)].map((m) => `${m[1].trim()} ${m[2]}`))
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

describe('the top bar, in every state of the page', () => {
  const states: Array<[string, KnowledgeView]> = [
    ['a build with no database', { kind: 'closed' }],
    ['signed out', { kind: 'sign-in' }],
    ['signed in without a crew account', { kind: 'crew-only' }],
    ['the knowledge out of reach', { kind: 'out-of-reach' }],
    ['the map', { kind: 'map', graph: GRAPH }],
    ['no knowledge yet', { kind: 'map', graph: { ...GRAPH, domains: [], entries: [], links: [], loose: [], unserved: [] } }],
  ];
  const bar = (view: KnowledgeView) => between(screen(view), '<header', '</header>');
  /** The bar's links and buttons, in order, by name; the Game mode dialog's own left out. */
  const controls = (html: string) =>
    [...html.replace(/<dialog[\s\S]*?<\/dialog>/g, '').matchAll(/<(a|button)\b[^>]*>([\s\S]*?)<\/\1>/g)]
      .map((m) => m[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());

  it.each(states)('%s: links the OMNI LOOP mark to /app', (_, view) => {
    expect(bar(view)).toMatch(/<a class="ask-mark" href="\/app">OMNI LOOP<\/a><span class="ask-brand-sub">Knowledge map<\/span>/);
  });

  it.each(states)('%s: keeps the star chart, then ends with Release notes, Docs, the theme switch and Game mode (PRD 346)', (_, view) => {
    expect(controls(bar(view))).toEqual(['OMNI LOOP', 'Open the star chart →', 'Release notes', 'Docs', 'Omni', 'Light', 'Dark', 'Game mode']);
    expect(bar(view)).toMatch(/<a class="km-chart" href="\/#chart">/);
    expect(bar(view)).toMatch(/<dialog [^>]*class="game-mode-dialog"/);
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
      graph: GRAPH, entries: tabEntries(GRAPH, 'product'), label: 'product', selected: 'P-PRODUCT-1', query: 'outbox', onChoose: () => {},
    }));
    const dim = [...svg.matchAll(/class="km-pick is-dim"[^>]*data-entry="([^"]+)"/g)].map((m) => m[1]).sort();
    expect(dim).toEqual(['BR-PRODUCT-1', 'BR-PRODUCT-3', 'N-PRODUCT-1', 'N-PRODUCT-2', 'P-PRODUCT-1', 'P-PRODUCT-3']);
    expect(count(svg, /class="km-pick"/)).toBe(2);
  });
});

describe('everyone else', () => {
  const states: Array<[string, KnowledgeView]> = [
    ['signed out', { kind: 'sign-in' }],
    ['signed in without a crew account', { kind: 'crew-only' }],
    ['a build with no database', { kind: 'closed' }],
    ['the knowledge out of reach', { kind: 'out-of-reach' }],
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
    expect(html).toContain('Sign in with Google');
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
    expect(screen({ kind: 'out-of-reach' })).toContain('The knowledge is out of reach');
  });

  it('says there is no knowledge yet for a graph without a domain', () => {
    const html = screen({ kind: 'map', graph: { ...GRAPH, domains: [], entries: [], links: [], loose: [], unserved: [] } });
    expect(html).toContain('No knowledge yet');
  });
});
