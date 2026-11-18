import { OVERLAY_CONTRAST } from './Dialog.meta.ts';
import type { ComponentMeta } from './meta.ts';

export const MENU_SIDES = ['bottom', 'top'] as const;
export const MENU_TONES = ['neutral', 'danger'] as const;

export const menuMeta = {
  name: 'Menu',
  variants: { side: MENU_SIDES, tone: MENU_TONES },
  usage: 'A short list of actions behind one button, when they do not all fit beside it: rename, archive, copy the link.',
  do: ['Name each item as the action it takes: Rename, Archive.', 'Keep it short: a handful of items, the one that destroys last, in the danger tone.'],
  dont: ['Hide the view\'s main action in it: that is a Button on the page.', 'Use it to pick a value for a form: that is a Select or a Combobox.'],
  contrast: {
    base: [...OVERLAY_CONTRAST, { text: 'text-primary', on: 'accent-soft' }],
    'tone=danger': [{ text: 'danger', on: 'raised' }, { text: 'danger', on: 'accent-soft' }],
  },
  accessibility: [
    'Its behaviour is Base UI\'s Menu: its button says it opens a menu (aria-haspopup) and whether it is open; Enter, Space or the arrow keys open it.',
    'The arrow keys move between items, Home and End go to the first and the last, a letter goes to the item it starts; Enter picks one.',
    'Escape closes it, and focus returns to the button that opened it.',
  ],
  replaces: ['dropdown-menu', 'more-actions'],
  example: '<Menu trigger="Actions" items={[{ id: \'rename\', label: \'Rename\' }, { id: \'archive\', label: \'Archive\', tone: \'danger\' }]} onSelect={act} />',
} satisfies ComponentMeta;
