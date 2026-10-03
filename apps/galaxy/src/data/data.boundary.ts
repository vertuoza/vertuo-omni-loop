// The arcade's data reads (PRD 1030), registered for `pnpm schemas:verify` (scripts/schemas-verify.ts):
// each module's own select or function, run against a real database and parsed with the schema the
// module parses it with. Every workspace's rows: the script reads as the service role. dossier_list()
// (data/dossiers.ts) is not registered: only a signed-in member may run it, never the service role.
import type { Boundary } from './parse-rows';
import { LEDGER_COLUMNS, LedgerRow } from './ledger-row';
import { PLAYER_COLUMNS, StoredPlayer } from './players';
import { SCORE_COLUMNS, ScoreRow } from './scores';
import { MEMBERSHIP_COLUMNS, MembershipRow } from './workspace';

export const boundaries: Boundary[] = [
  { name: 'data/load-galaxy: ledger_events', read: (db) => db.from('ledger_events').select(LEDGER_COLUMNS), schema: LedgerRow, shape: 'rows' },
  { name: 'data/load-galaxy: players', read: (db) => db.from('players').select(PLAYER_COLUMNS), schema: StoredPlayer, shape: 'rows' },
  { name: 'data/scores: arcade_scores', read: (db) => db.from('arcade_scores').select(SCORE_COLUMNS), schema: ScoreRow, shape: 'rows' },
  { name: 'data/workspace: workspace_members', read: (db) => db.from('workspace_members').select(MEMBERSHIP_COLUMNS), schema: MembershipRow, shape: 'rows' },
];
