import type { ReactNode } from 'react';
import './Table.css';
import type { TABLE_ALIGNS, TABLE_DENSITIES, TABLE_STRIPES } from './Table.meta.ts';

export type TableColumn = {
  id: string;
  label: ReactNode;
  align?: (typeof TABLE_ALIGNS)[number];
};

export type TableRow = {
  id: string;
  /** The cell of each column, by the column's `id`. */
  cells: Readonly<Record<string, ReactNode>>;
};

export type TableProps = {
  /** What the table lists: its accessible name, shown above it. */
  caption: string;
  columns: readonly TableColumn[];
  rows: readonly TableRow[];
  density?: (typeof TABLE_DENSITIES)[number];
  /** Alternate rows sit on the sunken surface. */
  striped?: (typeof TABLE_STRIPES)[number];
};

/** Rows of like things compared across columns, at 14 px. */
export function Table({ caption, columns, rows, density = 'normal', striped = 'false' }: TableProps) {
  return (
    <table className={`omni-table omni-table--${density} omni-table--striped-${striped}`}>
      <caption className="omni-table__caption">{caption}</caption>
      <thead>
        <tr>
          {columns.map((column) => (
            <th key={column.id} scope="col" className={`omni-table__cell omni-table__cell--${column.align ?? 'start'}`}>
              {column.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id}>
            {columns.map((column) => (
              <td key={column.id} className={`omni-table__cell omni-table__cell--${column.align ?? 'start'}`}>
                {row.cells[column.id]}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
