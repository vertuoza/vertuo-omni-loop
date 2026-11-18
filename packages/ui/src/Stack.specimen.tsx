import { Badge } from './Badge.tsx';
import { Stack } from './Stack.tsx';
import { STACK_ALIGNS, STACK_DIRECTIONS, STACK_GAPS } from './Stack.meta.ts';
import { one } from './meta.ts';
import type { Specimen } from './meta.ts';

/** A Stack in each direction, gap and alignment, wrapping and not. */
export const stackSpecimen: Specimen = (prop, value) => (
  <Stack
    {...(prop === 'direction' ? { direction: one(STACK_DIRECTIONS, value) } : {})}
    {...(prop === 'gap' ? { gap: one(STACK_GAPS, value) } : {})}
    {...(prop === 'align' ? { align: one(STACK_ALIGNS, value) } : {})}
    wrap={prop === 'wrap' && value === 'true'}
  >
    <Badge>One</Badge>
    <Badge>Two</Badge>
    <Badge>Three</Badge>
  </Stack>
);
