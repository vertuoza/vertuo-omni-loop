import { onSurfaces } from './meta.ts';
import type { ComponentMeta } from './meta.ts';

export const LIST_ROW_DENSITIES = ['normal', 'compact'] as const;
/** How many lines the title and the detail may take before they are cut with an ellipsis. */
export const LIST_ROW_CLAMPS = [1, 2, 3] as const;

export const listRowMeta = {
  name: 'ListRow',
  variants: { density: LIST_ROW_DENSITIES, link: ['true', 'false'], selected: ['true', 'false'], leading: ['true', 'false'], clamp: LIST_ROW_CLAMPS.map(String) },
  usage: 'One row of a list of like things: a proof, a check, a pull request, each with its state at the end.',
  do: ['Keep the title short and put the rest in the detail.', 'Make the whole row one link when it opens one thing.'],
  dont: ['Put a tertiary text on a selected row: it fails contrast on the tint.', 'Put a second link or a button inside a linked row.', 'Repeat the title in the trailing slot.'],
  contrast: {
    base: [...onSurfaces('text-primary'), ...onSurfaces('text-secondary')],
    'link=true': [{ text: 'text-primary', on: 'sunken' }, ...onSurfaces('focus-ring', { edge: true })],
    'selected=true': [
      { text: 'text-primary', on: 'signal-soft' },
      { text: 'text-secondary', on: 'signal-soft' },
      { text: 'signal', on: 'signal-soft' },
      { text: 'info', on: 'signal-soft' },
    ],
  },
  accessibility: [
    'A row with an `href` is one link around the whole row: one tab stop, one name.',
    'A selected row carries aria-current="true" and a heavier title: the tint is never the only cue.',
    'A row without one is plain content, read in order; its trailing slot never repeats the title.',
  ],
  replaces: ['proof-row', 'ready-row', 'care-row'],
  example: '<ListRow title="AC-1 tokens are generated" detail="test" trailing={<Badge tone="success">Passing</Badge>} />',
} satisfies ComponentMeta;
