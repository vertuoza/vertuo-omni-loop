// The switch between the two sides of Omni Loop (PRD 238): the arcade at `/`, and the app, the
// reading pages at /app, /ask/* and /knowledge. Each side has one home, and every crossing lands on
// it: the app on /app, the game on its menu (SELECT MODE, past the boot and the title: the arcade's
// `#menu` deep link, src/arcade/deep-link.ts). The app's words live here; the arcade's in its own
// files.

/** The app's home: a page of links that reads nothing and needs no sign-in. */
export const APP_HOME = '/app';

/** The game's home: the arcade on SELECT MODE. */
export const GAME_HOME = '/#menu';

/** One of the app's sections, as /app's card for it shows it. */
export interface Section {
  title: string;
  /** The page the card opens, from the site's root. */
  path: string;
  /** What the section holds, in one line. */
  line: string;
}

/** /app's cards, in order. A new section of the app is one entry here. */
export const SECTIONS: readonly Section[] = [
  { title: 'Questions', path: '/ask', line: 'The questions Claude is asking you now' },
  { title: 'For me', path: '/ask/for-me', line: 'Questions a teammate shared with you' },
  { title: 'History', path: '/ask/history', line: 'Every question your workspace was asked' },
  { title: 'Knowledge map', path: '/knowledge', line: 'Principles, rules and invariants, as a map' },
  // Public, unlike the others: anyone reads it, signed in or not (PRD 262).
  { title: 'Release notes', path: '/releases', line: 'What Omni Loop shipped, week by week' },
];

/** /app's own words: the sub-title beside the wordmark, the heading, and its line. */
export const HOME = {
  sub: 'App',
  heading: 'Omni Loop',
  line: 'The loop’s questions and knowledge, as pages. The game is one tap away.',
} as const;

/** The Game mode button, and the dialog it opens before the app is left for the game. */
export const GAME_MODE = {
  label: 'Game mode',
  title: 'Switch to game mode?',
  line: 'The arcade opens on its menu.',
  stay: 'Stay',
  go: 'Switch',
} as const;
