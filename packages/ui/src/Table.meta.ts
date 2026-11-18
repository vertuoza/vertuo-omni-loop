import { onSurfaces } from './meta.ts';
import type { ComponentMeta } from './meta.ts';

export const TABLE_DENSITIES = ['normal', 'compact'] as const;
export const TABLE_STRIPES = ['true', 'false'] as const;
export const TABLE_ALIGNS = ['start', 'end'] as const;

export const tableMeta = {
  name: 'Table',
  variants: { density: TABLE_DENSITIES, striped: TABLE_STRIPES, align: TABLE_ALIGNS },
  usage: 'Rows of like things compared across columns: the checks of a run, the slices of a plan.',
  do: ['Give it a caption that says what it lists.', 'Align numbers to the end of their column.'],
  dont: ['Use a table to lay a page out.', 'Hold a list of one column: use ListRow.'],
  contrast: {
    base: [...onSurfaces('text-primary'), ...onSurfaces('text-secondary'), { text: 'text-primary', on: 'sunken' }, { text: 'text-secondary', on: 'sunken' }],
  },
  accessibility: [
    'A real table: a caption names it, each column header has scope="col", so a screen reader reads each cell with its header.',
    'Long words wrap instead of widening the table.',
  ],
  replaces: ['slice-table', 'checks-table'],
  example: '<Table caption="Slices" columns={[{ id: "slice", label: "Slice" }]} rows={[{ id: "s1", cells: { slice: "s1" } }]} />',
} satisfies ComponentMeta;
