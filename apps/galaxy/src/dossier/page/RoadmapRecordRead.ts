import type { SupabaseClient } from '@supabase/supabase-js';
import { roadmapReader } from '../../roadmap/store';
import { readApproval, readAskedApprovers, readVoids, type ApprovalRead } from './approval';
import { isRoadmapPart, shownVersion, type RoadmapRecordRead, type RoadmapVersion, type VersionPick } from './RoadmapRecord';

// What a product roadmap's page reads of its dossier (PRD 2011, s3), as the signed-in person, so
// row-level security decides: its versions without their content, the one shown with its text, its
// approval in force, its voids and the members its product asks to approve (the same reads as a ◆ PRD's
// page, ./approval.ts). A roadmap's approval is read from the approvals table by its dossier's id, as
// dossier_approval() finds PRDs only. A read that fails leaves its part saying so, never the page: the
// versions' failure is the whole record's, returned as null.

type Db = Pick<SupabaseClient, 'from'>;

const logged = <T,>(fallback: T) => (error: unknown): T => {
  console.error(error);
  return fallback;
};

/** The dossier's versions, oldest first, only the roadmap's own parts; throws when the database fails or answers out of shape. */
export async function readRoadmapVersions(db: Db, dossier: string): Promise<RoadmapVersion[]> {
  const lines = await roadmapReader(db).dossierVersions(dossier);
  return lines.flatMap((line) => (isRoadmapPart(line.kind) ? [{ ...line, kind: line.kind }] : []));
}

/** The record of dossier `dossier`: its versions and approval, and the text of the version `pick` names;
 * null when its versions could not be read. */
export async function readRoadmapRecord(db: Db, dossier: string, pick: VersionPick): Promise<RoadmapRecordRead | null> {
  const [versions, approval, voids, asked] = await Promise.all([
    readRoadmapVersions(db, dossier).catch(logged(null)),
    readApproval(db, dossier).catch(logged<ApprovalRead>('unread')),
    readVoids(db, dossier).catch(logged(null)),
    readAskedApprovers(db, { id: dossier }).catch(logged<'unread'>('unread')),
  ]);
  if (versions === null) return null;
  const shown = shownVersion(versions, pick);
  const text = shown === null ? null : await roadmapReader(db).versionText(shown.id).catch(logged(null));
  return { dossier, versions, approval, voids, asked, text };
}
