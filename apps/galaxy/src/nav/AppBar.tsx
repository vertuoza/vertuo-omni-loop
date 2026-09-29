'use client';
import { logoSvg, spritePixels } from '@omni/design';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ThemeSwitch } from '../ask/theme-switch';
import { pixelSvg } from '../design/pixel-svg';
import { GameModeButton } from '../switch/GameModeButton';
import { Bell } from './Bell.tsx';
import { useDrawer } from './drawer-context';
import { pageTrail } from './sidebar.ts';
import { SignInButton, UserMenu } from './UserMenu.tsx';
import type { ViewerView } from './viewer-view';
import './app-bar.css';

// The app's top bar (PRD 438), over the page's content, to the right of the sidebar: where you are
// and how you see it. On the left, the sprite of the page's section at 2× in a tile, and the trail to
// the page (issue 704): its group, a nested item's section, then the page, the crumbs above it links
// back (next/link, PRD 657: no document load). Then the theme switch and Game mode, both unchanged
// (PRD 284, PRD 238), then, signed in, the bell that says what waits for you (PRD 499,
// src/nav/Bell.tsx), then you: signed in, the avatar that opens the user menu; signed out, Sign in
// with GitHub in its place. A section without a sprite, and a path under no item, show the OMNI LOOP
// mark in the tile; the crest, linked home, is the sidebar's.
// Below 900 px the sidebar hides: the bar opens with ☰, which opens it as a drawer.
// Its first row holds ☰, the tile, the trail and you; the theme switch, Game mode and the bell wrap
// to a second row (app-bar.css).

const MARK = logoSvg('mark', { scale: 1, title: null });
/** The tile's picture: the section's sprite at 2×, or the mark. Decoration: the trail says the same. */
const tileSvg = (sprite: string | null) => (sprite ? pixelSvg(spritePixels(sprite), { scale: 2, title: '' }) : MARK);

export function AppBar({ viewer }: { viewer: ViewerView }) {
  const trail = pageTrail(usePathname());
  const drawer = useDrawer();
  return (
    <header className="app-bar">
      <button
        ref={drawer.button}
        type="button"
        className="app-bar-menu"
        aria-label="Menu"
        aria-expanded={drawer.open}
        aria-controls="app-sidebar"
        onClick={() => drawer.send('toggle')}
      >
        <span aria-hidden="true">☰</span>
      </button>
      <span className="app-bar-tile" aria-hidden="true" dangerouslySetInnerHTML={{ __html: tileSvg(trail?.sprite ?? null) }} />
      {trail && (
        <nav className="app-bar-trail" aria-label="Breadcrumb">
          <ol>
            {trail.crumbs.map((crumb, i) => (
              <li key={crumb.label} className={i === trail.crumbs.length - 1 ? 'app-bar-here' : undefined}>
                {i > 0 && <span className="app-bar-sep" aria-hidden="true">›</span>}
                {crumb.path ? (
                  <Link className="app-bar-up" href={crumb.path}>{crumb.label}</Link>
                ) : i === trail.crumbs.length - 1 ? (
                  <span aria-current="page">{crumb.label}</span>
                ) : (
                  crumb.label
                )}
              </li>
            ))}
          </ol>
        </nav>
      )}
      <span className="app-bar-end">
        <span className="app-bar-view">
          <ThemeSwitch />
          <GameModeButton />
          {viewer.signedIn && <Bell />}
        </span>
        <span className="app-bar-you">
          {viewer.signedIn ? <UserMenu viewer={viewer} /> : <SignInButton />}
        </span>
      </span>
    </header>
  );
}
