// The Concepts list, /concepts (PRD 1272, s2): one card per concept dossier of the signed-in person's
// workspaces, newest first. A concept is a dossier kind (supabase/migrations/20261119090000_concept_dossiers.sql),
// numbered by its issue, pushed by `omni dossier push <n> --kind concept`. The rows come from
// dossier_list(), as /prd's do, read as the signed-in person so row-level security decides; only its
// concept rows are kept. Each concept's latest concept.md (its `concept-record` version) is read once and
// parsed with the kit's own parser, for its kind, its scale and how many of its areas have a PRD. A
// concept.md missing or refused by the parser leaves those unknown, and the card still shows.
//
// PRD 1272 (s4): each card carries the concept's state (./state.ts), read from its stored facts in fix_facts
// as the signed-in person, one read per workspace: the list never reads GitHub. Facts that cannot be read,
// or that the sync has not stored yet, leave the state unknown.
//
// PRD 2213: a merged concept whose every area names a PRD at shipped or retro reads shipped, and its card
// counts them. The PRDs' stages come from StageStore.currentStages, one read per workspace, never GitHub.
import type { ReactNode } from 'react';
import { z } from 'zod';
import { IssueNumberSchema, type IssueNumber, type PrdNumber } from 'vertuo-omni-plan/kit/lib/ids.ts';
import { parseConcept, type ConceptKind, type ConceptScale } from 'vertuo-omni-plan/kit/lib/concept/parse.ts';
import { shortDay } from '../dossier/page/dates';
import { workPath } from '../dossier/page/work';
import { dossierList, dossierReader } from '../dossier/store';
import type { ConceptFacts } from '../dossier/github/fix';
import { conceptFactsStore } from '../fixes/facts/store';
import { stageStore, type StageStore } from '../stages/store';
import type { StoredStage } from '../stages/stage';
import { conceptState, hasShipped, storedStage, type ConceptState } from './state';
import type { Db } from '../dossier/page/source';
import type { ArcadeMode } from '../data/mode';

/** A concept's row of dossier_list(): the fields the list reads, the others left aside. */
const ConceptRowSchema = z.object({
  id: z.string(),
  workspace_id: z.string(),
  kind: z.literal('concept'),
  /** The concept's issue. */
  prd: IssueNumberSchema.nullable(),
  title: z.string(),
  created_at: z.string(),
  /** The repository its issue and its areas' PRDs are in. */
  home_repo: z.string(),
  latest: z.object({ 'concept-record': z.object({ id: z.string() }).optional() }),
});
export type ConceptRow = z.infer<typeof ConceptRowSchema>;

/** One card of the list. */
export type ConceptCard = {
  id: string;
  href: string;
  /** The concept's issue; null for a row with none. */
  number: IssueNumber | null;
  title: string;
  /** From concept.md; null when it is missing or does not parse. */
  kind: ConceptKind | null;
  scale: ConceptScale | null;
  areas: { withPrd: number; shipped: number; total: number } | null;
  /** When the concept's dossier was made, as ISO and as `6 Oct 2026` (UTC). */
  recordedAt: string;
  recorded: string;
  /** In review, in the inbox, shipped or unknown, from its stored facts and its PRDs' stages. */
  state: ConceptState;
  /** The name of the product it carries (PRD 2011); null when it has none. */
  product: string | null;
  /** Its workspace, for the product filter. */
  workspaceId: string;
};

/** The concept rows among dossier_list()'s, in their order: every other kind is left out. */
function conceptRows(rows: readonly unknown[]): ConceptRow[] {
  return rows.flatMap((row) => {
    const parsed = ConceptRowSchema.safeParse(row);
    return parsed.success ? [parsed.data] : [];
  });
}

const dated = (iso: string) => `${shortDay(iso)} ${new Date(iso).getUTCFullYear()}`;

const UNKNOWN_RECORD = { kind: null, scale: null, areas: null } as const;

/** The stored stage of each PRD of a workspace, by `prdKey`. */
type Stages = ReadonlyMap<string, StoredStage>;
type ParsedAreas = readonly { prd: PrdNumber | null }[] | null;

/** What a card reads of concept.md: its kind, its scale and its areas with a PRD and a shipped one; all
 * unknown when it is missing or the parser refuses it. `list` is the areas, for the state. */
function recordFacts(text: string | undefined, repo: string, stages: Stages): Pick<ConceptCard, 'kind' | 'scale' | 'areas'> & { list: ParsedAreas } {
  const parsed = text === undefined ? null : parseConcept(text);
  if (!parsed?.ok) return { ...UNKNOWN_RECORD, list: null };
  const { kind, scale, areas } = parsed.record;
  const shipped = areas.filter((area) => area.prd !== null && hasShipped(storedStage(stages, repo, area.prd))).length;
  return { kind, scale, areas: { withPrd: areas.filter((area) => area.prd !== null).length, shipped, total: areas.length }, list: areas };
}

/** The cards of `rows`, newest first, each read with its concept.md from `records` and its stored facts
 * from `facts` (both by dossier id), its PRDs' stages from `stages` (by workspace id, then `prdKey`). */
