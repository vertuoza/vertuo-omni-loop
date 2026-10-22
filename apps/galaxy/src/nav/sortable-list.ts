import type { Query } from './query.ts';

// The rules of a sortable list (PRD 2240), shared by every table whose headers sort it through the
// address: `?sort=<column>` and, when the direction is not the column's natural one, `&dir=asc|desc`.
// Each header is a plain link, so a list still draws on the server with no script. A column the list
// does not know is the default column; a `dir` it does not know is the column's natural direction.
// Whatever the column and direction, an empty value sorts last, and ties fall back to the list's own
// tie-break (`newestFirst` for a list of dated rows), so the order is always total.

export type SortDir = 'asc' | 'desc';

/** What a column compares: a number, a word, or a list of counts compared in turn; null when empty. */
export type SortValue = number | string | readonly number[] | null;

export interface SortColumn<R> {
  key: string;
  /** The direction a first click on its header sorts by. */
  natural: SortDir;
  value: (row: R) => SortValue;
}

export interface Sort<R> {
  column: SortColumn<R>;
  dir: SortDir;
  /** How two rows equal on the column compare; none leaves them in the order given. */
  tie?: (a: R, b: R) => number;
}

const first = (value: Query[string]) => (Array.isArray(value) ? value[0] : value);
const isDir = (value: string | undefined): value is SortDir => value === 'asc' || value === 'desc';

/**
 * The sort the address asks for. `fallback` names the column an unknown or missing `sort` falls back
 * to (a key of `columns`; the first column when it is not one). `tie` breaks ties between rows.
 */
export function sortOf<R>(params: Query, columns: readonly SortColumn<R>[], fallback: string, tie?: (a: R, b: R) => number): Sort<R> {
  const asked = first(params.sort);
  const base = columns.find((c) => c.key === fallback) ?? columns[0];
  const column = columns.find((c) => c.key === asked) ?? base;
  if (!column) throw new Error('a sortable list needs at least one column');
  const dir = first(params.dir);
  return { column, dir: isDir(dir) ? dir : column.natural, ...(tie ? { tie } : {}) };
}

/** Two lists of counts, ascending: the first place they differ decides. */
function listsAscending(a: readonly number[], b: readonly number[]): number {
  const at = a.findIndex((n, i) => n !== (b[i] ?? n));
  return at === -1 ? 0 : (a[at] ?? 0) - (b[at] ?? 0);
}

/** Two present values, ascending. */
function ascending(a: number | string | readonly number[], b: number | string | readonly number[]): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  if (typeof a === 'string' && typeof b === 'string') return a.localeCompare(b, 'en', { sensitivity: 'base' });
  if (typeof a === 'object' && typeof b === 'object') return listsAscending(a, b);
  return 0;
}

/** The rows in the asked order, a new array: the rows given are left as they were. */
export function sortRows<R>(rows: readonly R[], sort: Sort<R>): R[] {
  const sign = sort.dir === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    const va = sort.column.value(a);
    const vb = sort.column.value(b);
    if (va === null || vb === null) {
      if (va !== vb) return va === null ? 1 : -1;
    } else {
      const d = ascending(va, vb);
      if (d !== 0) return sign * d;
    }
    return sort.tie?.(a, b) ?? 0;
  });
}

/** A tie-break for dated rows: the later date first, an undated row after a dated one. */
export function newestFirst<R>(dateOf: (row: R) => string | null): (a: R, b: R) => number {
  return (a, b) => {
    const da = dateOf(a);
    const db = dateOf(b);
    if (da === null || db === null) return da === db ? 0 : da === null ? 1 : -1;
    return da === db ? 0 : da < db ? 1 : -1;
  };
}

export interface Header {
  href: string;
  /** How the list is sorted by this header's column, for its `aria-sort`; null when it is not. */
  sorted: 'ascending' | 'descending' | null;
}

/** `path` with the query, `sort` and `dir` changed (`dir` removed with null), the rest kept in order. */
function addressWith(path: string, query: Query, sort: string, dir: SortDir | null): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (key === 'sort' || key === 'dir' || value === undefined) continue;
    for (const v of Array.isArray(value) ? value : [value]) params.append(key, v);
  }
  params.set('sort', sort);
  if (dir !== null) params.set('dir', dir);
  return `${path}?${params.toString()}`;
}

/** A header's link: another column in its natural direction, the current one in its other direction. */
export function sortHeaderOf<R>(path: string, query: Query, sort: Sort<R>, column: SortColumn<R>, anchor?: string): Header {
  const current = sort.column.key === column.key;
  const dir = current ? (sort.dir === 'asc' ? 'desc' : 'asc') : column.natural;
  const href = addressWith(path, query, column.key, dir === column.natural ? null : dir);
  return { href: anchor ? `${href}#${anchor}` : href, sorted: current ? (sort.dir === 'asc' ? 'ascending' : 'descending') : null };
}
