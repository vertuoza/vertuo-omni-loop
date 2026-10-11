import type { PrdNumber } from 'vertuo-omni-plan/kit/lib/ids.ts';
import type { ApprovalRow, ApprovalVoid } from '../page/approval';

// What the Attestation page reads of a ◆ PRD's approval record (PRD 1612 s4): the shape the repository
// (./attestation.repository.ts) answers and the service (./attestation.service.ts) judges.

/** What the member reads of the record. */
export type AttestationFacts = {
  dossier: { id: string; home_repo: string; prd: PrdNumber };
  /** The approval in force's row, null before any approval. */
  approval: ApprovalRow | null;
  /** Who approved it, by account id; null with no approval. */
  approvedBy: string | null;
  /** The dossier's voids, oldest first. */
  voids: readonly ApprovalVoid[];
  /** The approved text of each pinned version the member reads, by version id. */
  contents: ReadonlyMap<string, string>;
  /** The workspace's members, by account id. */
  members: readonly string[];
  /** The members the product asks to approve (none: any member may), or `unread`. */
  asked: readonly string[] | 'unread';
  /** The workspace's name; null when it could not be read. */
  workspace: string | null;
  /** The PRD's product: its name and repositories; null when it has none. */
  product: { name: string; repos: readonly string[] } | null;
};
