import type { ComponentMeta } from './meta.ts';

export const STACK_DIRECTIONS = ['column', 'row'] as const;
export const STACK_GAPS = ['1', '2', '3', '4', '5', '6'] as const;
export const STACK_ALIGNS = ['start', 'center', 'end', 'stretch'] as const;

export const stackMeta = {
  name: 'Stack',
  variants: { direction: STACK_DIRECTIONS, gap: STACK_GAPS, align: STACK_ALIGNS, wrap: ['true', 'false'] },
  usage: 'Lays its children out in a column or a row, a step of the space scale apart: the one way a page spaces things.',
  do: ['Pick the gap from the scale: closer for things that belong together.', 'Nest stacks for a row inside a column.'],
  dont: ['Add margins to the children to space them.', 'Use a row for content that must wrap on a phone, without `wrap`.'],
  contrast: {},
  accessibility: ['A plain div: it adds no role and reads as its children do, in source order.'],
  replaces: ['dossier-actions', 'stage-action-stack', 'outbox-chips'],
  example: '<Stack direction="row" gap="2"><Button>Approve</Button><Badge>Draft</Badge></Stack>',
} satisfies ComponentMeta;
