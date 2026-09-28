'use client';
import { usePathname } from 'next/navigation';
import { ThemeSwitch } from '../ask/theme-switch';
import { GameModeButton } from '../switch/GameModeButton';
import { pageTitle } from './sidebar.ts';
import type { ViewerView } from './viewer-view';
import './app-bar.css';

// The app's top bar (PRD 438), over the page's content, to the right of the sidebar: where you are
// and how you see it. The page's title on the left (its sidebar item, a nested item's parent first),
// then the theme switch and Game mode, both unchanged (PRD 284, PRD 238). The viewer is the person
// looking, for what ends the bar.

export function AppBar({ viewer: _viewer }: { viewer: ViewerView }) {
  const title = pageTitle(usePathname());
  return (
    <header className="app-bar">
      {title && <p className="app-bar-title">{title}</p>}
      <span className="app-bar-end">
        <ThemeSwitch />
        <GameModeButton />
      </span>
    </header>
  );
}
