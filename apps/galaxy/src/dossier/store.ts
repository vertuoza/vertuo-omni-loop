// The dossiers (supabase/migrations/20260928090000_dossiers.sql), written as the caller: the client
// carries their access token, and the two security-definer functions the migration writes check who
// calls. Nobody writes the tables directly: dossier_open() opens a draft, dossier_push() finds the
// dossier (the draft named, else the one keyed by workspace, repository and PRD, else a new one),
// numbers a draft, and adds a version of each kind only when the hash of its content, computed by the
// database, differs from the latest. A member of the workspace reads a dossier and its versions.
import type { SupabaseClient } from '@supabase/supabase-js';

/** The three artifacts of a PRD's folder, in the order a push sends them. */
export const DOSSIER_KINDS = ['spec', 'plan', 'before-after'] as const;
export type DossierKind = (typeof DOSSIER_KINDS)[number];

/** The largest artifact a version holds (the table's own check). */
export const ARTIFACT_MAX_BYTES = 512 * 1024;
/** The longest title a dossier takes. */
export const TITLE_MAX = 200;

export const isDossierKind = (value: unknown): value is DossierKind => DOSSIER_KINDS.includes(value as DossierKind);

export type DossierArtifact = { kind: DossierKind; content: string };

export type DossierPush = {
  repo: string;
  prd: number;
  title: string;
  /** The draft to number, or null: the dossier keyed by repo and PRD, or a new one. */
  draftId: string | null;
  artifacts: DossierArtifact[];
};

/** What a push did: every kind it received is either added (with its new version) or unchanged. */
export type DossierPushed = { id: string; added: Array<{ kind: DossierKind; version: number }>; unchanged: DossierKind[] };

/**
 * The database refused or failed; `code` is Postgres's: 42501 the caller belongs to no workspace,
 * P0002 no such draft for them, 22023 a draft of another repository or already another PRD, 54000 an
 * artifact over the cap.
 */
export class DossierStoreError extends Error {
  constructor(what: string, readonly code: string | undefined, readonly reason: string) {
    super(`${what}: ${reason}`);
  }
}

type Outcome<T> = { data: T | null; error: { code?: string; message: string } | null };

function settle<T>(what: string, { data, error }: Outcome<T>): T | null {
  if (error) throw new DossierStoreError(what, error.code, error.message);
  return data;
}

export function dossierStore(db: Pick<SupabaseClient, 'rpc'>) {
  return {
    /** Opens a draft for `repo` in the caller's workspace for it; the id of the new draft. */
    async open({ title, repo, claudeSessionId }: { title: string; repo: string; claudeSessionId: string | null }): Promise<{ id: string }> {
      const id = settle<string>('open the draft', await db.rpc('dossier_open', {
        p_title: title, p_repo: repo, p_claude_session_id: claudeSessionId,
      }));
      if (typeof id !== 'string') throw new DossierStoreError('open the draft', undefined, 'no id came back');
      return { id };
    },

    /** Sends a PRD folder's artifacts; the dossier they went to and which versions were added. */
    async push({ repo, prd, title, draftId, artifacts }: DossierPush): Promise<DossierPushed> {
      const pushed = settle<DossierPushed>('push the dossier', await db.rpc('dossier_push', {
        p_repo: repo, p_prd: prd, p_title: title, p_draft: draftId, p_artifacts: artifacts,
      }));
      if (!pushed || typeof pushed.id !== 'string') throw new DossierStoreError('push the dossier', undefined, 'no dossier came back');
      return { id: pushed.id, added: pushed.added ?? [], unchanged: pushed.unchanged ?? [] };
    },
  };
}

export type DossierStore = ReturnType<typeof dossierStore>;
