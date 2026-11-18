import { onSurfaces } from './meta.ts';
import type { ComponentMeta } from './meta.ts';

export const FILTER_BAR_CONTROLS = ['all', 'search'] as const;

export const filterBarMeta = {
  name: 'FilterBar',
  variants: { controls: FILTER_BAR_CONTROLS },
  usage: 'The controls above a list that narrow it: a search, a few selects and a segmented choice, side by side.',
  do: ['Give every control a label in words.', 'Start each on the value that shows everything.'],
  dont: ['Put actions that change data in it: those are Buttons.', 'Offer more filters than fit on one or two lines.'],
  contrast: { base: [...onSurfaces('text-primary'), ...onSurfaces('text-secondary')] },
  accessibility: [
    'A group named by `label`, not a landmark, so many bars on a page repeat nothing.',
    'Each control is a Field, Select or SegmentedControl with its own label; the keyboard behaviour is theirs.',
  ],
  replaces: ['filter-bar', 'toolbar'],
  example: '<FilterBar label="Filter PRDs" search={{ label: "Search" }} selects={[{ label: "Repository", name: "repo", options }]} />',
} satisfies ComponentMeta;
