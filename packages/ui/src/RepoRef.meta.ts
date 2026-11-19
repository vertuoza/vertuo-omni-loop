import { onSurfaces } from './meta.ts';
import type { ComponentMeta } from './meta.ts';

export const REPO_REF_VARIANTS = ['default', 'quiet'] as const;

export const repoRefMeta = {
  name: 'RepoRef',
  variants: { variant: REPO_REF_VARIANTS },
  usage: 'A repository named where it is mentioned: owner and name, as a link to it on GitHub.',
  do: ['Use it every time a repository is named, so a reader can always follow it.', 'Take the quiet variant inside a sentence that is already a link or a heading.'],
  dont: ['Write "owner/name" as plain text where a link exists.', 'Shorten the name: the text is what a screen reader says.'],
  contrast: {
    base: onSurfaces('focus-ring', { edge: true }),
    'variant=default': onSurfaces('text-primary'),
    'variant=quiet': onSurfaces('text-secondary'),
  },
  accessibility: [
    'A native link whose text is "owner/name": one tab stop, one name, no label to add.',
    'It opens GitHub in a new window without handing it the page, unless given an `href` of its own.',
    'Underlined in every variant, never told from text by colour alone.',
  ],
  replaces: ['repo-link', 'repo-chip'],
  example: '<RepoRef owner="vertuoza" name="vertuo-omni-loop" />',
} satisfies ComponentMeta;
