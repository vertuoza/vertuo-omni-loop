'use client';
import { spritePixels } from '@omni/design';
import { version } from '../../../../package.json';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { MouseEvent } from 'react';
import { pixelSvg } from '../design/pixel-svg';
import { useWaiting } from '../waiting/WaitingProvider';
import type { WaitingCounts } from '../waiting/waiting';
import { BrandLogo } from './BrandLogo';
import { useDrawer } from './drawer-context';
import { setMenu, type MenuState } from './menu-rail';
import { OMNI, SETTINGS, SIDEBAR, badgeOf, currentItem, type SidebarId, type SidebarItem } from './sidebar.ts';
import type { ViewerView } from './viewer-view';
import './sidebar.css';
import './drawer.css';

// The app's sidebar (PRD 438), on /app, /prd, /ask and /knowledge: the crest and OMNI LOOP, linked to
// /app, the workspace's name under it, then the Dashboard and Work groups (PRD 572), and at the foot one
// Settings entry, then Omni's Docs and Release notes (PRD 733; src/nav/sidebar.ts). No entry has nested
// lines: Questions' and Settings' own pages show as tabs on those pages.
// The entry the page falls under carries aria-current="page"; Questions carries how many questions
// wait there, shared ones included, and PRDs how many outbox items, live from the waiting provider
// (PRD 499). Each Dashboard and Work section, and Settings, shows its arcade sprite before its name
// (issue 653, PRD 733).
// Docs and Release notes open in a new tab, and say so with the new-tab icon and their name (issue 548).
// They sit at the sidebar's foot, under Settings, in one small row without a label, above the release running
// ("Omni Loop v0.0.54", the root package.json the release workflow stamps; issue 561).
// From 900 px, « in the header folds it to a 56 px rail and » opens it again (PRD 733;
// src/nav/menu-rail.ts): the shell carries data-menu="rail", kept in the omni-menu cookie and drawn
// before the first paint, and sidebar.css draws the rail from it: the crest, each section's sprite,
// named by its title and its spoken name, a dot for a count, and the Settings gear. Both buttons are
// always there, each with the aria-expanded it means; the stylesheet shows the one that applies.
// Below 900 px it is the phone drawer, with neither button: hidden until the top bar's ☰ opens it over the page, a scrim
// behind it. Escape, a tap on the scrim or choosing an item closes it (src/nav/drawer-context.tsx).
// Every entry is a next/link (PRD 657): a click changes the page without a document load, so the
// layout, the waiting polls and the bell's count stay. Docs and Release notes, which open a new tab,
// are not prefetched.

/** A section's sprite (issue 653), at its native 16 px: decoration, its name already says what it is. */
function SectionSprite({ name }: { name?: string }) {
  if (!name) return null;
  return <span className="app-sidebar-sprite" aria-hidden="true" dangerouslySetInnerHTML={{ __html: pixelSvg(spritePixels(name), { scale: 1, title: '' }) }} />;
}

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
      <Link className="app-sidebar-item" href={item.path} title={item.sprite ? item.label : undefined} aria-label={spokenLabel(item, waiting)} aria-current={item.id === current ? 'page' : undefined} {...(item.leavesApp ? LEAVES_APP : {})} onClick={choose}>
        <SectionSprite name={item.sprite} />
        <span className="app-sidebar-text">{item.label}</span>
        {waiting !== null && <span className="app-sidebar-badge" aria-hidden="true">{waiting}</span>}
        {item.leavesApp && <span className="app-sidebar-out" aria-hidden="true">{NEW_TAB}</span>}
      </Link>
    </li>
  );
}

/** « and »: fold the menu to the rail and open it again, on the app shell around the sidebar, then
 * hand the focus to the other button, the one now shown. */
function fold(event: MouseEvent<HTMLButtonElement>, state: MenuState) {
  const sidebar = event.currentTarget.closest('.app-sidebar');
  setMenu(sidebar?.closest('.app-shell') ?? null, document, state);
  sidebar?.querySelector<HTMLButtonElement>(state === 'rail' ? '.app-sidebar-unfold' : '.app-sidebar-fold')?.focus();
}

export function Sidebar({ viewer }: { viewer: ViewerView }) {
  const current = currentItem(usePathname());
  const drawer = useDrawer();
  const { counts } = useWaiting();
  const choose = () => { drawer.send('choose'); };
  return (
    <>
      {drawer.open && <div className="app-drawer-scrim" aria-hidden="true" onClick={() => { drawer.send('scrim'); }} />}
      <aside ref={drawer.panel} className="app-sidebar" id="app-sidebar" aria-label="Sidebar" data-open={drawer.open || undefined}>
        <div className="app-sidebar-head">
          <BrandLogo className="app-sidebar-crest" onClick={choose} />
          <button type="button" className="app-sidebar-fold" title="Collapse the menu" aria-label="Collapse the menu" aria-expanded="true" aria-controls="app-sidebar" onClick={(event) => { fold(event, 'rail'); }}>«</button>
          <button type="button" className="app-sidebar-unfold" title="Expand the menu" aria-label="Expand the menu" aria-expanded="false" aria-controls="app-sidebar" onClick={(event) => { fold(event, 'open'); }}>»</button>
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
        <div className="app-sidebar-foot">
          <ul className="app-sidebar-items">
            <Item item={SETTINGS} current={current} counts={counts} choose={choose} />
          </ul>
          <ul className="app-sidebar-links" aria-label="Omni">
            {OMNI.map((item) => <Item key={item.id} item={item} current={current} counts={counts} choose={choose} />)}
          </ul>
          <p className="app-sidebar-version">Omni Loop v{version}</p>
        </div>
      </aside>
    </>
  );
}
