// Where /prd/<id> reads (PRD 216, the page to share): straight from the database as the viewer — their
// session cookie on the server, the browser client for the delete — so the migration's row-level
// security decides. A member of the dossier's workspace reads it and its versions; a dossier of another
// workspace reads as missing, exactly like one that never was, and the page says not found either way.
// The workspace's members (ask_members(), PRD 144) name who opened it and who pushed each version.
// Its rounds (dossier_rounds(), PRD 216 step 3) are the questions that shaped it, read as the viewer
// too; when they cannot be read, the page still shows the dossier and its Questions tab says so.
// Its repositories (dossier_list(), step 4: its home, its questions' and its planet's regions) are its
// header's chips; when they cannot be read, the chip is its home repository alone. /prd, the history,
// reads dossier_list() whole, as the viewer: every dossier of their workspaces.
// Its latest outbox (PRD 251) is read as the viewer too; when it cannot be read, the page still shows
// the dossier and its Outbox tab says the outbox is out of reach. /prd/at/<owner>/<repo>/<n> finds a
// dossier by its key, among those the viewer may read.
import type { SupabaseClient } from '@supabase/supabase-js';
import { outboxReader } from '../../outbox/store';
import type { OutboxRead } from '../../outbox/count';
import { readMembers } from '../../ask/page/source';
import { dossierList, dossierReader, dossierRounds, type DossierListRow, type DossierRoundRow } from '../store';
import type { DossierRead } from './view';

export type Db = Pick<SupabaseClient, 'from' | 'rpc'>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Dossier ids are uuids; anything else is no dossier anyone has. */
export const isDossierId = (id: string) => UUID.test(id);

/** The dossier's rounds; null when they cannot be read. */
async function readRounds(db: Pick<Db, 'rpc'>, id: string): Promise<DossierRoundRow[] | null> {
  try {
    return await dossierRounds(db, id);
  } catch (error) {
    console.error(error);
    return null;
  }
}

/** The dossier's latest outbox, or a read that failed. */
async function readOutbox(db: Pick<Db, 'from'>, id: string): Promise<OutboxRead> {
  try {
    return { row: await outboxReader(db).latest(id) };
  } catch (error) {
    console.error(error);
    return { failed: true };
  }
}

/** The dossier's repositories, as the history lists them; null when they cannot be read. */
async function readRepos(db: Pick<Db, 'rpc'>, id: string): Promise<string[] | null> {
  try {
    return (await dossierList(db, id))[0]?.repos ?? null;
  } catch (error) {
    console.error(error);
    return null;
  }
}

/** The dossier, its versions (without their content), its workspace's members, its rounds and its
 * repositories; null when the viewer may not read it, or it does not exist. */
export async function readDossier(db: Db, id: string): Promise<DossierRead | null> {
  if (!isDossierId(id)) return null;
  const reader = dossierReader(db);
  const dossier = await reader.dossier(id);
  if (!dossier) return null;
  const [versions, members, rounds, repos, outbox] = await Promise.all([
    reader.versions(id), readMembers(db, dossier.workspace_id), readRounds(db, id), readRepos(db, id), readOutbox(db, id),
  ]);
  return { dossier, versions, members, rounds, repos, outbox };
}

/** The id of the dossier of `repo`'s PRD `prd` the viewer may read, or null when there is none. */
export const findDossier = (db: Pick<Db, 'from'>, repo: string, prd: number) => dossierReader(db).byKey(repo, prd);

/** Every dossier of the viewer's workspaces, as the history lists them. */
export const readHistory = (db: Pick<Db, 'rpc'>): Promise<DossierListRow[]> => dossierList(db);

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
