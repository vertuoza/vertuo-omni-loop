import type { Boundary } from '../data/parse-rows';
import { QUESTION_COLUMNS, WaitingRound } from './source';

// The Questions part's own read (PRD 1030), for `pnpm schemas:verify`: the waiting rounds' questions,
// any rounds rather than the open ones of one person.
export const boundaries: Boundary[] = [
  { name: 'waiting/source: ask_rounds', read: (db) => db.from('ask_rounds').select(QUESTION_COLUMNS).limit(50), schema: WaitingRound, shape: 'rows' },
];
