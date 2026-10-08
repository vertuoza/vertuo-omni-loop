// The demo board (PRD 1246, s1): what /ideas/vertuoza/vertuo-omni-loop shows in development, with no
// database. The ideas are the spec's own; the votes, ages and the PRD link are fictional. One idea is
// archived, so the demo shows it leaves the board.
import { parsePrd } from 'vertuo-omni-plan/kit/lib/ids.ts';
import type { Board, Idea } from './model';

/** The one repository whose board the demo has; any other address is a board that does not exist. */
export const DEMO_REPO = 'vertuoza/vertuo-omni-loop';

const idea = (n: number, lane: Idea['lane'], title: string, pitch: string, votes: number, day: number, over: Partial<Idea> = {}): Idea => ({
  id: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
  title,
  pitch,
  lane,
  prd: null,
  created_at: `2026-10-${String(day).padStart(2, '0')}T09:00:00+00:00`,
  votes,
  voted: false,
  archived: false,
  ...over,
});

export const DEMO_BOARD: Board = {
  repo: DEMO_REPO,
  public: true,
  member: false,
  ideas: [
    idea(1, 'now', 'A better HUD', 'Improve the session HUD with more useful information.', 12, 1),
    idea(2, 'now', 'Track our own tokens', 'Switch the token tracking from tokenspend to omni-loop, so the loop tracks its own spend.', 7, 2, { prd: parsePrd(1246) }),
    idea(3, 'next', 'Merge with an independent review', 'A setting that lets the AI merge by itself, with an independent code review it cannot skip.', 21, 3),
    idea(4, 'next', 'A calmer approval gate', 'A better UX on the approval gate.', 9, 4),
    idea(5, 'later', 'Call GitHub less', 'A better sync with GitHub, to call the GitHub API less.', 5, 5),
    idea(6, 'later', 'Rework Product, Business and Settings', 'Rework the UX of the Product, Business and Settings pages.', 5, 2),
    idea(7, 'later', 'A better game score', 'A better score for the gamification.', 3, 6),
    idea(8, 'later', 'An idea we dropped', 'Archived: it leaves the board.', 30, 1, { archived: true }),
  ],
};
