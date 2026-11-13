import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { Query } from '../../../nav/query';
import { demoEval } from './eval-demo';
import { EVAL_TITLE, EvalView, SearchViews } from './EvalView';
import { NO_QUESTION, NO_RUN } from './eval-stats';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: () => undefined }) }));

// The Eval view as the server renders it (PRD omni-loop-8 s5).

const NOW = Date.parse('2026-11-13T12:00:00Z');
const demo = demoEval('demo-product-1', NOW);
if (demo === null) throw new Error('the demo product has an eval set');
const DOMAINS = [{ key: 'invoicing', name: 'Invoicing' }];
const SOURCE = { kind: 'demo' } as const;

const draw = (data: Pick<typeof demo, 'runs' | 'questions' | 'answers'>, query: Query = {}) =>
  renderToStaticMarkup(createElement(EvalView, { product: 'p', source: SOURCE, ...data, query, domains: DOMAINS }));
const text = (markup: string) => markup.replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, '\'').replace(/\s+/g, ' ').trim();
const regionOf = (html: string, name: string) => html.slice(html.indexOf(`data-region="${name}"`));

describe('the Search section’s views', () => {
  it('link the overview, the Categories view and the Eval view, the one shown marked', () => {
    const html = renderToStaticMarkup(createElement(SearchViews, { product: 'p', shown: 'eval' }));
    expect(text(html)).toBe('Overview Categories Eval');
    expect(html).toContain('href="/app/products/p/knowledge/search/categories"');
    expect(html).toMatch(/aria-current="true" href="\/app\/products\/p\/knowledge\/search\/eval"/);
  });
});

describe('the Eval view', () => {
  it('is headed Search eval and shows the latest run’s four measures, with one point per run for each', () => {
    const html = draw(demo);
    expect(/<h2[^>]*>([^<]*)<\/h2>/.exec(html)?.[1]).toBe(EVAL_TITLE);
    expect(text(html)).toMatch(/top@1 67% top@5 67% recall@5 67% recall@10 83%/);
    expect(html.match(/data-chart="runs"/g)).toHaveLength(1);
    for (const key of ['top1', 'top5', 'recall5', 'recall10']) expect(html.match(new RegExp(`data-line="${key}"[^]*?</g>`))?.[0].match(/<circle/g)).toHaveLength(3);
  });

  it('draws one category when ?category= names it, and links each category', () => {
    const html = draw(demo, { category: 'invoicing' });
    expect(text(html)).toMatch(/top@1 100% top@5 100%/);
    expect(html).toContain('href="/app/products/p/knowledge/search/eval?category=invoicing"');
    expect(text(html)).toContain('Invoicing, ');
  });

  it('lists the latest run’s misses with where the right answer ranked and what came first', () => {
    const misses = text(regionOf(draw(demo), 'misses'));
    expect(misses).toContain('who owns the glossary other 7 L-GLOSSARY-9 ADR-0004 BL-QUOTES-1 L-GDPR-1 BL-INVOICING-2 L-GLOSSARY-1');
  });

  it('says so in one line when no question missed', () => {
    const runs = demo.runs.map((r) => ({ ...r, misses: [] }));
    expect(draw({ ...demo, runs }).match(/data-note="no-miss"/g)).toHaveLength(1);
  });

  it('marks each right answer Jev or person, with who and when, and offers Confirm only on Jev’s', () => {
    const set = regionOf(draw(demo), 'set');
    expect(set).toMatch(/data-answer="BL-INVOICING-2" data-source="jev"[^]*?Jev, 0.91 · 2026-11-01[^]*?Confirm/);
    expect(text(set)).toContain('person @you · 2026-11-03');
    expect(set.match(/>Confirm<\/button>/g)).toHaveLength(2);
    expect(text(set)).toContain('not an answer · person @you');
    expect(set).toContain('Restore');
    expect(text(set)).toContain('added by promotion, 2026-11-01');
    expect(text(set)).toContain('added by @you, 2026-11-05');
  });

  it('offers to add a question and an entry, and to remove a question', () => {
    const set = text(regionOf(draw(demo), 'set'));
    expect(set).toContain('Add a question to the set');
    expect(set).toContain('Add an entry Jev missed');
    expect(set.match(/Remove question/g)).toHaveLength(4);
  });

  it('tells a question with no right answer it is left out of the measures', () => {
    expect(draw(demo).match(/data-note="no-right-answer"/g)).toHaveLength(1);
  });

  it('says so in one line with no run yet, draws no chart, and still shows the set', () => {
    const html = draw({ ...demo, runs: [] });
    expect(text(html)).toContain(NO_RUN);
    expect(html).not.toContain('<svg');
    expect(html).not.toContain('data-region="misses"');
    expect(html).toContain('data-question="demo-q-numbers"');
  });

  it('says so in one line with an empty set, and still offers to add a question', () => {
    const html = draw({ runs: [], questions: [], answers: [] });
    expect(text(html)).toContain(NO_QUESTION);
    expect(text(html)).toContain('Add a question to the set');
  });
});
