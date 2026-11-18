import { TEXT_CONTROL_CONTRAST } from './Input.meta.ts';
import type { ComponentMeta } from './meta.ts';

export const selectMeta = {
  name: 'Select',
  variants: { invalid: ['true', 'false'], disabled: ['true', 'false'] },
  usage: 'One choice out of a short list, in the browser\'s own picker: a role, a repository, a status.',
  do: ['Put it in a Field so it has a label, a hint and an error.', 'Order the options the way people look for them.'],
  dont: ['Use it for two or three choices that should stay in view: that is a SegmentedControl.', 'Use it when people must search a long list: that is a Combobox.'],
  contrast: TEXT_CONTROL_CONTRAST,
  accessibility: [
    'A native select: it takes focus, the arrow keys, typing to jump and the platform picker.',
    'Inside a Field it is named by the Field label and described by its hint and error; alone it needs a `label`.',
    'The chevron is decoration; an invalid value sets `aria-invalid` with a thicker danger border.',
  ],
  replaces: ['select-box', 'dropdown'],
  example: '<Select name="role" options={[{ value: "dev", label: "Developer" }, { value: "pm", label: "Product" }]} />',
} satisfies ComponentMeta;
