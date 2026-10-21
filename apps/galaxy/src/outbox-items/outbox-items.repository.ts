// A product PRD's outbox storage (PRD 1548 s7; ADR-0095), on the client it is given: the caller's own,
// acting as their access token, so row-level security and the outbox RPCs have the last word (a member of
// the PRD's workspace reads its items and settlements, and writes them only through outbox_item_put(),
// outbox_item_adopt() and outbox_settle(), supabase/migrations/20261204100000_outbox_items.sql). Every
// answer is parsed where it comes in; it holds no rule. A refusal comes back as the database's code,
// message and hint; an answer out of shape as the code `shape`.
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import type { WorkSliceId } from 'omni-loop/kit/lib/ids.ts';
import { propertyOf } from 'omni-loop/kit/lib/narrow.ts';

/** What the reads and writes need: the tables, and the database's functions. */
export type OutboxItemsDb = Pick<SupabaseClient, 'from' | 'rpc'>;

/** A stored answer: its value, or why the database said no. */
export type Stored<T> = { ok: true; value: T } | { ok: false; code: string | null; message: string | null; hint: string | null };

const ITEM_COLUMNS = 'item, rank, repository, body, raised_at, outbox_settlements(verdict, basis, answer, channel, settler_login, settled_at)';

/** One item as the table holds it, with its settlements (at most one). */
const StoredItem = z.object({
  item: z.string(),
  rank: z.string(),
  repository: z.string().nullable(),
  body: z.string(),
  raised_at: z.string(),
  outbox_settlements: z.array(z.object({
    verdict: z.string(),
    basis: z.string(),
    answer: z.string().nullable(),
    channel: z.string().nullable(),
    settler_login: z.string(),
    settled_at: z.string(),
  })),
});
export type StoredItemRow = z.infer<typeof StoredItem>;

/** An item's columns, as the kit's item parser read them from its body, and the body itself. */
export type ItemColumns = { item: string; slice: WorkSliceId; rank: string; bearsOn: string; wave: number; raised: string; body: string };

/** Which product PRD a write is about, and the repository it comes from. */
export type PrdOnProduct = { key: string; seq: number; repo: string | null };

type Raw = { data: unknown; error: { code?: string; message?: string; hint?: string } | null };

async function parsed<T>(call: PromiseLike<Raw>, schema: z.ZodType<T>, what: string): Promise<Stored<T>> {
  const { data, error } = await call;
  if (error) return { ok: false, code: error.code ?? null, message: error.message ?? null, hint: error.hint ?? null };
  const read = schema.safeParse(data);
  return read.success ? { ok: true, value: read.data } : { ok: false, code: 'shape', message: `${what} answered out of shape`, hint: null };
}

/** The arguments an item's put or adoption takes. */
const itemArgs = ({ key, seq, repo }: PrdOnProduct, columns: ItemColumns) => ({
  p_product: key, p_prd: seq, p_item: columns.item, p_slice: columns.slice, p_rank: columns.rank, p_bears_on: columns.bearsOn,
  p_wave: columns.wave, p_raised: columns.raised, p_body: columns.body, ...(repo === null ? {} : { p_repository: repo }),
});

export function outboxItemsRepository(db: OutboxItemsDb) {
  return {
    /** The id of product PRD `<key>-<seq>`'s dossier, as the caller may read it, or null. */
    dossier: async ({ key, seq, repo }: PrdOnProduct): Promise<Stored<string | null>> => {
      const found = await parsed(db.rpc('dossier_approval', { p_repo: repo, p_prd: seq, p_product: key }), z.unknown(), 'dossier_approval()');
      if (!found.ok) return found;
      const dossier = propertyOf(found.value, 'dossier');
      return { ok: true, value: typeof dossier === 'string' ? dossier : null };
    },

    /** Every item of the dossier, oldest first, with its settlement. */
    items: (dossier: string): Promise<Stored<StoredItemRow[]>> =>
      parsed(db.from('outbox_items').select(ITEM_COLUMNS).eq('dossier_id', dossier).order('raised_at').order('item'), z.array(StoredItem), 'outbox_items'),

    /** Raises the item, or rewrites it while it is open. */
    put: (prd: PrdOnProduct, columns: ItemColumns): Promise<Stored<unknown>> =>
      parsed(db.rpc('outbox_item_put', itemArgs(prd, columns)), z.unknown(), 'outbox_item_put()'),

    /** Raises a medium item and adopts it at once. */
    adopt: (prd: PrdOnProduct, columns: ItemColumns): Promise<Stored<unknown>> =>
      parsed(db.rpc('outbox_item_adopt', itemArgs(prd, columns)), z.unknown(), 'outbox_item_adopt()'),

    /** Settles an open item with an answer given at `channel`. */
    settle: ({ key, seq, repo }: PrdOnProduct, answer: { item: string; verdict: string; basis: string; answer: string; channel: string }): Promise<Stored<unknown>> =>
      parsed(db.rpc('outbox_settle', {
        p_product: key, p_prd: seq, p_item: answer.item, p_verdict: answer.verdict, p_basis: answer.basis, p_answer: answer.answer,
        p_channel: answer.channel, ...(repo === null ? {} : { p_repo: repo }),
      }), z.unknown(), 'outbox_settle()'),
  };
}

export type OutboxItemsRepository = ReturnType<typeof outboxItemsRepository>;
