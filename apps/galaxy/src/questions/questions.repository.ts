// The Questions tab's storage (PRD 1548 s9; ADR-0095), on the client it is given: the signed-in person's
// own, so outbox_settle() decides who may answer (a member of the PRD's workspace) and what (an open
// question, once: supabase/migrations/20261204090000_outbox_items.sql). It settles a question as answered
// on the Questions tab. The items it answers are read through the outbox's own service
// (src/outbox-items), so the tab reads them as the kit does. It holds no rule; a refusal comes back as the
// database's code, message and hint.
import type { SupabaseClient } from '@supabase/supabase-js';

/** What the writes need: the database's functions. */
export type QuestionsDb = Pick<SupabaseClient, 'rpc'>;

/** A stored answer: its value, or why the database said no. */
export type Settled = { ok: true; value: unknown } | { ok: false; code: string | null; message: string | null; hint: string | null };

/** The product PRD `<key>-<seq>`. */
type ProductPrd = { key: string; seq: number };

/** A settlement of one open question: its verdict and why, and the answer as it was given. */
export type Settlement = { item: string; verdict: 'agreed' | 'drifted'; basis: string; answer: string };

type Raw = { data: unknown; error: { code?: string; message?: string; hint?: string } | null };

export function questionsRepository(db: QuestionsDb) {
  return {
    /** Settles the open question with an answer given on the Questions tab. */
    async settle({ key, seq }: ProductPrd, { item, verdict, basis, answer }: Settlement): Promise<Settled> {
      const answered: Raw = await db.rpc('outbox_settle', {
        p_product: key, p_prd: seq, p_item: item, p_verdict: verdict, p_basis: basis, p_answer: answer, p_channel: 'questions',
      });
      const { data, error } = answered;
      if (error) return { ok: false, code: error.code ?? null, message: error.message ?? null, hint: error.hint ?? null };
      return { ok: true, value: data };
    },
  };
}

export type QuestionsRepository = ReturnType<typeof questionsRepository>;
