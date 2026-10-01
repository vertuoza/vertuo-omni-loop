import { describe, expect, it } from 'vitest';
import { questionsOf, type AgentQuestion } from './model';
import { databaseQuestions, demoQuestions, PICK_PRODUCT } from './port';
import { loadQuestions } from './load';

// The questions' calls (PRD 855 s3): the functions of 20261028100000_agent_questions.sql as the signed-in
// person, their refusals in plain words, and the demo's same rules in memory.

const QUESTION: AgentQuestion = {
  id: 'q-1', question: 'Do we sell in Luxembourg?', asked: 2, askedBy: 'Tom’s editor', repo: 'acme/app',
  file: 'src/NewQuoteForm.tsx', firstAskedAt: '2026-09-30T08:00:00Z', lastAskedAt: '2026-10-01T09:00:00Z', product: 'p-1',
};

type Call = { fn: string; args: Record<string, unknown> };

function db(answer: { data?: unknown; error?: unknown } = {}) {
  const calls: Call[] = [];
  return {
    calls,
    rpc: async (fn: string, args: Record<string, unknown>) => {
      calls.push({ fn, args });
      return { data: answer.data ?? null, error: answer.error ?? null };
    },
  };
}

describe('a question as the database lists it', () => {
  it('reads a list of questions, and nothing else', () => {
    expect(questionsOf([QUESTION])).toEqual([QUESTION]);
    expect(questionsOf([{ ...QUESTION, repo: null, file: null, product: null }])).toHaveLength(1);
    expect(questionsOf([{ ...QUESTION, asked: 0 }])).toBeNull();
    expect(questionsOf({})).toBeNull();
  });
});

describe('the database port', () => {
  it('answers once: the kind, the value and the product, as the signed-in person', async () => {
    const d = db({ data: { id: 'q-1', claim: 'region#7' } });
    expect(await databaseQuestions(d, 'w-1').answer(QUESTION, 'region', 'Luxembourg', null)).toEqual({ ok: true, claim: 'region#7' });
    expect(d.calls).toEqual([{ fn: 'agent_question_answer', args: {
      p_workspace: 'w-1', p_question: 'q-1', p_kind: 'region', p_value: 'Luxembourg', p_product: null,
    } }]);
  });

  it('dismisses', async () => {
    const d = db({ data: { id: 'q-1' } });
    expect(await databaseQuestions(d, 'w-1').dismiss(QUESTION)).toEqual({ ok: true });
    expect(d.calls).toEqual([{ fn: 'agent_question_dismiss', args: { p_workspace: 'w-1', p_question: 'q-1' } }]);
  });

  it('says each refusal in plain words', async () => {
    const said = async (error: unknown) => {
      const got = await databaseQuestions(db({ error }), 'w-1').answer(QUESTION, 'trade', 'plumbing', null);
      return got.ok ? null : got.message;
    };
    expect(await said({ code: '22023', hint: 'product' })).toBe(PICK_PRODUCT);
    expect(await said({ code: '42501' })).toMatch(/member/);
    expect(await said({ code: 'P0002' })).toMatch(/Reload/);
    expect(await said({ code: '22023', hint: 'value' })).toMatch(/1 to 80/);
    const never = await databaseQuestions(db({ error: { code: '22023', hint: 'value' } }), 'w-1').answer(QUESTION, 'never', 'x', null);
    expect(never.ok ? null : never.message).toMatch(/200/);
    const gone = await databaseQuestions(db({ error: { code: 'P0002' } }), 'w-1').dismiss(QUESTION);
    expect(gone.ok).toBe(false);
  });
});

describe('the demo port', () => {
  it('answers with the next claim number, dismisses, and refuses an empty value', async () => {
    const port = demoQuestions(6);
    expect(await port.answer(QUESTION, 'region', ' Luxembourg ', null)).toEqual({ ok: true, claim: 'region#7' });
    expect(await port.answer(QUESTION, 'size', '2-50', null)).toEqual({ ok: true, claim: 'size#8' });
    expect((await port.answer(QUESTION, 'trade', '  ', null)).ok).toBe(false);
    expect(await port.dismiss(QUESTION)).toEqual({ ok: true });
  });
});

describe('the page\'s read', () => {
  it('lists the open questions, or none when the database cannot answer', async () => {
    const d = db({ data: [QUESTION] });
    expect(await loadQuestions(d, 'w-1')).toEqual([QUESTION]);
    expect(d.calls).toEqual([{ fn: 'agent_questions_list', args: { p_workspace: 'w-1' } }]);
    const errors: unknown[] = [];
    const original = console.error;
    console.error = (...args: unknown[]) => { errors.push(args); };
    try {
      expect(await loadQuestions(db({ error: { message: 'no such function' } }), 'w-1')).toEqual([]);
      expect(await loadQuestions(db({ data: 'odd' }), 'w-1')).toEqual([]);
    } finally {
      console.error = original;
    }
    expect(errors).toHaveLength(2);
  });
});
