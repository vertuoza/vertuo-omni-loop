import type { ElementType, ReactNode } from 'react';
import './Tabs.css';
import type { TABS_SIZES } from './Tabs.meta.ts';

export type TabItem = {
  id: string;
  label: ReactNode;
  href: string;
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

/** A row of links to the sections of one page; the current one is marked for everyone. */
export function Tabs({ label, items, current, size = 'md', link: Link = 'a' }: TabsProps) {
  return (
    <nav className={`omni-tabs omni-tabs--${size}`} aria-label={label}>
      {items.map((item) => (
        <Link
          key={item.id}
          className={item.id === current ? 'omni-tab omni-tab--current' : 'omni-tab'}
          href={item.href}
          aria-current={item.id === current ? 'page' : undefined}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
