import type { ComponentMeta } from './meta.ts';

export const BUTTON_VARIANTS = ['primary', 'secondary', 'quiet', 'danger'] as const;
export const BUTTON_SIZES = ['md', 'sm'] as const;

export const buttonMeta = {
  name: 'Button',
  variants: { variant: BUTTON_VARIANTS, size: BUTTON_SIZES, disabled: ['true', 'false'] },
  accessibility: [
    'A native button, or a link when it has an `href`: it takes focus, Enter and Space.',
    'A visible focus ring on the accent role; a strong border (3:1) on every variant but quiet.',
    'One `primary` per view: the page header holds it, marked `data-primary` for the design checks.',
    'With `external`, a link opens in a new window without handing it the page; `title` says what hovering it shows; `expanded` says whether the panel it opens is open.',
  ],
  replaces: ['dossier-approve', 'pitch-action'],
  example: '<Button variant="primary" onClick={approve}>Approve</Button>',
} satisfies ComponentMeta;
