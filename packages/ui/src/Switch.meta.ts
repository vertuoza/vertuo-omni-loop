import { onSurfaces } from './meta.ts';
import type { ComponentMeta } from './meta.ts';

export const switchMeta = {
  name: 'Switch',
  variants: { checked: ['true', 'false'], disabled: ['true', 'false'] },
  usage: 'A setting that is on or off and takes effect as soon as it is flipped: notifications, a runner online.',
  do: ['Put it in a Field so it has a label and a hint.', 'Name what is on, not the action: "Email me about the outbox".'],
  dont: ['Use it in a form that is sent later: that is a Checkbox.', 'Show the state in colour alone: the thumb moves too.'],
  contrast: {
    base: [...onSurfaces('focus-ring', { edge: true }), ...onSurfaces('border-strong', { edge: true })],
    'checked=true': [{ text: 'text-on-accent', on: 'accent' }, ...onSurfaces('accent', { edge: true })],
  },
  accessibility: [
    'A native checkbox with the `switch` role: it takes focus and Space flips it; a screen reader says on or off.',
    'The thumb sits left when off and right when on, so the state is not colour alone.',
    'Inside a Field it is named by the Field label and described by its hint; alone it needs a `label`.',
    'The thumb\'s slide stops under reduced motion.',
  ],
  replaces: ['toggle', 'switch-row'],
  example: '<Field label="Email me about the outbox"><Switch name="email" /></Field>',
} satisfies ComponentMeta;
