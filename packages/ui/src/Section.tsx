'use client';
import { useId } from 'react';
import type { ReactNode } from 'react';
import './Section.css';
import { Heading } from './Heading.tsx';
import type { SECTION_LEVELS, SECTION_RULES } from './Section.meta.ts';

export type SectionProps = {
  /** The title of the group. */
  title: ReactNode;
  /** The level in the document outline: it never skips one. */
  level?: (typeof SECTION_LEVELS)[number];
  /** A quieter line under the title. */
  description?: ReactNode;
  /** What sits at the end of the header: a Button, a Link. */
  actions?: ReactNode;
  /** A line under the header, or none. */
  rule?: (typeof SECTION_RULES)[number];
  children?: ReactNode;
};

/** A titled group of the page: the one way to group things, where a Card would nest. */
export function Section({ title, level = '2', description, actions, rule = 'true', children }: SectionProps) {
  const id = useId();
  return (
    <section className={`omni-section omni-section--rule-${rule}`} aria-labelledby={id}>
      <header className="omni-section__header">
        <div className="omni-section__heading">
          <span id={id}>
            <Heading level={level} size={level === '2' ? 'section' : 'subsection'}>
              {title}
            </Heading>
          </span>
          {description === undefined ? null : <p className="omni-section__description">{description}</p>}
        </div>
        {actions === undefined ? null : <div className="omni-section__actions">{actions}</div>}
      </header>
      <div className="omni-section__body">{children}</div>
    </section>
  );
}
