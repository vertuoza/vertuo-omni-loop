import type { ComponentMeta } from './meta.ts';

export const INLINE_GAPS = ['1', '2', '3', '4', '5'] as const;
export const INLINE_ALIGNS = ['start', 'center', 'end', 'baseline'] as const;
export const INLINE_JUSTIFIES = ['start', 'center', 'end', 'between'] as const;

export const inlineMeta = {
  name: 'Inline',
  variants: { gap: INLINE_GAPS, align: INLINE_ALIGNS, justify: INLINE_JUSTIFIES },
  usage: 'Sets small things side by side on a line that wraps when it is full: badges, tags, a row of buttons.',
  do: ['Pick the gap from the space scale.', 'Use it for short items; use Stack for a column or a row that must not wrap.'],
  dont: ['Put wide blocks in it: they wrap one under the other, so use Grid.', 'Add margins to the children to space them.'],
  contrast: {},
  accessibility: ['A plain div: it adds no role and the children read in source order, as they are drawn.'],
  replaces: ['chip-row', 'inline-actions', 'meta-line'],
  example: '<Inline gap="2"><Badge>Draft</Badge><Badge tone="success">Approved</Badge></Inline>',
} satisfies ComponentMeta;
