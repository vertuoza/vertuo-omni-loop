import { OVERLAY_CONTRAST } from './Dialog.meta.ts';
import type { ComponentMeta } from './meta.ts';

export const POPOVER_SIDES = ['bottom', 'top'] as const;

export const popoverMeta = {
  name: 'Popover',
  variants: { side: POPOVER_SIDES },
  usage: 'A few lines or a couple of links beside the button that opens them, while the page goes on around them: who answers a question, what a badge means.',
  do: ['Title it in a few words; keep what it holds short.', 'Let it close on its own: Escape and a click outside both close it.'],
  dont: ['Put a question the person must answer in it: that is a Dialog.', 'Open it on hover alone: a keyboard and a touch screen never hover.'],
  contrast: { base: OVERLAY_CONTRAST },
  accessibility: [
    'Its behaviour is Base UI\'s Popover: opened from its button (aria-expanded), focus moves inside; the page behind stays live.',
    'Escape or a click outside closes it, and focus returns to the button that opened it.',
    'It is a dialog named by its title.',
  ],
  replaces: ['popover', 'hint-panel'],
  example: '<Popover trigger="Who answers?" title="Who answers">The people of this PRD.</Popover>',
} satisfies ComponentMeta;
