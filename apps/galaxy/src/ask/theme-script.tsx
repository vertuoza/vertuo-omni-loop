'use client';
import { themeScript } from './theme';

// The theme script as the ask root's first child. A client component on purpose: rendered on the
// server it is a script the browser runs while parsing, before the first paint; rendered in the
// browser (a soft navigation, a not-found boundary) it is inert text React does not warn about,
// and the theme switch applies the theme instead.
export function ThemeScript() {
  return (
    <script
      type={typeof window === 'undefined' ? 'text/javascript' : 'text/plain'}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: themeScript }}
    />
  );
}
