import { onSurfaces } from './meta.ts';
import type { ComponentMeta } from './meta.ts';

export const checkboxMeta = {
  name: 'Checkbox',
  variants: { checked: ['true', 'false'], invalid: ['true', 'false'], disabled: ['true', 'false'] },
  usage: 'One yes or no choice, or one of several that may all be on: accept the terms, include archived.',
  do: ['Put it in a Field so it has a label, a hint and an error.', 'Word the label so that ticked means yes.'],
  dont: ['Use it to pick exactly one of several: that is a Radio.', 'Use it for a setting that acts at once: that is a Switch.'],
  contrast: {
    base: [...onSurfaces('focus-ring', { edge: true }), ...onSurfaces('border-strong', { edge: true })],
    'checked=true': [{ text: 'text-on-accent', on: 'accent' }, ...onSurfaces('accent', { edge: true })],
    'invalid=true': onSurfaces('danger', { edge: true }),
  },
  accessibility: [
    'A native checkbox: it takes focus and Space toggles it.',
    'Inside a Field it is named by the Field label and described by its hint and error; alone it needs a `label`.',
    'An invalid choice sets `aria-invalid`, with a thicker danger border as well as the Field\'s error text.',
  ],
  replaces: ['checkbox', 'check-row'],
  example: '<Field label="Include archived"><Checkbox name="archived" /></Field>',
} satisfies ComponentMeta;
