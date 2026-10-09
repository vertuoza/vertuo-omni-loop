// A voter back from GitHub (PRD 1246, s3), at the galaxy's callback with `next=ideas`: GitHub's code
// becomes the session cookie, the vote pressed while signed out is counted as the voter, and the voter
// lands back on the board the ▲ was pressed on. Nothing else: a voter needs no workspace, so this
// sign-in joins none, links no player and never goes on to /signup.
//
// The board comes from the address, so it is allowlisted (boardLanding() in ./vote.ts): anything that
// is not owner/name is refused, back to /play, with nothing exchanged and nothing voted. A refused or
// failed vote still lands on the board, its reason logged on the server only.
import { z } from 'zod';
import { boardLanding } from './vote';
import { VOTE } from './words';

/** What the callback reaches: the exchange of GitHub's code, then the vote, as the new session. */
export interface VoterCallbackPorts {
  exchange(code: string): Promise<{ error: string | null }>;
  vote(ideaId: string): Promise<string | null>;
}

const IdeaId = z.uuid();

const withError = (path: string, reason: string) => `${path}?${new URLSearchParams({ signin_error: reason }).toString()}`;

/** Where the voter goes next, a path on the galaxy. `ports` null: a deployment with no Supabase. */
export async function voterReturn(params: URLSearchParams, ports: VoterCallbackPorts | null): Promise<string> {
  const board = boardLanding(params.get('board'));
  if (!board) return '/play';
  const failure = params.get('error_description') ?? params.get('error');
  if (failure) return withError(board, failure);
  const code = params.get('code');
  if (!code || !ports) return board;
  const { error } = await ports.exchange(code);
  if (error) {
    console.error(`auth callback: ${error}`);
    return withError(board, VOTE.unfinished);
  }
  const idea = IdeaId.safeParse(params.get('vote'));
  if (idea.success) {
    const refused = await ports.vote(idea.data);
    if (refused) console.error(`auth callback: the vote was not counted: ${refused}`);
  }
  return board;
}
