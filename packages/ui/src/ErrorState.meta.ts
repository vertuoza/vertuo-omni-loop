import { onSurfaces } from './meta.ts';
import type { ComponentMeta } from './meta.ts';

export const ERROR_STATE_SIZES = ['page', 'inline'] as const;

export const errorStateMeta = {
  name: 'ErrorState',
  variants: { size: ERROR_STATE_SIZES },
  usage: 'What a section says when what it shows could not be loaded or done: what failed, in plain words, and the one thing to try.',
  do: ['Say what failed and what it means for the person, then offer one action (try again, go back).', 'Keep the cause in plain words; leave stack traces and codes to the logs.'],
  dont: ['Offer two or three actions: pick the one that is most likely to work.', 'Say only "Something went wrong".'],
  contrast: {
    base: [...onSurfaces('text-primary'), ...onSurfaces('text-secondary'), ...onSurfaces('danger', { edge: true })],
  },
  accessibility: [
    'It is role="alert": a screen reader announces what failed when it appears.',
    'The title is a paragraph, not a heading: a failed section keeps the page outline of a working one.',
    'The failure shows as a strong start edge and the words of the title: never as colour alone.',
    'The action, when given, is the only control inside it.',
  ],
  replaces: ['load-error', 'error-panel'],
  example: '<ErrorState title="The plan did not load" action={<Button onClick={retry}>Try again</Button>}>The server did not answer.</ErrorState>',
} satisfies ComponentMeta;
