import { onSurfaces } from './meta.ts';
import type { ComponentMeta } from './meta.ts';

export const LINK_VARIANTS = ['default', 'quiet'] as const;

export const linkMeta = {
  name: 'Link',
  variants: { variant: LINK_VARIANTS },
  usage: 'A link to another page or an outside site, in a sentence or beside it.',
  do: ['Say where it goes in its own words: "the outbox", not "here".', 'Mark an outside site with `external`.'],
  dont: ['Use a link for an action that changes something: that is a Button.', 'Remove the underline.'],
  contrast: {
    base: onSurfaces('focus-ring', { edge: true }),
    'variant=default': onSurfaces('text-primary'),
    'variant=quiet': onSurfaces('text-secondary'),
  },
  accessibility: [
    'A native link: it takes focus and Enter, and works without script.',
    'Underlined in every variant, never told from text by colour alone.',
    'With `external` it opens in a new window without handing it the page.',
  ],
  replaces: ['text-link'],
  example: '<Link href="/outbox">the outbox</Link>',
} satisfies ComponentMeta;
