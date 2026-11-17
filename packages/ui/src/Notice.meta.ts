import type { ComponentMeta } from './meta.ts';

export const NOTICE_TONES = ['info', 'success', 'warning', 'danger'] as const;

export const noticeMeta = {
  name: 'Notice',
  variants: { tone: NOTICE_TONES },
  accessibility: [
    'A danger or warning notice is role="alert"; info and success are role="status".',
    'The tone shows as a strong start edge and the title: never as colour alone.',
  ],
  replaces: ['outbox-note', 'proof-note', 'ready-note'],
  example: '<Notice tone="warning" title="Waiting for a person">Two questions are open.</Notice>',
} satisfies ComponentMeta;
