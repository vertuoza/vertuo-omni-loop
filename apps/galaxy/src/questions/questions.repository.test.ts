import { describe, expect, it } from 'vitest';
import { questionsRepository, type QuestionsDb } from './questions.repository';

// The Questions tab's storage (PRD 1548 s9), on a stubbed client (no test calls Supabase): a settlement
// goes through outbox_settle() as answered on the Questions tab, and a refusal comes back as the
// database's code, message and hint.

function stub(answer: { data?: unknown; error?: { code?: string; message?: string; hint?: string } | null }) {
  const calls: unknown[] = [];
  const db = { rpc: (fn: string, args: unknown) => { calls.push([fn, args]); return Promise.resolve({ data: answer.data ?? null, error: answer.error ?? null }); } };
  return { calls, repo: questionsRepository(db as unknown as QuestionsDb) };
}

const SETTLEMENT = { item: 's2-01-quote-totals', verdict: 'agreed' as const, basis: 'stated', answer: 'A. Round per line (built).' };

describe('the Questions tab\'s storage', () => {
  it('settles the question through outbox_settle(), on the Questions tab\'s channel', async () => {
    const value = { id: 'st-1', item: 's2-01-quote-totals', prdId: 'mobile-12', verdict: 'agreed', settledAt: '2026-10-11T11:00:00Z' };
    const { calls, repo } = stub({ data: value });
    expect(await repo.settle({ key: 'mobile', seq: 12 }, SETTLEMENT)).toEqual({ ok: true, value });
    expect(calls).toEqual([['outbox_settle', {
      p_product: 'mobile', p_prd: 12, p_item: 's2-01-quote-totals', p_verdict: 'agreed', p_basis: 'stated', p_answer: 'A. Round per line (built).', p_channel: 'questions',
    }]]);
  });

  it('answers the database\'s refusal as its code, message and hint', async () => {
    const { repo } = stub({ error: { code: 'P0002', message: 'No PRD mobile-12 in your workspaces.' } });
    expect(await repo.settle({ key: 'mobile', seq: 12 }, SETTLEMENT)).toEqual({ ok: false, code: 'P0002', message: 'No PRD mobile-12 in your workspaces.', hint: null });
    expect(await stub({ error: { hint: 'settled' } }).repo.settle({ key: 'mobile', seq: 12 }, SETTLEMENT)).toEqual({ ok: false, code: null, message: null, hint: 'settled' });
  });
});
