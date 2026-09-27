import type { ReactNode } from 'react';
import { GameModeButton } from '../../switch/GameModeButton';
import { APP_HOME } from '../../switch/switch';
import { ThemeSwitch } from '../theme-switch';

// The header of every /ask page, which app/ask/layout.tsx renders: the OMNI LOOP mark, a link to the
// app's home, and the sub-title; then the page's own links (the layout's History and For me), the
// theme switch, and Game mode last, at the top right (PRD 238).

export function AskBar({ children }: { children?: ReactNode }) {
  return (
    <header className="ask-bar">
      <span className="ask-brand">
        <a className="ask-mark" href={APP_HOME}>OMNI LOOP</a>
        <span className="ask-brand-sub">Claude asks</span>
      </span>
      <span className="ask-bar-end">
        {children}
        <ThemeSwitch />
        <GameModeButton />
      </span>
    </header>
  );
}
