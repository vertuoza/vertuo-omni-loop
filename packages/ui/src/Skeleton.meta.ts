import type { ComponentMeta } from './meta.ts';

export const SKELETON_SHAPES = ['text', 'block', 'circle'] as const;

export const skeletonMeta = {
  name: 'Skeleton',
  variants: { shape: SKELETON_SHAPES },
  usage: 'The grey shape of what is loading, drawn where it will land, so the page does not jump when it arrives.',
  do: ['Match the shape and size of what will replace it: text lines for text, a block for a card, a circle for an avatar.', 'Name what loads in `label`, in words.'],
  dont: ['Use it for more than a moment or two: past that, say what is happening in a Notice.', 'Show a skeleton where nothing will ever load: that is an EmptyState.'],
  contrast: {},
  accessibility: [
    'It is a status named by its label (read by a screen reader as "Loading …"); the grey shape itself is hidden from it.',
    'Its shimmer stops under `prefers-reduced-motion: reduce`: the shape stays, still.',
    'It carries no colour that tells anything: the label does.',
  ],
  replaces: ['loading-bar', 'placeholder-line'],
  example: '<Skeleton shape="text" label="Loading the plan" lines={3} />',
} satisfies ComponentMeta;
