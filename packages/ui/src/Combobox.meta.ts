import { OVERLAY_CONTRAST } from './Dialog.meta.ts';
import { TEXT_CONTROL_CONTRAST } from './Input.meta.ts';
import type { ComponentMeta } from './meta.ts';

export const comboboxMeta = {
  name: 'Combobox',
  variants: { invalid: ['false', 'true'], disabled: ['false', 'true'] },
  usage: 'One choice out of a list too long to read through, found by typing: a repository, a person, a PRD.',
  do: ['Put it in a Field so it has a label, a hint and an error.', 'Say in `emptyText` what to do when nothing matches.'],
  dont: ['Use it for a handful of options: that is a Select, or a SegmentedControl for two or three.', 'Use it for actions: that is a Menu.'],
  contrast: {
    ...TEXT_CONTROL_CONTRAST,
    base: [...TEXT_CONTROL_CONTRAST.base, ...OVERLAY_CONTRAST, { text: 'text-primary', on: 'accent-soft' }],
  },
  accessibility: [
    'Its behaviour is Base UI\'s Combobox: an input (role combobox) whose list (role listbox) filters as the person types.',
    'The arrow keys move through the options left, Enter picks one, Escape closes the list and focus stays in the input.',
    'Inside a Field it is named by the Field label and described by its hint and error, as an Input is; alone it needs a `label`.',
  ],
  replaces: ['autocomplete', 'typeahead'],
  example: '<Field label="Repository"><Combobox options={repositories} onValueChange={pick} /></Field>',
} satisfies ComponentMeta;
