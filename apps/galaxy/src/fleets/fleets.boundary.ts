// The fleets page's read of each fleet's GitHub project board (PRD 2530, ./load.ts), for `pnpm schemas:verify`
// (scripts/schemas-verify.ts): the page's own select, over every workspace (no filter).
import type { Boundary } from '../data/parse-rows';
import { BOARD_COLUMNS, StoredBoard } from './board-row';

export const boundaries: Boundary[] = [
  { name: 'fleets/load: teams boards', read: (db) => db.from('teams').select(BOARD_COLUMNS), schema: StoredBoard, shape: 'rows' },
];
