import { onSurfaces } from './meta.ts';
import type { ComponentMeta } from './meta.ts';

export const TEXT_SIZES = ['caption', 'small', 'body', 'prose', 'heading', 'title'] as const;
export const TEXT_TONES = ['primary', 'secondary', 'tertiary', 'success', 'warning', 'danger'] as const;
export const TEXT_ELEMENTS = ['p', 'span', 'h1', 'h2', 'h3', 'h4'] as const;

export const textMeta = {
  name: 'Text',
  variants: { size: TEXT_SIZES, tone: TEXT_TONES, as: TEXT_ELEMENTS, strong: ['true', 'false'] },
  usage: 'A run of text at a step of the type scale, in a tone: the one way a page sets type.',
  do: ['Pick `as` for the outline and `size` for the look.', 'Use the prose size for what a person reads at length.'],
  dont: ['Skip a heading level to get a smaller look.', 'Say a state by its tone alone: the words say it too.'],
  contrast: {
    'tone=primary': onSurfaces('text-primary'),
    'tone=secondary': onSurfaces('text-secondary'),
    'tone=tertiary': onSurfaces('text-tertiary'),
    'tone=success': onSurfaces('success'),
    'tone=warning': onSurfaces('warning'),
    'tone=danger': onSurfaces('danger'),
  },
  accessibility: [
    'Pick `as` for the document outline (h1 to h4), never for the look: the look is `size`.',
    'Every tone passes WCAG AA on canvas, surface and raised in the three themes.',
  ],
  replaces: ['dossier-title', 'ready-title', 'prd-timeline-title'],
  example: '<Text as="p" size="prose">The spec, as the PRD says it.</Text>',
} satisfies ComponentMeta;
