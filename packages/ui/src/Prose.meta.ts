import { onSurfaces } from './meta.ts';
import type { ComponentMeta } from './meta.ts';

export const PROSE_MEASURES = ['reading', 'full'] as const;

export const proseMeta = {
  name: 'Prose',
  variants: { measure: PROSE_MEASURES },
  usage: 'Long text a person reads, a spec or a note: paragraphs, lists and links at a readable size, line length and rhythm.',
  do: ['Wrap the whole text once: it sets the rhythm between its paragraphs and lists.', 'Keep the reading measure for text; use `full` only inside a column that is already narrow.'],
  dont: ['Use it for a label or a single line: use Text.', 'Add spacing to its children: the rhythm is its own.'],
  contrast: { base: onSurfaces('text-primary') },
  accessibility: [
    'It styles the plain elements it holds (p, ul, ol, a, h2 to h4), so the outline and the lists keep their meaning.',
    'A link inside is underlined, never told by colour alone, and shows the focus ring.',
  ],
  replaces: ['spec-body', 'dossier-prose', 'note-text'],
  example: '<Prose><p>The spec, as the PRD says it.</p><ul><li>One</li><li>Two</li></ul></Prose>',
} satisfies ComponentMeta;
