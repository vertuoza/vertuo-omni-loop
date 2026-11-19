import { onSurfaces } from './meta.ts';
import type { ComponentMeta } from './meta.ts';

export const TAG_TONES = ['neutral', 'info', 'success', 'warning', 'danger'] as const;

export const tagMeta = {
  name: 'Tag',
  variants: { tone: TAG_TONES },
  usage: 'A label that files a thing under a kind or a topic: backend, docs, security. Unlike a Badge it names what the thing is, not its state.',
  do: ['Keep it to one or two words.', 'Use the same tag text for the same topic everywhere.'],
  dont: ['Use it for a state or a count: that is a Badge.', 'Make it a button or a link: it takes no action.'],
  contrast: {
    base: onSurfaces('text-primary'),
    'tone=neutral': onSurfaces('border-strong', { edge: true }),
    'tone=info': onSurfaces('info', { edge: true }),
    'tone=success': onSurfaces('success', { edge: true }),
    'tone=warning': onSurfaces('warning', { edge: true }),
    'tone=danger': onSurfaces('danger', { edge: true }),
  },
  accessibility: [
    'Its text names the topic: the border colour is never the only signal.',
    'A plain span: it is read in place, and takes no focus.',
  ],
  replaces: ['tag', 'topic-chip'],
  example: '<Tag>backend</Tag>',
} satisfies ComponentMeta;
