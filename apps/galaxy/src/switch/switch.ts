// The switch between the two sides of Omni Loop (PRD 238): the arcade at `/`, and the app, the
// reading pages at /app, /ask/* and /knowledge. Each side has one home, and every crossing lands on
// it: the app on /app, the game on its menu (SELECT MODE, past the boot and the title: the arcade's
// `#menu` deep link, src/arcade/deep-link.ts). The app's words live here; the arcade's in its own
// files.

/** The app's home: your dashboard (PRD 328). The app's sections are its sidebar (src/nav/sidebar.ts,
 * PRD 438). */
export const APP_HOME = '/app';

/** The game's home: the arcade on SELECT MODE. */
export const GAME_HOME = '/#menu';

/** The Game mode button, and the dialog it opens before the app is left for the game. */
export const GAME_MODE = {
  label: 'Game mode',
  title: 'Switch to game mode?',
  line: 'The arcade opens on its menu.',
  stay: 'Stay',
  go: 'Switch',
} as const;
