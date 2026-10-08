// A vote on a public ideas board (PRD 1246, s3): what a press of a card's ▲ does, and the way back
// to the board after a voter's sign-in.
//
// - Signed in, a press adds the reader's vote, and a second press takes it back: the count moves by
//   one each time. The database holds one vote per (idea, account) and lets a person add and remove
//   only their own, on a public board (supabase/migrations/20261114090000_ideas.sql).
// - Signed out, a press starts a GitHub sign-in with no `read:org` (a voter needs no workspace) that
//   comes back through the galaxy's callback with `next=ideas`, the board and the idea: the callback
//   counts the vote and lands back on the board (./callback.ts), never on /signup.
// - The demo has no database: a press counts on the page only.
//
// The board a sign-in comes back to is allowlisted: only a board path, /ideas/<owner>/<repo>, read
// through the same rule the board's route reads its address with. Never a path taken as given.
import { boardPath, fullNameOf } from '../model';
import { VOTE } from './words';

/** The callback's `next` for a voter's sign-in. */
export const VOTER_NEXT = 'ideas';

/** What a card shows of its votes: the count, and whether the reader's own vote is in it. */
export type VoteState = { votes: number; voted: boolean };

/** What a press reaches: the browser's session, the reader's own votes and GitHub's sign-in. Each
 * write answers the database's refusal, or null. */
export interface VotePorts {
  origin: string;
  signedIn(): Promise<boolean>;
  add(ideaId: string): Promise<string | null>;
  remove(ideaId: string): Promise<string | null>;
  signIn(redirectTo: string): Promise<string | null>;
}

export type Pressed =
  | { kind: 'counted'; state: VoteState }
  | { kind: 'signing-in' }
  | { kind: 'failed'; problem: string };

/** The callback address a voter's sign-in comes back to, naming the board and the idea to count. */
export function voterCallbackUrl(origin: string, board: string, ideaId: string): string {
  const url = new URL('/auth/callback', origin);
  url.search = new URLSearchParams({ next: VOTER_NEXT, board, vote: ideaId }).toString();
  return url.href;
}

/** The board path a voter lands back on, or null for anything that is not owner/name. */
export function boardLanding(board: string | null): string | null {
  const [owner, repo, ...rest] = (board ?? '').split('/');
  if (owner === undefined || repo === undefined || rest.length) return null;
  const fullName = fullNameOf(owner, repo);
  return fullName && !fullName.split('/').some((part) => /^\.+$/.test(part)) ? boardPath(fullName) : null;
}

/** The line a board shows when a sign-in to vote came back refused, read from its address. */
export function signInProblem(search: string): string | null {
  const reason = new URLSearchParams(search).get('signin_error');
  return reason ? VOTE.signInFailed(reason) : null;
}

const toggled = ({ votes, voted }: VoteState): VoteState => ({ votes: Math.max(0, votes + (voted ? -1 : 1)), voted: !voted });

/** One press of the ▲ of `ideaId` on `board`, from `state`. `ports` null is the demo. */
export async function press(ports: VotePorts | null, board: string, ideaId: string, state: VoteState): Promise<Pressed> {
  if (!ports) return { kind: 'counted', state: toggled(state) };
  if (!(await ports.signedIn())) {
    const failed = await ports.signIn(voterCallbackUrl(ports.origin, board, ideaId));
    return failed ? { kind: 'failed', problem: failed } : { kind: 'signing-in' };
  }
  const refused = await (state.voted ? ports.remove(ideaId) : ports.add(ideaId));
  if (refused) {
    console.error(`ideas: a vote was refused: ${refused}`);
    return { kind: 'failed', problem: VOTE.refused };
  }
  return { kind: 'counted', state: toggled(state) };
}
