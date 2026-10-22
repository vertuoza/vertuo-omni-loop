import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { PrdNumberSchema, PrNumberSchema } from 'omni-loop/kit/lib/ids.ts';
import { orThrow, parseRows } from '../data/parse-rows';
import { readTracked } from '../profile/stored';
import { WAIT_KINDS } from '../stages/sync/waits';

// The Waiting board's storage (PRD 2377 s3; ADR-0095): the reads behind /app/waiting, as the signed-in
// person, so row-level security has the last word (a member reads their workspace's waits and no
// other's, supabase/checks/waits.sql). The open waits, the dossiers of the PRDs they name (its page
// and its title), each PRD's open outbox questions, and when the stages sync last recorded a
// repository. A failed read throws, and an answer out of shape too. No rule lives here:
// ./board.ts's and ./waiting-board.service.ts's.

/** What the reads need: the tables. */
export type WaitingBoardDb = SupabaseClient;

const WHERE = 'waiting-board/waiting-board.repository';

const WAIT_COLUMNS = 'id, repo, prd, pr, kind, turn, since';
/** An open wait, as WAIT_COLUMNS reads it. */
export const StoredWaitRow = z.strictObject({
  id: z.string(),
  repo: z.string(),
  prd: PrdNumberSchema.nullable(),
  pr: PrNumberSchema.nullable(),
  kind: z.enum(WAIT_KINDS),
  turn: z.array(z.string()),
  since: z.string(),
});

const DOSSIER_COLUMNS = 'id, home_repo, prd, title, opened_by';
/** A PRD's dossier, as DOSSIER_COLUMNS reads it. */
export const StoredDossierRow = z.strictObject({ id: z.string(), home_repo: z.string(), prd: PrdNumberSchema, title: z.string(), opened_by: z.string().nullable() });

const OUTBOX_COLUMNS = 'repository, prd, open_questions';
/** A PRD's stored outbox count, as OUTBOX_COLUMNS reads it. */
export const StoredOutboxRow = z.strictObject({ repository: z.string(), prd: PrdNumberSchema, open_questions: z.number().int() });

const SYNCED_COLUMNS = 'repository, synced_at';
/** When a repository's PRD stages were last recorded, as SYNCED_COLUMNS reads it. */
export const StoredSyncedRow = z.strictObject({ repository: z.string(), synced_at: z.string() });

/** Every open wait the caller reads. */
export const openWaitsOf = (db: WaitingBoardDb) => db.from('waits').select(WAIT_COLUMNS).is('ended_at', null);
/** Every numbered PRD dossier the caller reads that has a home repository. */
export const prdDossiersOf = (db: WaitingBoardDb) => db.from('dossiers').select(DOSSIER_COLUMNS).eq('kind', 'prd').not('prd', 'is', null).not('home_repo', 'is', null);
/** Every PRD outbox the caller reads that holds an open question. */
export const openOutboxesOf = (db: WaitingBoardDb) => db.from('prd_outbox').select(OUTBOX_COLUMNS).gt('open_questions', 0);
/** The stored `prd` stage rows the caller reads: only the sync writes them. */
export const syncedStagesOf = (db: WaitingBoardDb) => db.from('prd_stages').select(SYNCED_COLUMNS).eq('stage', 'prd');

export function waitingBoardRepository(db: WaitingBoardDb) {
  return {
    /** The workspace's tracked repositories, `owner/name`. */
    tracked(workspace: string): Promise<string[]> {
      return readTracked(db, workspace, `${WHERE}: repositories`);
    },

    /** The workspace's open waits. */
    async openWaits(workspace: string) {
      const { data, error } = await openWaitsOf(db).eq('workspace_id', workspace);
      if (error) throw new Error(`Supabase: could not read the waits (${error.message})`);
      return orThrow(parseRows(StoredWaitRow, data, `${WHERE}: waits`));
    },

    /** The dossiers of these PRD numbers in the workspace. */
    async dossiers(workspace: string, prds: readonly number[]) {
      if (prds.length === 0) return [];
      const { data, error } = await prdDossiersOf(db).eq('workspace_id', workspace).in('prd', [...prds]);
      if (error) throw new Error(`Supabase: could not read the PRDs' pages (${error.message})`);
      return orThrow(parseRows(StoredDossierRow, data, `${WHERE}: dossiers`));
    },

    /** The workspace's PRDs that hold an open outbox question, among these numbers. */
    async openQuestions(workspace: string, prds: readonly number[]) {
      if (prds.length === 0) return [];
      const { data, error } = await openOutboxesOf(db).eq('workspace_id', workspace).in('prd', [...prds]);
      if (error) throw new Error(`Supabase: could not read the outbox questions (${error.message})`);
      return orThrow(parseRows(StoredOutboxRow, data, `${WHERE}: outboxes`));
    },

    /** When the sync last recorded the repository; null when it never did. */
    async lastSynced(workspace: string, repository: string): Promise<string | null> {
      const { data, error } = await syncedStagesOf(db).eq('workspace_id', workspace).eq('repository', repository.toLowerCase())
        .order('synced_at', { ascending: false }).limit(1);
      if (error) throw new Error(`Supabase: could not read when ${repository} was last synced (${error.message})`);
      return orThrow(parseRows(StoredSyncedRow, data, `${WHERE}: stages`))[0]?.synced_at ?? null;
    },
  };
}

export type WaitingBoardRepository = ReturnType<typeof waitingBoardRepository>;
