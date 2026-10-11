// The approved check's read of a product PRD's record (PRD 1548 s3), as the service role (`SUPABASE_URL`,
// `SUPABASE_SERVICE_ROLE_KEY`, the pr-stats collector's and the canon gate's pair): the App has no
// person's session, so it reads the tables the record lives in rather than dossier_approval(), which
// checks who calls, and answers the same shape.
//
// The PRD is found only through the repository the pull request is in: the product keyed `key` that
// holds that repository (`product_repositories`, PRD 1364), then its PRD `seq`. A body naming a PRD of a
// product that does not hold the repository reads as no PRD at all, so a pull request elsewhere learns
// nothing of it. Then the approval in force (the latest row), whether its approver is a member of the
// workspace today, the voids a push left on it, and the latest version of each kind, with the text of
// each pinned version and of each latest version that differs from its pin, for the whitespace test.
//
// Throws when the database refuses or answers out of shape: the check reads that as held.
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import type { Database } from '../../../../supabase/database.types.ts';
import type { ApprovalRecord, LatestVersion, ProductPrdRef } from './state.ts';

/** The Supabase connection a service-role read takes. */
export type Connection = { url: string; key: string; fetch?: typeof globalThis.fetch | undefined };

/** Reads PRD `prd`'s record for a pull request of `repository` (`owner/name`); null when there is no such PRD there. */
export type RecordReader = (repository: string, prd: ProductPrdRef) => Promise<ApprovalRecord | null>;

const text = z.string().min(1);
const at = z.string().refine((value) => !Number.isNaN(Date.parse(value)));

const HolderRowSchema = z.object({ product_id: text, workspace_id: text });
const DossierRowSchema = z.object({ id: text });
const ApprovalRowSchema = z.object({
  id: text,
  approved_by: text,
  approver_login: text,
  approved_at: at,
  files: z.array(z.object({ kind: text, path: text, sha256: text, version_id: text })),
});
const VoidRowSchema = z.object({ kind: text, from_sha256: text, to_sha256: text, pusher_login: text, voided_at: at });
const VersionRowSchema = z.object({ id: text, kind: text, sha256: text, commit_sha: z.string().nullable(), created_at: at });
const ContentRowSchema = z.object({ id: text, content: z.string() });

/** The columns the reader takes of each table. */
const HOLDER = 'product_id, workspace_id, products!inner(key)';
const APPROVAL = 'id, approved_by, approver_login, approved_at, files';
const VOID = 'kind, from_sha256, to_sha256, pusher_login, voided_at';
const VERSION = 'id, kind, sha256, commit_sha, created_at';

/** What the database's refusal says, with its code when it has one. */
const refused = (error: { message: string; code?: string }) => new Error(`the database refused: ${error.message}${error.code ? ` (${error.code})` : ''}`);

/** An answer's rows through `schema`, or the refusal thrown. */
function rowsOf<T>(schema: z.ZodType<T>, answer: { data: unknown; error: { message: string; code?: string } | null }): T[] {
  if (answer.error) throw refused(answer.error);
  return z.array(schema).parse(answer.data ?? []);
}

/** The latest version of each kind, newest first as the rows come. */
function latestByKind(rows: z.infer<typeof VersionRowSchema>[]): z.infer<typeof VersionRowSchema>[] {
  const seen = new Map<string, z.infer<typeof VersionRowSchema>>();
  for (const row of rows) if (!seen.has(row.kind)) seen.set(row.kind, row);
  return [...seen.values()];
}

/** The record reader, as the service role on `connection`. */
export function recordReader({ url, key, fetch }: Connection): RecordReader {
  const db = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    ...(fetch ? { global: { fetch } } : {}),
  });
  return async (repository, prd) => {
    const holders = rowsOf(HolderRowSchema, await db.from('product_repositories').select(HOLDER).eq('repository', repository.toLowerCase()).eq('products.key', prd.key));
    const [holder] = holders;
    if (!holder) return null;
    const dossiers = rowsOf(DossierRowSchema, await db.from('dossiers').select('id').eq('product_id', holder.product_id).eq('product_seq', prd.seq).eq('kind', 'prd').limit(1));
    const [dossier] = dossiers;
    if (!dossier) return null;

    const versions = latestByKind(rowsOf(VersionRowSchema, await db.from('dossier_versions').select(VERSION).eq('dossier_id', dossier.id).order('created_at', { ascending: false })));
    const [approved] = rowsOf(ApprovalRowSchema, await db.from('approvals').select(APPROVAL).eq('dossier_id', dossier.id).order('approved_at', { ascending: false }).order('id', { ascending: false }).limit(1));
    const latestWithout = versions.map((row): LatestVersion => ({ kind: row.kind, sha256: row.sha256, versionId: row.id, commitSha: row.commit_sha, content: null }));
    if (!approved) return { dossierId: dossier.id, approval: null, latest: latestWithout };

    const members = rowsOf(z.object({ user_id: text }), await db.from('workspace_members').select('user_id').eq('workspace_id', holder.workspace_id).eq('user_id', approved.approved_by).limit(1));
    const voids = rowsOf(VoidRowSchema, await db.from('approval_voids').select(VOID).eq('approval_id', approved.id).order('voided_at', { ascending: true }));

    const pinnedSha = new Map(approved.files.map((file) => [file.kind, file.sha256]));
    const differing = versions.filter((row) => pinnedSha.has(row.kind) && pinnedSha.get(row.kind) !== row.sha256).map((row) => row.id);
    const wanted = [...new Set([...approved.files.map((file) => file.version_id), ...differing])];
    const texts = new Map(rowsOf(ContentRowSchema, await db.from('dossier_versions').select('id, content').in('id', wanted)).map((row) => [row.id, row.content]));

    return {
      dossierId: dossier.id,
      approval: {
        approver: { login: approved.approver_login, member: members.length > 0 },
        approvedAt: new Date(approved.approved_at).toISOString(),
        files: approved.files.map((file) => ({ kind: file.kind, path: file.path, sha256: file.sha256, versionId: file.version_id, content: texts.get(file.version_id) ?? null })),
        voids: voids.map((row) => ({ pusher: row.pusher_login, kind: row.kind, from: row.from_sha256, to: row.to_sha256, voidedAt: new Date(row.voided_at).toISOString() })),
      },
      latest: latestWithout.map((version) => ({ ...version, content: texts.get(version.versionId) ?? null })),
    };
  };
}
