import type { ComponentMeta } from './meta.ts';

export const PAGE_HEADER_LEVELS = ['1', '2'] as const;

export const pageHeaderMeta = {
  name: 'PageHeader',
  variants: { level: PAGE_HEADER_LEVELS },
  accessibility: [
    'A header element holding the page title as a heading: `level` 1 for a page, 2 for a section.',
    'The action slot is the view\'s one primary action; it follows the title in source order.',
  ],
  replaces: ['dossier-head', 'dossier-head-top', 'dossier-history-head'],
  example: '<PageHeader title="Checkout rewrite" eyebrow="PRD 12" status={<Badge>Building</Badge>} action={<Button variant="primary">Approve</Button>} />',
} satisfies ComponentMeta;
