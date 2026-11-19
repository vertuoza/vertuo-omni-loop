import { onSurfaces } from './meta.ts';
import type { ComponentMeta } from './meta.ts';

export const APP_SHELL_CURRENTS = ['home', 'prds'] as const;

export const appShellMeta = {
  name: 'AppShell',
  variants: { current: APP_SHELL_CURRENTS },
  usage: 'The frame of an app page: a navigation of 1-bit icons with text labels beside one main region, and a skip link to it.',
  do: ['Give each entry an icon and a word: the icon never stands alone.', 'Mark the page you are on with `current`.'],
  dont: ['Put a second main landmark inside it.', 'Hide the skip link: it shows itself when it takes focus.'],
  contrast: {
    base: [...onSurfaces('text-primary'), ...onSurfaces('text-secondary'), ...onSurfaces('border-strong', { edge: true }), ...onSurfaces('focus-ring', { edge: true })],
  },
  accessibility: [
    'The first tab stop is a skip link; it moves focus to the main region, where the page content starts.',
    'The navigation is a `nav` named by `navLabel`; the current entry carries `aria-current="page"` and a bar, never colour alone.',
    'The icons are decoration: each entry is read by its text label.',
    'With `contained` the main region is a plain block, not a second main landmark, for a preview inside a page that has its own.',
  ],
  replaces: ['page-frame', 'skip-link'],
  example: '<AppShell navigation={[{ id: "home", label: "Home", href: "/", icon: "home" }]} current="home">The page</AppShell>',
} satisfies ComponentMeta;
