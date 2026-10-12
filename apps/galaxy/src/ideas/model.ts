// A repository's ideas board (PRD 1246, s1), as public.ideas_board() answers it: the board's
// repository, whether it is public, whether the reader is a member of its workspace, and its ideas,
// each with its vote count, whether the reader voted for it and whether it is archived. Null when the
// board is private or there is no such repository: the page answers both the same. The answer is
// parsed where it comes in (src/data/parse-rows.ts), then split into its three lanes here.
import { z } from 'zod';
import { PrdNumberSchema } from 'vertuo-omni-plan/kit/lib/ids.ts';

/** The three lanes, in the board's order: Now, Next, Later. A member sets an idea's lane. */
export const LANES = ['now', 'next', 'later'] as const;
export type Lane = (typeof LANES)[number];

export const IdeaRow = z.strictObject({
  id: z.uuid(),
  title: z.string(),
  pitch: z.string(),
  lane: z.enum(LANES),
  prd: PrdNumberSchema.nullable(),
  created_at: z.string(),
  votes: z.number().int().nonnegative(),
  voted: z.boolean(),
  archived: z.boolean(),
});
export type Idea = z.infer<typeof IdeaRow>;

export const Board = z.strictObject({
  repo: z.string(),
  public: z.boolean(),
  member: z.boolean(),
  ideas: z.array(IdeaRow),
});
export type Board = z.infer<typeof Board>;

/** What ideas_board() answers: a board, or null for a private or missing one. */
export const BoardAnswer = Board.nullable();

/** One lane of the board, its ideas in the order a reader sees them. */
export type LaneView = { lane: Lane; ideas: Idea[] };

/** Most votes first, then the oldest first; the id settles a tie of both, so the order never moves. */
function byVotesThenAge(a: Idea, b: Idea): number {
  return b.votes - a.votes || Date.parse(a.created_at) - Date.parse(b.created_at) || a.id.localeCompare(b.id);
}

/** The board's three lanes, Now, Next then Later, each sorted by votes then by age, with no archived idea. */
export function lanesOf(ideas: readonly Idea[]): LaneView[] {
  const shown = ideas.filter((idea) => !idea.archived);
  return LANES.map((lane) => ({ lane, ideas: shown.filter((idea) => idea.lane === lane).sort(byVotesThenAge) }));
}

/** The path of a repository's board: /ideas/<owner>/<repo>. */
export const boardPath = (fullName: string) => `/ideas/${fullName}`;

/** owner/name as public.repositories keeps it, read from the route, or null when GitHub would name no such repository. */
export function fullNameOf(owner: string, repo: string): string | null {
  const name = `${owner}/${repo}`.toLowerCase();
  return /^[a-z0-9-]{1,39}\/[a-z0-9._-]{1,100}$/.test(name) ? name : null;
}
