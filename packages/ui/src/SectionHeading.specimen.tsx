import { SectionHeading } from './SectionHeading.tsx';
import { SECTION_HEADING_LEVELS } from './SectionHeading.meta.ts';
import { one } from './meta.ts';
import type { Specimen } from './meta.ts';

/** A SectionHeading at each level, with a count and a link. */
export const sectionHeadingSpecimen: Specimen = (_prop, value) => (
  <SectionHeading level={one(SECTION_HEADING_LEVELS, value)} count="3/7" link={{ label: 'Open the question', href: '#question' }}>
    Questions
  </SectionHeading>
);
