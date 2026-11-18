import { onSurfaces } from './meta.ts';
import type { ComponentMeta } from './meta.ts';

export const DATA_LIST_LAYOUTS = ['stacked', 'inline'] as const;
export const DATA_LIST_DENSITIES = ['normal', 'compact'] as const;

export const dataListMeta = {
  name: 'DataList',
  variants: { layout: DATA_LIST_LAYOUTS, density: DATA_LIST_DENSITIES },
  usage: 'The facts of one thing as names and values: a PRD\'s owner, state and date.',
  do: ['Keep each term to one or two words.', 'Use `inline` when the page is wide, `stacked` when it is narrow.'],
  dont: ['Use it to compare many things across the same columns: use Table.', 'Put a long paragraph in a detail.'],
  contrast: { base: [...onSurfaces('text-primary'), ...onSurfaces('text-secondary')] },
  accessibility: [
    'A description list (dl) of dt and dd pairs, each pair in its own group, so a screen reader reads each term with its value.',
    'Long values wrap instead of widening the list.',
  ],
  replaces: ['dossier-facts', 'meta-list'],
  example: '<DataList items={[{ id: "owner", term: "Owner", detail: "Pierre" }]} />',
} satisfies ComponentMeta;
