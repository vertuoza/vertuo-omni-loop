import { onSurfaces } from './meta.ts';
import type { ComponentMeta } from './meta.ts';

export const PROGRESS_TONES = ['accent', 'success', 'warning', 'danger'] as const;

export const progressMeta = {
  name: 'Progress',
  variants: { tone: PROGRESS_TONES },
  usage: 'How far a task, an upload or a budget has got, as a bar with its percentage in words.',
  do: ['Give it a label that says what is progressing.', 'Pick the tone from what the value means: warning when a budget runs low.'],
  dont: ['Use it for a task of unknown length: say what is happening in text.', 'Rely on the bar alone: the percentage beside it says the same in words.'],
  contrast: {
    base: [...onSurfaces('text-primary'), { text: 'text-secondary', on: 'canvas' }],
    'tone=accent': [{ text: 'accent', on: 'sunken', edge: true }],
    'tone=success': [{ text: 'success', on: 'sunken', edge: true }],
    'tone=warning': [{ text: 'warning', on: 'sunken', edge: true }],
    'tone=danger': [{ text: 'danger', on: 'sunken', edge: true }],
  },
  accessibility: [
    'A native progress element: a screen reader announces its label and value.',
    'The percentage is also written beside the bar, so colour and length are never the only signal.',
  ],
  replaces: ['progress-bar', 'budget-bar'],
  example: '<Progress label="Tokens used" value={40} />',
} satisfies ComponentMeta;
