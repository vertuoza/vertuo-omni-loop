import { onSurfaces } from './meta.ts';
import type { ComponentMeta } from './meta.ts';

export const STAT_SIZES = ['md', 'lg'] as const;

export const statMeta = {
  name: 'Stat',
  variants: { size: STAT_SIZES },
  usage: 'One number with its label and, when it helps, one line of context: 12 open PRDs, this week.',
  do: ['Put the label in words that say what is counted.', 'Use `lg` for the one number a view is about.'],
  dont: ['Put a sentence in the value: it is a number or a short word.', 'Line up many of them in a grid of cards: a DataList reads better.'],
  contrast: {
    base: [...onSurfaces('text-primary'), ...onSurfaces('text-secondary')],
  },
  accessibility: [
    'A description list: a screen reader reads the label with its value.',
    'The hint is plain text, never carried by colour.',
  ],
  replaces: ['stat', 'metric', 'kpi'],
  example: '<Stat label="Open PRDs" value={12} hint="this week" />',
} satisfies ComponentMeta;
