import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import type { PrdNumber } from 'omni-loop/kit/lib/ids.ts';
import type { Database } from '../../../../supabase/database.types.ts';
import { at, parsed, text, UUID, type Answer } from './answer';

// The judge's storage (PRD 1612 s2): the approval record as the service role reads it, for the App's
// signed `GET /api/approvals/judge`. dossier_approval() checks who calls (auth.uid()), and the App is
// nobody's sign-in, so this reads the tables it reads, as the service role, which may select every one
// of them (supabase/migrations/20261123090000_approvals.sql, 20261125090000_approval_requests.sql,
// 20260928090000_dossiers.sql, 20260926120000_workspaces.sql). It holds no rule: the newest numbered
// dossier of the PRD, its newest approval, that approval's voids, the versions it pins and whether the
// approver is a member, each parsed as it comes (./answer.ts's `parsed`). A refusal comes
// back as its code and message; rows out of shape as the code `shape`.

/** The service role's client: its tables. */
type ServiceDb = Pick<SupabaseClient<Database>, 'from'>;

const DossierRows = z.array(z.object({ id: UUID, workspace_id: UUID }));
const PinnedFile = z.object({ kind: text, path: text, sha256: text, version_id: UUID });
const ApprovalRows = z.array(z.object({ id: UUID, approved_by: UUID, approver_login: text, approved_at: at, files: z.array(PinnedFile) }));
const VoidRows = z.array(z.object({ pusher_login: text, kind: text, from_sha256: text, to_sha256: text, voided_at: at }));
const VersionRows = z.array(z.object({ id: UUID, content: z.string() }));
const MemberRows = z.array(z.object({ user_id: UUID }));

/** An approval row, its pinned files as stored ({kind, path, sha256, version_id}). */
export type ApprovalRow = z.infer<typeof ApprovalRows>[number];
/** A void row of an approval. */
export type VoidRow = z.infer<typeof VoidRows>[number];

/** The service role's reads of the approval record. */
export function judgeRepository(db: ServiceDb) {
  return {
    /** The newest numbered PRD dossier of PRD `prd` of `repo` (lower case), as dossier_approval() orders them. */
    dossier: (repo: string, prd: PrdNumber) => parsed(
      db.from('dossiers').select('id, workspace_id').eq('home_repo', repo).eq('kind', 'prd').eq('prd', prd)
        .order('numbered_at', { ascending: false, nullsFirst: false }).order('id').limit(1),
      DossierRows, 'dossiers'),
    /** The dossier's newest approval: its approval in force, unless a void says otherwise. */
    latestApproval: (dossier: string) => parsed(
      db.from('approvals').select('id, approved_by, approver_login, approved_at, files').eq('dossier_id', dossier)
        .order('approved_at', { ascending: false }).order('id', { ascending: false }).limit(1),
      ApprovalRows, 'approvals'),
    /** The voids of an approval, oldest first. */
    voids: (approval: string) => parsed(
      db.from('approval_voids').select('pusher_login, kind, from_sha256, to_sha256, voided_at').eq('approval_id', approval)
        .order('voided_at').order('id'),
      VoidRows, 'approval_voids'),
    /** The approved text of each version named. */
    versions: (ids: readonly string[]) => (ids.length
      ? parsed(db.from('dossier_versions').select('id, content').in('id', [...ids]), VersionRows, 'dossier_versions')
      : Promise.resolve<Answer<z.infer<typeof VersionRows>>>({ ok: true, value: [] })),
    /** Whether `user` is a member of `workspace` today. */
    async isMember(workspace: string, user: string): Promise<Answer<boolean>> {
      const read = await parsed(
        db.from('workspace_members').select('user_id').eq('workspace_id', workspace).eq('user_id', user).limit(1),
        MemberRows, 'workspace_members');
      return read.ok ? { ok: true, value: read.value.length > 0 } : read;
    },
  };
}

export type JudgeRepository = ReturnType<typeof judgeRepository>;
