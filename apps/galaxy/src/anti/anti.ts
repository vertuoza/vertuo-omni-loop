// The anti-loop mode of the app shell (PRD 2490): the tech team's place, at /anti and /anti/work. The
// URL is the mode: nothing is stored, and every other page is the forward loop.

/** The shell's mode: the forward loop (the default) or the anti-loop. */
export type ShellMode = 'omni' | 'anti';

/** The anti-loop's home: Anti-dashboard. */
export const ANTI_HOME = '/anti';

/** The two placeholder pages: a title and two short lines, and nothing else. */
export const ANTI_PAGES = {
  dashboard: { title: 'Anti-dashboard', lines: ['Harness, architecture and retros, at a glance.', 'Not open yet.'] },
  work: { title: 'Anti-work', lines: ['The tech team\'s harness, architecture and retros.', 'Not open yet.'] },
} as const;
