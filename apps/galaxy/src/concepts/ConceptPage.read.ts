// What /concepts/<id> reads (PRD 1272, s3): the concept's dossier, straight from the database as the
// signed-in person, so row-level security decides. A member of its workspace reads it; anyone else, an id
// that is no dossier's, and a dossier of another kind read as not found, in the same words. Its versions
// are listed without their content; only the latest concept.md is read (Overview and Areas), with
// debate.md on the Debate tab only, and, on Areas, which of its areas' PRDs have a page. The framed tabs
// read nothing here: their sandboxed routes read their own version (../dossier/page/sandbox-live.ts).
// The demo holds no concept, and a deployment with no database keeps none.
//
// PRD 1272 (s4): its facts (its issue and its concept PR), for the state chip and the PR link, are read
// beside its versions through `facts`: by default ./state.live.ts, the stored ones at once, else GitHub.
// Facts that cannot be had leave the state unknown, and the page still renders.
import { parseConcept } from 'vertuo-omni-plan/kit/lib/concept/parse.ts';
import { parseIssue, type PrdNumber } from 'vertuo-omni-plan/kit/lib/ids.ts';
import type { ConceptFacts } from '../dossier/github/fix';
import type { ArcadeMode } from '../data/mode';
import { isDossierId, type Db } from '../dossier/page/source';
import { rowKind } from '../dossier/page/work';
import { dossierReader, type DossierReader } from '../dossier/store';
import { readAreaPages } from './areas';
import { conceptView, type ConceptPageView, type ConceptPick, type ConceptRead } from './ConceptPage.view';
import { liveConceptFacts, type ConceptFactsRead } from './state.live';

/** The latest version of `kind` among `versions`, oldest first; undefined when there is none. */
const latest = (versions: readonly { id: string; kind: string }[], kind: string) => versions.filter((v) => v.kind === kind).at(-1);

/** One version's text; null when it cannot be read (logged). */
async function textOf(read: () => Promise<string | null>): Promise<string | null> {
  try {
    return await read();
  } catch (error) {
    console.error(error);
    return null;
  }
}

/** The latest version of `kind`'s text, when `wanted`; null otherwise, with none, or when it cannot be read. */
async function latestText(reader: DossierReader, versions: readonly { id: string; kind: string }[], kind: string, wanted = true): Promise<string | null> {
  const version = wanted ? latest(versions, kind) : undefined;
  return version ? textOf(() => reader.content(version.id)) : null;
}

/** The PRDs the areas of `record` name, when it parses; none otherwise. */
function areaPrds(record: string | null): PrdNumber[] {
  const parsed = record === null ? null : parseConcept(record);
  return parsed?.ok ? parsed.record.areas.flatMap((area) => (area.prd === null ? [] : [area.prd])) : [];
}

/** Concept `id` as the viewer reads it for `pick`; null when they may not read it, it does not exist, or
 * it is not a concept. Rejects when the dossier itself cannot be read. */
async function readConcept(db: Pick<Db, 'from'>, id: string, pick: ConceptPick, facts: ConceptFactsRead = liveConceptFacts): Promise<ConceptRead | null> {
  if (!isDossierId(id)) return null;
  const reader = dossierReader(db);
  const row = await reader.dossier(id);
  if (!row || rowKind(row) !== 'concept') return null;
  // Each version's kind as it came: a concept's are not the kinds the store's row type names.
  const versions = (await reader.versions(id)).map((v): { id: string; kind: string } => ({ id: v.id, kind: v.kind }));
  const [record, debate, read] = await Promise.all([
    latestText(reader, versions, 'concept-record'),
    latestText(reader, versions, 'debate', pick.tab === 'debate'),
    row.prd === null ? Promise.resolve<ConceptFacts | null>(null) : facts(db, { id: row.id, workspace_id: row.workspace_id, home_repo: row.home_repo, prd: parseIssue(row.prd) }),
  ]);
  const prds = pick.tab === 'areas' ? areaPrds(record) : [];
  const pages = prds.length ? await readAreaPages(reader, row.home_repo, prds) : new Map<PrdNumber, string>();
  return { id: row.id, repo: row.home_repo, number: row.prd, title: row.title, versions, record, debate, pages, facts: read };
}

/** What /concepts/<id> shows: no dossier here, a sign-in, a database that did not answer, not found, or the page. */
export type ConceptPageState =
  | { kind: 'closed' }
  | { kind: 'signed-out' }
  | { kind: 'down' }
  | { kind: 'not-found' }
  | { kind: 'page'; view: ConceptPageView };

/** The session /concepts/<id> reads as: its database and the signed-in person, null when signed out; null
 * when this deployment keeps no dossier. */
type Session = { db: Pick<Db, 'from'>; user: object | null } | null;

/** What /concepts/<id> shows in `mode` for `pick`. */
export async function conceptPageState(
  mode: ArcadeMode,
  session: (mode: ArcadeMode) => Promise<Session>,
  id: string,
  pick: ConceptPick,
  read: (db: Pick<Db, 'from'>, id: string, pick: ConceptPick) => Promise<ConceptRead | null> = readConcept,
): Promise<ConceptPageState> {
  if (mode === 'demo') return { kind: 'not-found' };
  const seen = await session(mode);
  if (!seen) return { kind: 'closed' };
  if (!seen.user) return { kind: 'signed-out' };
  let concept: ConceptRead | null;
  try {
    concept = await read(seen.db, id, pick);
  } catch (error) {
    console.error(error);
    return { kind: 'down' };
  }
  return concept ? { kind: 'page', view: conceptView(concept, pick) } : { kind: 'not-found' };
}
