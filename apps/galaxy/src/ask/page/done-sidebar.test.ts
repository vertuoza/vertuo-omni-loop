import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DEMO_MEMBERS, demoHistory } from './demo';
import { WorkspaceHistory } from './WorkspaceHistory';
import {
  categoriesOf, categoryCounts, historyChoices, historyFacetsOf, historyHref, historyItemsOf, historyPageOf, type HistoryFilters,
} from './workspace-history';

// The Inbox's Done tab (visual update #3169, pick A of round 3): the categories in a sidebar on the
// left, each with its count, beside one line of search, More filters and the count, then the rows
// grouped by day.

const NOW = Date.parse('2026-09-26T10:00:00Z');
const rows = demoHistory(NOW);

const listed = (filters: HistoryFilters = {}) => historyItemsOf(historyPageOf(rows, filters).rows, DEMO_MEMBERS);
const page = (filters: HistoryFilters = {}, extra: { all?: number; matched?: number; next?: string | null } = {}) => {
  const facets = historyFacetsOf(rows, filters);
  return renderToStaticMarkup(createElement(WorkspaceHistory, {
    items: listed(filters),
    choices: historyChoices(rows, DEMO_MEMBERS),
    filters,
    categories: categoriesOf(facets),
    all: facets.reduce((sum, f) => sum + f.total, 0),
    now: NOW,
    ...extra,
  }));
};

describe('the Done tab\'s categories', () => {
  it('counts each category over the other filters, leaving the chosen category out', () => {
    const all = categoryCounts(rows, {});
    const chosen = categoryCounts(rows, { category: 'product' });
    expect(chosen).toEqual(all);
    expect(all.reduce((sum, c) => sum + c.count, 0)).toBe(listed().length + rows.filter((row) => row.round.status === 'open').length);
    expect(all.every((c) => c.count > 0)).toBe(true);
    const narrowed = categoryCounts(rows, { search: 'no such word anywhere' });
    expect(narrowed).toEqual([]);
  });

  it('links each category to the Done tab, keeping the other filters', () => {
    expect(historyHref({ repo: 'vertuoza/vertuo-omni-loop', category: 'product' }, { category: 'architecture' }))
      .toBe('/app/inbox/done?category=architecture&repo=vertuoza%2Fvertuo-omni-loop');
    expect(historyHref({ category: 'product', search: 'host' }, { category: undefined })).toBe('/app/inbox/done?q=host');
    expect(historyHref({}, {})).toBe('/app/inbox/done');
  });

  it('draws the categories as a sidebar of links, All first, the chosen one marked', () => {
    const html = page({ category: 'architecture' });
    expect(html).toMatch(/<nav class="done-cats" aria-label="Categories">/);
    expect(html).toContain('<a class="done-cat" href="/app/inbox/done">All');
    expect(html).toMatch(/<a class="done-cat" href="\/app\/inbox\/done\?category=architecture" aria-current="page">Architecture/);
  });

  it('AC-2: marks the chosen category for the signal tint, and the stylesheet gives it no border, bar or rule', () => {
    expect(page({ category: 'architecture' }).match(/aria-current="page"/g)).toHaveLength(1);
    const css = readFileSync(fileURLToPath(new URL('./history.css', import.meta.url)), 'utf8');
    const rule = css.match(/\.ask a\.done-cat\[aria-current='page'\] \{[^}]*\}/)?.[0] ?? '';
    expect(rule).toContain('background: var(--color-signal-soft)');
    expect(rule).toContain('font-weight: var(--weight-semibold)');
    expect(rule).not.toMatch(/border|outline|box-shadow|::before/);
  });

  it('AC-9: lists every category with its count under the other filters, a category with none dimmed', () => {
    const filters: HistoryFilters = { search: 'host', repo: 'vertuoza/vertuo-omni-loop' };
    const html = page(filters);
    const facets = historyFacetsOf(rows, filters);
    for (const facet of facets) {
      const link = html.match(new RegExp(`<a class="([^"]*)" href="[^"]*category=${facet.id}[^"]*"[^>]*>[^<]*<span class="done-cat-count">(\\d+)</span>`));
      expect(link, facet.id).not.toBeNull();
      expect(Number(link?.[2])).toBe(facet.matched);
      expect(link?.[1]?.includes('is-none')).toBe(facet.matched === 0);
    }
    expect(facets.some((f) => f.matched === 0)).toBe(true);
  });

  it('says the count as "<n> answered", or "<k> of <n> in <category> · Clear all"', () => {
    expect(page({}, { all: 1284 }).replace(/<[^>]*>/g, '')).toContain('1,284 answered');
    const text = page({ category: 'architecture' }, { all: 187, matched: 3 }).replace(/<[^>]*>/g, '');
    expect(text).toContain('3 of 187 in Architecture · Clear all');
  });

  it('offers "Show older" from the cursor, keeping the filters, and a way back to the newest', () => {
    expect(page({}, { next: 'r50' })).toContain('<a class="omni-button omni-button--sm" href="/app/inbox/done?before=r50">Show older</a>');
    expect(page({ category: 'product' }, { next: 'r50' })).toContain('href="/app/inbox/done?category=product&amp;before=r50">Show older');
    expect(page({})).not.toContain('Show older');
    const older = page({ before: 'r50' });
    expect(older).not.toContain('Show older');
    expect(older).toContain('Back to the newest');
  });

  it('keeps the search, More filters and the count on one line, with no Filter button outside More', () => {
    const html = page({ category: 'product' });
    expect(html).toContain('<input type="hidden" name="category" value="product"/>');
    expect(html).toMatch(/<input[^>]*type="search"[^>]*name="q"/);
    expect(html).toContain('<summary');
    expect(html).toContain('>Filters<');
    expect(html).not.toContain('class="ask-button"');
    expect(html).toMatch(/class="inbox-toolbar done-bar"/);
    expect(html).toMatch(/class="inbox-toolbar-end done-count"/);
  });

  it('groups the rows under day titles', () => {
    const html = page();
    expect(html).toMatch(/<h2 class="inbox-group-head done-day">Today <span class="done-day-count">\d+<\/span><\/h2>/);
  });
});
