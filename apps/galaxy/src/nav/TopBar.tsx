import { ThemeSwitch } from '../ask/theme-switch';
import { GameModeButton } from '../switch/GameModeButton';
import { APP_HOME } from '../switch/switch';
import { MENU, type MenuId } from './menu';
import './nav.css';

// The public bar (PRD 346, reshaped by PRD 438), on /docs and /releases only: the app's pages sit in
// the app shell (AppShell) instead. It reads, in order: the OMNI LOOP mark linking to /app, the
// page's sub-title, the menu of Omni's own pages, Open the app → to /app, then the theme switch, and
// Game mode last, at the top right (PRD 238). Open the app → is shown to everyone, so these pages
// never read the session and stay static; a signed-out visitor lands on /app's sign-in card. The
// item of the page being shown carries aria-current="page".

export type TopBarProps = {
  /** The page's sub-title, beside the wordmark. */
  sub: string;
  /** The menu item of the page being shown, when it is one. */
  current?: MenuId;
};

export function TopBar({ sub, current }: TopBarProps) {
  return (
    <header className="ask-bar top-bar">
      <span className="ask-brand">
        <a className="ask-mark" href={APP_HOME}>OMNI LOOP</a>
        <span className="ask-brand-sub">{sub}</span>
      </span>
      <span className="ask-bar-end top-bar-end">
        <nav className="top-bar-menu" aria-label="Menu">
          {MENU.map((item) => (
            <a key={item.id} className="top-bar-item" href={item.path} aria-current={item.id === current ? 'page' : undefined}>
              {item.label}
            </a>
          ))}
        </nav>
        <a className="top-bar-open" href={APP_HOME}>Open the app →</a>
        <ThemeSwitch />
        <GameModeButton />
      </span>
    </header>
  );
}
