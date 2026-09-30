// The heartbeats (supabase/migrations/20261019090000_working_pings.sql, PRD 757): one row per Claude
// session, written as the caller through working_ping(), which upserts only the caller's own row, places
// it in the workspace the repository belongs to for them, and resolves the dossier its work names. A
// member of the workspace reads the rows; row-level security decides, so a row of another workspace
// reads as missing.
import type { SupabaseClient } from '@supabase/supabase-js';
import type { WorkKind } from '../dossier/store';
import type { WorkingPing } from './state';

/** What a session works on, as the kit's work finder names it: a draft by its id, a PRD or a fix by
 * its number, or nothing. */
export type Work = { kind: 'draft'; draftId: string } | { kind: WorkKind; number: number } | null;

/** A heartbeat to record: `ended` once, when the session ends. */
export type Heartbeat = { claudeSessionId: string; repo: string; work: Work; ended: boolean };

/** A heartbeat as a reader sees it. */
type WorkingPingRow = WorkingPing & {
  claude_session_id: string;
  user_id: string;
  workspace_id: string;
  repo: string;
  work_kind: 'draft' | WorkKind | null;
  work_number: number | null;
  dossier_id: string | null;
};

export const PING_COLUMNS = 'claude_session_id, user_id, workspace_id, repo, work_kind, work_number, dossier_id, seen_at, ended_at';

/** The database refused or failed; `code` is Postgres's: 42501 another account's session or a
 * repository no workspace of the caller owns, 22023 a malformed argument. */
export class WorkingStoreError extends Error {
  readonly code: string | undefined;
  readonly reason: string;

  constructor(what: string, failure: Failure) {
    super(`${what}: ${failure.message}`);
    this.code = failure.code;
    this.reason = failure.message;
  }
}

type Failure = { code?: string; message: string };

function settle<T>(what: string, { data, error }: { data: T | null; error: Failure | null }): T | null {
  if (error) throw new WorkingStoreError(what, error);
  return data;
}

export function workingStore(db: Pick<SupabaseClient, 'rpc'>) {
  return {
    /** Records the caller's heartbeat for their Claude session. */
    async ping({ claudeSessionId, repo, work, ended }: Heartbeat): Promise<void> {
      settle('record the heartbeat', await db.rpc('working_ping', {
        p_claude_session_id: claudeSessionId,
        p_repo: repo,
        p_work_kind: work?.kind ?? null,
        p_work_number: work && work.kind !== 'draft' ? work.number : null,
        p_draft: work && work.kind === 'draft' ? work.draftId : null,
        p_ended: ended,
      }));
    },
  };
}

export function workingReader(db: Pick<SupabaseClient, 'from'>) {
  return {
    /** The freshest heartbeat of a session still on the dossier, or null: a dossier is working when
     * any of its sessions is, and the freshest of those that have not ended says whether one is. */
    async forDossier(dossierId: string): Promise<WorkingPingRow | null> {
      const rows = settle<WorkingPingRow[]>('read the dossier\'s heartbeats', await db.from('working_pings').select(PING_COLUMNS)
        .eq('dossier_id', dossierId).is('ended_at', null).order('seen_at', { ascending: false }).limit(1));
      return rows?.[0] ?? null;
    },

    /** The heartbeat of one Claude session (the terminal of an /ask tab), or null. */
    async forSession(claudeSessionId: string): Promise<WorkingPingRow | null> {
      return settle<WorkingPingRow>('read the session\'s heartbeat', await db.from('working_pings').select(PING_COLUMNS)
        .eq('claude_session_id', claudeSessionId).maybeSingle());
    },
  };
}
