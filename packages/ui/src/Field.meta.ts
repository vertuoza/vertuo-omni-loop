import { onSurfaces } from './meta.ts';
import type { ComponentMeta } from './meta.ts';

export const FIELD_REQUIRED = ['true', 'false'] as const;
export const FIELD_ERRORS = ['shown', 'none'] as const;

export const fieldMeta = {
  name: 'Field',
  variants: { required: FIELD_REQUIRED, error: FIELD_ERRORS },
  usage: 'The label, the hint and the error of one form control: put an Input, a Textarea or a Select inside it.',
  do: ['Always give a label in words; the placeholder is not one.', 'Say what is wrong and how to fix it in the error.'],
  dont: ['Put more than one control in a Field.', 'Show the error in colour alone: it is always text.'],
  contrast: {
    base: [...onSurfaces('text-primary'), ...onSurfaces('text-secondary')],
    'error=shown': onSurfaces('danger'),
  },
  accessibility: [
    'The label is tied to the control with `for`; the hint and the error through `aria-describedby`.',
    'An error sets `aria-invalid` on the control and is written out as text, never colour alone.',
    'A required field says "(required)" in its label as well as setting `required` on the control.',
  ],
  replaces: ['form-field', 'field-label'],
  example: '<Field label="Name" hint="As on your badge" error={problem}><Input name="name" /></Field>',
} satisfies ComponentMeta;
