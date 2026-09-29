import type { BoardRequest } from '../board/load';
import type { Scope } from '../board/tally';

// Home's board (PRD 572): the board with scope *you*, your login's merges and PRD events and your own
// questions, whose People table is your team: every member of your fleet, 0s kept, you marked. A solo
// player (a player row with no fleet) or a member with no player row has no team: their own row, and
// a line that sends them to the Fleet page, where any fleet's board is.

/** The Fleet page, where a solo player finds any fleet's board. */
export const FLEET_PATH = '/app/fleet';

/** Who is looking: their account, their GitHub login in lower case (or none), their fleet (or none). */
export interface HomeViewer { userId: string; login: string | null; team: string | null }

/** Home's scopes, and whether the viewer has no team (their row alone, and the link to Fleet). */
export function homeRequest(viewer: HomeViewer): Pick<BoardRequest, 'scope' | 'people'> & { solo: boolean } {
  const scope: Scope = { kind: 'you', userId: viewer.userId, login: viewer.login };
  return viewer.team
    ? { scope, people: { kind: 'fleet', fleet: viewer.team }, solo: false }
    : { scope, people: scope, solo: true };
}
