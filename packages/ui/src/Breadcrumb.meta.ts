import { onSurfaces } from './meta.ts';
import type { ComponentMeta } from './meta.ts';

export const BREADCRUMB_DEPTHS = ['2', '4'] as const;

export const breadcrumbMeta = {
  name: 'Breadcrumb',
  variants: { depth: BREADCRUMB_DEPTHS },
  usage: 'The path from the top of the app to the page you are on: each step up is a link, the last is where you are.',
  do: ['Keep each crumb to the page\'s own name.', 'Name the item itself in the last crumb, without a link.', 'Use it in place of a "back" link.'],
  dont: ['Use it as the main navigation.', 'Repeat the page title as a link.'],
  contrast: { base: [...onSurfaces('text-primary'), ...onSurfaces('text-secondary'), ...onSurfaces('focus-ring', { edge: true })] },
  accessibility: [
    'A `nav` named by `label`, holding an ordered list of the steps.',
    'The last crumb is text with `aria-current="page"`, not a link.',
    'The separators are decoration, hidden from a screen reader.',
  ],
  replaces: ['breadcrumb', 'crumbs'],
  example: '<Breadcrumb items={[{ label: "PRDs", href: "/prds" }, { label: "PRD 12" }]} />',
} satisfies ComponentMeta;
