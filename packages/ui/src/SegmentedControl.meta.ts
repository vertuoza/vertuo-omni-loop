import { onSurfaces } from './meta.ts';
import type { ComponentMeta } from './meta.ts';

export const SEGMENTED_SIZES = ['md', 'sm'] as const;

export const segmentedControlMeta = {
  name: 'SegmentedControl',
  variants: { size: SEGMENTED_SIZES },
  usage: 'One choice out of two to five, side by side, that changes what this view shows: All, Open, Closed.',
  do: ['Keep each label to one or two words.', 'Always choose one option; start on the usual one.'],
  dont: ['Use it to go to other pages: that is Tabs.', 'Offer more than five options.'],
  contrast: {
    base: [...onSurfaces('text-secondary'), ...onSurfaces('text-primary'), ...onSurfaces('border-strong', { edge: true }), ...onSurfaces('focus-ring', { edge: true })],
  },
  accessibility: [
    'A radio group named by `label`; each segment is a radio with aria-checked.',
    'One tab stop: Tab enters on the chosen segment, the arrow keys, Home and End move the choice and the focus.',
    'The chosen segment shows by a bar and weight, never by colour alone.',
  ],
  replaces: ['segmented', 'filter-toggle'],
  example: '<SegmentedControl label="Show" value="open" onChange={setShow} options={[{ id: "open", label: "Open" }, { id: "all", label: "All" }]} />',
} satisfies ComponentMeta;
