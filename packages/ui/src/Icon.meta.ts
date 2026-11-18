import { onSurfaces } from './meta.ts';
import type { ComponentMeta } from './meta.ts';

export const ICON_SIZES = ['md', 'lg'] as const;

export const iconMeta = {
  name: 'Icon',
  variants: { size: ICON_SIZES },
  usage: 'A 1-bit pixel icon of the set, drawn in the ink around it: a navigation entry, a control, a status mark.',
  do: ['Give it a `label` when it stands alone, and pair it with text otherwise.', 'Keep to the two sizes, whole-number scales of the 16 px grid.'],
  dont: ['Say something with an icon alone when a word fits.', 'Stretch it to a size that is not a whole multiple of 16.'],
  contrast: {
    base: [...onSurfaces('text-primary', { edge: true }), ...onSurfaces('text-secondary', { edge: true })],
  },
  accessibility: [
    'Decoration by default: hidden from a screen reader, so the text beside it is read once.',
    'With a `label` it is an image with that name.',
    'It takes the ink of its parent (`currentColor`), so it reaches the parent text\'s contrast.',
  ],
  replaces: ['nav-icon'],
  example: '<Icon name="home" label="Home" />',
} satisfies ComponentMeta;
