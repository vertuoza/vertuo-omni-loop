import type { ReactNode } from 'react';
import './Grid.css';
import type { GRID_COLUMNS, GRID_GAPS } from './Grid.meta.ts';

export type GridProps = {
  /** How many equal columns: they fall to one on a narrow screen. */
  columns?: (typeof GRID_COLUMNS)[number];
  /** The step of the space scale between the cells: `space-2` to `space-6`. */
  gap?: (typeof GRID_GAPS)[number];
  children?: ReactNode;
};

/** Lays its children out in equal columns, one column on a narrow screen. */
export function Grid({ columns = '2', gap = '4', children }: GridProps) {
  return <div className={`omni-grid omni-grid--columns-${columns} omni-grid--gap-${gap}`}>{children}</div>;
}
