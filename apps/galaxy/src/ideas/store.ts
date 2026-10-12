// The read behind /ideas/<owner>/<repo> (PRD 1246, s1): public.ideas_board(), as whoever reads the page.
// The function is the database's rule of who reads what: signed out or not, a public board answers with
// its ideas and their counts, and a private or missing one answers null. It never writes. A refusal, or
// an answer that does not parse, throws: the page decides what a visitor then sees (./source.ts).
import { orThrow, parseRow, type BoundaryAnswer } from '../data/parse-rows';
import { BoardAnswer, type Board } from './model';

/** The one call the read makes: an rpc of the Supabase client, whichever key and session it holds. */
export type IdeasDb = {
  rpc(fn: 'ideas_board', args: { p_full_name: string }, options?: { get?: boolean }): PromiseLike<BoundaryAnswer>;
};

export const WHERE = 'ideas/store: ideas_board';

/** The board of owner/name, or null when it is private or missing. */
export async function readBoard(db: IdeasDb, fullName: string): Promise<Board | null> {
  const { data, error } = await db.rpc('ideas_board', { p_full_name: fullName }, { get: true });
  if (error) throw new Error(`${WHERE}: ${error.message}`);
  return orThrow(parseRow(BoardAnswer, data, WHERE));
}
