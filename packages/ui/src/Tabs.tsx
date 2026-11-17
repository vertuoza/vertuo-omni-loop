import type { ReactNode } from 'react';
import './Tabs.css';
import type { TABS_SIZES } from './Tabs.meta.ts';

export type TabItem = {
  id: string;
  label: ReactNode;
  href: string;
};

export type TabsProps = {
  /** The accessible name of the navigation. */
  label: string;
  items: readonly TabItem[];
  /** The `id` of the current tab. */
  current: string;
  size?: (typeof TABS_SIZES)[number];
};

/** A row of links to the sections of one page; the current one is marked for everyone. */
export function Tabs({ label, items, current, size = 'md' }: TabsProps) {
  return (
    <nav className={`omni-tabs omni-tabs--${size}`} aria-label={label}>
      {items.map((item) => (
        <a
          key={item.id}
          className={item.id === current ? 'omni-tab omni-tab--current' : 'omni-tab'}
          href={item.href}
          aria-current={item.id === current ? 'page' : undefined}
        >
          {item.label}
        </a>
      ))}
    </nav>
  );
}
