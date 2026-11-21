import { TEXT_CONTROL_CONTRAST } from './Input.meta.ts';
import type { ComponentMeta } from './meta.ts';

export const selectMeta = {
  name: 'Select',
  variants: { invalid: ['true', 'false'], disabled: ['true', 'false'], size: ['md', 'sm'] },
  usage: 'One choice out of a short list, in the product\'s own list: a role, a repository, a status. `md` for forms, `sm` for a chip, a toolbar or an inline sort.',
  do: ['Put it in a Field so it has a label, a hint and an error.', 'Order the options the way people look for them.'],
  dont: ['Use it for two or three choices that should stay in view: that is a SegmentedControl.', 'Use it when people must search a long list: that is a Combobox.'],
  contrast: TEXT_CONTROL_CONTRAST,
  accessibility: [
    'A list box on Base UI: the trigger opens it by click, Enter, Space or the arrows; the arrows, Home and End move, typing jumps, Enter picks, Escape or an outside click closes it and focus returns to the trigger.',
    'The list has the role listbox, each option the role option, and only the picked one is `aria-selected`; every option is at least 44 px tall.',
    'Inside a Field it is named by the Field label and described by its hint and error; alone it needs a `label`. A hidden input posts `name=value` in a form.',
    'The chevron and the check are decoration; an invalid value sets `aria-invalid` with a thicker danger border.',
  ],
  replaces: ['select-box', 'dropdown'],
  example: '<Select name="role" options={[{ value: "dev", label: "Developer" }, { value: "pm", label: "Product" }]} />',
} satisfies ComponentMeta;
