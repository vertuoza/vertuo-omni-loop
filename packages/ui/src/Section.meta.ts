import { onSurfaces } from './meta.ts';
import type { ComponentMeta } from './meta.ts';

export const SECTION_LEVELS = ['2', '3'] as const;
export const SECTION_RULES = ['true', 'false'] as const;

export const sectionMeta = {
  name: 'Section',
  variants: { level: SECTION_LEVELS, rule: SECTION_RULES },
  usage: 'A titled group of the page, with an optional description and actions: the one way to group things, where a Card would nest.',
  do: ['Group related things under one title, then lay them out with a Stack.', 'Put the group\'s own actions in the header.'],
  dont: ['Put a Card inside a Card to group: use a Section.', 'Skip a heading level to get a smaller look.'],
  contrast: { base: [...onSurfaces('text-primary'), ...onSurfaces('text-secondary')] },
  accessibility: [
    'A section landmark named by its heading (aria-labelledby), so a screen reader lists the groups of a page.',
    'The heading level is set by `level`, so the outline never skips one.',
  ],
  replaces: ['dossier-section', 'section-header'],
  example: '<Section title="Open questions" description="Answer these before the PRD ships."><Text>Nothing open.</Text></Section>',
} satisfies ComponentMeta;
