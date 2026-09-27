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

// ── Reading, as a member (PRD 216's page to share) ──────────────────────────────
// The page reads with the viewer's own session, so row-level security decides: a dossier of another
// workspace reads as missing, exactly like one that never was. Only the columns the migration grants
// the signed-in are asked for. The opener deletes their own draft through the table's delete policy;
// nobody deletes a numbered dossier, and a delete the policy refuses deletes nothing.

/** A dossier as its members read it. */
export type DossierRow = {
  id: string;
  workspace_id: string;
  home_repo: string;
  /** Null while a draft. */
  prd: number | null;
  title: string;
  /** Null when the fallback created it, or its opener's account is gone. */
  opened_by: string | null;
  created_at: string;
  numbered_at: string | null;
};

/** A version without its content: what the version picker lists. */
export type DossierVersionRow = {
  id: string;
  dossier_id: string;
  kind: DossierKind;
  bytes: number;
  source: 'kit' | 'github';
  uploaded_by: string | null;
  commit_sha: string | null;
  created_at: string;
};

export const DOSSIER_COLUMNS = 'id, workspace_id, home_repo, prd, title, opened_by, created_at, numbered_at';
export const VERSION_COLUMNS = 'id, dossier_id, kind, bytes, source, uploaded_by, commit_sha, created_at';

export function dossierReader(db: Pick<SupabaseClient, 'from'>) {
  return {
    /** The dossier, or null when there is none the caller may read. */
    async dossier(id: string): Promise<DossierRow | null> {
      return settle<DossierRow>('read the dossier', await db.from('dossiers').select(DOSSIER_COLUMNS).eq('id', id).maybeSingle());
    },

    /** Every version of the dossier, oldest first: a version's number is its place among its kind's. */
    async versions(dossierId: string): Promise<DossierVersionRow[]> {
      return settle<DossierVersionRow[]>('read the versions', await db.from('dossier_versions').select(VERSION_COLUMNS)
        .eq('dossier_id', dossierId).order('created_at', { ascending: true }).order('id', { ascending: true })) ?? [];
    },

    /** One version's content, or null when the caller may not read it. */
    async content(versionId: string): Promise<string | null> {
      const row = settle<{ content: string }>('read the version', await db.from('dossier_versions').select('content').eq('id', versionId).maybeSingle());
      return row?.content ?? null;
    },

    /** Deletes a draft: true when it went, false when the caller is not its opener, it is numbered, or
     * it was gone already. Its versions go with it. */
    async deleteDraft(id: string): Promise<boolean> {
      const gone = settle<Array<{ id: string }>>('delete the draft', await db.from('dossiers').delete().eq('id', id).select('id'));
      return (gone ?? []).length > 0;
    },
  };
}

export type DossierReader = ReturnType<typeof dossierReader>;
