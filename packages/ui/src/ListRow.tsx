import type { ReactNode } from 'react';
import './ListRow.css';
import type { LIST_ROW_DENSITIES } from './ListRow.meta.ts';

export type ListRowProps = {
  title: ReactNode;
  /** A quieter line beside or under the title. */
  detail?: ReactNode;
  /** What sits at the end of the row: a Badge, a date. */
  trailing?: ReactNode;
  /** With an `href` the whole row is one link. */
  href?: string;
  density?: (typeof LIST_ROW_DENSITIES)[number];
};

/** One row of a list, at 14 px: a title, a detail, and what belongs at the end. */
export function ListRow({ title, detail, trailing, href, density = 'normal' }: ListRowProps) {
  const className = `omni-list-row omni-list-row--${density}`;
  const content = (
    <>
      <span className="omni-list-row__main">
        <span className="omni-list-row__title">{title}</span>
        {detail === undefined ? null : <span className="omni-list-row__detail">{detail}</span>}
      </span>
      {trailing === undefined ? null : <span className="omni-list-row__trailing">{trailing}</span>}
    </>
  );
  if (href === undefined) return <div className={className}>{content}</div>;
  return (
    <a className={`${className} omni-list-row--link`} href={href}>
      {content}
    </a>
  );
}
