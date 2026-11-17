import type { ComponentMeta } from './meta.ts';

export const EMPTY_STATE_SIZES = ['page', 'inline'] as const;

export const emptyStateMeta = {
  name: 'EmptyState',
  variants: { size: EMPTY_STATE_SIZES },
  accessibility: [
    'The title is a paragraph, not a heading: an empty section keeps the page outline of a full one.',
    'The action, when given, is the only control inside it.',
  ],
  replaces: ['dossier-empty'],
  example: '<EmptyState title="No questions yet">Questions appear once the plan is read.</EmptyState>',
} satisfies ComponentMeta;
