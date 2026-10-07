import { UNREADABLE } from '../part';
import { hrefWith, type Query } from './links';
import { byDefault, SOLO, type PersonRow } from './tally';

// The People table's sort (PRD 1017), kept in the URL as the period is: `?sort=<key>` and, when the
// key is reversed, `&dir=asc|desc`. Each header is a plain link, so the board still draws on the
// server with no script. A key the table does not know is `points`; a `dir` it does not know is the
// key's natural direction. Whatever the key and direction, a dash or `?` sorts last, and ties fall
// back to the default order (points, PRs, name), so the order is always total.

export const SORT_KEYS = ['rank', 'name', 'fleet', 'points', 'prs', 'prds', 'questions'] as const;
export type SortKey = (typeof SORT_KEYS)[number];
export type SortDir = 'asc' | 'desc';
export interface PeopleSort { key: SortKey; dir: SortDir }

/** Where every header link lands: the People table's heading. */
export const PEOPLE_ANCHOR = 'board-people';

const NATURAL: Record<SortKey, SortDir> = { rank: 'asc', name: 'asc', fleet: 'asc', points: 'desc', prs: 'desc', prds: 'desc', questions: 'desc' };

const first = (value: Query[string]) => (Array.isArray(value) ? value[0] : value);
const isKey = (value: string | undefined): value is SortKey => SORT_KEYS.some((k) => k === value);
const isDir = (value: string | undefined): value is SortDir => value === 'asc' || value === 'desc';

/** The sort the query asks for: `points` in its natural direction when it asks for none it knows. */
export function peopleSortOf(query: Query): PeopleSort {
  const sort = first(query.sort);
  const dir = first(query.dir);
  const key = isKey(sort) ? sort : 'points';
  return { key, dir: isDir(dir) ? dir : NATURAL[key] };
}

/** What a key compares: a number, a word, or a list compared in turn; null for a dash or `?`. */
type Value = number | string | readonly number[] | null;

const fleetLabel = (fleet: PersonRow['fleet']) => (fleet === SOLO ? 'SOLO' : fleet.label);
const count = (value: number | null | typeof UNREADABLE) => (typeof value === 'number' ? value : null);

function valueOf(row: PersonRow, key: SortKey): Value {
  switch (key) {
    case 'rank': return row.rank;
    case 'name': return row.name;
    case 'fleet': return fleetLabel(row.fleet);
    case 'points': return count(row.points);
    case 'prs': return count(row.prs);
    case 'prds': return row.prds === UNREADABLE ? null : [row.prds.shipped, row.prds.building, row.prds.open];
    case 'questions': return count(row.answered);
  }
}

/** Two present values, ascending. */
function ascending(a: number | string | readonly number[], b: number | string | readonly number[]): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  if (typeof a === 'string' && typeof b === 'string') return a.localeCompare(b, 'en', { sensitivity: 'base' });
  if (typeof a === 'object' && typeof b === 'object') {
    for (let i = 0; i < Math.min(a.length, b.length); i++) {
      const d = (a[i] ?? 0) - (b[i] ?? 0);
      if (d !== 0) return d;
    }
  }
  return 0;
}

/** The rows in the asked order, a new array: the rows given are left as they were. */
export function sortPeople(rows: readonly PersonRow[], sort: PeopleSort): PersonRow[] {
  const sign = sort.dir === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    const va = valueOf(a, sort.key);
    const vb = valueOf(b, sort.key);
    if (va === null || vb === null) {
      if (va !== vb) return va === null ? 1 : -1;
    } else {
      const d = ascending(va, vb);
      if (d !== 0) return sign * d;
    }
    return byDefault(a, b);
  });
}

export interface Header {
  href: string;
  /** How the table is sorted by this header's column, for its `aria-sort`; null when it is not. */
  sorted: 'ascending' | 'descending' | null;
}

/** A header's link: another key in its natural direction, the current key in its other direction. */
export function headerOf(path: string, query: Query, sort: PeopleSort, key: SortKey): Header {
  const current = sort.key === key;
  const dir = current ? (sort.dir === 'asc' ? 'desc' : 'asc') : NATURAL[key];
  const href = hrefWith(path, query, { sort: key, dir: dir === NATURAL[key] ? null : dir });
  return { href: `${href}#${PEOPLE_ANCHOR}`, sorted: current ? (sort.dir === 'asc' ? 'ascending' : 'descending') : null };
}
