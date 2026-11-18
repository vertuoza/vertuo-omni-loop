import { onSurfaces } from './meta.ts';
import type { ComponentMeta } from './meta.ts';

export const ICON_BUTTON_VARIANTS = ['secondary', 'quiet'] as const;

export const iconButtonMeta = {
  name: 'IconButton',
  variants: { variant: ICON_BUTTON_VARIANTS, disabled: ['true', 'false'] },
  usage: 'An action that is one icon: close, search, open the menu. Its label is required and says what it does.',
  do: ['Write the label as the action: Close, Search.', 'Use the quiet variant for a control that sits in a toolbar.'],
  dont: ['Leave the label out: the type refuses it.', 'Use it for the view\'s main action: that is a Button with words.'],
  contrast: {
    base: onSurfaces('focus-ring', { edge: true }),
    'variant=secondary': [...onSurfaces('text-primary'), ...onSurfaces('border-strong', { edge: true })],
    'variant=quiet': onSurfaces('text-secondary'),
  },
  accessibility: [
    'A native button named by its required `label`; the icon inside is decoration.',
    'It takes focus, Enter and Space, with a visible focus ring on the focus-ring role.',
    'A strong border (3:1) on the secondary variant.',
  ],
  replaces: ['icon-button'],
  example: '<IconButton icon="close" label="Close" onClick={close} />',
} satisfies ComponentMeta;
