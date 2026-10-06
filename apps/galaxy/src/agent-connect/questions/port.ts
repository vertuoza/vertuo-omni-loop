import { NEVER_INVALID, refusalOf } from '../../business/store';
import type { ClaimKind } from '../../business/model';
import type { AgentQuestion } from './model';
import { propertyOf } from 'vertuo-omni-plan/kit/lib/narrow.ts';

// The questions' calls from the browser (PRD 855 s3). In production, the functions of
// supabase/migrations/20261028100000_agent_questions.sql, called as the signed-in person like the rest of
// Settings › Business: agent_question_answer() saves the answer as a confirmed claim (source `answer`) and
// closes the question on it; agent_question_dismiss() closes it with no claim; agent_question_bring_back()
// (PRD 855 s4) reopens one Jev set aside. In the demo, the same in
// memory: an answer takes the business's next claim number.

export type Answered = { ok: true; claim: string } | { ok: false; message: string };
export type Dismissed = { ok: true } | { ok: false; message: string };
export type BroughtBack = Dismissed;

export interface QuestionsPort {
  /** Answers `question` once with `value` of `kind`, on `product` when the question names none. */
  answer(question: AgentQuestion, kind: ClaimKind, value: string, product: string | null): Promise<Answered>;
  dismiss(question: AgentQuestion): Promise<Dismissed>;
  /** Reopens a question Jev set aside (PRD 855 s4): agent_question_bring_back(). */
  bringBack(question: AgentQuestion): Promise<BroughtBack>;
}

export const PICK_PRODUCT = 'Pick the product this answer is about.';

type Rpc = { rpc(fn: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: unknown }> };

/** A refusal as the card says it: the product to pick, a Never line's own length, or the business's words. */
function said(error: unknown, kind: ClaimKind | null): string {
  const code = propertyOf(error, 'code');
  const hint = propertyOf(error, 'hint');
  if (code === '22023' && hint === 'product') return PICK_PRODUCT;
  if (code === '22023' && kind === 'never') return NEVER_INVALID;
  return refusalOf(error);
}

export function databaseQuestions(db: Rpc, workspace: string): QuestionsPort {
  type Called = { ok: true; data: unknown } | { ok: false; message: string };
  const call = async (fn: string, args: Record<string, unknown>, kind: ClaimKind | null): Promise<Called> => {
    try {
      const { data, error } = await db.rpc(fn, { p_workspace: workspace, ...args });
      return error || !data ? { ok: false, message: said(error, kind) } : { ok: true, data };
    } catch (err) {
      return { ok: false, message: said(err, kind) };
    }
  };
  return {
    async answer(question, kind, value, product) {
      const got = await call('agent_question_answer', { p_question: question.id, p_kind: kind, p_value: value, p_product: product }, kind);
      return got.ok ? { ok: true, claim: String(propertyOf(got.data, 'claim')) } : got;
    },
    async dismiss(question) {
      const got = await call('agent_question_dismiss', { p_question: question.id }, null);
      return got.ok ? { ok: true } : got;
    },
    async bringBack(question) {
      const got = await call('agent_question_bring_back', { p_question: question.id }, null);
      return got.ok ? { ok: true } : got;
    },
  };
}

/** The demo's port: `seq` is the business's last claim number. */
export function demoQuestions(seq: number): QuestionsPort {
  let last = seq;
  return {
    answer(_question, kind, value) {
      if (value.trim() === '') return Promise.resolve({ ok: false, message: kind === 'never' ? NEVER_INVALID : refusalOf({ code: '22023' }) });
      last += 1;
      return Promise.resolve({ ok: true, claim: `${kind}#${last}` });
    },
    dismiss() {
      return Promise.resolve({ ok: true });
    },
    bringBack() {
      return Promise.resolve({ ok: true });
    },
  };
}
