import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SortableList, type ListColumn } from './SortableList.tsx';
import { newestFirst, sortOf } from './sortable-list.ts';

// A sortable table as the server renders it (PRD 2240): headers that are links keeping the rest of the
// query, the column in use marked with aria-sort, and the rows in the order the address asks.

interface Row { code: string; made: string | null }
const COLUMNS: readonly ListColumn<Row>[] = [
  { key: 'code', label: 'Code', natural: 'asc', value: (r) => r.code },
  { key: 'made', label: 'Created', natural: 'desc', value: (r) => r.made, note: 'newest first' },
];
const ROWS: Row[] = [{ code: 'L-2', made: '2026-02-01' }, { code: 'L-1', made: '2026-03-01' }, { code: 'L-3', made: null }];
const render = (query: Record<string, string>) => renderToStaticMarkup(createElement(SortableList<Row>, {
  columns: COLUMNS, rows: ROWS, sort: sortOf(query, COLUMNS, 'made', newestFirst((r) => r.made)), path: '/legal', query, classes: 'kn',
  rowKey: (r) => r.code, row: (r) => createElement('tr', null, createElement('td', null, r.code)),
}));
const codes = (html: string) => [...html.matchAll(/<td>([^<]*)<\/td>/g)].map((m) => m[1]);

describe('SortableList', () => {
  it('draws a link per header, keeping the rest of the query, and marks the column in use', () => {
    const html = render({ show: 'retired' });
    expect(html).toContain('<table class="kn-table">');
    expect(html).toContain('<th scope="col" aria-sort="descending"><a class="kn-sort" href="/legal?show=retired&amp;sort=made&amp;dir=asc">Created<span class="kn-sort-mark" aria-hidden="true">▼</span></a><span class="kn-th-note">newest first</span></th>');
    expect(html).toContain('<th scope="col"><a class="kn-sort" href="/legal?show=retired&amp;sort=code">Code</a></th>');
    expect(html.match(/aria-sort/g)).toHaveLength(1);
  });

  it('marks a column sorted ascending, and sorts the rows both ways with an empty value last', () => {
    const html = render({ sort: 'code', dir: 'asc' });
    expect(html).toContain('aria-sort="ascending"');
    expect(codes(html)).toEqual(['L-1', 'L-2', 'L-3']);
    expect(codes(render({ sort: 'made', dir: 'asc' }))).toEqual(['L-2', 'L-1', 'L-3']);
    expect(codes(render({ sort: 'made' }))).toEqual(['L-1', 'L-2', 'L-3']);
  });

  it('falls back to the default column for an unknown one', () => {
    expect(codes(render({ sort: 'nope' }))).toEqual(['L-1', 'L-2', 'L-3']);
    expect(render({ sort: 'nope' })).toContain('aria-sort="descending"');
  });
});
