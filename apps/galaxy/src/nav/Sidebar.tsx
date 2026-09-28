'use client';
import { logoSvg } from '@omni/design';
import { usePathname } from 'next/navigation';
import { APP_HOME } from '../switch/switch';
import { SIDEBAR, currentItem, type SidebarId, type SidebarItem } from './sidebar.ts';
import type { ViewerView } from './viewer-view';
import './sidebar.css';

// The app's sidebar (PRD 438), on /app, /prd, /ask and /knowledge: the crest and OMNI LOOP, linked to
// /app, the workspace's name under it, then the Work group and the Omni group (src/nav/sidebar.ts).
// The item the page falls under carries aria-current="page"; For me carries how many questions wait
// there; Docs and Release notes say they leave the app.

const CREST = logoSvg('mark', { scale: 2, title: null });

function Item({ item, current, forMe }: { item: SidebarItem; current: SidebarId | null; forMe: number | null }) {
  const waiting = item.id === 'for-me' && forMe !== null && forMe > 0 ? forMe : null;
  const label = item.leavesApp ? `${item.label} (leaves the app)` : waiting !== null ? `${item.label}: ${waiting} waiting` : undefined;
  return (
    <li>
      <a className="app-sidebar-item" href={item.path} aria-label={label} aria-current={item.id === current ? 'page' : undefined}>
        {item.label}
        {waiting !== null && <span className="app-sidebar-badge" aria-hidden="true">{waiting}</span>}
        {item.leavesApp && <span className="app-sidebar-out" aria-hidden="true">↗</span>}
      </a>
      {item.children && (
        <ul className="app-sidebar-children">
          {item.children.map((child) => <Item key={child.id} item={child} current={current} forMe={forMe} />)}
        </ul>
      )}
    </li>
  );
}

export function Sidebar({ viewer }: { viewer: ViewerView }) {
  const current = currentItem(usePathname());
  return (
    <aside className="app-sidebar" aria-label="Sidebar">
      <div className="app-sidebar-head">
        <a className="app-sidebar-crest" href={APP_HOME}>
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
              {group.items.map((item) => <Item key={item.id} item={item} current={current} forMe={viewer.forMe} />)}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
}
