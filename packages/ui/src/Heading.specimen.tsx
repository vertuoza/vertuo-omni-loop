import { Heading } from './Heading.tsx';
import { HEADING_LEVELS, HEADING_SIZES } from './Heading.meta.ts';
import { one } from './meta.ts';
import type { Specimen } from './meta.ts';

/** A Heading at each level and each size. */
export const headingSpecimen: Specimen = (prop, value) => (
  <Heading
    {...(prop === 'level' ? { level: one(HEADING_LEVELS, value) } : {})}
    {...(prop === 'size' ? { size: one(HEADING_SIZES, value) } : {})}
  >
    Open questions
  </Heading>
);
