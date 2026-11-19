import type { ComponentMeta } from './meta.ts';

export const KBD_SIZES = ['small', 'body'] as const;

export const kbdMeta = {
  name: 'Kbd',
  variants: { size: KBD_SIZES },
  usage: 'A key a person presses, drawn as a key cap, in a shortcut hint or in help text: Esc, Enter, Tab.',
  do: ['Write one key in each Kbd and put a plus sign between two.', 'Name the key as it is on the keyboard: Esc, not Escape key.'],
  dont: ['Use it for a button a person clicks: use Button.', 'Use it for a command: use Code.'],
  contrast: { base: [{ text: 'text-primary', on: 'sunken' }] },
  accessibility: [
    'A kbd element: a screen reader reads its text as the key.',
    'Its text is on a sunken background and passes WCAG AA in the three themes; its edge is never the only sign of the key.',
  ],
  replaces: ['shortcut-hint', 'key-chip', 'help-key'],
  example: '<Kbd>Esc</Kbd>',
} satisfies ComponentMeta;
