// The one way into the stored fix facts (supabase/migrations/20261014090000_fix_facts.sql, PRD 691 s1):
// public.fix_facts. The stages sync and a fix's own page write, as the service role; /bugs and /visual
// read, as the signed-in member, so row-level security keeps each workspace's rows to its members. A row
// is a fix dossier's FixSummary, exactly as the reader returns it, each part the string 'unread' when
// GitHub could not read it. A write replaces the fix's facts. A row whose facts are not a FixSummary is
// read as none. A refusal throws with Supabase's reason.
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import type { FixSummary } from '../../dossier/github/fix';
import { UNREAD } from '../../dossier/github/summary';
import { settle } from '../../stages/store';

const TABLE = 'fix_facts';

/** A fix dossier's facts, to store. */
export type FixFactsRow = { dossier_id: string; workspace_id: string; facts: FixSummary };

export type FixFactsStore = {
  /** The stored facts of the workspace's fixes among `ids`, by dossier id; a fix with none is left out. */
  readFacts(workspace: string, ids: readonly string[]): Promise<Map<string, FixSummary>>;
  /** Stores each fix's facts, replacing the ones it had, read at `syncedAt`. */
  writeFacts(rows: readonly FixFactsRow[], syncedAt?: string): Promise<void>;
};

/** A part as stored: its value, or UNREAD. */
const read = <T extends z.ZodTypeAny>(part: T) => z.union([z.literal(UNREAD), part]);

const Summary = z.object({
  issue: read(z.object({
    number: z.number(), url: z.string(), state: z.enum(['open', 'closed']), author: z.string().nullable(), createdAt: z.string(),
    risk: z.string().nullable(), regression: z.boolean(),
  }).nullable()),
  pull: read(z.object({
    number: z.number(), url: z.string(), state: z.enum(['open', 'merged']), mergedAt: z.string().nullable(), mergedBy: z.string().nullable(),
  }).nullable()),
  approvals: read(z.array(z.object({ login: z.string(), at: z.string() }))),
  release: read(z.object({ tag: z.string(), url: z.string(), at: z.string() }).nullable()),
});

/** A stored `facts` value as a FixSummary; null when it is not one. */
export function factsOf(value: unknown): FixSummary | null {
  const parsed = Summary.safeParse(value);
  return parsed.success ? (parsed.data as FixSummary) : null;
}

export function fixFactsStore(db: Pick<SupabaseClient, 'from'>): FixFactsStore {
  return {
    async readFacts(workspace, ids) {
      const facts = new Map<string, FixSummary>();
      const wanted = [...new Set(ids)];
      if (wanted.length === 0) return facts;
      const { data, error } = await db.from(TABLE).select('dossier_id, facts').eq('workspace_id', workspace).in('dossier_id', wanted);
      settle('read the fix facts', error);
      for (const row of (data ?? []) as Record<string, unknown>[]) {
        const summary = factsOf(row.facts);
        if (summary) facts.set(String(row.dossier_id), summary);
      }
      return facts;
    },

    async writeFacts(rows, syncedAt = new Date().toISOString()) {
      if (rows.length === 0) return;
      const values = rows.map((r) => ({ dossier_id: r.dossier_id, workspace_id: r.workspace_id, facts: r.facts, synced_at: syncedAt }));
      const { error } = await db.from(TABLE).upsert(values, { onConflict: 'dossier_id' });
      settle(`store the facts of ${rows.length} ${rows.length === 1 ? 'fix' : 'fixes'}`, error);
    },
  };
}
