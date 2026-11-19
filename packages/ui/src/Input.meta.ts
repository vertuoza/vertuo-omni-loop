import { onSurfaces } from './meta.ts';
import type { ComponentMeta } from './meta.ts';

/** The colour pairs a bordered text control draws: Input, Textarea and Select share them. */
export const TEXT_CONTROL_CONTRAST = {
  base: [...onSurfaces('focus-ring', { edge: true }), { text: 'text-primary', on: 'surface' }, { text: 'text-secondary', on: 'surface' }, { text: 'border-strong', on: 'surface', edge: true }],
  'invalid=true': [{ text: 'danger', on: 'surface', edge: true }],
} as const satisfies ComponentMeta['contrast'];

export const INPUT_TYPES = ['text', 'email', 'search', 'url', 'password', 'number'] as const;

export const inputMeta = {
  name: 'Input',
  variants: { type: INPUT_TYPES, invalid: ['true', 'false'], disabled: ['true', 'false'] },
  usage: 'One line of text: a name, an email, a search, a number.',
  do: ['Put it in a Field so it has a label, a hint and an error.', 'Pick the `type` that matches the value: the keyboard on a phone follows it.'],
  dont: ['Use a placeholder as the label.', 'Use it for several lines: that is a Textarea.'],
  contrast: TEXT_CONTROL_CONTRAST,
  accessibility: [
    'A native input: it takes focus, typing and autofill.',
    'Inside a Field it is named by the Field label and described by its hint and error; alone it needs a `label`.',
    'An invalid value sets `aria-invalid`, with a thicker danger border as well as the Field\'s error text.',
  ],
  replaces: ['text-input', 'search-box'],
  example: '<Input name="email" type="email" />',
} satisfies ComponentMeta;
