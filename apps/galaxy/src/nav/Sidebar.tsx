'use client';
import { logoSvg } from '@omni/design';
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
// /app, the workspace's name under it, then the Work group and the Omni group (src/nav/sidebar.ts).
// The item the page falls under carries aria-current="page"; Questions and Shared with me carry how
// many questions wait there, and PRDs how many outbox items, live from the waiting provider (PRD 499);
// Docs and Release notes say they leave the app.
// Below 900 px it is the phone drawer: hidden until the top bar's ☰ opens it over the page, a scrim
// behind it. Escape, a tap on the scrim or choosing an item closes it (src/nav/drawer-context.tsx).

const CREST = logoSvg('mark', { scale: 2, title: null });

function Item({ item, current, counts, choose }: { item: SidebarItem; current: SidebarId | null; counts: WaitingCounts; choose: () => void }) {
  const waiting = badgeOf(item.id, counts);
  const label = item.leavesApp ? `${item.label} (leaves the app)` : waiting !== null ? `${item.label}: ${waiting} waiting` : undefined;
  return (
    <li>
      <a className="app-sidebar-item" href={item.path} aria-label={label} aria-current={item.id === current ? 'page' : undefined} onClick={choose}>
        {item.label}
        {waiting !== null && <span className="app-sidebar-badge" aria-hidden="true">{waiting}</span>}
        {item.leavesApp && <span className="app-sidebar-out" aria-hidden="true">↗</span>}
      </a>
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
          <a className="app-sidebar-crest" href={APP_HOME} onClick={choose}>
            <span className="app-sidebar-logo" aria-hidden="true" dangerouslySetInnerHTML={{ __html: CREST }} />
            <span className="ask-mark">OMNI LOOP</span>
          </a>
          {viewer.workspaceName && <p className="app-sidebar-workspace">{viewer.workspaceName}</p>}
        </div>
        <nav className="app-sidebar-nav" aria-label="Sections">
          {SIDEBAR.map((group) => (
            <div key={group.id} className="app-sidebar-group">
              <p className="app-sidebar-label" id={`app-sidebar-${group.id}`}>{group.label}</p>
              <ul className="app-sidebar-items" aria-labelledby={`app-sidebar-${group.id}`}>
                {group.items.map((item) => <Item key={item.id} item={item} current={current} counts={counts} choose={choose} />)}
              </ul>
            </div>
          ))}
        </nav>
      </aside>
    </>
  );
}
