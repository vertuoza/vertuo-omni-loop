import type { ReactNode } from 'react';
import { TopBar } from '../../nav/TopBar';

// The header of every /ask page, which app/ask/layout.tsx renders: the app's one top bar (TopBar,
// PRD 346) under the sub-title Claude asks, with the page's own links (the layout's History and For
// me) before its menu, then the theme switch, and Game mode last, at the top right (PRD 238).

export function AskBar({ children }: { children?: ReactNode }) {
  return <TopBar sub="Claude asks" extras={children} />;
}
