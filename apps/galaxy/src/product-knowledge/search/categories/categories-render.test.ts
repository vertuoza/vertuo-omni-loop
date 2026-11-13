import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { Query } from '../../../nav/query';
import { NO_SEARCH, noSearchIn } from '../search-stats';
import { demoCategories } from './categories-demo';
import type { CategorizedRow, GroupHead } from './categories-stats';
import { CATEGORIES_TITLE, CategoriesView, NO_CATEGORY, SearchViews } from './CategoriesView';

// The Categories view as the server renders it (PRD omni-loop-7 s4).

const NOW = Date.parse('2026-11-13T12:00:00Z');
const demo = demoCategories('demo-product-1', NOW);
if (demo === null) throw new Error('the demo product has searches');
const DOMAINS = [{ key: 'invoicing', name: 'Invoicing' }];

const draw = (rows: readonly CategorizedRow[], groups: readonly GroupHead[], query: Query = {}, days: 7 | 30 | 90 = 30) =>
  renderToStaticMarkup(createElement(CategoriesView, { product: 'p', rows, groups, days, now: NOW, query, domains: DOMAINS }));
const text = (markup: string) => markup.replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, '\'').replace(/\s+/g, ' ').trim();
const regionOf = (html: string, name: string) => html.slice(html.indexOf(`data-region="${name}"`));

describe('the Search section’s views', () => {
  it('link the overview and the Categories view, the one shown marked', () => {
    const html = renderToStaticMarkup(createElement(SearchViews, { product: 'p', shown: 'overview' }));
    expect(html).toContain('href="/app/products/p/knowledge/search/categories"');
    expect(text(html)).toBe('Overview Categories');
    expect(html).toMatch(/aria-current="true" href="\/app\/products\/p\/knowledge\/search"/);
  });
});

describe('the Categories view', () => {
  it('is headed Search categories and lists the categories by searches, named by their domain, with their four numbers', () => {
    const html = draw(demo.rows, demo.groups);
    expect(/<h2[^>]*>([^<]*)<\/h2>/.exec(html)?.[1]).toBe(CATEGORIES_TITLE);
    expect([...html.matchAll(/data-category="([^"]+)"/g)].map((m) => m[1])).toEqual(['invoicing', 'other', '-']);
    const table = text(html.slice(html.indexOf('data-region="categories"'), html.indexOf('data-region="groups"')));
    expect(table).toContain('Category Searches Zero-hit rate Words fallback Opened@5 Groups');
    expect(table).toMatch(/Invoicing \d+ \d+% \d+% \d+% 4/);
    expect(table).toContain('Not categorized');
    expect(table).toContain('Other');
  });

  it('opens the most searched category to its most-asked groups, each with its first question, count and worst opened rank', () => {
    const groups = regionOf(draw(demo.rows, demo.groups), 'groups');
    expect(text(groups)).toContain('Invoicing: most-asked questions');
    expect([...groups.matchAll(/data-group="([^"]+)"/g)][0]?.[1]).toBe('demo-group-credit');
    expect(text(groups)).toMatch(/refund a customer \d+ searches worst opened rank 2/);
  });

  it('opens the category ?category= names, Not categorized by its dash, and keeps it across the period links', () => {
    const html = draw(demo.rows, demo.groups, { category: '-' });
    expect(text(regionOf(html, 'groups'))).toContain('Not categorized: most-asked questions');
    expect(html).toContain('href="/app/products/p/knowledge/search/categories?days=90&amp;category=-"');
    expect(html).toMatch(/data-category="-" data-open="true"/);
  });

  it('opens a group to its questions', () => {
    const rows: CategorizedRow[] = [
      { id: 'a', query: 'can a quote go out with no payment term', mode: 'meaning', total: 2, hitIds: ['x'], openedRank: 3, askedAt: '2026-11-12T10:00:00Z', category: 'quotes', groupId: 'g1' },
      { id: 'b', query: 'can a quote be sent without a payment term', mode: 'words', total: 0, hitIds: [], openedRank: null, askedAt: '2026-11-11T10:00:00Z', category: 'quotes', groupId: 'g1' },
    ];
    const group = regionOf(draw(rows, [{ id: 'g1', question: 'can a quote be sent without a payment term' }]), 'groups');
    expect(group).toContain('<details class="kn-group" data-group="g1">');
    expect(text(group)).toContain('can a quote be sent without a payment term 2 searches worst opened rank 3');
    expect(text(group)).toContain('can a quote go out with no payment term meaning 2 3 2026-11-12');
  });

  it('says so in one line with no category yet, and still lists the groups', () => {
    const rows = demo.rows.map((row) => ({ ...row, category: null }));
    const html = draw(rows, demo.groups);
    expect(html.match(/data-note="no-category"/g)).toHaveLength(1);
    expect(text(html)).toContain(NO_CATEGORY);
    expect(text(regionOf(html, 'groups'))).toContain('Not categorized: most-asked questions');
    expect(html.match(/data-group=/g)?.length).toBeGreaterThan(1);
    expect(draw(demo.rows, demo.groups)).not.toContain('data-note="no-category"');
  });

  it('says so in one line when the log holds no row, or the period none', () => {
    expect(text(draw([], []))).toContain(NO_SEARCH);
    const old: CategorizedRow = { id: 'o', query: 'q', mode: 'meaning', total: 1, hitIds: ['a'], openedRank: null, askedAt: '2026-08-20T10:00:00Z', category: 'quotes', groupId: null };
    const html = draw([old], [], {}, 7);
    expect(text(html)).toContain(noSearchIn(7));
    expect(html).not.toContain('data-region="groups"');
  });
});
