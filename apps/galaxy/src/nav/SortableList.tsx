import { Fragment, type ReactNode } from 'react';
import type { Query } from './query.ts';
import { sortHeaderOf, sortRows, type Sort, type SortColumn } from './sortable-list.ts';

// A sortable table (PRD 2240): every header a link that sorts the list by its column, the sort kept in
// the address, the sorted header alone showing ▼ or ▲ and carrying aria-sort. It draws on the server
// with no script. The caller draws each row (a `<tr>`); the list puts them in the order the sort asks.
// `classes` names the page's own styling: `<classes>-table`, `-sort`, `-sort-mark` and `-th-note`.

const MARK = { ascending: '▲', descending: '▼' } as const;

export interface ListColumn<R> extends SortColumn<R> {
  label: string;
  /** A number column: right-aligned. */
  num?: boolean;
  /** A line under the label. */
  note?: string;
}

export interface SortableListProps<R> {
  columns: readonly ListColumn<R>[];
  rows: readonly R[];
  sort: Sort<R>;
  /** The page's path and query, which every header link keeps. */
  path: string;
  query: Query;
  /** Where every header link lands on the page. */
  anchor?: string;
  classes?: string;
  rowKey: (row: R) => string;
  row: (row: R) => ReactNode;
}

export function SortableList<R>({ columns, rows, sort, path, query, anchor, classes = 'sortable', rowKey, row }: SortableListProps<R>) {
  return (
    <table className={`${classes}-table`}>
      <thead>
        <tr>
          {columns.map((column) => {
            const header = sortHeaderOf(path, query, sort, column, anchor);
            return (
              <th key={column.key} scope="col" className={column.num ? 'is-num' : undefined} aria-sort={header.sorted ?? undefined}>
                <a className={`${classes}-sort`} href={header.href}>{column.label}{header.sorted && <span className={`${classes}-sort-mark`} aria-hidden="true">{MARK[header.sorted]}</span>}</a>
                {column.note && <span className={`${classes}-th-note`}>{column.note}</span>}
              </th>
            );
          })}
        </tr>
      </thead>
      <tbody>
        {sortRows(rows, sort).map((r) => <Fragment key={rowKey(r)}>{row(r)}</Fragment>)}
      </tbody>
    </table>
  );
}
