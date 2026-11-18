import { onSurfaces } from './meta.ts';
import type { ComponentMeta } from './meta.ts';

export const OUTBOX_LEVELS = ['low', 'medium', 'high'] as const;

export const outboxItemMeta = {
  name: 'OutboxItem',
  variants: { level: OUTBOX_LEVELS },
  usage: 'One decision an agent took alone, waiting for a person: its question, a line of detail, and its level as a Badge.',
  do: ['Say the question in plain words, as the title.', 'Make the row one link when it opens the item.'],
  dont: ['Show the level by colour alone: the Badge says it in words.', 'Put a second link or a button inside a linked row.'],
  contrast: {
    base: [...onSurfaces('text-primary'), ...onSurfaces('text-secondary'), { text: 'text-primary', on: 'sunken' }, ...onSurfaces('focus-ring', { edge: true })],
    'level=low': [{ text: 'text-secondary', on: 'sunken' }],
    'level=medium': [{ text: 'warning', on: 'sunken' }],
    'level=high': [{ text: 'danger', on: 'sunken' }],
  },
  accessibility: [
    'The level is a Badge with its word ("Low", "Medium", "High"): colour is never the only signal.',
    'With an `href` the whole row is one link: one tab stop, one name.',
  ],
  replaces: ['outbox-row', 'outbox-item'],
  example: '<OutboxItem level="high" title="Keep the old route?" detail="PRD 12 · s4" href="/outbox/1" />',
} satisfies ComponentMeta;
