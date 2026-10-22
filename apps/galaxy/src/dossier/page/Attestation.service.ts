import type { PrdNumber } from 'omni-loop/kit/lib/ids.ts';
import { stamp } from './dates';
import { attestationRepository, type ApprovalInForce, type AttestationDb, type AttestationRepository, type AttestationVersion, type AttestationVoid } from './Attestation.repository';

// The attestation of a product PRD (PRD 1548 s4): what `omni/approved`'s Details opens on the PRD page,
// `/prd/<id>#attestation`. It says who approved the PRD and when, whether they are a member of the
// workspace today and one of the approvers its product asks (any member, when it asks nobody), and each
// pinned file's hash beside today's. A file whose latest version is not the one pinned, or one a push
// voided, is drifted: it offers to restore the pinned version (open it, to push it again) and to ask
// for the approval again (the approve screen). The personas' rounds (voice) are appended after approval
// and never drift, as the approved check reads them (apps/omni-app/src/approved-check/state.ts).

/** One pinned file, beside today's. */
export type AttestedFile = {
  path: string;
  /** The pinned hash, short; `—` when the approval kept none. */
  pinned: string;
  /** Today's latest hash, short; null when the kind has no version left. */
  today: string | null;
  same: boolean;
  /** The pinned version on the page, to push again; null while the file matches. */
  restore: string | null;
};

/** Whether the approver is one the product asks: yes, any member may (it asks nobody), or no. */
export type ApproverTick = 'asked' | 'any' | 'not asked';

export type AttestationView = {
  state: 'building' | 'drifted';
  approver: string;
  member: boolean;
  approverTick: ApproverTick;
  /** `11 Oct 2026, 08:00 UTC`. */
  at: string;
  files: AttestedFile[];
  /** Who voided it and when, the latest void; null when none did. */
  voided: string | null;
  /** Where to ask for the approval again; null while it holds. */
  askAgain: string | null;
};

const short = (sha: string) => sha.slice(0, 7);

/** The latest version of each kind, and each version's number among its kind's (oldest is 1). */
function indexOf(versions: readonly AttestationVersion[]) {
  const latest = new Map<string, AttestationVersion>();
  const number = new Map<string, number>();
  const counts = new Map<string, number>();
  for (const version of versions) {
    const n = (counts.get(version.kind) ?? 0) + 1;
    counts.set(version.kind, n);
    number.set(version.id, n);
    latest.set(version.kind, version);
  }
  return { latest, number };
}

/** The attestation as the page shows it, pure. `page` is the PRD page's path, `/prd/<id>`. */
export function attestationView(
  read: { approval: ApprovalInForce; voids: readonly AttestationVoid[]; versions: readonly AttestationVersion[]; member: boolean; asked: readonly string[] },
  page: string,
): AttestationView {
  const { approval, voids } = read;
  const { latest, number } = indexOf(read.versions);
  const voided = new Set(voids.map((v) => v.kind));
  const files = approval.files.map((file): AttestedFile => {
    const now = latest.get(file.kind);
    const same = file.kind === 'voice' || (!voided.has(file.kind) && now?.id === file.version_id);
    const v = number.get(file.version_id);
    return {
      path: file.path,
      pinned: file.sha256 ? short(file.sha256) : '—',
      today: now ? short(now.sha256) : null,
      same,
      restore: same ? null : `${page}?tab=${encodeURIComponent(file.kind)}${v === undefined ? '' : `&v=${v}`}`,
    };
  });
  const drifted = files.some((file) => !file.same);
  const last = voids[voids.length - 1];
  return {
    state: drifted ? 'drifted' : 'building',
    approver: approval.approver_login,
    member: read.member,
    approverTick: read.asked.length === 0 ? 'any' : read.asked.includes(approval.approved_by) ? 'asked' : 'not asked',
    at: stamp(approval.approved_at),
    files,
    voided: last ? `voided by ${last.pusher_login}'s push · ${stamp(last.voided_at)}` : null,
    askAgain: drifted ? `${page}#approve` : null,
  };
}

/** A product PRD's attestation, read as the member; null when nobody approved it yet. Throws when a read fails. */
export async function readAttestation(repository: AttestationRepository, dossier: string, page: string): Promise<AttestationView | null> {
  const approval = await repository.approval(dossier);
  if (!approval) return null;
  const [voids, versions, approvers] = await Promise.all([
    repository.voids(approval.id),
    repository.versions(dossier),
    repository.approvers(dossier, approval.approved_by),
  ]);
  return attestationView({ approval, voids, versions, ...approvers }, page);
}

/** The dossier the page shows, as far as the attestation reads it. */
type Shown = { id: string; prd: PrdNumber | null; kind?: string | undefined; birthplace?: string | null | undefined };

/**
 * The attestation the page shows for `dossier`, read as the member through `db`: a product PRD's (a PRD born
 * on the server, with no repository number) once approved; null for any other dossier, before an approval, or
 * when a read fails, said in the log: the page then shows its approval as it did.
 */
export async function attestationOf(db: AttestationDb, dossier: Shown): Promise<AttestationView | null> {
  if ((dossier.kind ?? 'prd') !== 'prd' || dossier.birthplace !== 'server' || dossier.prd !== null) return null;
  try {
    return await readAttestation(attestationRepository(db), dossier.id, `/prd/${dossier.id}`);
  } catch (error) {
    console.error(error);
    return null;
  }
}
