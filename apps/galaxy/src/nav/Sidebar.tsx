'use client';
import { logoSvg } from '@omni/design';
import { version } from '../../../../package.json';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { APP_HOME } from '../switch/switch';
import { useWaiting } from '../waiting/WaitingProvider';
import type { WaitingCounts } from '../waiting/waiting';
import { useDrawer } from './drawer-context';
import { SIDEBAR, badgeOf, currentItem, type SidebarId, type SidebarItem } from './sidebar.ts';
import type { ViewerView } from './viewer-view';
import './sidebar.css';
import './drawer.css';

// The app's sidebar (PRD 438), on /app, /prd, /ask and /knowledge: the crest and OMNI LOOP, linked to
// /app, the workspace's name under it, then the Dashboard, Work and Settings groups (PRD 572) and the
// Omni group (src/nav/sidebar.ts).
// The item the page falls under carries aria-current="page"; Questions and Shared with me carry how
// many questions wait there, and PRDs how many outbox items, live from the waiting provider (PRD 499);
// Docs and Release notes open in a new tab, and say so with the new-tab icon and their name (issue 548).
// They sit at the sidebar's foot, in one small row without a label, above the release running
// ("Omni Loop v0.0.54", the root package.json the release workflow stamps; issue 561).
// Below 900 px it is the phone drawer: hidden until the top bar's ☰ opens it over the page, a scrim
// behind it. Escape, a tap on the scrim or choosing an item closes it (src/nav/drawer-context.tsx).
// Every entry is a next/link (PRD 657): a click changes the page without a document load, so the
// layout, the waiting polls and the bell's count stay. Docs and Release notes, which open a new tab,
// are not prefetched.

const CREST = logoSvg('mark', { scale: 2, title: null });
const OMNI = SIDEBAR.find((group) => group.id === 'omni')?.items ?? [];

/** A box with an arrow leaving it: the item opens in a new tab. */
const NEW_TAB = (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" focusable="false">
    <path d="M9 2h5v5M14 2 7.5 8.5M12 9.5V13a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h3.5" />
  </svg>
);

/** The spoken name of an item: said to open a new tab, or with its waiting count, or its own label. */
function spokenLabel(item: SidebarItem, waiting: number | null): string | undefined {
  if (item.leavesApp) return `${item.label} (opens in a new tab)`;
  return waiting !== null ? `${item.label}: ${waiting} waiting` : undefined;
}

/** An item that leaves the app opens in a new tab and is never prefetched. */
const LEAVES_APP = { target: '_blank', rel: 'noopener', prefetch: false } as const;

function Item({ item, current, counts, choose }: { item: SidebarItem; current: SidebarId | null; counts: WaitingCounts; choose: () => void }) {
  const waiting = badgeOf(item.id, counts);
  return (
    <li>
      <Link className="app-sidebar-item" href={item.path} aria-label={spokenLabel(item, waiting)} aria-current={item.id === current ? 'page' : undefined} {...(item.leavesApp ? LEAVES_APP : {})} onClick={choose}>
        {item.label}
        {waiting !== null && <span className="app-sidebar-badge" aria-hidden="true">{waiting}</span>}
        {item.leavesApp && <span className="app-sidebar-out" aria-hidden="true">{NEW_TAB}</span>}
      </Link>
      {item.children && (
        <ul className="app-sidebar-children">
          {item.children.map((child) => <Item key={child.id} item={child} current={current} counts={counts} choose={choose} />)}
        </ul>
      )}
    </li>
  );
}

export function Sidebar({ viewer }: { viewer: ViewerView }) {
  const current = currentItem(usePathname());
  const drawer = useDrawer();
  const { counts } = useWaiting();
  const choose = () => drawer.send('choose');
  return (
    <>
      {drawer.open && <div className="app-drawer-scrim" aria-hidden="true" onClick={() => drawer.send('scrim')} />}
      <aside ref={drawer.panel} className="app-sidebar" id="app-sidebar" aria-label="Sidebar" data-open={drawer.open || undefined}>
        <div className="app-sidebar-head">
          <Link className="app-sidebar-crest" href={APP_HOME} onClick={choose}>
            <span className="app-sidebar-logo" aria-hidden="true" dangerouslySetInnerHTML={{ __html: CREST }} />
            <span className="ask-mark">OMNI LOOP</span>
          </Link>
          {viewer.workspaceName && <p className="app-sidebar-workspace">{viewer.workspaceName}</p>}
        </div>
        <nav className="app-sidebar-nav" aria-label="Sections">
          {SIDEBAR.filter((group) => group.id !== 'omni').map((group) => (
            <div key={group.id} className="app-sidebar-group">
              <p className="app-sidebar-label" id={`app-sidebar-${group.id}`}>{group.label}</p>
              <ul className="app-sidebar-items" aria-labelledby={`app-sidebar-${group.id}`}>
                {group.items.map((item) => <Item key={item.id} item={item} current={current} counts={counts} choose={choose} />)}
              </ul>
            </div>
          ))}
        </nav>
        <div className="app-sidebar-foot">
          <ul className="app-sidebar-links" aria-label="Omni">
            {OMNI.map((item) => <Item key={item.id} item={item} current={current} counts={counts} choose={choose} />)}
          </ul>
          <p className="app-sidebar-version">Omni Loop v{version}</p>
        </div>
      </aside>
    </>
  );
}
