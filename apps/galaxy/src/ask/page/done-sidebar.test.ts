import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DEMO_MEMBERS, demoHistory } from './demo';
import { WorkspaceHistory } from './WorkspaceHistory';
import { categoryCounts, historyChoices, historyHref, historyList, type HistoryFilters } from './workspace-history';

// The Inbox's Done tab (visual update #3169, pick A of round 3): the categories in a sidebar on the
// left, each with its count, beside one line of search, More filters and the count, then the rows
// grouped by day.

const NOW = Date.parse('2026-09-26T10:00:00Z');
const rows = demoHistory(NOW);

const page = (filters: HistoryFilters = {}) =>
  renderToStaticMarkup(createElement(WorkspaceHistory, {
    items: historyList(rows, filters, DEMO_MEMBERS),
    choices: historyChoices(rows, DEMO_MEMBERS),
    filters,
    categories: categoryCounts(rows, filters),
    now: NOW,
  }));

describe('the Done tab\'s categories', () => {
  it('counts each category over the other filters, leaving the chosen category out', () => {
    const all = categoryCounts(rows, {});
    const chosen = categoryCounts(rows, { category: 'product' });
    expect(chosen).toEqual(all);
    expect(all.reduce((sum, c) => sum + c.count, 0)).toBe(historyList(rows, {}, DEMO_MEMBERS).length);
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

  it('keeps the search, More filters and the count on one line, with no Filter button outside More', () => {
    const html = page({ category: 'product' });
    expect(html).toContain('<input type="hidden" name="category" value="product"/>');
    expect(html).toMatch(/<input[^>]*type="search"[^>]*name="q"/);
    expect(html).toContain('<summary');
    expect(html).toContain('More filters');
    expect(html).not.toContain('class="ask-button"');
    expect(html).toMatch(/class="done-count"/);
  });

  it('groups the rows under day titles', () => {
    const html = page();
    expect(html).toMatch(/<h2 class="done-day">Today <span class="done-day-count">\d+<\/span><\/h2>/);
  });
});
