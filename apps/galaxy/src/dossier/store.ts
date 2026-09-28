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

// ── The questions that shaped it (PRD 216, step 3) ──────────────────────────────
// dossier_rounds() (supabase/migrations/20260928100000_dossier_rounds.sql) finds a dossier's rounds
// when it is read, by two rules — brainstorm (its Claude session, from its opening to that session's
// next dossier) and delivery (its PRD number in its home repository) — in its own workspace. It runs as
// the caller, so PRD 144's access rules decide: someone who cannot read the dossier gets no round.

/** Which rule brought a round to a dossier. A round both rules match is brainstorm. */
export type RoundRule = 'brainstorm' | 'delivery';

/** A round of a dossier, as dossier_rounds() returns it: the round as PRD 144 keeps it, its rule, and
 * its ask session's owner (who asked), repository and branch. */
export type DossierRoundRow = {
  rule: RoundRule;
  round_id: string;
  session_id: string;
  asked_by: string;
  repo: string | null;
  branch: string | null;
  /** AskUserQuestion's questions, exactly as the tool took them. */
  questions: unknown;
  /** Question text → the answer, once answered. */
  answers: Record<string, string> | null;
  status: 'open' | 'answered' | 'abandoned';
  answered_via: 'page' | 'terminal' | null;
  answered_by: string | null;
  category: string | null;
  category_by: string | null;
  prd: number | null;
  skill: string | null;
  created_at: string;
  answered_at: string | null;
};

/** The columns dossier_rounds() returns, in its order. */
export const ROUND_FIELDS = [
  'rule', 'round_id', 'session_id', 'asked_by', 'repo', 'branch', 'questions', 'answers', 'status', 'answered_via',
  'answered_by', 'category', 'category_by', 'prd', 'skill', 'created_at', 'answered_at',
] as const satisfies ReadonlyArray<keyof DossierRoundRow>;

/** The dossier's rounds, in the order they were asked; none when the caller may not read it. */
export async function dossierRounds(db: Pick<SupabaseClient, 'rpc'>, dossierId: string): Promise<DossierRoundRow[]> {
  return settle<DossierRoundRow[]>('read the questions', await db.rpc('dossier_rounds', { p_dossier: dossierId })) ?? [];
}

// ── The history (PRD 216, step 4) ───────────────────────────────────────────────
// dossier_list() (supabase/migrations/20260928110000_dossier_list.sql) returns each dossier of the
// caller's workspaces with what /prd lists and the planet's DOSSIER tab reads: its repositories (the
// home repository first, then its questions' and, for a PRD of the plan repository, its planet's
// regions, in lower case), its latest version of each kind, its question counts (rounds, as the
// Questions tab counts them) and its last activity, newest first. It runs as the caller, so row-level
// security decides: a member of another workspace lists nothing of it.

/** An artifact's latest version: its number is how many versions of its kind there are. */
export type LatestVersion = { id: string; version: number; source: 'kit' | 'github'; created_at: string };

/** A dossier as the history lists it. */
export type DossierListRow = DossierRow & {
  /** The home repository first, then the others in order, each once, in lower case. */
  repos: string[];
  /** The latest version of each kind it has; a kind with none is left out. */
  latest: Partial<Record<DossierKind, LatestVersion>>;
  /** Its rounds (dossier_rounds()), and those answered. */
  asked: number;
  answered: number;
  /** The latest of its opening, its numbering, its versions and its rounds, asked or answered. */
  last_activity: string;
};

/** The columns dossier_list() returns, in its order. */
export const LIST_FIELDS = [
  'id', 'workspace_id', 'home_repo', 'prd', 'title', 'opened_by', 'created_at', 'numbered_at', 'repos', 'latest', 'asked', 'answered',
  'last_activity',
] as const satisfies ReadonlyArray<keyof DossierListRow>;

/** Every dossier the caller may read, newest activity first; or only `dossierId`'s, when given. */
export async function dossierList(db: Pick<SupabaseClient, 'rpc'>, dossierId: string | null = null): Promise<DossierListRow[]> {
  return settle<DossierListRow[]>('read the history', await db.rpc('dossier_list', { p_dossier: dossierId })) ?? [];
}

// ── The change check (PRD 384, part 5) ──────────────────────────────────────────
// The open page asks every 2 s whether anything changed: how many rounds, how many answered, and the
// latest version number of each artifact. dossier_list() with the dossier named answers exactly that in
// one row, as the caller, so the page's own access rule decides: no new function, no migration.

/** What the change check compares: counts, never rows. */
export type DossierPulse = { asked: number; answered: number; latest: Partial<Record<DossierKind, number>> };

/** The dossier's pulse, or null when the caller may not read it, or it is gone. */
export async function dossierPulse(db: Pick<SupabaseClient, 'rpc'>, dossierId: string): Promise<DossierPulse | null> {
  const row = (await dossierList(db, dossierId))[0];
  if (!row) return null;
  const latest: Partial<Record<DossierKind, number>> = {};
  for (const kind of DOSSIER_KINDS) {
    const version = row.latest?.[kind]?.version;
    if (typeof version === 'number') latest[kind] = version;
  }
  return { asked: row.asked ?? 0, answered: row.answered ?? 0, latest };
}
