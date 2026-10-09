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
import { z } from 'zod';
import { IssueNumberSchema, type IssueNumber } from 'vertuo-omni-plan/kit/lib/ids.ts';
import { parseConcept, type ConceptKind, type ConceptScale } from 'vertuo-omni-plan/kit/lib/concept/parse.ts';
import { shortDay } from '../dossier/page/dates';
import { workPath } from '../dossier/page/work';
import { dossierList, dossierReader } from '../dossier/store';
import type { ConceptFacts } from '../dossier/github/fix';
import { conceptFactsStore } from '../fixes/facts/store';
import { conceptState, type ConceptState } from './state';
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
  areas: { withPrd: number; total: number } | null;
  /** When the concept's dossier was made, as ISO and as `6 Oct 2026` (UTC). */
  recordedAt: string;
  recorded: string;
  /** In review, in the inbox or unknown, from its stored facts. */
  state: ConceptState;
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

/** What a card reads of concept.md: its kind, its scale and its areas with a PRD; all unknown when it is
 * missing or the parser refuses it. */
function recordFacts(text: string | undefined): Pick<ConceptCard, 'kind' | 'scale' | 'areas'> {
  const parsed = text === undefined ? null : parseConcept(text);
  if (!parsed?.ok) return UNKNOWN_RECORD;
  const { kind, scale, areas } = parsed.record;
  return { kind, scale, areas: { withPrd: areas.filter((area) => area.prd !== null).length, total: areas.length } };
}

/** The cards of `rows`, newest first, each read with its concept.md from `records` and its stored facts
 * from `facts` (both by dossier id). */
export function conceptCards(
  rows: readonly ConceptRow[], records: ReadonlyMap<string, string>, facts: ReadonlyMap<string, ConceptFacts> = new Map(),
): ConceptCard[] {
  return rows
    .map((row): ConceptCard => ({
      id: row.id,
      href: workPath('concept', row.id),
      number: row.prd,
      title: row.title,
      ...recordFacts(records.get(row.id)),
      recordedAt: row.created_at,
      recorded: dated(row.created_at),
      state: conceptState(facts.get(row.id) ?? null),
    }))
    .sort((a, b) => Date.parse(b.recordedAt) - Date.parse(a.recordedAt) || a.id.localeCompare(b.id));
}

/** Every concept the caller may read, as cards, newest first. Rejects when the list cannot be read; a
 * concept.md that cannot be read leaves its card's kind, scale and areas unknown. */
export async function readConcepts(db: Pick<Db, 'rpc' | 'from'>): Promise<ConceptCard[]> {
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
  return conceptCards(rows, new Map(records.filter((entry) => entry !== null)), facts);
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

/** What /concepts shows: no dossier here, a sign-in, a database that did not answer, or the cards. */
export type ConceptListState =
  | { kind: 'closed' }
  | { kind: 'signed-out' }
  | { kind: 'down' }
  | { kind: 'listed'; cards: ConceptCard[] };

/** The session /concepts reads as: its database and the signed-in person, null when signed out; null
 * when this deployment keeps no dossier. */
type Session = { db: Pick<Db, 'rpc' | 'from'>; user: object | null } | null;

/** What /concepts shows in `mode`: the demo holds no concept, a deployment with no database keeps none,
 * a signed-out person is asked to sign in, and a read that fails says so. */
export async function conceptListState(
  mode: ArcadeMode,
  session: (mode: ArcadeMode) => Promise<Session>,
  read: (db: Pick<Db, 'rpc' | 'from'>) => Promise<ConceptCard[]> = readConcepts,
): Promise<ConceptListState> {
  if (mode === 'demo') return { kind: 'listed', cards: [] };
  const seen = await session(mode);
  if (!seen) return { kind: 'closed' };
  if (!seen.user) return { kind: 'signed-out' };
  try {
    return { kind: 'listed', cards: await read(seen.db) };
  } catch (error) {
    console.error(error);
    return { kind: 'down' };
  }
}
