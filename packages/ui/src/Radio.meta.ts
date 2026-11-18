import { onSurfaces } from './meta.ts';
import type { ComponentMeta } from './meta.ts';

export const RADIO_ORIENTATIONS = ['vertical', 'horizontal'] as const;

export const radioMeta = {
  name: 'Radio',
  variants: { orientation: RADIO_ORIENTATIONS, invalid: ['true', 'false'], disabled: ['true', 'false'] },
  usage: 'Exactly one choice out of a few that all stay in view: a role, a sort order, a visibility.',
  do: ['Put it in a Field so the group has a label, a hint and an error.', 'Start on the safe or most common option when one exists.'],
  dont: ['Use it for more than about six options: that is a Select.', 'Use it when several may be chosen: that is a Checkbox.'],
  contrast: {
    base: [...onSurfaces('focus-ring', { edge: true }), ...onSurfaces('border-strong', { edge: true }), ...onSurfaces('text-primary')],
    'invalid=true': onSurfaces('danger', { edge: true }),
  },
  accessibility: [
    'Native radios in one `radiogroup` named by `label`: Tab enters the group, the arrow keys move and choose.',
    'Each option is a label around its radio, so its words are the click target too.',
    'An invalid group sets `aria-invalid`, with a thicker danger border as well as the Field\'s error text.',
  ],
  replaces: ['radio', 'radio-row'],
  example: '<Field label="Who can see it"><Radio label="Who can see it" name="who" options={[{ value: \'team\', label: \'Team\' }, { value: \'all\', label: \'Everyone\' }]} /></Field>',
} satisfies ComponentMeta;
