import type { ReactNode } from 'react';
import './ListRow.css';
import type { LIST_ROW_CLAMPS, LIST_ROW_DENSITIES } from './ListRow.meta.ts';

export type ListRowProps = {
  title: ReactNode;
  /** A quieter line beside or under the title. */
  detail?: ReactNode;
  /** What sits at the end of the row: a Badge, a date. */
  trailing?: ReactNode;
  /** With an `href` the whole row is one link. */
  href?: string;
  density?: (typeof LIST_ROW_DENSITIES)[number];
  /** The row the viewer is on: a soft signal tint, the title heavier, the detail lifted. Off by default. */
  selected?: boolean;
  /** What sits at the start of the row: a face, an icon. Nothing by default. */
  leading?: ReactNode;
  /** Cuts the title and the detail at this many lines with an ellipsis. Not cut by default. */
  clamp?: (typeof LIST_ROW_CLAMPS)[number];
};

/** One row of a list, at 14 px: a title, a detail, and what belongs at the end. */
export function ListRow({ title, detail, trailing, href, density = 'normal', selected = false, leading, clamp }: ListRowProps) {
  const className = `omni-list-row omni-list-row--${density}${selected ? ' omni-list-row--selected' : ''}`;
  const content = (
    <>
      {leading === undefined ? null : <span className="omni-list-row__leading">{leading}</span>}
      <span className={clamp === undefined ? 'omni-list-row__main' : `omni-list-row__main omni-list-row__main--clamp omni-list-row__main--clamp-${String(clamp)}`}>
        <span className="omni-list-row__title">{title}</span>
        {detail === undefined ? null : <span className="omni-list-row__detail">{detail}</span>}
      </span>
      {trailing === undefined ? null : <span className="omni-list-row__trailing">{trailing}</span>}
    </>
  );
  const current = selected ? ({ 'aria-current': 'true' } as const) : {};
  if (href === undefined) return <div className={className} {...current}>{content}</div>;
  return (
    <a className={`${className} omni-list-row--link`} href={href} {...current}>
      {content}
    </a>
  );
}
