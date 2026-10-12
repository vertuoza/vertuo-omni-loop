// The words of /ideas/<owner>/<repo> (PRD 1246, s1), in one place. English, whatever the server's locale.
import type { PrdNumber } from 'vertuo-omni-plan/kit/lib/ids.ts';
import type { Lane } from './model';

export const IDEAS = {
  /** Beside the OMNI LOOP mark in the app bar. */
  sub: 'Ideas',
  /** A board's title, in the browser's tab, search results and link previews. */
  title: (fullName: string) => `Ideas for ${fullName} · Omni Loop`,
  /** A board's description, for search engines and link previews. */
  description: (fullName: string) =>
    `What ${fullName} plans to build Now, Next and Later. Sign in with GitHub to vote for the ideas that matter to you.`,
  heading: (fullName: string) => `Ideas for ${fullName}`,
  line: 'What is planned Now, Next and Later. Votes sort the ideas inside a lane, most votes first.',
  /** Shown to a member on their workspace's board while it is private. */
  private: 'This board is private: only members of the workspace see it.',
  lanes: { now: 'Now', next: 'Next', later: 'Later' } satisfies Record<Lane, string>,
  /** A lane with no idea in it. */
  emptyLane: 'Nothing here yet.',
  /** A private board and a missing one: the same words, so the page never tells them apart. */
  none: {
    title: 'No public board here · Omni Loop',
    heading: 'No public board here',
    line: 'This address has no public ideas board.',
  },
  /** Closed, or a read that failed: no error detail, ever. */
  unavailable: 'The ideas board is unavailable right now.',
  prd: (prd: PrdNumber) => `In PRD #${prd}`,
  votes: (n: number) => `${n} ${n === 1 ? 'vote' : 'votes'}`,
} as const;

/** The GitHub issue of a PRD, in the board's repository. */
export const prdIssueUrl = (fullName: string, prd: PrdNumber) => `https://github.com/${fullName}/issues/${prd}`;
