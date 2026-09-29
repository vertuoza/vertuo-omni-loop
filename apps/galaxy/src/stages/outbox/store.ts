// The one way into the stored PRD outboxes (supabase/migrations/20261012090000_prd_outbox.sql, PRD 657
// s5): public.prd_outbox. The stages sync, the stage events and the sends write, as the service role;
// /prd and the waiting outbox read, as the signed-in member, so row-level security keeps each
// workspace's rows to its members. A PRD is a workspace, a repository (kept in lower case) and an issue
// number. A write replaces the PRD's counts. A refusal throws with Supabase's reason.
import type { SupabaseClient } from '@supabase/supabase-js';
import { prdKey, type PrdRef, type StageKey } from '../store';

const TABLE = 'prd_outbox';

/** An open outbox item that waits on a person: ranked human-action or high, its feature PR open. */
export type WaitingQuestion = { id: string; rank: 'human-action' | 'high'; question: string };

/** What a PRD's outbox holds open: every open item, and those that wait on a person. */
export type OutboxCounts = { open_questions: number; waiting: WaitingQuestion[] };

/** A PRD's counts, as stored. */
export type OutboxRecord = StageKey & OutboxCounts;

export type PrdOutboxStore = {
  /** Records each PRD's counts, replacing the ones it had, taken at `syncedAt`. */
  record(rows: readonly OutboxRecord[], syncedAt?: string): Promise<void>;
  /** The stored counts of the workspace's PRDs among `prds`, keyed by `prdKey`; a PRD with none is left out. */
  countsOf(workspace: string, prds: readonly PrdRef[]): Promise<Map<string, OutboxCounts>>;
};

type Refusal = { message: string; code?: string } | null;

function settle(what: string, error: Refusal): void {
  if (error) throw new Error(`Supabase refused to ${what}: ${error.message}${error.code ? ` (${error.code})` : ''}`);
}

const RANKS = new Set(['human-action', 'high']);

/** The waiting items a row holds, dropping any that is not one. */
export function waitingOf(value: unknown): WaitingQuestion[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((raw): WaitingQuestion[] => {
    const item = (raw ?? {}) as Record<string, unknown>;
    if (typeof item.id !== 'string' || typeof item.question !== 'string' || typeof item.rank !== 'string' || !RANKS.has(item.rank)) return [];
    return [{ id: item.id, rank: item.rank as WaitingQuestion['rank'], question: item.question }];
  });
}

export function prdOutboxStore(db: Pick<SupabaseClient, 'from'>): PrdOutboxStore {
  return {
    async record(rows, syncedAt = new Date().toISOString()) {
      if (rows.length === 0) return;
      const values = rows.map((r) => ({
        workspace_id: r.workspace_id, repository: r.repository.toLowerCase(), prd: r.prd,
        open_questions: r.open_questions, waiting: r.waiting, synced_at: syncedAt,
      }));
      const { error } = await db.from(TABLE).upsert(values, { onConflict: 'workspace_id,repository,prd' });
      settle(`record the outbox of ${rows.length} ${rows.length === 1 ? 'PRD' : 'PRDs'}`, error);
    },

    async countsOf(workspace, prds) {
      const counts = new Map<string, OutboxCounts>();
      if (prds.length === 0) return counts;
      const wanted = new Set(prds.map(prdKey));
      const numbers = [...new Set(prds.map((p) => p.prd))];
      const { data, error } = await db.from(TABLE).select('repository, prd, open_questions, waiting')
        .eq('workspace_id', workspace).in('prd', numbers);
      settle('read the outboxes', error);
      for (const row of (data ?? []) as Record<string, unknown>[]) {
        const key = prdKey({ repository: String(row.repository), prd: Number(row.prd) });
        if (!wanted.has(key)) continue;
        counts.set(key, { open_questions: Number(row.open_questions) || 0, waiting: waitingOf(row.waiting) });
      }
      return counts;
    },
  };
}
