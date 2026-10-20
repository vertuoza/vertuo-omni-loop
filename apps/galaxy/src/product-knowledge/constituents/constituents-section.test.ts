import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { StoredConstituent } from '../../constituents/model';
import { sure } from '../../arcade/test/sure';
import { sortRows } from '../../nav/sortable-list';
import { ConstituentView, ConstituentsTable } from './ConstituentsList';
import { constituentSortOf, keyOf, rowOf, rowsOf, shownRows } from './constituents-section';

// The Constituents section's rows, their sort and their pages (PRD 2240 s4).

const PRODUCT = 'p-1';
const stored = (over: Partial<StoredConstituent> & Pick<StoredConstituent, 'id' | 'kind'>): StoredConstituent => ({
  product_id: PRODUCT, seq: null, body: 'A text', created_by: 'u-anna', created_at: '2026-10-01T09:00:00Z', updated_at: '2026-10-01T09:00:00Z',
  removed_at: null, removed_by: null, ...over,
});
const STORED: StoredConstituent[] = [
  stored({ id: 'k-s', kind: 'statement', body: 'A quoting tool for builders', created_at: '2026-10-01T09:00:00Z', updated_at: '2026-10-09T09:00:00Z' }),
  stored({ id: 'k-1', kind: 'never', seq: 1, body: 'Build for groups', created_by: null, created_at: '2026-10-05T09:00:00Z', updated_at: '2026-10-05T09:00:00Z' }),
  stored({ id: 'k-3', kind: 'never', seq: 3, body: 'Answer tenders', created_by: 'u-bob', created_at: '2026-10-07T09:00:00Z', updated_at: '2026-10-07T09:00:00Z' }),
  stored({ id: 'k-2', kind: 'never', seq: 2, body: 'Old line', removed_at: '2026-10-08T09:00:00Z', removed_by: 'u-anna', created_at: '2026-10-06T09:00:00Z' }),
];
const ROWS = rowsOf(STORED, { 'u-anna': 'anna' });
const keys = (query: Record<string, string> = {}) => sortRows(shownRows(ROWS, 'active'), constituentSortOf(query)).map((r) => r.key);

describe('the rows', () => {
  it('addresses a line as statement or never-<n>', () => {
    expect(ROWS.map((r) => r.key)).toEqual(['statement', 'never-1', 'never-3', 'never-2']);
    expect(keyOf({ kind: 'never', seq: 12 })).toBe('never-12');
  });

  it('names the author by login, a member the roster does not know as a member, and a missing author as none', () => {
    expect(ROWS.map((r) => r.by)).toEqual([{ user: 'u-anna', login: 'anna' }, null, { user: 'u-bob', login: null }, { user: 'u-anna', login: 'anna' }]);
  });

  it('keeps removed lines out of the default list and in the Retired one', () => {
    expect(shownRows(ROWS, 'active').map((r) => r.key)).toEqual(['statement', 'never-1', 'never-3']);
    expect(shownRows(ROWS, 'retired').map((r) => r.key)).toEqual(['never-2']);
    expect(rowOf(ROWS, 'never-2')?.removed).toBe(true);
    expect(rowOf(ROWS, 'never-9')).toBeNull();
  });
});

describe('the sort', () => {
  it('opens newest first', () => {
    expect(keys()).toEqual(['never-3', 'never-1', 'statement']);
  });

  it('sorts every column both ways, an empty author last whichever the direction', () => {
    expect(keys({ sort: 'kind' })).toEqual(['never-3', 'never-1', 'statement']);
    expect(keys({ sort: 'kind', dir: 'desc' })).toEqual(['statement', 'never-3', 'never-1']);
    expect(keys({ sort: 'text' })).toEqual(['statement', 'never-3', 'never-1']);
    expect(keys({ sort: 'text', dir: 'desc' })).toEqual(['never-1', 'never-3', 'statement']);
    expect(keys({ sort: 'by' })).toEqual(['statement', 'never-3', 'never-1']);
    expect(keys({ sort: 'by', dir: 'desc' })).toEqual(['never-3', 'statement', 'never-1']);
    expect(keys({ sort: 'created', dir: 'asc' })).toEqual(['statement', 'never-1', 'never-3']);
    expect(keys({ sort: 'updated' })).toEqual(['statement', 'never-3', 'never-1']);
  });

  it('falls back to newest first for a column it does not know', () => {
    expect(keys({ sort: 'nonsense' })).toEqual(keys());
  });
});

const html = (query: Record<string, string> = {}, rows = ROWS) => renderToStaticMarkup(createElement(ConstituentsTable, { product: PRODUCT, rows, query, add: null }));

describe('the list page', () => {
  it('marks the header in use with aria-sort, both ways, and each header sorts through the address', () => {
    expect(html({ sort: 'text' })).toMatch(/<th scope="col"[^>]*aria-sort="ascending"[^>]*><a[^>]*>Text/);
    expect(html({ sort: 'text', dir: 'desc' })).toMatch(/aria-sort="descending"[^>]*><a[^>]*>Text/);
    expect(html({ sort: 'text' }).match(/aria-sort=/g)).toHaveLength(1);
    expect(html()).toContain('href="/app/products/p-1/knowledge/constituents?sort=kind"');
  });

  it('draws the five columns, one row a live line, each opening its page and the sort kept', () => {
    const page = html({ sort: 'by' });
    expect([...page.matchAll(/<th scope="col"[^>]*><a[^>]*>([^<]*)/g)].map((m) => m[1])).toEqual(['Kind', 'Text', 'Created by', 'Created', 'Updated']);
    expect([...page.matchAll(/data-constituent="([^"]+)"/g)].map((m) => m[1])).toEqual(['statement', 'never-3', 'never-1']);
    expect(page).toContain('href="/app/products/p-1/knowledge/constituents/never-3?sort=by"');
    expect(page).toContain('@anna');
    expect(page).toContain('—');
  });

  it('counts the active and the retired lines, and lists the removed ones under Retired', () => {
    const page = html({ show: 'retired' });
    expect(page).toContain('Active · 3');
    expect(page).toContain('Retired · 1');
    expect([...page.matchAll(/data-constituent="([^"]+)"/g)].map((m) => m[1])).toEqual(['never-2']);
  });

  it('says so when there is no line', () => {
    expect(html({}, [])).toContain('No Statement or Never line yet.');
  });
});

describe('a line\'s page', () => {
  const view = (key: string, controls = 'controls') => renderToStaticMarkup(createElement(ConstituentView, { row: sure(rowOf(ROWS, key), key), back: '/back?sort=by', controls }));

  it('shows the line whole under a link back to its list with the sort kept', () => {
    const page = view('never-3', 'Answer tenders');
    expect(page).toContain('href="/back?sort=by"');
    expect(page).toContain('← Constituents');
    expect(page).toContain('Never · never-3');
    expect(page).toContain('Answer tenders');
    expect(page).toContain('@a member');
  });

  it('marks a removed line with when it left', () => {
    expect(view('never-2')).toContain('removed 2026-10-08');
  });
});
