import type { ComponentMeta } from './meta.ts';

export const BADGE_TONES = ['neutral', 'accent', 'success', 'warning', 'danger', 'info'] as const;

export const badgeMeta = {
  name: 'Badge',
  variants: { tone: BADGE_TONES },
  usage: 'A short label for the state of a thing, or a count beside it: Draft, Approved, 3 open.',
  do: ['Say the state in one or two words.', 'Pick the tone from what the state means: success for done, danger for broken.'],
  dont: ['Make it a button or a link: it takes no action.', 'Use the signal colour: the signal belongs to one thing per view.'],
  contrast: {
    'tone=neutral': [{ text: 'text-secondary', on: 'sunken' }],
    'tone=accent': [{ text: 'accent', on: 'accent-soft' }],
    'tone=success': [{ text: 'success', on: 'sunken' }],
    'tone=warning': [{ text: 'warning', on: 'sunken' }],
    'tone=danger': [{ text: 'danger', on: 'sunken' }],
    'tone=info': [{ text: 'info', on: 'sunken' }],
  },
  accessibility: [
    'Its text says the state: colour is never the only signal.',
    'A plain span: it is read in place, and takes no focus.',
  ],
  replaces: ['stage-badge', 'fix-badge', 'care-chip'],
  example: '<Badge tone="success">Approved</Badge>',
} satisfies ComponentMeta;
