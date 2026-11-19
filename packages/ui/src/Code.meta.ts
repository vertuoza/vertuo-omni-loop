import type { ComponentMeta } from './meta.ts';

export const CODE_DISPLAYS = ['inline', 'block'] as const;

export const codeMeta = {
  name: 'Code',
  variants: { display: CODE_DISPLAYS },
  usage: 'A command, a path, an id or a few lines of code, in the monospace face on a sunken background.',
  do: ['Use inline for a word in a sentence, such as a path or a command.', 'Use block for several lines: it keeps the line breaks and wraps a long one.'],
  dont: ['Use it for emphasis: use Text with `strong`.', 'Put a screenful in it: link to the file instead.'],
  contrast: { base: [{ text: 'text-primary', on: 'sunken' }] },
  accessibility: [
    'A code element, so a screen reader can tell it from the text around it.',
    'A block wraps its long lines instead of scrolling, so it needs no scrolling by keyboard.',
  ],
  replaces: ['inline-code', 'command-block', 'path-chip'],
  example: '<Code>pnpm test</Code>',
} satisfies ComponentMeta;
