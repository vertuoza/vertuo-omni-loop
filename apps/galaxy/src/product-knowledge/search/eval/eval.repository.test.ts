import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import { answersOf, questionsOf, runsOf } from './eval.repository';

// The Eval view's storage (PRD omni-loop-8 s5): the reads it sends as the signed-in person, each answer parsed
// where it comes in. A fake client records each query's chain and answers in order.

type Answer = { data: unknown; error: { message: string } | null };

function fakeDb(answers: Answer[]) {
  const lines: string[] = [];
  const chain = (line: string[]): unknown => new Proxy({}, {
    get(_, key: string) {
      if (key === 'then') {
        const answer = answers.shift() ?? { data: null, error: { message: 'no answer left' } };
        lines.push(line.join('.'));
        return (resolve: (value: Answer) => unknown) => resolve(answer);
      }
      return (...args: unknown[]) => chain([...line, `${key}(${args.map((a) => JSON.stringify(a)).join(',')})`]);
    },
  });
  const db = { from: (table: string) => chain([`from(${JSON.stringify(table)})`]) } as unknown as Pick<SupabaseClient, 'from'>;
  return { db, lines };
}

const M = { questions: 2, top1: 0.5, top5: 1, recall5: 1, recall10: 1, mrr: 0.75 };
const storedRun = (id: string, ran_at: string) => ({
  id, trigger: 'daily', ran_at,
  measures: { overall: M, categories: { invoicing: M }, misses: [{ id: 'q1', category: 'invoicing', rank: null, first: ['a'], right: ['b'] }], skipped: 1 },
});

describe('the runs of a product', () => {
  it('are its latest runs, read newest first and handed oldest first', async () => {
    const { db, lines } = fakeDb([{ data: [storedRun('r2', '2026-11-12T06:00:00Z'), storedRun('r1', '2026-11-11T06:00:00Z')], error: null }]);
    const runs = await runsOf(db, 'p-1');
    expect(runs?.map((r) => r.id)).toEqual(['r1', 'r2']);
    expect(runs?.[0]).toMatchObject({ trigger: 'daily', overall: M, categories: { invoicing: M }, skipped: 1, misses: [{ id: 'q1', rank: null }] });
    expect(lines).toEqual(['from("search_eval_runs").select("id, trigger, ran_at, measures").eq("product_id","p-1").order("ran_at",{"ascending":false}).limit(120)']);
  });

  it('are none to read on a refusal or an answer out of shape', async () => {
    expect(await runsOf(fakeDb([{ data: null, error: { message: 'down' } }]).db, 'p-1')).toBeNull();
    expect(await runsOf(fakeDb([{ data: [{ ...storedRun('r', 'x'), measures: { overall: 1 } }], error: null }]).db, 'p-1')).toBeNull();
  });
});

describe('the questions of a product', () => {
  it('are those no member removed, oldest first', async () => {
    const { db, lines } = fakeDb([{ data: [{ id: 'q1', question: 'a quote?', category: null, added_by: 'promotion', added_at: '2026-11-01T00:00:00Z' }], error: null }]);
    expect(await questionsOf(db, 'p-1')).toEqual([{ id: 'q1', question: 'a quote?', category: null, addedBy: 'promotion', addedAt: '2026-11-01T00:00:00Z' }]);
    expect(lines).toEqual(['from("search_eval_questions").select("id, question, category, added_by, added_at").eq("product_id","p-1").is("removed_at",null)'
      + '.order("added_at",{"ascending":true}).limit(1000)']);
  });

  it('are none to read on a refusal', async () => {
    expect(await questionsOf(fakeDb([{ data: null, error: { message: 'down' } }]).db, 'p-1')).toBeNull();
  });
});

describe('the answers of a workspace', () => {
  const stored = { question_id: 'q1', entry_id: 'e1', relevant: true, source: 'jev', confidence: 0.9, decided_by: null, decided_at: '2026-11-02T00:00:00Z' };

  it('are each entry’s verdict with its source and who decided', async () => {
    const { db } = fakeDb([{ data: [stored], error: null }]);
    expect(await answersOf(db)).toEqual([{ questionId: 'q1', entryId: 'e1', relevant: true, source: 'jev', confidence: 0.9, decidedBy: null, decidedAt: '2026-11-02T00:00:00Z' }]);
  });

  it('are none to read on a source that is neither Jev nor a person', async () => {
    expect(await answersOf(fakeDb([{ data: [{ ...stored, source: 'bot' }], error: null }]).db)).toBeNull();
  });
});
