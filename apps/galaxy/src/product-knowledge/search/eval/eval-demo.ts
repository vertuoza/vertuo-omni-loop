import type { EvalAnswer, EvalQuestion, EvalRun, Measures } from './eval-stats';

// The demo's Eval view (PRD omni-loop-8 s5): a few fictional questions with right answers, and three runs over the
// last days, as the search-eval-run job would keep them. Fictional, as every demo is.

const DEMO_PRODUCT = 'demo-product-1';

const measures = (questions: number, top1: number, top5: number, recall5: number, recall10: number, mrr: number): Measures =>
  ({ questions, top1, top5, recall5, recall10, mrr });

const DAY = 86_400_000;

const QUESTIONS: EvalQuestion[] = [
  { id: 'demo-q-numbers', question: 'when is an invoice number reused', category: 'invoicing', addedBy: 'promotion', addedAt: '2026-11-01T06:00:00Z' },
  { id: 'demo-q-credit', question: 'what is a credit note', category: 'invoicing', addedBy: 'promotion', addedAt: '2026-11-01T06:00:00Z' },
  { id: 'demo-q-glossary', question: 'who owns the glossary', category: 'other', addedBy: 'you', addedAt: '2026-11-05T09:00:00Z' },
  { id: 'demo-q-new', question: 'how long are exports kept', category: null, addedBy: 'promotion', addedAt: '2026-11-12T06:00:00Z' },
];

const ANSWERS: EvalAnswer[] = [
  { questionId: 'demo-q-numbers', entryId: 'BL-INVOICING-2', relevant: true, source: 'jev', confidence: 0.91, decidedBy: null, decidedAt: '2026-11-01T06:05:00Z' },
  { questionId: 'demo-q-numbers', entryId: 'BL-INVOICING-7', relevant: true, source: 'person', confidence: null, decidedBy: 'you', decidedAt: '2026-11-03T10:00:00Z' },
  { questionId: 'demo-q-numbers', entryId: 'BL-QUOTES-1', relevant: false, source: 'person', confidence: null, decidedBy: 'you', decidedAt: '2026-11-03T10:01:00Z' },
  { questionId: 'demo-q-credit', entryId: 'glossary:credit-note', relevant: true, source: 'jev', confidence: 0.87, decidedBy: null, decidedAt: '2026-11-01T06:06:00Z' },
  { questionId: 'demo-q-glossary', entryId: 'L-GLOSSARY-1', relevant: true, source: 'person', confidence: null, decidedBy: 'you', decidedAt: '2026-11-05T09:01:00Z' },
];

/** The demo product's set and runs, `now` being the page's clock; null for any other product. */
export function demoEval(product: string, now: number): { runs: EvalRun[]; questions: EvalQuestion[]; answers: EvalAnswer[] } | null {
  if (product !== DEMO_PRODUCT) return null;
  const run = (daysAgo: number, trigger: string, overall: Measures, invoicing: Measures, other: Measures, misses: EvalRun['misses']): EvalRun => ({
    id: `demo-run-${String(daysAgo)}`, ranAt: new Date(now - daysAgo * DAY).toISOString(), trigger, overall,
    categories: { invoicing, other }, misses, skipped: 1,
  });
  return {
    questions: QUESTIONS,
    answers: ANSWERS,
    runs: [
      run(2, 'daily', measures(3, 0.33, 0.67, 0.5, 0.67, 0.5), measures(2, 0.5, 0.5, 0.5, 0.5, 0.5), measures(1, 0, 1, 1, 1, 0.25), []),
      run(1, 'embed', measures(3, 0.33, 0.67, 0.58, 0.75, 0.55), measures(2, 0.5, 0.5, 0.5, 0.75, 0.55), measures(1, 0, 1, 1, 1, 0.33), []),
      run(0, 'daily', measures(3, 0.67, 0.67, 0.67, 0.83, 0.72), measures(2, 1, 1, 0.75, 1, 1), measures(1, 0, 0, 0, 0.5, 0.1), [
        { id: 'demo-q-glossary', category: 'other', rank: 7, first: ['L-GLOSSARY-9', 'ADR-0004', 'BL-QUOTES-1', 'L-GDPR-1', 'BL-INVOICING-2'], right: ['L-GLOSSARY-1'] },
      ]),
    ],
  };
}
