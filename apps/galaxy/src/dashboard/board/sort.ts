import { UNREADABLE } from '../part';
import { sortHeaderOf, sortOf, sortRows, type Header, type Sort, type SortColumn, type SortDir, type SortValue } from '../../nav/sortable-list';
import type { Query } from './links';
import { byDefault, SOLO, type PersonRow } from './tally';

// The People table's sort (PRD 1017), kept in the URL as the period is: `?sort=<key>` and, when the
// key is reversed, `&dir=asc|desc`. Each header is a plain link, so the board still draws on the
// server with no script. A key the table does not know is `points`; a `dir` it does not know is the
// key's natural direction. Whatever the key and direction, a dash or `?` sorts last, and ties fall
// back to the default order (points, PRs, name), so the order is always total.

export const SORT_KEYS = ['rank', 'name', 'fleet', 'points', 'prs', 'prds', 'questions'] as const;
export type SortKey = (typeof SORT_KEYS)[number];
export type { SortDir };
export interface PeopleSort { key: SortKey; dir: SortDir }

/** Where every header link lands: the People table's heading. */
export const PEOPLE_ANCHOR = 'board-people';

const NATURAL: Record<SortKey, SortDir> = { rank: 'asc', name: 'asc', fleet: 'asc', points: 'desc', prs: 'desc', prds: 'desc', questions: 'desc' };

const fleetLabel = (fleet: PersonRow['fleet']) => (fleet === SOLO ? 'SOLO' : fleet.label);
const count = (value: number | null | typeof UNREADABLE) => (typeof value === 'number' ? value : null);

function valueOf(row: PersonRow, key: SortKey): SortValue {
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

/** The table's columns, for the shared list (nav/sortable-list.ts): what each key compares. */
export const PEOPLE_COLUMNS: readonly SortColumn<PersonRow>[] = SORT_KEYS.map((key) => ({ key, natural: NATURAL[key], value: (row: PersonRow) => valueOf(row, key) }));

/** The column a key names. */
export function peopleColumn(sort: PeopleSort | SortKey): SortColumn<PersonRow> {
  const key = typeof sort === 'string' ? sort : sort.key;
  const column = PEOPLE_COLUMNS.find((c) => c.key === key);
  if (!column) throw new Error(`no People column ${key}`);
  return column;
}

const toSort = (sort: PeopleSort): Sort<PersonRow> => ({ column: peopleColumn(sort), dir: sort.dir, tie: byDefault });

/** The sort the query asks for: `points` in its natural direction when it asks for none it knows. */
export function peopleSortOf(query: Query): PeopleSort {
  const { column, dir } = sortOf(query, PEOPLE_COLUMNS, 'points');
  return { key: SORT_KEYS.find((k) => k === column.key) ?? 'points', dir };
}

/** The rows in the asked order, a new array: the rows given are left as they were. */
export function sortPeople(rows: readonly PersonRow[], sort: PeopleSort): PersonRow[] {
  return sortRows(rows, toSort(sort));
}

/** A header's link: another key in its natural direction, the current key in its other direction. */
export function headerOf(path: string, query: Query, sort: PeopleSort, key: SortKey): Header {
  return sortHeaderOf(path, query, toSort(sort), peopleColumn(key), PEOPLE_ANCHOR);
}
