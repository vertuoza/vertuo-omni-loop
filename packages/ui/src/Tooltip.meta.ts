import { OVERLAY_CONTRAST } from './Dialog.meta.ts';
import { onSurfaces } from './meta.ts';
import type { ComponentMeta } from './meta.ts';

export const TOOLTIP_SIDES = ['top', 'bottom'] as const;

export const tooltipMeta = {
  name: 'Tooltip',
  variants: { side: TOOLTIP_SIDES },
  usage: 'An icon button whose name shows as a short hint on hover and on focus, for a toolbar of icons a sighted person may not read at a glance.',
  do: ['Write the label as the action, in two or three words: Search, Copy the link.', 'Keep it to the name: the hint says what the button already says to a screen reader.'],
  dont: ['Put something the person needs only in the hint: a touch screen never shows it.', 'Put a link or a button in it: that is a Popover.'],
  contrast: { base: [...OVERLAY_CONTRAST, ...onSurfaces('text-secondary')] },
  accessibility: [
    'Its behaviour is Base UI\'s Tooltip: the hint shows on hover and when its button takes focus, and hides on Escape or when focus leaves.',
    'Its button is named by the same `label` (aria-label), so the hint is never the only place the words are.',
    'The hint holds no control and never takes focus.',
  ],
  replaces: ['tooltip', 'title-hint'],
  example: '<Tooltip icon="search" label="Search the PRDs" onClick={openSearch} />',
} satisfies ComponentMeta;
