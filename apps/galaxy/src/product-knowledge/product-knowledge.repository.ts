import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { RosterRow } from '../business/constituents-rows';
import { orThrow, parseRow, parseRows } from '../data/parse-rows';
import { KnowledgeReadSchema, type ChangeWrite, type Kind, type KnowledgeRead } from './product-knowledge.contract';

// The Knowledge tab's storage (PRD 1795 s2): the reads and writes behind /app/products/<id>/knowledge, on
// the client it is given, the signed-in person's, so row-level security and the definer functions of
// 20261211090000_product_knowledge.sql have the last word. The product, the tab's read
// (product_knowledge_of()), the workspace's members (workspace_roster()), and the writes
// (product_legal_*, product_glossary_*, product_knowledge_propose / approve / reject / name). A failed read
// throws, and an answer out of shape too; a refused write answers the database's code and words. No rule
// lives here: who may change what is product-knowledge.service.ts's, and the database's.

/** What the tab's reads and writes need: the tables and the database's functions. */
export type KnowledgeDb = Pick<SupabaseClient, 'from' | 'rpc'>;

const StoredKnowledgeProductSchema = z.object({ id: z.string(), workspace_id: z.string(), name: z.string() });
type StoredKnowledgeProduct = z.infer<typeof StoredKnowledgeProductSchema>;

/** A refusal, by the database's code and in its words. */
export type Refused = { ok: false; code: string | null; message: string };
type Written = { ok: true } | Refused;
type Read<T> = ({ ok: true } & T) | Refused;

type RpcAnswer = { data: unknown; error: { code?: string; message: string } | null };

const refusedOf = (error: { code?: string; message: string }): Refused => ({ ok: false, code: error.code || null, message: error.message });

export function knowledgeRepository(db: KnowledgeDb) {
  const write = async (fn: string, args: Record<string, unknown>): Promise<Written> => {
    const answer: RpcAnswer = await db.rpc(fn, args);
    return answer.error ? refusedOf(answer.error) : { ok: true };
  };

  return {
    /** The product by its id, or null when the caller reads no such product. */
    async product(id: string): Promise<StoredKnowledgeProduct | null> {
      const { data, error } = await db.from('products').select('id, workspace_id, name').eq('id', id);
      if (error) throw new Error(`Supabase: could not read the product (${error.message})`);
      return orThrow(parseRows(StoredKnowledgeProductSchema, data, 'product-knowledge/product-knowledge.repository: products'))[0] ?? null;
    },

    /** The tab's read, or the database's refusal (42501 not a member, P0002 no such product). */
    async read(workspace: string, product: string): Promise<Read<{ read: KnowledgeRead }>> {
      const answer: RpcAnswer = await db.rpc('product_knowledge_of', { p_workspace: workspace, p_product: product });
      if (answer.error) return refusedOf(answer.error);
      return { ok: true, read: orThrow(parseRow(KnowledgeReadSchema, answer.data, 'product-knowledge/product-knowledge.repository: product_knowledge_of')) };
    },

    /** The workspace's members. */
    async roster(workspace: string): Promise<z.infer<typeof RosterRow>[]> {
      const answer: RpcAnswer = await db.rpc('workspace_roster', { workspace });
      if (answer.error) throw new Error(`Supabase: could not read the members (${answer.error.message})`);
      return orThrow(parseRows(RosterRow, answer.data, 'product-knowledge/product-knowledge.repository: workspace_roster'));
    },

    /** The owner or delegate of the kind changes it directly, through the kind's definer function. */
    apply(workspace: string, product: string, change: ChangeWrite): Promise<Written> {
      const f = change.fields;
      const entry = change.entry;
      if (change.kind === 'legal') {
        if (change.action === 'add') {
          return write('product_legal_add', { p_workspace: workspace, p_product: product, p_code: f.code, p_statement: f.statement, p_source: f.source });
        }
        if (change.action === 'edit') return write('product_legal_edit', { p_workspace: workspace, p_entry: entry, p_statement: f.statement, p_source: f.source });
        return write('product_legal_retire', { p_workspace: workspace, p_entry: entry });
      }
      if (change.action === 'add') {
        return write('product_glossary_add', { p_workspace: workspace, p_product: product, p_term: f.term, p_meaning: f.meaning, p_avoid: f.avoid });
      }
      if (change.action === 'edit') {
        return write('product_glossary_edit', { p_workspace: workspace, p_entry: entry, p_term: f.term, p_meaning: f.meaning, p_avoid: f.avoid });
      }
      return write('product_glossary_remove', { p_workspace: workspace, p_entry: entry });
    },

    /** Any member proposes a change, through product_knowledge_propose(). */
    propose(workspace: string, product: string, change: ChangeWrite): Promise<Written> {
      return write('product_knowledge_propose', {
        p_workspace: workspace, p_product: product, p_kind: change.kind, p_action: change.action, p_entry: change.entry, p_fields: change.fields,
      });
    },

    /** The kind's owner or delegate approves or rejects an open proposal. */
    decide(workspace: string, proposal: string, verdict: 'approve' | 'reject'): Promise<Written> {
      return write(verdict === 'approve' ? 'product_knowledge_approve' : 'product_knowledge_reject', { p_workspace: workspace, p_proposal: proposal });
    },

    /** A workspace owner names (user null: clears) a kind's owner or delegate, through product_knowledge_name(). */
    name(workspace: string, product: string, kind: Kind, role: 'owner' | 'delegate', user: string | null): Promise<Written> {
      return write('product_knowledge_name', { p_workspace: workspace, p_product: product, p_kind: kind, p_role: role, p_user: user });
    },
  };
}

export type KnowledgeRepository = ReturnType<typeof knowledgeRepository>;
