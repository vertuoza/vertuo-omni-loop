import type { ReactNode } from 'react';
import './DataList.css';
import type { DATA_LIST_DENSITIES, DATA_LIST_LAYOUTS } from './DataList.meta.ts';

export type DataListItem = {
  id: string;
  /** What the value is: a name. */
  term: ReactNode;
  /** The value. */
  detail: ReactNode;
};

export type DataListProps = {
  items: readonly DataListItem[];
  /** `stacked` puts each term over its detail; `inline` puts them side by side. */
  layout?: (typeof DATA_LIST_LAYOUTS)[number];
  density?: (typeof DATA_LIST_DENSITIES)[number];
};

/** Names and their values: the facts of one thing, such as a PRD's owner, state and date. */
export function DataList({ items, layout = 'stacked', density = 'normal' }: DataListProps) {
  return (
    <dl className={`omni-data-list omni-data-list--${layout} omni-data-list--${density}`}>
      {items.map((item) => (
        <div key={item.id} className="omni-data-list__item">
          <dt className="omni-data-list__term">{item.term}</dt>
          <dd className="omni-data-list__detail">{item.detail}</dd>
        </div>
      ))}
    </dl>
  );
}
