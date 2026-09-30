'use client';
import { menuScript } from './menu-rail';

// The menu's rail script (PRD 733) as a child of the app shell, right after the theme's. A client
// component on purpose, as ThemeScript is: rendered on the server it is a script the browser runs
// while parsing, before the first paint; rendered in the browser (a soft navigation, a not-found
// boundary) it is inert text, and the shell keeps the mark it already carries.
export function MenuRailScript() {
  return (
    <script
      type={typeof window === 'undefined' ? 'text/javascript' : 'text/plain'}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: menuScript }}
    />
  );
}
