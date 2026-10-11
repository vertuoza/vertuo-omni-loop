import type { PrdNumber } from 'vertuo-omni-plan/kit/lib/ids.ts';
import type { Answer } from './approvals.repository';
import type { ApprovalRow, JudgeRepository, VoidRow } from './judge.repository';

// The approval in force, as the App's check reads it (PRD 1612 s2, spec §3): the same record the kit's
// `omni approval` reads through dossier_approval() (src/approval/approval-api.ts), in the same shape
// (kit/lib/approval/approval.ts), with `voided` said outright. The newest approval of the PRD's newest
// dossier is the one in force; a void since means it no longer holds, and the kit's judge reads it as
// drifted. Each pinned file carries the approved text when the database still holds it, so the kit's
// `omni approval restore` can write it back once it hashes to its sha256.

/** A file the approval pins: its kind, path, sha256 and version, and the approved text when kept. */
export type JudgedFile = { kind: string; path: string; sha256: string; versionId: string; content?: string };

/** A push that changed a pinned file since the approval. */
export type JudgedVoid = { pusher: string; kind: string; from: string; to: string; voidedAt: string };

/** The approval in force, or null before any approval. */
export type JudgedApproval = {
  approver: { login: string; member: boolean };
  approvedAt: string;
  files: JudgedFile[];
  voids: JudgedVoid[];
  voided: boolean;
};

/** What the record says of a PRD: its dossier, and its approval in force (null: none yet). */
export type Judged = { dossier: string; approval: JudgedApproval | null };

const iso = (at: string) => new Date(at).toISOString();

const voidOf = (row: VoidRow): JudgedVoid => ({
  pusher: row.pusher_login, kind: row.kind, from: row.from_sha256, to: row.to_sha256, voidedAt: iso(row.voided_at),
});

/** The approval's pinned files, in the order approved, each with its approved text when kept. */
function filesOf(row: ApprovalRow, contents: ReadonlyMap<string, string>): JudgedFile[] {
  return row.files.map(({ kind, path, sha256, version_id: versionId }) => {
    const content = contents.get(versionId);
    return content === undefined ? { kind, path, sha256, versionId } : { kind, path, sha256, versionId, content };
  });
}

/** The approval row, with its voids, its pinned texts and its approver's membership. */
async function inForceOf(record: JudgeRepository, workspace: string, row: ApprovalRow): Promise<Answer<JudgedApproval>> {
  const [voids, versions, member] = await Promise.all([
    record.voids(row.id),
    record.versions([...new Set(row.files.map((f) => f.version_id))]),
    record.isMember(workspace, row.approved_by),
  ]);
  if (!voids.ok) return voids;
  if (!versions.ok) return versions;
  if (!member.ok) return member;
  return {
    ok: true,
    value: {
      approver: { login: row.approver_login, member: member.value },
      approvedAt: iso(row.approved_at),
      files: filesOf(row, new Map(versions.value.map((v) => [v.id, v.content]))),
      voids: voids.value.map(voidOf),
      voided: voids.value.length > 0,
    },
  };
}

/** PRD `prd` of `repo`'s approval in force, as the service role reads it; null when no dossier is
 * numbered for that PRD. */
export async function approvalInForce(record: JudgeRepository, repo: string, prd: PrdNumber): Promise<Answer<Judged | null>> {
  const found = await record.dossier(repo, prd);
  if (!found.ok) return found;
  const [dossier] = found.value;
  if (!dossier) return { ok: true, value: null };
  const latest = await record.latestApproval(dossier.id);
  if (!latest.ok) return latest;
  const [row] = latest.value;
  if (!row) return { ok: true, value: { dossier: dossier.id, approval: null } };
  const approval = await inForceOf(record, dossier.workspace_id, row);
  return approval.ok ? { ok: true, value: { dossier: dossier.id, approval: approval.value } } : approval;
}
