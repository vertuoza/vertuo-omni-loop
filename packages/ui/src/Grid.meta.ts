import type { ComponentMeta } from './meta.ts';

export const GRID_COLUMNS = ['1', '2', '3', '4'] as const;
export const GRID_GAPS = ['2', '3', '4', '5', '6'] as const;

export const gridMeta = {
  name: 'Grid',
  variants: { columns: GRID_COLUMNS, gap: GRID_GAPS },
  usage: 'Lays cards, stats or other blocks of one size out in equal columns, one column on a narrow screen.',
  do: ['Give it blocks of about the same size.', 'Pick the gap from the space scale: the same step both ways.'],
  dont: ['Use it for a page layout of unequal columns.', 'Ask for four columns of text: the lines get too short to read.'],
  contrast: {},
  accessibility: ['A plain div: the cells read in source order, whatever the number of columns.'],
  replaces: ['stat-grid', 'card-grid', 'dossier-columns'],
  example: '<Grid columns="3" gap="4"><Card>One</Card><Card>Two</Card><Card>Three</Card></Grid>',
} satisfies ComponentMeta;
