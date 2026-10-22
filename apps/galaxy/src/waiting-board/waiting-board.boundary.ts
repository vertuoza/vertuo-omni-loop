// The Waiting board's reads from Supabase, for `pnpm schemas:verify` (PRD 1030,
// scripts/schemas-verify.ts): each select of ./waiting-board.repository.ts, over every workspace.
import type { Boundary, BoundaryAnswer } from '../data/parse-rows';
import {
  openOutboxesOf, openWaitsOf, prdDossiersOf, StoredDossierRow, StoredOutboxRow, StoredSyncedRow, StoredWaitRow, syncedStagesOf, type WaitingBoardDb,
} from './waiting-board.repository';

const WHERE = 'waiting-board/waiting-board.repository';

/** One of the storage's selects, as the script runs it. */
const reading = (build: (db: WaitingBoardDb) => PromiseLike<BoundaryAnswer>): Boundary['read'] => (db) => build(db);

export const boundaries: Boundary[] = [
  { name: `${WHERE}: waits`, read: reading(openWaitsOf), schema: StoredWaitRow, shape: 'rows' },
  { name: `${WHERE}: dossiers`, read: reading(prdDossiersOf), schema: StoredDossierRow, shape: 'rows' },
  { name: `${WHERE}: outboxes`, read: reading(openOutboxesOf), schema: StoredOutboxRow, shape: 'rows' },
  { name: `${WHERE}: stages`, read: (db) => syncedStagesOf(db).limit(1), schema: StoredSyncedRow, shape: 'rows' },
];
