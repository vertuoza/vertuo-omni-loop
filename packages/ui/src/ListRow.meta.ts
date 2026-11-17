import type { ComponentMeta } from './meta.ts';

export const LIST_ROW_DENSITIES = ['normal', 'compact'] as const;

export const listRowMeta = {
  name: 'ListRow',
  variants: { density: LIST_ROW_DENSITIES, link: ['true', 'false'] },
  accessibility: [
    'A row with an `href` is one link around the whole row: one tab stop, one name.',
    'A row without one is plain content, read in order; its trailing slot never repeats the title.',
  ],
  replaces: ['proof-row', 'ready-row', 'care-row'],
  example: '<ListRow title="AC-1 tokens are generated" detail="test" trailing={<Badge tone="success">Passing</Badge>} />',
} satisfies ComponentMeta;
