import type { ElementType, ReactNode } from 'react';
import './Tabs.css';
import type { TABS_SIZES } from './Tabs.meta.ts';

export type TabItem = {
  id: string;
  label: ReactNode;
  href: string;
  /** A short count beside the label, drawn as a mono pill: `3/7`, `v2`, `5`, `2 open`. */
  count?: string;
  /** The tab waits on the viewer: its count pill turns yellow. Only with a `count`. */
  attention?: boolean;
  /** The tab has nothing yet, and why: it stays in the row, dimmed, not a link, this reason its title. */
  empty?: string;
};

/** What a tab hands the link that draws it: the app's router link takes the same props as an `<a>`. */
type TabLinkAttributes = {
  className: string;
  href: string;
  'aria-current'?: 'page' | undefined;
  children?: ReactNode;
};

export type TabsProps = {
  /** The accessible name of the navigation. */
  label: string;
  items: readonly TabItem[];
  /** The `id` of the current tab. */
  current: string;
  size?: (typeof TABS_SIZES)[number];
  /** The link each tab is drawn with: the app's router link, so a tab switches without a full page load. A plain `<a>` by default. */
  link?: ElementType<TabLinkAttributes>;
};

/** What a tab says: its label, then its count as a pill when it has one. */
function TabContent({ item }: { item: TabItem }) {
  if (item.count === undefined) return item.label;
  return (
    <>
      {item.label}
      <span className={item.attention === true ? 'omni-tab__count omni-tab__count--attention' : 'omni-tab__count'}>{item.count}</span>
    </>
  );
}

/** One row of links to the sections of one page; the current one is marked for everyone, an empty one stays, dimmed. */
export function Tabs({ label, items, current, size = 'md', link: Link = 'a' }: TabsProps) {
  return (
    <nav className={`omni-tabs omni-tabs--${size}`} aria-label={label}>
      {items.map((item) => {
        const isCurrent = item.id === current;
        // The current tab stays a link even when empty: the reader is on it.
        if (item.empty !== undefined && !isCurrent) {
          return (
            <span key={item.id} className="omni-tab omni-tab--empty" aria-disabled="true" title={item.empty}>
              <TabContent item={item} />
            </span>
          );
        }
        return (
          <Link
            key={item.id}
            className={isCurrent ? 'omni-tab omni-tab--current' : 'omni-tab'}
            href={item.href}
            aria-current={isCurrent ? 'page' : undefined}
          >
            <TabContent item={item} />
          </Link>
        );
      })}
    </nav>
  );
}
