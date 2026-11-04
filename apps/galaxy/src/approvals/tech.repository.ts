import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { type PrdNumber, PrdNumberSchema } from 'omni-loop/kit/lib/ids.ts';
import { at, parsed, text, UUID } from './answer';

// A Tech Approval's storage (PRD 2608 s3): as the caller (a terminal's access token, or the page's
// session), so the database checks who calls. dossier_request_tech_approval()
// (supabase/migrations/20270110090000_tech_approval.sql) records the request; workspace_roster()
// (supabase/migrations/20261013090000_roster_hero.sql) reads the members, for a member, never an email. It
// holds no rule. A database refusal comes back as its code and message; an answer out of shape as `shape`.

type Db = Pick<SupabaseClient, 'rpc' | 'from'>;

/** What dossier_approval() says of a PRD the caller reads: only its dossier is read here; null for no such PRD. */
const FoundDossier = z.object({ dossier: UUID }).nullable();

/** A dossier the caller reads: its workspace. */
const WorkspaceRows = z.array(z.object({ workspace_id: UUID }));

/** The workspace's members, as workspace_roster() lists them: the login, null with no GitHub. */
const RosterRows = z.array(z.object({ user_id: UUID, name: text.nullable(), github_login: text.nullable() }));

/** What dossier_request_tech_approval() answers: the request recorded, and the one person it names. */
const TechRequested = z.object({
  id: UUID,
  dossier: UUID,
  repo: text,
  prd: PrdNumberSchema,
  title: z.string(),
  kind: z.enum(['asked', 're-asked']),
  approvalKind: z.literal('tech'),
  askedAt: at,
  author: text,
  asked: z.array(z.object({ user: UUID, login: text, name: text.nullable() })),
});

/** A Tech Approval's request, as the database recorded it. */
export type TechRequested = z.infer<typeof TechRequested>;

export function techRepository(db: Db) {
  return {
    /** The dossier of PRD `prd` of `repo` (lower case), found as the approval is, when the caller reads it. */
    dossier: (repo: string, prd: PrdNumber) => parsed(db.rpc('dossier_approval', { p_repo: repo, p_prd: prd }), FoundDossier, 'dossier_approval'),
    /** The workspace of dossier `id`, when the caller reads it, as a list of at most one. */
    workspace: (id: string) => parsed(db.from('dossiers').select('workspace_id').eq('id', id).limit(1), WorkspaceRows, 'dossiers'),
    /** The members of `workspace`. */
    roster: (workspace: string) => parsed(db.rpc('workspace_roster', { workspace }), RosterRows, 'workspace_roster'),
    /** Names `login` for the Tech Approval of dossier `id`. */
    request: (id: string, login: string) => parsed(
      db.rpc('dossier_request_tech_approval', { p_dossier: id, p_login: login }), TechRequested, 'dossier_request_tech_approval'),
  };
}

export type TechRepository = ReturnType<typeof techRepository>;
