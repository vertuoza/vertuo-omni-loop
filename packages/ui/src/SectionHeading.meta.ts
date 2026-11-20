import { onSurfaces } from './meta.ts';
import type { ComponentMeta } from './meta.ts';

export const SECTION_HEADING_LEVELS = ['2', '3'] as const;

export const sectionHeadingMeta = {
  name: 'SectionHeading',
  variants: { level: SECTION_HEADING_LEVELS },
  usage: 'The title of a section of a page: sentence case, with how many there are beside it and one quiet link at its right.',
  do: ['Use level 2 for a section of the page and level 3 for a part inside a section.', 'Say the count in the count slot, not in the title.'],
  dont: ['Put a button where the link goes: a section has its action in its body.', 'Skip a level to get a smaller look.'],
  contrast: { base: [...onSurfaces('text-primary'), ...onSurfaces('text-secondary')] },
  accessibility: [
    'It renders an h2 or an h3 by `level`, so a screen reader lists each section in the page outline.',
    'The link is a plain link with a visible focus ring.',
  ],
  replaces: ['dossier-section-title', 'section-title'],
  example: '<SectionHeading count="3/7" link={{ label: \'Open the question\', href: \'#q\' }}>Questions</SectionHeading>',
} satisfies ComponentMeta;
