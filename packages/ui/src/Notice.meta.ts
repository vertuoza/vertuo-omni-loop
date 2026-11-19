import type { ComponentMeta } from './meta.ts';

export const NOTICE_TONES = ['info', 'success', 'warning', 'danger'] as const;

export const noticeMeta = {
  name: 'Notice',
  variants: { tone: NOTICE_TONES },
  usage: 'A message the page owes the reader: what happened, or what is needed from them.',
  do: ['Say what happened and what to do next.', 'Use danger for what is broken, warning for what waits on the reader.'],
  dont: ['Stack several notices in one place: merge them.', 'Use a notice for help text that is always true.'],
  contrast: {
    base: [{ text: 'text-primary', on: 'sunken' }, { text: 'text-secondary', on: 'sunken' }],
    'tone=info': [{ text: 'info', on: 'sunken', edge: true }],
    'tone=success': [{ text: 'success', on: 'sunken', edge: true }],
    'tone=warning': [{ text: 'warning', on: 'sunken', edge: true }],
    'tone=danger': [{ text: 'danger', on: 'sunken', edge: true }],
  },
  accessibility: [
    'A danger or warning notice is role="alert"; info and success are role="status".',
    'The tone shows as a strong start edge and the title: never as colour alone.',
  ],
  replaces: ['outbox-note', 'proof-note', 'ready-note'],
  example: '<Notice tone="warning" title="Waiting for a person">Two questions are open.</Notice>',
} satisfies ComponentMeta;
