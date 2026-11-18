import { Section } from './Section.tsx';
import { SECTION_LEVELS, SECTION_RULES } from './Section.meta.ts';
import { one } from './meta.ts';
import type { Specimen } from './meta.ts';

/** A Section at each level, with and without its rule. */
export const sectionSpecimen: Specimen = (prop, value) => (
  <Section
    title="Open questions"
    description="Answer these before the PRD ships."
    {...(prop === 'level' ? { level: one(SECTION_LEVELS, value) } : {})}
    {...(prop === 'rule' ? { rule: one(SECTION_RULES, value) } : {})}
  >
    Nothing open.
  </Section>
);
