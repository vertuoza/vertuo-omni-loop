import { describe, expect, it } from 'vitest';
import { parseBusinessLaws, type BusinessLaw } from 'omni-loop/kit/lib/knowledge/business-laws.ts';
import { batchesOf, judgeSpec, type AskLaws } from './judge.service';

// The business laws' judge (PRD 2632 s4) with an injected model: the laws a spec's words point to, in batches
// of 40; a finding counts only when it quotes the spec and cites a law of its own batch; every failure is
// neutral. Every law and spec is fictional.

const QUOTES = parseBusinessLaws('k/domains/quotes/business-laws.md', [
  '## BL-QUOTES-1',
  'A quote can be sent only when its total including tax is above zero.',
  'Why: A customer who receives an empty quote stops trusting the contractor.',
  'Also: invoicing',
  '',
].join('\n'), { scope: 'domain', domain: 'quotes' });
const PRODUCT = parseBusinessLaws('k/product/business-laws.md', '## BL-PRODUCT-1\nEvery amount shows its currency.\nWhy: Two currencies once looked the same.\n', { scope: 'product', domain: 'product' });
const STOCK = parseBusinessLaws('k/domains/stock/business-laws.md', '## BL-STOCK-1\nStock never goes below zero.\nWhy: A sold-out item was sold twice.\n', { scope: 'domain', domain: 'stock' });
const LAWS: BusinessLaw[] = [...PRODUCT, ...QUOTES, ...STOCK];
const GLOSSARY = [{ term: 'Quote', avoid: ['estimate'], domains: ['quotes'] }, { term: 'Item', avoid: [], domains: [] }];
const SPEC = '---\nprd: 7\n---\n\n## Solution\n\nA quote template can be sent with a zero   total, for any Item.\n';

/** A model that answers each call with the next reply, and records what it was asked. */
function fakeModel(replies: unknown[]): { ask: AskLaws; asked: string[] } {
  const asked: string[] = [];
  return {
    asked,
    ask: ({ user }) => {
      asked.push(user);
      const reply = replies.shift();
      return Promise.resolve(reply instanceof Error ? { ok: false as const, why: reply.message } : { ok: true as const, reply });
    },
  };
}

describe('the laws a spec is judged against', () => {
  it('are the domains its words point to and every product law, never a domain nothing points to', async () => {
    const { ask, asked } = fakeModel([{ findings: [] }]);
    const verdict = await judgeSpec({ spec: SPEC, laws: LAWS, glossary: GLOSSARY, owners: ['ana'], ask });
    expect(verdict).toEqual({ state: 'green', reason: '2 judged', laws: ['BL-PRODUCT-1', 'BL-QUOTES-1'], domains: [{ key: 'quotes', reasons: ['"Quote"'] }], findings: [] });
    expect(asked[0]).toContain('BL-QUOTES-1: A quote can be sent only when its total including tax is above zero. Why: A customer');
    expect(asked[0]).not.toContain('BL-STOCK-1');
  });

  it('are none when no law applies: green, and the model is not asked', async () => {
    const { ask, asked } = fakeModel([]);
    const verdict = await judgeSpec({ spec: SPEC, laws: STOCK, glossary: GLOSSARY, owners: [], ask });
    expect(verdict).toMatchObject({ state: 'green', laws: [], findings: [] });
    expect(asked).toEqual([]);
  });

  it('go to the model in batches of 40', async () => {
    const many = Array.from({ length: 85 }, (_, n) => `## BL-PRODUCT-${n + 1}\nRule ${n + 1}.\nWhy: Reason ${n + 1}.\n`).join('\n');
    const laws = parseBusinessLaws('k/product/business-laws.md', many, { scope: 'product', domain: 'product' });
    const { ask, asked } = fakeModel([{ findings: [] }, { findings: [] }, { findings: [] }]);
    const verdict = await judgeSpec({ spec: SPEC, laws, glossary: [], owners: [], ask });
    expect(asked).toHaveLength(3);
    expect(asked.map((user) => (user.match(/^BL-/gm) ?? []).length)).toEqual([40, 40, 5]);
    expect(verdict).toMatchObject({ state: 'green', reason: '85 judged' });
    expect(batchesOf([1, 2, 3], 2)).toEqual([[1, 2], [3]]);
  });
});

