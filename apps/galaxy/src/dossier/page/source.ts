// Where /prd/<id> reads (PRD 216, the page to share): straight from the database as the viewer — their
// session cookie on the server, the browser client for the delete — so the migration's row-level
// security decides. A member of the dossier's workspace reads it and its versions; a dossier of another
// workspace reads as missing, exactly like one that never was, and the page says not found either way.
// The workspace's members (ask_members(), PRD 144) name who opened it and who pushed each version.
import type { SupabaseClient } from '@supabase/supabase-js';
import { readMembers } from '../../ask/page/source';
import { dossierReader } from '../store';
import type { DossierRead } from './view';

export type Db = Pick<SupabaseClient, 'from' | 'rpc'>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Dossier ids are uuids; anything else is no dossier anyone has. */
export const isDossierId = (id: string) => UUID.test(id);

/** The dossier, its versions (without their content) and its workspace's members; null when the
 * viewer may not read it, or it does not exist. */
export async function readDossier(db: Db, id: string): Promise<DossierRead | null> {
  if (!isDossierId(id)) return null;
  const reader = dossierReader(db);
  const dossier = await reader.dossier(id);
  if (!dossier) return null;
  const [versions, members] = await Promise.all([reader.versions(id), readMembers(db, dossier.workspace_id)]);
  return { dossier, versions, members };
}

/** One version's content, or null when the viewer may not read it. */
export const readContent = (db: Pick<Db, 'from'>, versionId: string) => dossierReader(db).content(versionId);

/** Version `number` of the dossier's before/after page, or null when there is none the viewer may read. */
export async function readSandboxed(db: Pick<Db, 'from'>, id: string, number: number): Promise<string | null> {
  if (!isDossierId(id) || !Number.isInteger(number) || number < 1) return null;
  const reader = dossierReader(db);
  const version = (await reader.versions(id)).filter((v) => v.kind === 'before-after')[number - 1];
  return version ? reader.content(version.id) : null;
}

/** Deletes a draft as the viewer: false when they are not its opener, it is numbered, or it is gone. */
export const deleteDraft = (db: Pick<Db, 'from'>, id: string) => dossierReader(db).deleteDraft(id);
