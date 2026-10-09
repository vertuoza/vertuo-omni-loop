// The ideas board's read (PRD 1246, s1), registered for `pnpm schemas:verify`
// (scripts/schemas-verify.ts): ideas_board(), parsed with the schema the store parses it with. The demo
// seed has no public board, so the read answers null, which the script names as empty.
import type { Boundary } from '../data/parse-rows';
import { BoardAnswer } from './model';
import { WHERE } from './store';

export const boundaries: Boundary[] = [
  { name: WHERE, read: (db) => db.rpc('ideas_board', { p_full_name: 'vertuoza/vertuo-omni-loop' }, { get: true }), schema: BoardAnswer, shape: 'row' },
];