describe('a finding', () => {
  it('quoting the spec, whitespace and case aside, and citing a law of its batch makes the verdict red', async () => {
    const { ask } = fakeModel([{ findings: [{ law: 'BL-QUOTES-1', quote: 'can be sent with a ZERO total', why: 'The design sends a quote whose total is zero.' }] }]);
    const verdict = await judgeSpec({ spec: SPEC, laws: LAWS, glossary: GLOSSARY, owners: ['ana'], ask });
    expect(verdict.state).toBe('red');
    expect(verdict.reason).toBe('1 law broken');
    expect(verdict.findings).toEqual([{
      law: 'BL-QUOTES-1',
      statement: 'A quote can be sent only when its total including tax is above zero.',
      why: 'A customer who receives an empty quote stops trusting the contractor.',
      quote: 'can be sent with a ZERO total',
      broken: 'The design sends a quote whose total is zero.',
      domain: 'quotes',
      file: 'k/domains/quotes/business-laws.md',
      owners: ['ana'],
    }]);
  });

  it('whose quote is not in the spec, or too long, is dropped', async () => {
    const long = 'x'.repeat(301);
    const { ask } = fakeModel([{ findings: [{ law: 'BL-QUOTES-1', quote: 'can be sent for free', why: 'It breaks the law.' }, { law: 'BL-QUOTES-1', quote: long, why: 'It breaks the law.' }, { law: 'BL-QUOTES-1', quote: '   ', why: 'It breaks the law.' }] }]);
    expect(await judgeSpec({ spec: `${SPEC}${long}`, laws: LAWS, glossary: GLOSSARY, owners: [], ask })).toMatchObject({ state: 'green', findings: [] });
  });

  it('citing a law outside its batch, or no law at all, is dropped', async () => {
    const { ask } = fakeModel([{ findings: [{ law: 'BL-STOCK-1', quote: 'zero total', why: 'It breaks the law.' }, { law: 'BL-QUOTES-9', quote: 'zero total', why: 'It breaks the law.' }] }]);
    expect(await judgeSpec({ spec: SPEC, laws: LAWS, glossary: GLOSSARY, owners: [], ask })).toMatchObject({ state: 'green', findings: [] });
    // The 41st law is judged in the second batch: the first batch's reply cannot cite it.
    const many = Array.from({ length: 41 }, (_, n) => `## BL-PRODUCT-${n + 1}\nRule ${n + 1}.\nWhy: Reason.\n`).join('\n');
    const laws = parseBusinessLaws('k/product/business-laws.md', many, { scope: 'product', domain: 'product' });
    const second = fakeModel([{ findings: [{ law: 'BL-PRODUCT-41', quote: 'zero total', why: 'It breaks the law.' }] }, { findings: [] }]);
    expect(await judgeSpec({ spec: SPEC, laws, glossary: [], owners: [], ask: second.ask })).toMatchObject({ state: 'green', findings: [] });
  });

  it('counts once for the same law and words', async () => {
    const twice = { law: 'BL-QUOTES-1', quote: 'zero total', why: 'It breaks the law.' };
    const { ask } = fakeModel([{ findings: [twice, { ...twice, quote: 'ZERO   total' }, { law: 'BL-PRODUCT-1', quote: 'for any Item', why: 'It breaks the law.' }] }]);
    const verdict = await judgeSpec({ spec: SPEC, laws: LAWS, glossary: GLOSSARY, owners: [], ask });
    expect(verdict.findings.map((f) => f.law)).toEqual(['BL-QUOTES-1', 'BL-PRODUCT-1']);
    expect(verdict.reason).toBe('2 laws broken');
  });
});

describe('a spec that cannot be judged', () => {
  it('is neutral with no model key, naming the laws it would judge', async () => {
    expect(await judgeSpec({ spec: SPEC, laws: LAWS, glossary: GLOSSARY, owners: [], ask: null })).toEqual({
      state: 'neutral', reason: 'no model key on this deployment', laws: ['BL-PRODUCT-1', 'BL-QUOTES-1'], domains: [{ key: 'quotes', reasons: ['"Quote"'] }], findings: [],
    });
  });

  it('is neutral on a model error, even after a batch found a break', async () => {
    const many = Array.from({ length: 41 }, (_, n) => `## BL-PRODUCT-${n + 1}\nRule ${n + 1}.\nWhy: Reason.\n`).join('\n');
    const laws = parseBusinessLaws('k/product/business-laws.md', many, { scope: 'product', domain: 'product' });
    const { ask } = fakeModel([{ findings: [{ law: 'BL-PRODUCT-1', quote: 'zero total', why: 'It breaks the law.' }] }, new Error('timeout')]);
    expect(await judgeSpec({ spec: SPEC, laws, glossary: [], owners: [], ask })).toMatchObject({ state: 'neutral', reason: 'the model did not answer: timeout', findings: [] });
  });

  it('is neutral on a reply out of shape', async () => {
    const { ask } = fakeModel([{ breaks: [] }]);
    expect(await judgeSpec({ spec: SPEC, laws: LAWS, glossary: GLOSSARY, owners: [], ask })).toMatchObject({ state: 'neutral', reason: 'the model answered out of shape' });
  });
});
