import { onSurfaces } from './meta.ts';
import type { ComponentMeta } from './meta.ts';

export const BUTTON_VARIANTS = ['primary', 'secondary', 'quiet', 'danger'] as const;
export const BUTTON_SIZES = ['md', 'sm'] as const;

export const buttonMeta = {
  name: 'Button',
  variants: { variant: BUTTON_VARIANTS, size: BUTTON_SIZES, disabled: ['true', 'false'] },
  usage: 'An action the person takes on this view: approve, send, copy. With an `href` it is a link that looks like one.',
  do: ['Name the action with a verb: Approve, Send to a runner.', 'Give the view one `primary`, its main action; keep the others secondary or quiet.'],
  dont: ['Put two primary buttons in one view.', 'Use a button to go to another page when a link says it better.'],
  contrast: {
    base: onSurfaces('focus-ring', { edge: true }),
    'variant=primary': [{ text: 'text-on-accent', on: 'accent' }, ...onSurfaces('accent', { edge: true })],
    'variant=secondary': [{ text: 'text-primary', on: 'surface' }, ...onSurfaces('border-strong', { edge: true })],
    'variant=quiet': onSurfaces('text-secondary'),
    'variant=danger': [{ text: 'danger', on: 'surface' }, ...onSurfaces('border-strong', { edge: true })],
  },
  accessibility: [
    'A native button, or a link when it has an `href`: it takes focus, Enter and Space.',
    'A visible focus ring on the focus-ring role; a strong border (3:1) on every variant but quiet.',
    'One `primary` per view: the page header holds it, marked `data-primary` for the design checks.',
    'With `external`, a link opens in a new window without handing it the page; `title` says what hovering it shows; `expanded` says whether the panel it opens is open.',
  ],
  replaces: ['dossier-approve', 'pitch-action'],
  example: '<Button variant="primary" onClick={approve}>Approve</Button>',
} satisfies ComponentMeta;
