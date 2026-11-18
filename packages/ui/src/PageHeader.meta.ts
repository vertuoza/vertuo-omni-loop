import { onSurfaces } from './meta.ts';
import type { ComponentMeta } from './meta.ts';

export const PAGE_HEADER_LEVELS = ['1', '2'] as const;

export const pageHeaderMeta = {
  name: 'PageHeader',
  variants: { level: PAGE_HEADER_LEVELS },
  usage: 'The head of a page or of a major section: what it is, where it stands, and the one thing to do next.',
  do: ['Say the state once, in the status slot.', 'Put the view\'s one primary action in the action slot.'],
  dont: ['Use two page headers at level 1 on one page.', 'Fill the lede with what the page itself says below.'],
  contrast: { base: [...onSurfaces('text-primary'), ...onSurfaces('text-secondary'), ...onSurfaces('text-tertiary')] },
  accessibility: [
    'A header element holding the page title as a heading: `level` 1 for a page, 2 for a section.',
    'The action slot is the view\'s one primary action; it follows the title in source order.',
  ],
  replaces: ['dossier-head', 'dossier-head-top', 'dossier-history-head'],
  example: '<PageHeader title="Checkout rewrite" eyebrow="PRD 12" status={<Badge>Building</Badge>} action={<Button variant="primary">Approve</Button>} />',
} satisfies ComponentMeta;
