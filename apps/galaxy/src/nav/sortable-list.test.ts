import { describe, expect, it } from 'vitest';
import { sortHeaderOf, newestFirst, sortOf, sortRows, type SortColumn } from './sortable-list.ts';

// The rules of a sortable list (PRD 2240): read from the address, applied to the rows, and each
// header's link.

interface Item { name: string; size: number | null; tags: readonly number[] | null; made: string | null }
const item = (name: string, size: number | null, made: string | null = null, tags: readonly number[] | null = null): Item => ({ name, size, tags, made });
const NAME: SortColumn<Item> = { key: 'name', natural: 'asc', value: (r) => r.name };
const SIZE: SortColumn<Item> = { key: 'size', natural: 'desc', value: (r) => r.size };
const TAGS: SortColumn<Item> = { key: 'tags', natural: 'desc', value: (r) => r.tags };
const MADE: SortColumn<Item> = { key: 'made', natural: 'desc', value: (r) => r.made };
const COLUMNS = [NAME, SIZE, TAGS, MADE];
const TIE = newestFirst<Item>((r) => r.made);
const names = (rows: readonly Item[]) => rows.map((r) => r.name);

describe('sortOf', () => {
  it('is the default column in its natural direction with nothing in the address', () => {
    const sort = sortOf({}, COLUMNS, 'made');
    expect([sort.column.key, sort.dir]).toEqual(['made', 'desc']);
  });

  it('reads every column in its natural direction, and dir=asc or dir=desc', () => {
    for (const column of COLUMNS) {
      const sort = sortOf({ sort: column.key }, COLUMNS, 'made');
      expect([sort.column.key, sort.dir]).toEqual([column.key, column.natural]);
      for (const dir of ['asc', 'desc'] as const) expect(sortOf({ sort: column.key, dir }, COLUMNS, 'made').dir).toBe(dir);
    }
  });

  it('falls back on an unknown column, an unknown direction or a repeated value, with no error', () => {
    expect(sortOf({ sort: 'shoe-size', dir: 'asc' }, COLUMNS, 'made')).toMatchObject({ column: MADE, dir: 'asc' });
    expect(sortOf({ sort: 'name', dir: 'sideways' }, COLUMNS, 'made')).toMatchObject({ column: NAME, dir: 'asc' });
    expect(sortOf({ sort: ['size', 'name'], dir: ['up'] }, COLUMNS, 'made')).toMatchObject({ column: SIZE, dir: 'desc' });
    expect(sortOf({ sort: 'toString' }, COLUMNS, 'made').column).toBe(MADE);
  });

  it('takes the first column when the default names none, and refuses a list with no column', () => {
    expect(sortOf({}, COLUMNS, 'nope').column).toBe(NAME);
    expect(() => sortOf({}, [], 'x')).toThrow('at least one column');
  });
});

describe('sortRows', () => {
  const a = item('a', 3, '2026-01-01', [1, 2]);
  const b = item('B', 1, '2026-03-01', [1, 9]);
  const c = item('c', 3, '2026-02-01', [0, 5]);
  const d = item('d', null, null, null);
  const rows = [d, c, b, a];
  const by = (column: SortColumn<Item>, dir: 'asc' | 'desc') => names(sortRows(rows, { column, dir, tie: TIE }));

  it('orders every column both ways, an empty value last whichever the direction', () => {
    expect(by(NAME, 'asc')).toEqual(['a', 'B', 'c', 'd']);
    expect(by(NAME, 'desc')).toEqual(['d', 'c', 'B', 'a']);
    expect(by(SIZE, 'desc')).toEqual(['c', 'a', 'B', 'd']);
    expect(by(SIZE, 'asc')).toEqual(['B', 'c', 'a', 'd']);
    expect(by(TAGS, 'desc')).toEqual(['B', 'a', 'c', 'd']);
    expect(by(TAGS, 'asc')).toEqual(['c', 'a', 'B', 'd']);
    expect(by(MADE, 'desc')).toEqual(['B', 'c', 'a', 'd']);
    expect(by(MADE, 'asc')).toEqual(['a', 'c', 'B', 'd']);
  });

  it('breaks ties newest first, whatever the direction', () => {
    expect(by(SIZE, 'desc').slice(0, 2)).toEqual(['c', 'a']);
    expect(by(SIZE, 'asc').slice(1, 3)).toEqual(['c', 'a']);
  });

  it('keeps the order given when there is no tie-break, and leaves the rows given as they were', () => {
    const given = [d, a, c];
    expect(names(sortRows(given, { column: SIZE, dir: 'desc' }))).toEqual(['a', 'c', 'd']);
    expect(given).toEqual([d, a, c]);
  });
});

describe('newestFirst', () => {
  it('puts the later date first, and an undated row after a dated one', () => {
    expect(TIE(item('x', 0, '2026-02-01'), item('y', 0, '2026-01-01'))).toBeLessThan(0);
    expect(TIE(item('x', 0, '2026-01-01'), item('y', 0, '2026-02-01'))).toBeGreaterThan(0);
    expect(TIE(item('x', 0, null), item('y', 0, '2026-02-01'))).toBeGreaterThan(0);
    expect(TIE(item('x', 0, '2026-02-01'), item('y', 0, null))).toBeLessThan(0);
    expect(TIE(item('x', 0, null), item('y', 0, null))).toBe(0);
    expect(TIE(item('x', 0, '2026-02-01'), item('y', 0, '2026-02-01'))).toBe(0);
  });
});

describe('sortHeaderOf', () => {
  const query = { show: 'retired', q: ['1', '2'], sort: 'size', dir: 'asc' };

  it('links another column in its natural direction, keeping the rest of the query', () => {
    const sort = sortOf({}, COLUMNS, 'made');
    expect(sortHeaderOf('/p', { show: 'retired', q: ['1', '2'] }, sort, SIZE)).toEqual({ href: '/p?show=retired&q=1&q=2&sort=size', sorted: null });
    expect(sortHeaderOf('/p', query, sort, NAME)).toEqual({ href: '/p?show=retired&q=1&q=2&sort=name', sorted: null });
    expect(sortHeaderOf('/p', { gone: undefined }, sort, NAME, 'list').href).toBe('/p?sort=name#list');
  });

  it('links the current column to its other direction and marks it', () => {
    expect(sortHeaderOf('/p', {}, sortOf({ sort: 'size' }, COLUMNS, 'made'), SIZE)).toEqual({ href: '/p?sort=size&dir=asc', sorted: 'descending' });
    expect(sortHeaderOf('/p', {}, sortOf({ sort: 'size', dir: 'asc' }, COLUMNS, 'made'), SIZE)).toEqual({ href: '/p?sort=size', sorted: 'ascending' });
    expect(sortHeaderOf('/p', {}, sortOf({ sort: 'name' }, COLUMNS, 'made'), NAME)).toEqual({ href: '/p?sort=name&dir=desc', sorted: 'ascending' });
  });
});
