import { onSurfaces } from './meta.ts';
import type { ComponentMeta } from './meta.ts';

export const DIALOG_SIZES = ['md', 'sm', 'lg'] as const;

export const dialogMeta = {
  name: 'Dialog',
  variants: { size: DIALOG_SIZES },
  usage: 'A question the person must answer before the page goes on, opened from a button: confirm an approval, name a new runner.',
  do: ['Title it with the question, and give it one action that answers it beside a way out.', 'Keep it short: one decision, a few lines.'],
  dont: ['Open a dialog the person did not ask for.', 'Put a long form or a page of reading in it: that is a Drawer or a page.'],
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
    'Its behaviour is Base UI\'s Dialog: opened from its button, focus moves inside and Tab stays inside; the page behind is inert.',
    'Escape, the close button or a click on the scrim closes it, and focus returns to the button that opened it.',
    'It is a dialog named by its title and described by its description; the close button is named in words (`closeLabel`).',
  ],
  replaces: ['modal', 'dialog-panel'],
  example: '<Dialog trigger="Approve the plan" title="Approve the plan?" actions={<Button variant="primary" onClick={approve}>Approve</Button>}>Five slices, two waves.</Dialog>',
} satisfies ComponentMeta;
