import { describe, expect, it } from 'vitest';
import { parseBusinessLaws } from 'omni-loop/kit/lib/knowledge/business-laws.ts';
import { judgeSpec, type AskLaws } from './judge.service';

// A red a person can read and trust (bug #2696), with an injected model: each finding keeps the judge's own
// words for what the design does that the law forbids, beside the law's Why; a finding that says none is no
// finding; and the model is told that a sentence which restates a law, or says the design keeps it, breaks
// nothing. Every law and spec is fictional.

const GATE = parseBusinessLaws('k/product/business-laws.md', [
  '## BL-PRODUCT-1',
  'A check that could not decide says so in its result. It never shows a plain pass.',
  'Why: A green that means nobody looked teaches people to ignore every green.',
  '',
].join('\n'), { scope: 'product', domain: 'product' });
const SPEC = '## Solution\n\nA check that times out shows a green tick, so the pull request is not held.\n';
const QUOTE = 'A check that times out shows a green tick';

function model(reply: unknown): { ask: AskLaws; system: string[] } {
  const system: string[] = [];
  return { system, ask: (request) => { system.push(request.system); return Promise.resolve({ ok: true as const, reply }); } };
}

const judge = (ask: AskLaws) => judgeSpec({ spec: SPEC, laws: GATE, glossary: [], owners: ['ana'], ask });

describe('a red says what is judged broken', () => {
  it('keeps the judge\'s own why for a finding, beside the law\'s Why', async () => {
    const { ask } = model({ findings: [{ law: 'BL-PRODUCT-1', quote: QUOTE, why: '  A check that could not decide shows a plain pass.  ' }] });
    const verdict = await judge(ask);
    expect(verdict.state).toBe('red');
    expect(verdict.findings).toEqual([expect.objectContaining({
      law: 'BL-PRODUCT-1', quote: QUOTE,
      why: 'A green that means nobody looked teaches people to ignore every green.',
      broken: 'A check that could not decide shows a plain pass.',
    })]);
  });

  it('keeps at most 300 characters of it', async () => {
    const { ask } = model({ findings: [{ law: 'BL-PRODUCT-1', quote: QUOTE, why: 'x'.repeat(400) }] });
    expect((await judge(ask)).findings).toEqual([expect.objectContaining({ broken: 'x'.repeat(300) })]);
  });

  it('drops a finding that does not say what the design does: it never turns a verdict red', async () => {
    for (const why of [undefined, '', '   ']) {
      const { ask } = model({ findings: [{ law: 'BL-PRODUCT-1', quote: QUOTE, ...(why === undefined ? {} : { why }) }] });
      expect(await judge(ask)).toMatchObject({ state: 'green', findings: [] });
    }
  });
});

describe('what the model is told', () => {
  it('a sentence that restates a law, or says the design keeps it, is no finding', async () => {
    const { ask, system } = model({ findings: [] });
    await judge(ask);
    expect(system[0]).toContain('A sentence that restates a law, cites it, or says how the design keeps it is no finding');
    expect(system[0]).toContain('why: one short sentence saying what the design does that the law forbids');
    expect(system[0]).toContain('When you cannot say it, there is no finding');
  });
});
