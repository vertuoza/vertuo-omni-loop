import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { SavedConstituentRow, type ConstituentKind } from '../constituents/model';

// A terminal's knowledge change, its storage (PRD 2268 s1; ADR-0095), on the client it is given: the
// caller's own, acting as their access token, never a service key, so the database decides who may change
// what and records each change as theirs. The product the change lands on
// (knowledge_product_for_repo(), 20261219090000_knowledge_product_for_repo.sql), a live constituent by its
// display id, and the constituent writes the Knowledge tab makes (constituent_add(), constituent_edit(),
// 20261029090000_constituents.sql). Legal and glossary changes go through the tab's own service and
// repository (product-knowledge/). Every answer is parsed where it comes in; it holds no rule. A refusal
// comes back as the database's code and words; an answer out of shape as the code `shape`.

/** What the reads and writes need: the tables and the database's functions. */
export type KnowledgeApiDb = Pick<SupabaseClient, 'from' | 'rpc'>;

/** A stored answer: its value, or why the database said no. */
export type Stored<T> = { ok: true; value: T } | { ok: false; code: string | null; message: string };

/** The product a change lands on, and its workspace. */
const FoundProduct = z.object({ id: z.string().min(1), workspace: z.string().min(1), name: z.string() });
export type FoundProduct = z.infer<typeof FoundProduct>;

/** A constituent as its display id reads it: its kind, and its number for a Never line. */
export type ConstituentKey = { kind: ConstituentKind; seq: number | null };

const ConstituentIdRows = z.array(z.object({ id: z.string().min(1) }));

type Raw = { data: unknown; error: { code?: string; message?: string } | null };

/** What `call` answered, read by `schema`; the database's refusal, or `shape` naming `what`. */
async function parsed<T>(call: PromiseLike<Raw>, schema: z.ZodType<T>, what: string): Promise<Stored<T>> {
  const answer = await call;
  if (answer.error) return { ok: false, code: answer.error.code ?? null, message: answer.error.message ?? '' };
  const read = schema.safeParse(answer.data);
  return read.success ? { ok: true, value: read.data } : { ok: false, code: 'shape', message: `${what} answered out of shape` };
}

const keyOfRow = (row: z.infer<typeof SavedConstituentRow>): ConstituentKey => ({ kind: row.kind, seq: row.seq });

export function knowledgeApiRepository(db: KnowledgeApiDb) {
  return {
    /** The product of `repo` named `product` (or its only one), in the caller's workspace for it. */
    productFor(repo: string, product: string | null): Promise<Stored<FoundProduct>> {
      return parsed(db.rpc('knowledge_product_for_repo', { p_repo: repo, p_product: product }), FoundProduct, 'knowledge_product_for_repo');
    },

    /** The id of the product's live constituent `key`, or null when it has none. */
    async constituent(product: string, key: ConstituentKey): Promise<Stored<string | null>> {
      const live = db.from('constituents').select('id').eq('product_id', product).eq('kind', key.kind).is('removed_at', null);
      const rows = await parsed(key.seq === null ? live : live.eq('seq', key.seq), ConstituentIdRows, 'constituents');
      return rows.ok ? { ok: true, value: rows.value[0]?.id ?? null } : rows;
    },

    /** A workspace owner adds the product's Statement or a Never line. */
    async addConstituent(workspace: string, product: string, kind: ConstituentKind, text: string): Promise<Stored<ConstituentKey>> {
      const saved = await parsed(db.rpc('constituent_add', { p_workspace: workspace, p_product: product, p_kind: kind, p_text: text }), SavedConstituentRow, 'constituent_add');
      return saved.ok ? { ok: true, value: keyOfRow(saved.value) } : saved;
    },

    /** A workspace owner rewrites a live constituent. */
    async editConstituent(workspace: string, constituent: string, text: string): Promise<Stored<ConstituentKey>> {
      const saved = await parsed(db.rpc('constituent_edit', { p_workspace: workspace, p_constituent: constituent, p_text: text }), SavedConstituentRow, 'constituent_edit');
      return saved.ok ? { ok: true, value: keyOfRow(saved.value) } : saved;
    },
  };
}

export type KnowledgeApiRepository = ReturnType<typeof knowledgeApiRepository>;
