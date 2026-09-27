// The words of /releases (PRD 262), in one place: the page's own, the initial release's, the message
// a visitor reads when the releases cannot be shown, and the way a day, a week and its counts are
// written. English, whatever the server's locale: the names are spelled here, never asked of Intl.
import type { Day } from './weeks.ts';

export const RELEASES = {
  /** Beside the OMNI LOOP mark in the app bar. */
  sub: 'Releases',
  /** The page's title, in the browser's tab and in search results. */
  title: 'Release notes · Omni Loop',
  /** For search engines and link previews. */
  description: 'What Omni Loop shipped, week by week: every PRD the loop ships, in plain words, each with its version.',
  heading: 'What’s new in Omni Loop',
  line: 'Every PRD the loop ships, in plain words. Newest first.',
  /** Release 1: every PRD shipped before release notes existed. */
  initial: {
    name: 'Initial release',
    headline: 'From idea to merged PR, on a loop.',
    intro: 'The first public release of Omni Loop gathers everything shipped from 24 to 27 September 2026: the kit and its '
      + 'Claude Code plugin, the omni-loop GitHub App, ask mode and its question history, a knowledge base that fills itself, '
      + 'PRD dossiers, a design system, and the arcade that turns delivery into a game.',
  },
  /** Closed, or a failed read with no good page behind it: no error detail, ever. */
  unavailable: 'Release notes are unavailable right now.',
  /** The table holds no row yet: the sync has not run. */
  empty: 'No release is published yet.',
} as const;

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

/** A release's day: `Sun 27 Sep`. */
export const dayOf = ({ weekday, day, month }: Day) => `${WEEKDAYS[weekday]} ${day} ${MONTHS[month - 1]}`;

/** A week's heading, from its Monday: `Week of 21 Sep 2026`. */
export const weekOf = ({ day, month, year }: Day) => `Week of ${day} ${MONTHS[month - 1]} ${year}`;

/** A day as `<time datetime>` takes it: `2026-09-27`. */
export const isoDateOf = ({ year, month, day }: Day) =>
  `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** A week's counts: `1 release · 21 PRDs`. */
export const countsOf = (releases: number, prds: number) => `${plural(releases, 'release', 'releases')} · ${plural(prds, 'PRD', 'PRDs')}`;

/** A PRD, as plain text: never a link. */
export const prdOf = (prd: number) => `PRD ${prd}`;
