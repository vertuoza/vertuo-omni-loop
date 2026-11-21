import { onSurfaces } from './meta.ts';
import type { ComponentMeta } from './meta.ts';

export const SEGMENTED_SIZES = ['md', 'sm'] as const;

export const segmentedControlMeta = {
  name: 'SegmentedControl',
  variants: { size: SEGMENTED_SIZES },
  usage: 'Two to five options side by side, as one control, that change what this view shows: a filter (All, Open, Closed), or, given an `href` on each, the sub-views of a tab (Before/after, Spec, Plan) and its versions as links.',
  do: [
    'Keep each label to one or two words.',
    'Always mark one option; start on the usual one.',
    'Give every option an `href` when each one is its own address (a sub-view, a version), and the app\'s router link.',
  ],
  dont: [
    'Use it to go to the sections of a page: that is Tabs. Never draw a second row of tabs inside a tab: use this.',
    'Mix options with and without an `href`.',
    'Offer more than five options.',
  ],
  contrast: {
    base: [...onSurfaces('text-secondary'), ...onSurfaces('text-primary'), ...onSurfaces('border-strong', { edge: true }), ...onSurfaces('focus-ring', { edge: true })],
  },
  accessibility: [
    'As a choice: a radio group named by `label`; each segment is a radio with aria-checked, and the arrow keys, Home and End move the choice and the focus.',
    'As links (every option has an `href`): a group named by `label`, one link per segment, the current one carrying aria-current="page"; the arrow keys, Home and End move the focus, and Enter follows the link.',
    'One tab stop either way: Tab enters on the chosen or current segment.',
    'The chosen segment shows by a bar and weight, never by colour alone.',
  ],
  replaces: ['segmented', 'filter-toggle'],
  example: '<SegmentedControl label="Show" value="open" onChange={setShow} options={[{ id: "open", label: "Open" }, { id: "all", label: "All" }]} />',
} satisfies ComponentMeta;
