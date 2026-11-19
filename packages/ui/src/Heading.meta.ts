import { onSurfaces } from './meta.ts';
import type { ComponentMeta } from './meta.ts';

export const HEADING_LEVELS = ['1', '2', '3', '4'] as const;
export const HEADING_SIZES = ['page', 'section', 'subsection', 'label'] as const;

export const headingMeta = {
  name: 'Heading',
  variants: { level: HEADING_LEVELS, size: HEADING_SIZES },
  usage: 'A heading of the page outline: the level says where it sits, the size says how it looks.',
  do: ['Use one level 1 per page, then go down one level at a time.', 'Pick the size for the look, apart from the level.'],
  dont: ['Skip a level to get a smaller look: change `size` instead.', 'Use it for a line that is not a title, such as a label: use Text.'],
  contrast: { base: onSurfaces('text-primary') },
  accessibility: [
    'It renders h1 to h4 by `level`, so screen readers list it in the outline.',
    'Its colour passes WCAG AA on canvas, surface, raised and sunken in the three themes.',
  ],
  replaces: ['dossier-heading', 'section-title', 'card-title'],
  example: '<Heading level="2" size="section">Open questions</Heading>',
} satisfies ComponentMeta;
