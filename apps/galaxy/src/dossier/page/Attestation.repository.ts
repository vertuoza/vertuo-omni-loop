import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

// The attestation's reads (PRD 1548 s4), as the signed-in member, so row-level security decides: the
// approval in force of a dossier (its latest row of `approvals`), the voids appended to it, every version's
// hash (to pair each pinned hash with today's), whether its approver is a member of the workspace today,
// and the members its product asks to approve. It holds no rule; ./Attestation.service.ts does.

type Raw = { data: unknown; error: { message?: string } | null };

/** A Supabase client's tables, as the member reads them. */
export type AttestationDb = Pick<SupabaseClient, 'from'>;

/** A column that is set, and a timestamp as PostgREST answers it. */
const set = z.string().min(1);
const stampOf = z.iso.datetime({ offset: true });

const ApprovalSchema = z.object({
  id: set,
  approved_by: set,
  approver_login: set,
  approved_at: stampOf,
  files: z.array(z.looseObject({ kind: set, path: set, version_id: set, sha256: set.optional() })),
});
const VoidSchema = z.object({ kind: set, from_sha256: set, to_sha256: set, pusher_login: set, voided_at: stampOf });
const VersionSchema = z.object({ id: set, kind: set, sha256: set, created_at: stampOf });
const DossierSchema = z.object({ workspace_id: set, product_id: z.string().nullable() });
const UserSchema = z.object({ user_id: set });

export type ApprovalInForce = z.infer<typeof ApprovalSchema>;
export type AttestationVoid = z.infer<typeof VoidSchema>;
export type AttestationVersion = z.infer<typeof VersionSchema>;

/** An answer's rows through `schema`; throws, naming `what`, when the database fails or answers out of shape. */
async function rows<T>(query: PromiseLike<Raw>, schema: z.ZodType<T>, what: string): Promise<T[]> {
  const { data, error } = await query;
  if (error) throw new Error(`read ${what}: ${error.message ?? 'the database failed'}`);
  const read = z.array(schema).safeParse(data ?? []);
  if (!read.success) throw new Error(`read ${what}: answered out of shape`);
  return read.data;
}

/** The member's reads of one dossier's attestation. */
export function attestationRepository(db: AttestationDb) {
  return {
    /** The approval in force: the latest row, or null when nobody approved the PRD yet. */
    async approval(dossier: string): Promise<ApprovalInForce | null> {
      const [row] = await rows(db.from('approvals').select('id, approved_by, approver_login, approved_at, files').eq('dossier_id', dossier)
        .order('approved_at', { ascending: false }).order('id', { ascending: false }).limit(1), ApprovalSchema, 'the approval');
      return row ?? null;
    },
    /** The voids appended to approval `approval`, oldest first. */
    voids: (approval: string): Promise<AttestationVoid[]> =>
      rows(db.from('approval_voids').select('kind, from_sha256, to_sha256, pusher_login, voided_at').eq('approval_id', approval)
        .order('voided_at', { ascending: true }), VoidSchema, 'the approval\'s voids'),
    /** Every version's hash, oldest first. */
    versions: (dossier: string): Promise<AttestationVersion[]> =>
      rows(db.from('dossier_versions').select('id, kind, sha256, created_at').eq('dossier_id', dossier)
        .order('created_at', { ascending: true }).order('id', { ascending: true }), VersionSchema, 'the versions\' hashes'),
    /** Whether `user` is a member of the dossier's workspace today, and the members its product asks to approve (none: no product, or nobody asked). */
    async approvers(dossier: string, user: string): Promise<{ member: boolean; asked: string[] }> {
      const [row] = await rows(db.from('dossiers').select('workspace_id, product_id').eq('id', dossier).limit(1), DossierSchema, 'the dossier');
      if (!row) return { member: false, asked: [] };
      const [members, asked] = await Promise.all([
        rows(db.from('workspace_members').select('user_id').eq('workspace_id', row.workspace_id).eq('user_id', user).limit(1), UserSchema, 'the workspace\'s members'),
        row.product_id === null
          ? Promise.resolve([])
          : rows(db.from('product_approvers').select('user_id').eq('product_id', row.product_id).eq('state', 'asked'), UserSchema, 'the product\'s approvers'),
      ]);
      return { member: members.length > 0, asked: asked.map((a) => a.user_id) };
    },
  };
}

export type AttestationRepository = ReturnType<typeof attestationRepository>;
