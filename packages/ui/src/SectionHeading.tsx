import type { ReactNode } from 'react';
import './SectionHeading.css';
import type { SECTION_HEADING_LEVELS } from './SectionHeading.meta.ts';

export type SectionHeadingProps = {
  /** `2` is a section of the page, 20 px; `3` is a part inside a section, 16 px. It never skips a level. */
  level?: (typeof SECTION_HEADING_LEVELS)[number];
  /** How many there are, drawn beside the title: `3`, `3/7`. */
  count?: string | number;
  /** One quiet link at the right, such as "Open the question". */
  link?: { label: string; href: string };
  children?: ReactNode;
};

/** The title of a section of the page, with its count and at most one quiet link. */
export function SectionHeading({ level = '2', count, link, children }: SectionHeadingProps) {
  const title = level === '2'
    ? <h2 className="omni-section-heading__title">{children}</h2>
    : <h3 className="omni-section-heading__title">{children}</h3>;
  return (
    <div className={level === '2' ? 'omni-section-heading omni-section-heading--h2' : 'omni-section-heading omni-section-heading--h3'}>
      <div className="omni-section-heading__lead">
        {title}
        {count === undefined ? null : <span className="omni-section-heading__count">{count}</span>}
      </div>
      {link === undefined ? null : <a className="omni-section-heading__link" href={link.href}>{link.label}</a>}
    </div>
  );
}
