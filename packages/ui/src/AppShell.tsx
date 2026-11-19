'use client';

import { useId, useRef } from 'react';
import type { MouseEvent, ReactNode } from 'react';
import type { IconName } from '@omni/design';
import './AppShell.css';
import { Icon } from './Icon.tsx';

export type AppShellEntry = {
  id: string;
  label: string;
  href: string;
  /** The 1-bit icon beside the label. */
  icon: IconName;
};

export type AppShellProps = {
  navigation: readonly AppShellEntry[];
  /** The `id` of the entry of the page you are on. */
  current?: string;
  /** The name of the navigation landmark; unique on a page that holds more than one. */
  navLabel?: string;
  /** What the skip link says. */
  skipLabel?: string;
  /** The main region is a plain block, not a main landmark: for a preview inside a page that has its own. */
  contained?: boolean;
  children?: ReactNode;
};

/** The frame of an app page: a skip link, a navigation of icons with labels, and the main region. */
export function AppShell({ navigation, current, navLabel = 'Primary', skipLabel = 'Skip to main content', contained = false, children }: AppShellProps) {
  const mainId = `${useId()}-main`;
  const main = useRef<HTMLElement | null>(null);
  const skip = (event: MouseEvent<HTMLElement>) => {
    event.preventDefault();
    main.current?.focus();
  };
  return (
    <div className="omni-shell">
      <a className="omni-shell__skip" href={`#${mainId}`} onClick={skip}>{skipLabel}</a>
      <nav className="omni-shell__nav" aria-label={navLabel}>
        <ul className="omni-shell__list">
          {navigation.map((entry) => (
            <li key={entry.id}>
              <a className="omni-shell__link" href={entry.href} {...(entry.id === current ? { 'aria-current': 'page' as const } : {})}>
                <Icon name={entry.icon} />
                <span>{entry.label}</span>
              </a>
            </li>
          ))}
        </ul>
      </nav>
      {contained
        ? <div className="omni-shell__main" id={mainId} tabIndex={-1} ref={(el) => { main.current = el; }}>{children}</div>
        : <main className="omni-shell__main" id={mainId} tabIndex={-1} ref={(el) => { main.current = el; }}>{children}</main>}
    </div>
  );
}
