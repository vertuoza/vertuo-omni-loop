import { TEXT_CONTROL_CONTRAST } from './Input.meta.ts';
import type { ComponentMeta } from './meta.ts';

export const textareaMeta = {
  name: 'Textarea',
  variants: { invalid: ['true', 'false'], disabled: ['true', 'false'] },
  usage: 'Several lines of text: a comment, a description, a reason.',
  do: ['Put it in a Field so it has a label, a hint and an error.', 'Set `rows` to about the length you expect.'],
  dont: ['Use it for a short value: that is an Input.', 'Use a placeholder as the label.'],
  contrast: TEXT_CONTROL_CONTRAST,
  accessibility: [
    'A native textarea: it takes focus, typing, Enter for a new line and resizing.',
    'Inside a Field it is named by the Field label and described by its hint and error; alone it needs a `label`.',
    'An invalid value sets `aria-invalid`, with a thicker danger border as well as the Field\'s error text.',
  ],
  replaces: ['text-area', 'comment-box'],
  example: '<Textarea name="comment" rows={5} />',
} satisfies ComponentMeta;
