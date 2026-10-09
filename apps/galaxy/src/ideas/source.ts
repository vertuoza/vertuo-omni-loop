// What /ideas/<owner>/<repo> shows (PRD 1246, s1), by the build's mode (src/data/mode.ts):
//
// - demo (development, or a build with OMNI_LOOP_DEMO=1): the demo board at its one address, and no
//   board anywhere else; nothing read;
// - closed (a deployed build with no Supabase): the unavailable line;
// - supabase: ideas_board(), read on the server with the public key as whoever reads the page (./store.ts).
//
// A private board and a missing one are the same view, `none`, whoever asks: the page never tells
// which private repositories exist. An address GitHub would name no repository by is `none` too,
// without a read. A failed read is the unavailable line; its reason goes to the server's log only.
import type { ArcadeEnv } from '../env';
import { fullNameOf, lanesOf, type Board, type LaneView } from './model';
import { DEMO_BOARD, DEMO_REPO } from './demo';

export type IdeasView =
  | { kind: 'board'; board: Board; lanes: LaneView[] }
  | { kind: 'none' }
  | { kind: 'unavailable' };

/** Reads one board by owner/name: the board, or null when it is private or missing. */
export type ReadBoard = (fullName: string) => Promise<Board | null>;

const NONE: IdeasView = { kind: 'none' };
const UNAVAILABLE: IdeasView = { kind: 'unavailable' };

const boardView = (board: Board | null): IdeasView => (board ? { kind: 'board', board, lanes: lanesOf(board.ideas) } : NONE);

export async function ideasView(env: Pick<ArcadeEnv, 'mode'>, owner: string, repo: string, read: ReadBoard): Promise<IdeasView> {
  const fullName = fullNameOf(owner, repo);
  if (!fullName) return NONE;
  if (env.mode === 'demo') return boardView(fullName === DEMO_REPO ? DEMO_BOARD : null);
  if (env.mode === 'closed') return UNAVAILABLE;
  try {
    return boardView(await read(fullName));
  } catch (error) {
    console.error('ideas: the board could not be read', error);
    return UNAVAILABLE;
  }
}
