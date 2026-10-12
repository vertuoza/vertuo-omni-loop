// The one way into the stored fix facts (supabase/migrations/20261014090000_fix_facts.sql, PRD 691 s1):
// public.fix_facts. The stages sync and a fix's own page write, as the service role; /bugs and /visual
// read, as the signed-in member, so row-level security keeps each workspace's rows to its members. A row
// is a fix dossier's FixSummary, exactly as the reader returns it, each part the string 'unread' when
// GitHub could not read it. A write replaces the fix's facts. A row whose facts are not a FixSummary is
// read as none. A refusal throws with Supabase's reason.
//
// PRD 1272 (s4): a concept dossier's facts live in the same table, as its ConceptFacts, {issue, pull}:
// written by the sync and the concept's page, read by /concepts and the page. Each store reads a row only
// as its own shape, and never asks for another kind's ids.
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '../../../../../supabase/database.types.ts';
import { z } from 'zod';
import type { ConceptFacts, FixSummary } from '../../dossier/github/fix';
import { UNREAD } from '../../dossier/github/summary';
import { textOf } from '../../data/unparsed';
import { settle } from '../../stages/store';
import { IssueNumberSchema, PrNumberSchema } from 'vertuo-omni-plan/kit/lib/ids.ts';

const TABLE = 'fix_facts';

/** A dossier's facts of shape `T`, to store. */
export type FactsRow<T> = { dossier_id: string; workspace_id: string; facts: T };

/** Stored facts of shape `T`, by dossier. */
export type FactsStore<T> = {
  /** The stored facts of the workspace's dossiers among `ids`, by dossier id; a dossier with none is left out. */
  readFacts(workspace: string, ids: readonly string[]): Promise<Map<string, T>>;
  /** Stores each dossier's facts, replacing the ones it had, read at `syncedAt`. */
  writeFacts(rows: readonly FactsRow<T>[], syncedAt?: string): Promise<void>;
};

/** A fix dossier's stored facts. */
export type FixFactsStore = FactsStore<FixSummary>;
/** A concept dossier's stored facts (PRD 1272, s4). */
export type ConceptFactsStore = FactsStore<ConceptFacts>;

/** A part as stored: its value, or UNREAD. */
const read = <T extends z.ZodType>(part: T) => z.union([z.literal(UNREAD), part]);

const IssuePart = read(z.object({
  number: IssueNumberSchema, url: z.string(), state: z.enum(['open', 'closed']), author: z.string().nullable(), createdAt: z.string(),
  risk: z.string().nullable(), regression: z.boolean(),
}).nullable());
const PullPart = read(z.object({
  number: PrNumberSchema, url: z.string(), state: z.enum(['open', 'merged']), mergedAt: z.string().nullable(), mergedBy: z.string().nullable(),
}).nullable());

const Summary = z.object({
  issue: IssuePart,
  pull: PullPart,
  approvals: read(z.array(z.object({ login: z.string(), at: z.string() }))),
  release: read(z.object({ tag: z.string(), url: z.string(), at: z.string() }).nullable()),
});
const Concept = z.object({ issue: IssuePart, pull: PullPart });

/** A stored `facts` value as a FixSummary; null when it is not one. */
export function factsOf(value: unknown): FixSummary | null {
  const parsed = Summary.safeParse(value);
  return parsed.success ? parsed.data : null;
}

/** A stored `facts` value as a concept's facts; null when it is not one. */
export function conceptFactsOf(value: unknown): ConceptFacts | null {
  const parsed = Concept.safeParse(value);
  return parsed.success ? parsed.data : null;
}

/** fix_facts, its rows read as `parse` reads them; `what` names one dossier in a refusal (`fix`, `concept`). */
function factsStore<T extends Json>(db: Pick<SupabaseClient<Database>, 'from'>, parse: (value: unknown) => T | null, what: { one: string; many: string }): FactsStore<T> {
  return {
    async readFacts(workspace, ids) {
      const facts = new Map<string, T>();
      const wanted = [...new Set(ids)];
      if (wanted.length === 0) return facts;
      const { data, error } = await db.from(TABLE).select('dossier_id, facts').eq('workspace_id', workspace).in('dossier_id', wanted);
      settle(`read the ${what.one} facts`, error);
      for (const row of data ?? []) {
        const parsed = parse(row.facts);
        if (parsed) facts.set(textOf(row.dossier_id), parsed);
      }
      return facts;
    },

    async writeFacts(rows, syncedAt = new Date().toISOString()) {
      if (rows.length === 0) return;
      const values = rows.map((r) => ({ dossier_id: r.dossier_id, workspace_id: r.workspace_id, facts: r.facts, synced_at: syncedAt }));
      const { error } = await db.from(TABLE).upsert(values, { onConflict: 'dossier_id' });
      settle(`store the facts of ${rows.length} ${rows.length === 1 ? what.one : what.many}`, error);
    },
  };
}

export function fixFactsStore(db: Pick<SupabaseClient<Database>, 'from'>): FixFactsStore {
  return factsStore(db, factsOf, { one: 'fix', many: 'fixes' });
}

export function conceptFactsStore(db: Pick<SupabaseClient<Database>, 'from'>): ConceptFactsStore {
  return factsStore(db, conceptFactsOf, { one: 'concept', many: 'concepts' });
}
