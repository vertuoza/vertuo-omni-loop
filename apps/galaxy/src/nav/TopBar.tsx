import type { ReactNode } from 'react';
import { ThemeSwitch } from '../ask/theme-switch';
import { GameModeButton } from '../switch/GameModeButton';
import { APP_HOME } from '../switch/switch';
import { MENU, type MenuId } from './menu';
import './nav.css';

// The one header of the normal app (PRD 346), on /app, /releases, /prd, /ask and /knowledge: the
// OMNI LOOP mark linking to /app, the page's sub-title, then the page's own extras (History and For
// me on /ask, the star chart on /knowledge), the menu, the theme switch, and
// Game mode last, at the top right (PRD 238). The item of the page being shown carries
// aria-current="page". Nothing else differs between bars: a page's classes only let its own
// stylesheet lay its bar out.

export type TopBarProps = {
  /** The page's sub-title, beside the wordmark. */
  sub: string;
  /** The menu item of the page being shown, when it is one. */
  current?: MenuId;
  /** The page's own links, before the menu. */
  extras?: ReactNode;
  /** What follows the sub-title, inside the brand (the repository /knowledge reads). */
  brandExtra?: ReactNode;
  /** A page's own classes on the bar, its brand and its end, added to the shared ones. */
  classes?: { bar?: string; brand?: string; end?: string };
};

const join = (...names: Array<string | undefined>) => names.filter(Boolean).join(' ');

export function TopBar({ sub, current, extras, brandExtra, classes = {} }: TopBarProps) {
  return (
    <header className={join('ask-bar top-bar', classes.bar)}>
      <span className={join('ask-brand', classes.brand)}>
        <a className="ask-mark" href={APP_HOME}>OMNI LOOP</a>
        <span className="ask-brand-sub">{sub}</span>
        {brandExtra}
      </span>
      <span className={join('ask-bar-end top-bar-end', classes.end)}>
        {extras}
        <nav className="top-bar-menu" aria-label="Menu">
          {MENU.map((item) => (
            <a key={item.id} className="top-bar-item" href={item.path} aria-current={item.id === current ? 'page' : undefined}>
              {item.label}
            </a>
          ))}
        </nav>
        <ThemeSwitch />
        <GameModeButton />
      </span>
    </header>
  );
}