export function conceptCards(
  rows: readonly ConceptRow[], records: ReadonlyMap<string, string>, facts: ReadonlyMap<string, ConceptFacts> = new Map(),
  stages: ReadonlyMap<string, Stages> = new Map(),
): ConceptCard[] {
  return rows
    .map((row): ConceptCard => {
      const workspaceStages = stages.get(row.workspace_id) ?? new Map<string, StoredStage>();
      const { list, ...record } = recordFacts(records.get(row.id), row.home_repo, workspaceStages);
      return {
        id: row.id,
        href: workPath('concept', row.id),
        number: row.prd,
        title: row.title,
        ...record,
        recordedAt: row.created_at,
        recorded: dated(row.created_at),
        state: conceptState(facts.get(row.id) ?? null, list && { repo: row.home_repo, areas: list, stages: workspaceStages }),
        product: null,
        workspaceId: row.workspace_id,
      };
    })
    .sort((a, b) => Date.parse(b.recordedAt) - Date.parse(a.recordedAt) || a.id.localeCompare(b.id));
}

/** Every concept the caller may read, as cards, newest first. Rejects when the list cannot be read; a
 * concept.md that cannot be read leaves its card's kind, scale and areas unknown. */
export async function readConcepts(db: Pick<Db, 'rpc' | 'from'>, stageReader: Pick<StageStore, 'currentStages'> = stageStore(db)): Promise<ConceptCard[]> {
  // dossier_list()'s rows as they came: since PRD 1272 they hold concepts, which the store's row type does not name.
  const listed: readonly unknown[] = await dossierList(db);
  const rows = conceptRows(listed);
  const reader = dossierReader(db);
  const records = await Promise.all(rows.map(async (row): Promise<[string, string] | null> => {
    const version = row.latest['concept-record']?.id;
    if (!version) return null;
    try {
      const content = await reader.content(version);
      return content === null ? null : [row.id, content];
    } catch (error) {
      console.error(error);
      return null;
    }
  }));
  const facts = await storedFacts(db, rows);
  const recorded = new Map(records.filter((entry) => entry !== null));
  return conceptCards(rows, recorded, facts, await storedStages(stageReader, rows, recorded));
}

/** The stored facts of each concept, by dossier id, one read per workspace; a workspace whose facts
 * cannot be read leaves its concepts out (logged), their state unknown. */
async function storedFacts(db: Pick<Db, 'from'>, rows: readonly ConceptRow[]): Promise<Map<string, ConceptFacts>> {
  const store = conceptFactsStore(db);
  const byWorkspace = new Map<string, string[]>();
  for (const row of rows) byWorkspace.set(row.workspace_id, [...(byWorkspace.get(row.workspace_id) ?? []), row.id]);
  const facts = new Map<string, ConceptFacts>();
  for (const [workspace, ids] of byWorkspace) {
    try {
      for (const [id, read] of await store.readFacts(workspace, ids)) facts.set(id, read);
    } catch (error) {
      console.error(error);
    }
  }
  return facts;
}

/** The stored stage of each PRD the concepts' areas name, one read per workspace (none when no area names a
 * PRD); a workspace whose stages cannot be read is left out (logged), its concepts never shipped. */
async function storedStages(
  store: Pick<StageStore, 'currentStages'>, rows: readonly ConceptRow[], records: ReadonlyMap<string, string>,
): Promise<Map<string, Stages>> {
  const wanted = new Map<string, { repository: string; prd: PrdNumber }[]>();
  for (const row of rows) {
    const named = namedPrds(records.get(row.id)).map((prd) => ({ repository: row.home_repo, prd }));
    if (named.length > 0) wanted.set(row.workspace_id, [...(wanted.get(row.workspace_id) ?? []), ...named]);
  }
  const stages = new Map<string, Stages>();
  for (const [workspace, prds] of wanted) {
    try {
      stages.set(workspace, await store.currentStages(workspace, prds));
    } catch (error) {
      console.error(error);
    }
  }
  return stages;
}

/** The PRDs the areas of concept.md `text` name; none when it is missing or does not parse. */
function namedPrds(text: string | undefined): PrdNumber[] {
  const parsed = text === undefined ? null : parseConcept(text);
  return parsed?.ok ? parsed.record.areas.flatMap((area) => (area.prd === null ? [] : [area.prd])) : [];
}

/** What /concepts shows: no dossier here, a sign-in, a database that did not answer, or the cards. */
export type ConceptListState =
  | { kind: 'closed' }
  | { kind: 'signed-out' }
  | { kind: 'down' }
  | { kind: 'listed'; cards: ConceptCard[]; above?: ReactNode };

/** The session /concepts reads as: its database and the signed-in person, null when signed out; null
 * when this deployment keeps no dossier. */
type Session = { db: Pick<Db, 'rpc' | 'from'>; user: object | null } | null;

/** What narrows the cards by product (PRD 2011) and what to draw above them: the product filter. */
export type ConceptScope = (
  db: Pick<Db, 'rpc' | 'from'>, cards: ConceptCard[],
) => Promise<{ cards: ConceptCard[]; above: ReactNode }>;

/** What /concepts shows in `mode`: the demo holds no concept, a deployment with no database keeps none,
 * a signed-out person is asked to sign in, and a read that fails says so. */
export async function conceptListState(
  mode: ArcadeMode,
  session: (mode: ArcadeMode) => Promise<Session>,
  read: (db: Pick<Db, 'rpc' | 'from'>) => Promise<ConceptCard[]> = readConcepts,
  scope?: ConceptScope,
): Promise<ConceptListState> {
  if (mode === 'demo') return { kind: 'listed', cards: [] };
  const seen = await session(mode);
  if (!seen) return { kind: 'closed' };
  if (!seen.user) return { kind: 'signed-out' };
  try {
    const cards = await read(seen.db);
    return scope ? { kind: 'listed', ...await scope(seen.db, cards) } : { kind: 'listed', cards };
  } catch (error) {
    console.error(error);
    return { kind: 'down' };
  }
}
