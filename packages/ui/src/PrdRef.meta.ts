import { onSurfaces } from './meta.ts';
import type { ComponentMeta } from './meta.ts';

export const PRD_REF_VARIANTS = ['default', 'quiet'] as const;

export const prdRefMeta = {
  name: 'PrdRef',
  variants: { variant: PRD_REF_VARIANTS },
  usage: 'A PRD named where it is mentioned: its number and title, as a link to its page.',
  do: ['Use it every time a PRD is named, so a reader can always follow it.', 'Take the quiet variant inside a sentence that is already a link or a heading.'],
  dont: ['Write "PRD 12" as plain text where its page exists.', 'Shorten or translate the title: the text is what a screen reader says.'],
  contrast: {
    base: onSurfaces('focus-ring', { edge: true }),
    'variant=default': onSurfaces('text-primary'),
    'variant=quiet': onSurfaces('text-secondary'),
  },
  accessibility: [
    'A native link whose text is the PRD\'s number and title: one tab stop, one name, no label to add.',
    'Underlined in every variant, never told from text by colour alone.',
  ],
  replaces: ['prd-link', 'prd-chip'],
  example: '<PrdRef number={12} title="Parts and the catalogue" href="/prd/12" />',
} satisfies ComponentMeta;
