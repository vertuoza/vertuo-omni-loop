import type { ComponentMeta } from './meta.ts';

export const STACK_DIRECTIONS = ['column', 'row'] as const;
export const STACK_GAPS = ['1', '2', '3', '4', '5', '6'] as const;
export const STACK_ALIGNS = ['start', 'center', 'end', 'stretch'] as const;

export const stackMeta = {
  name: 'Stack',
  variants: { direction: STACK_DIRECTIONS, gap: STACK_GAPS, align: STACK_ALIGNS, wrap: ['true', 'false'] },
  accessibility: ['A plain div: it adds no role and reads as its children do, in source order.'],
  replaces: ['dossier-actions', 'stage-action-stack', 'outbox-chips'],
  example: '<Stack direction="row" gap="2"><Button>Approve</Button><Badge>Draft</Badge></Stack>',
} satisfies ComponentMeta;
