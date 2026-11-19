import { onSurfaces } from './meta.ts';
import type { ComponentMeta } from './meta.ts';

export const EMPTY_STATE_SIZES = ['page', 'inline'] as const;

export const emptyStateMeta = {
  name: 'EmptyState',
  variants: { size: EMPTY_STATE_SIZES },
  usage: 'What a section says while it holds nothing yet: why it is empty, and what fills it.',
  do: ['Say why it is empty and what will fill it.', 'Offer the one action that fills it, when the person has one.'],
  dont: ['Leave a section blank instead.', 'Blame the person: it is empty, not wrong.'],
  contrast: { base: [...onSurfaces('text-primary'), ...onSurfaces('text-secondary')] },
  accessibility: [
    'The title is a paragraph, not a heading: an empty section keeps the page outline of a full one.',
    'The action, when given, is the only control inside it.',
  ],
  replaces: ['dossier-empty'],
  example: '<EmptyState title="No questions yet">Questions appear once the plan is read.</EmptyState>',
} satisfies ComponentMeta;
