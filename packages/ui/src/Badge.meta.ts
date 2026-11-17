import type { ComponentMeta } from './meta.ts';

export const BADGE_TONES = ['neutral', 'accent', 'success', 'warning', 'danger', 'info'] as const;

export const badgeMeta = {
  name: 'Badge',
  variants: { tone: BADGE_TONES },
  accessibility: [
    'Its text says the state: colour is never the only signal.',
    'A plain span: it is read in place, and takes no focus.',
  ],
  replaces: ['stage-badge', 'fix-badge', 'care-chip'],
  example: '<Badge tone="success">Approved</Badge>',
} satisfies ComponentMeta;
