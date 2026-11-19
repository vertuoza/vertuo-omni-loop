import { Badge } from './Badge.tsx';
import { Inline } from './Inline.tsx';
import { INLINE_ALIGNS, INLINE_GAPS, INLINE_JUSTIFIES } from './Inline.meta.ts';
import { one } from './meta.ts';
import type { Specimen } from './meta.ts';

/** An Inline of badges at each gap, alignment and justification. */
export const inlineSpecimen: Specimen = (prop, value) => (
  <Inline
    {...(prop === 'gap' ? { gap: one(INLINE_GAPS, value) } : {})}
    {...(prop === 'align' ? { align: one(INLINE_ALIGNS, value) } : {})}
    {...(prop === 'justify' ? { justify: one(INLINE_JUSTIFIES, value) } : {})}
  >
    <Badge>One</Badge>
    <Badge tone="accent">Two</Badge>
    <Badge>Three</Badge>
  </Inline>
);
