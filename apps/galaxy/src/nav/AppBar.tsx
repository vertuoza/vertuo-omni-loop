'use client';
import { logoSvg } from '@omni/design';
import { usePathname } from 'next/navigation';
import { ThemeSwitch } from '../ask/theme-switch';
import { APP_HOME } from '../switch/switch';
import { GameModeButton } from '../switch/GameModeButton';
import { useDrawer } from './drawer-context';
import { pageTitle } from './sidebar.ts';
import { SignInButton, UserMenu } from './UserMenu.tsx';
import type { ViewerView } from './viewer-view';
import './app-bar.css';

// The app's top bar (PRD 438), over the page's content, to the right of the sidebar: where you are
// and how you see it. The page's title on the left (its sidebar item, a nested item's parent first),
// then the theme switch and Game mode, both unchanged (PRD 284, PRD 238), then you: signed in, the
// avatar that opens the user menu; signed out, Sign in with GitHub in its place.
// Below 900 px the sidebar hides: the bar opens with ☰, which opens it as a drawer, and the crest.
// Its first row holds ☰, the crest, the title and you; the theme switch and Game mode wrap to a
// second row (app-bar.css).

const CREST = logoSvg('mark', { scale: 2, title: null });

export function AppBar({ viewer }: { viewer: ViewerView }) {
  const title = pageTitle(usePathname());
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
      <a className="app-bar-crest" href={APP_HOME} aria-label="OMNI LOOP, Home">
        <span aria-hidden="true" dangerouslySetInnerHTML={{ __html: CREST }} />
      </a>
      {title && <p className="app-bar-title">{title}</p>}
      <span className="app-bar-end">
        <span className="app-bar-view">
          <ThemeSwitch />
          <GameModeButton />
        </span>
        <span className="app-bar-you">
          {viewer.signedIn ? <UserMenu viewer={viewer} /> : <SignInButton />}
        </span>
      </span>
    </header>
  );
}
