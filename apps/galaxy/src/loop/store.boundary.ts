// The loops' reads (PRD 1139, s2), registered for `pnpm schemas:verify` (scripts/schemas-verify.ts):
// each select of loopReader(), parsed with the schema the store parses it with.
import type { Boundary } from '../data/parse-rows';
import { LOOP_COLUMNS, LoopRow, PLAN_COLUMNS, PlanRow, TICK_COLUMNS, TickRow } from './store';

export const boundaries: Boundary[] = [
  { name: 'loop/store: loops', read: (db) => db.from('loops').select(LOOP_COLUMNS), schema: LoopRow, shape: 'rows' },
  { name: 'loop/store: loop_ticks', read: (db) => db.from('loop_ticks').select(TICK_COLUMNS), schema: TickRow, shape: 'rows' },
  { name: 'loop/store: loop_plans', read: (db) => db.from('loop_plans').select(PLAN_COLUMNS), schema: PlanRow, shape: 'rows' },
];
