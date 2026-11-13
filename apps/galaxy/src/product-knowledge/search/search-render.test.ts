import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { demoSearches } from './search-demo';
import { NO_SEARCH, noSearchIn, type SearchRow } from './search-stats';
import { SearchView } from './SearchView';

// The Search section as the server renders it (PRD omni-loop-6 s3).

const NOW = Date.parse('2026-11-13T12:00:00Z');
const rows = demoSearches('demo-product-1', NOW) as SearchRow[];
const draw = (list: readonly SearchRow[], days: 7 | 30 | 90 = 30) => renderToStaticMarkup(createElement(SearchView, { product: 'p', rows: list, days, now: NOW }));
const text = (markup: string) => markup.replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, '\'').replace(/\s+/g, ' ').trim();

describe('the Search section', () => {
  it('is headed Search, shows the five numbers of the period and the period links', () => {
    const html = draw(rows, 7);
    expect(/<h2[^>]*>([^<]*)<\/h2>/.exec(html)?.[1]).toBe('Search');
    expect([...html.matchAll(/data-figure="([^"]+)"/g)].map((m) => m[1])).toEqual(['searches', 'zero-hit', 'words', 'opened-1', 'opened-5']);
    expect(html).toContain('href="/app/products/p/knowledge/search?days=90"');
    expect(html).toMatch(/aria-current="true" href="[^"]+days=7"/);
  });

  it('draws one bar per day and the two rate lines', () => {
    const html = draw(rows, 30);
    expect(html.match(/class="kn-bar"/g)).toHaveLength(30);
    expect(html).toContain('data-line="zero-hit"');
    expect(html).toContain('data-line="words"');
  });

  it('puts the zero-hit questions, then the ones that fell back, before the latest questions', () => {
    const html = draw(rows, 30);
    const first = html.slice(html.indexOf('data-region="look-first"'), html.indexOf('data-region="latest"'));
    expect(first).toContain('delete an invoice');
    expect(first).toContain('no hit');
    expect(first).toContain('fell back');
    expect(first.indexOf('no hit')).toBeLessThan(first.indexOf('fell back'));
    expect(html).toContain('data-region="latest"');
  });

  it('shows each latest question with its mode, total, top hit and opened rank', () => {
    const html = draw([{ id: 'x', query: 'what is a credit note', mode: 'meaning', total: 2, hitIds: ['credit-note', 'b'], openedRank: 2, askedAt: '2026-11-12T10:00:00Z' }]);
    const latest = html.slice(html.indexOf('data-region="latest"'));
    expect(text(latest)).toContain('what is a credit note meaning 2 credit-note 2 2026-11-12');
  });

  it('says so in one line and draws no chart when the log holds no row', () => {
    const html = draw([]);
    expect(text(html)).toContain(NO_SEARCH);
    expect(html).not.toContain('<svg');
    expect(html).not.toContain('data-figure');
  });

  it('says so, with no chart, when the period holds no row', () => {
    const html = draw([{ id: 'old', query: 'q', mode: 'meaning', total: 1, hitIds: ['a'], openedRank: null, askedAt: '2026-08-20T10:00:00Z' }], 7);
    expect(text(html)).toContain(noSearchIn(7));
    expect(html).not.toContain('<svg');
  });
});

describe('the demo', () => {
  it('has searches for the demo product only', () => {
    expect(rows.length).toBeGreaterThan(10);
    expect(demoSearches('other', NOW)).toBeNull();
  });
});
