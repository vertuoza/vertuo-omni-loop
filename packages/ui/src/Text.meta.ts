import type { ComponentMeta } from './meta.ts';

export const TEXT_SIZES = ['caption', 'small', 'body', 'prose', 'heading', 'title'] as const;
export const TEXT_TONES = ['primary', 'secondary', 'tertiary', 'success', 'warning', 'danger'] as const;
export const TEXT_ELEMENTS = ['p', 'span', 'h1', 'h2', 'h3', 'h4'] as const;

export const textMeta = {
  name: 'Text',
  variants: { size: TEXT_SIZES, tone: TEXT_TONES, as: TEXT_ELEMENTS, strong: ['true', 'false'] },
  accessibility: [
    'Pick `as` for the document outline (h1 to h4), never for the look: the look is `size`.',
    'Every tone passes WCAG AA on canvas, surface and raised in the three themes.',
  ],
  replaces: ['dossier-title', 'ready-title', 'prd-timeline-title'],
  example: '<Text as="p" size="prose">The spec, as the PRD says it.</Text>',
} satisfies ComponentMeta;
