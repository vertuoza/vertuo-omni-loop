import { onSurfaces } from './meta.ts';
import type { ComponentMeta } from './meta.ts';

export const PERSON_REF_VARIANTS = ['default', 'quiet'] as const;

export const personRefMeta = {
  name: 'PersonRef',
  variants: { variant: PERSON_REF_VARIANTS },
  usage: 'A person named where they are mentioned: their name, as a link to their page.',
  do: ['Use it every time a person is named, so a reader can always follow it.', 'Take the quiet variant inside a sentence that is already a link or a heading.'],
  dont: ['Write a name as plain text where a page exists.', 'Use it for an agent: an agent is never named as a person.'],
  contrast: {
    base: onSurfaces('focus-ring', { edge: true }),
    'variant=default': onSurfaces('text-primary'),
    'variant=quiet': onSurfaces('text-secondary'),
  },
  accessibility: [
    'A native link whose text is the person\'s name: one tab stop, one name, no label to add.',
    'Underlined in every variant, never told from text by colour alone.',
  ],
  replaces: ['person-link', 'author-chip'],
  example: '<PersonRef name="Ada Lovelace" href="/people/ada" />',
} satisfies ComponentMeta;
