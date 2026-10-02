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
// Which of its rounds the viewer may answer on the list (PRD 384) is decided here, on the server, from
// the rounds' sessions and the shares the viewer reads (PRD 144's rule: the session's owner, or a
// member the round is shared with); the database's own rule still refuses anyone else.
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../../../../supabase/database.types.ts';
import { readMembers, sendAnswers } from '../../ask/page/source';
import { askShares } from '../../ask/store';
import { loadPeople } from '../../people/load';
import {
  dossierList, dossierPulse, dossierReader, dossierRounds, type DossierListRow, type DossierPulse, type DossierRoundRow,
  type DossierVersionRow,
} from '../store';
import { parsePlanSlices } from 'vertuo-omni-plan/kit/lib/inbox/territory.ts';
import { isOneOf, propertyOf } from 'vertuo-omni-plan/kit/lib/narrow.ts';
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

/** The dossier's repositories, as the history lists them; null when they cannot be read. */
async function readRepos(db: Pick<Db, 'rpc'>, id: string): Promise<string[] | null> {
  try {
    return (await dossierList(db, id))[0]?.repos ?? null;
  } catch (error) {
    console.error(error);
    return null;
  }
}

/** The rounds shared with `me`; none when the shares cannot be read (their owner still answers). */
async function readSharedWithMe(db: Db, me: string): Promise<Set<string>> {
  try {
    return new Set((await askShares(db).withMe(me)).map((share) => share.round_id));
  } catch (error) {
    console.error(error);
    return new Set();
  }
}

/** The open rounds `me` may answer: those of a session they own, and those shared with them. */
async function readAnswerable(db: Db, rounds: DossierRoundRow[] | null, me: string | null): Promise<string[]> {
  const open = (rounds ?? []).filter((round) => round.status === 'open');
  if (me === null || !open.length) return [];
  const shared = open.some((round) => round.asked_by !== me) ? await readSharedWithMe(db, me) : new Set<string>();
  return open.filter((round) => round.asked_by === me || shared.has(round.round_id)).map((round) => round.round_id);
}

/** The dossier, its versions (without their content), its workspace's members, its rounds, its
 * repositories, the open rounds `me` may answer, and the workspace's people directory for the faces
 * (PRD 652; a failed read falls back to GitHub photos and initials, never an error); null when the viewer may not read it, or it does
 * not exist. */
export async function readDossier(db: Db, id: string, me: string | null = null): Promise<DossierRead | null> {
  if (!isDossierId(id)) return null;
  const reader = dossierReader(db);
  const dossier = await reader.dossier(id);
  if (!dossier) return null;
  const [versions, members, rounds, repos, people] = await Promise.all([
    reader.versions(id), readMembers(db, dossier.workspace_id), readRounds(db, id), readRepos(db, id),
    loadPeople(db as SupabaseClient<Database>, dossier.workspace_id), // ts-allow: loadPeople reads only `from` and `rpc`, the two members a Db has
  ]);
  return { dossier, versions, members, rounds, repos, answerable: await readAnswerable(db, rounds, me), people };
}

/** What one click on a quick round did: answered it, or found it taken — answered first by someone
 * (`by`, null when the terminal answered with no one named), or moved to the terminal. */
export type QuickOutcome =
  | { kind: 'answered' }
  | { kind: 'taken'; by: string | null; via: 'page' | 'terminal' | null; moved: boolean };

/** Answers a quick round from the list, as the viewer, through the question page's own path
 * (`sendAnswers`, `answered_via: 'page'`, only while it is still open); when it was taken, reads who
 * came first. Throws when the database cannot be reached. */
export async function answerQuick(db: Pick<Db, 'from'>, roundId: string, question: string, value: string): Promise<QuickOutcome> {
  if ((await sendAnswers(db, roundId, { [question]: value })) === 'answered') return { kind: 'answered' };
  const { data, error } = await db.from('ask_rounds').select('status, answered_by, answered_via').eq('id', roundId).maybeSingle();
  if (error) throw new Error(`read the round: ${error.message}`);
  // The round as it came, unparsed: each column is checked as it is read.
  const by = propertyOf(data, 'answered_by');
  const via = propertyOf(data, 'answered_via');
  return { kind: 'taken', by: typeof by === 'string' ? by : null, via: isOneOf(['page', 'terminal'] as const, via) ? via : null, moved: propertyOf(data, 'status') !== 'answered' };
}

/** The dossier's pulse, for the change check (PRD 384): one small read, as the viewer, from the browser;
 * null when they may not read it, or the id is no dossier's. */
export async function readPulse(db: Pick<Db, 'rpc'>, id: string): Promise<DossierPulse | null> {
  return isDossierId(id) ? dossierPulse(db, id) : null;
}

/** Every dossier of the viewer's workspaces, as the history lists them. */
export const readHistory = (db: Pick<Db, 'rpc'>): Promise<DossierListRow[]> => dossierList(db);

/** The slices of the dossier's latest plan version (PRD 426: the stage's "m/t slices"); null when
 * there is no plan version, or it cannot be read or holds no slice table. */
export async function readPlanSlices(db: Pick<Db, 'from'>, versions: readonly DossierVersionRow[]): Promise<number | null> {
  const plans = versions.filter((v) => v.kind === 'plan');
  const latest = plans[plans.length - 1];
  if (!latest) return null;
  try {
    const content = await dossierReader(db).content(latest.id);
    return content === null ? null : parsePlanSlices(content).length;
  } catch (error) {
    console.error(error);
    return null;
  }
}

/** One version's content, or null when the viewer may not read it. */
export const readContent = (db: Pick<Db, 'from'>, versionId: string) => dossierReader(db).content(versionId);

/** The pages served sandboxed: a before/after page, and a visual fix's rounds of variations (PRD 627). */
export type SandboxedKind = 'before-after' | 'variations';

/** Version `number` of the dossier's before/after page (or its round `number` of variations), or null when
 * there is none the viewer may read. */
export async function readSandboxed(db: Pick<Db, 'from'>, id: string, number: number, artifact: SandboxedKind = 'before-after'): Promise<string | null> {
  if (!isDossierId(id) || !Number.isInteger(number) || number < 1) return null;
  const reader = dossierReader(db);
  const version = (await reader.versions(id)).filter((v) => v.kind === artifact)[number - 1];
  return version ? reader.content(version.id) : null;
}

/** Deletes a draft as the viewer: false when they are not its opener, it is numbered, or it is gone. */
export const deleteDraft = (db: Pick<Db, 'from'>, id: string) => dossierReader(db).deleteDraft(id);
