import { onSurfaces } from './meta.ts';
import type { ComponentMeta } from './meta.ts';

export const DRAWER_SIDES = ['end', 'start'] as const;

export const drawerMeta = {
  name: 'Drawer',
  variants: { side: DRAWER_SIDES },
  usage: 'Work beside the page, opened from a button, that the person closes to come back: filters, a slice\'s details, the navigation on a phone.',
  do: ['Title it with what it holds.', 'Keep the page behind it as it was, so closing it puts the person back where they were.'],
  dont: ['Ask a yes-or-no question in it: that is a Dialog.', 'Open a drawer from inside a drawer.'],
  contrast: {
    base: [
      { text: 'text-primary', on: 'raised' },
      { text: 'text-secondary', on: 'raised' },
      { text: 'focus-ring', on: 'raised', edge: true },
      { text: 'text-primary', on: 'surface' },
      ...onSurfaces('border-strong', { edge: true }),
      ...onSurfaces('focus-ring', { edge: true }),
    ],
  },
  accessibility: [
    'Its behaviour is Base UI\'s Drawer: opened from its button, focus moves inside and Tab stays inside; the page behind is inert.',
    'Escape, the close button, a click on the scrim or a swipe toward its edge closes it, and focus returns to the button that opened it.',
    'It is a dialog named by its title and described by its description; the close button is named in words (`closeLabel`).',
  ],
  replaces: ['drawer', 'side-panel'],
  example: '<Drawer trigger="Filters" title="Filter the PRDs" side="end">…</Drawer>',
} satisfies ComponentMeta;
