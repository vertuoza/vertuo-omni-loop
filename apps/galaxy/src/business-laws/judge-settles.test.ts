import { describe, expect, it } from 'vitest';
import { parseBusinessLaws } from 'omni-loop/kit/lib/knowledge/business-laws.ts';
import { judgeSpec, type AskLaws } from './judge.service';

// Bug #2900: a spec pushed five times, each push answering the last verdict, came back red every time on the
// same two laws, with a new reason each time: reasons that hedge ("could be misread", "implying the App may…",
// "this is consistent. However, … not explicitly …"), that quote the spec's own sentence saying how it keeps the
// law, or that read a breach into words that design none. A red holds the product approval, so a judge that
// never settles holds a PRD for good. A verdict is red only when the model quotes the spec's words, states the
// breach without hedging, the quote is not the spec citing the law it is judged on, and a second reading
// confirms the breach. The replies below are recorded in the shape the model gave; no test calls a model. The
// laws and the spec are fictional.

const LAWS = [
  ...parseBusinessLaws('k/domains/answers/business-laws.md', [
    '## BL-ANSWERS-1',
    'An answer a person gave is never changed or reworded afterwards, by an agent or by the product. What an agent',
    'writes in its own name is not a person\'s answer.',
    'Why: Every decision must trace back to the person\'s own words.',
    '',
  ].join('\n'), { scope: 'domain', domain: 'answers' }),
  ...parseBusinessLaws('k/product/business-laws.md', [
    '## BL-PRODUCT-1',
    'A check that ends without deciding says "not judged", with the reason. It never shows a pass. A check still',
    'running shows as not finished, never as passed.',
    'Why: A green that means nobody looked teaches people to ignore every green.',
    '',
  ].join('\n'), { scope: 'product', domain: 'product' }),
];

const SPEC = [
  '---',
  'prd: 7',
  'areas: [answers]',
  '---',
  '',
  '## Solution',
  '',
  'An item excuses a finding only through two recorded fields, never through its words. The checks only read',
  'the ledger, as it is written: they never read meaning into an answer and never reword one.',
  '',
  '**The status records.** The check and the rows of the verdict table are the App\'s status records, in its',
  'own name: BL-ANSWERS-1 counts those as no person\'s answer. They are kept apart from the ledger, never shown',
  'as a person\'s words, and never read as an excuse.',
  '',
  'A check reads `pass`, `fail`, `not finished` (never shown green) or `not judged · <why>`. Only `pass` passes:',
  'one check `not finished` makes the whole verdict not ready, and the pull request stays a draft.',
  '',
  'The App writes the acceptance check run when a runner has run the scenarios.',
  '',
  '## Risks',
  '',
  '- BL-PRODUCT-1 (a check that does not decide says "not judged"): `not finished` and `not judged` are never',
  '  shown green and never pass.',
  '- BL-ANSWERS-1 (a person\'s answer is never reworded): the checks never write to the ledger.',
  '',
].join('\n');

/** A model that answers each call with the next recorded reply, and counts the calls. */
function recorded(replies: unknown[]): { ask: AskLaws; calls: () => number } {
  let calls = 0;
  return {
    calls: () => calls,
    ask: () => {
      calls += 1;
      const reply = replies.shift();
      return Promise.resolve(reply instanceof Error ? { ok: false as const, why: reply.message } : { ok: true as const, reply });
    },
  };
}

const judge = (ask: AskLaws) => judgeSpec({ spec: SPEC, laws: LAWS, glossary: [], owners: ['ana'], ask });

/** A second reading that confirms every finding of the first. */
const confirmed = (n: number) => ({ findings: Array.from({ length: n }, (_, at) => ({ n: at + 1, breaks: true, why: 'The design shows a pass for a check that did not decide.' })) });

describe('a reason that hedges never turns a verdict red', () => {
  it.each([
    ['BL-ANSWERS-1', 'they never read meaning into an answer', 'Reading outbox items as excuses could involve reinterpreting a person\'s answers.'],
    ['BL-PRODUCT-1', 'one check `not finished` makes the whole verdict not ready', 'A test-only PRD could show pass while its e2e evidence is waiting.'],
    ['BL-PRODUCT-1', 'Only `pass` passes', 'The spec does not explicitly confirm that waiting prevents the overall verdict from being pass.'],
    ['BL-PRODUCT-1', '`not finished` (never shown green)', 'Waiting could be misread as a passing state.'],
    ['BL-ANSWERS-1', 'never shown\nas a person\'s words', 'Saying they are never shown as a person\'s words implies the App may reword answers.'],
    ['BL-PRODUCT-1', '`not finished` (never shown green)', 'This is consistent. However, the spec does not explicitly forbid showing not finished as a pass.'],
    ['BL-PRODUCT-1', 'Only `pass` passes', 'Not finished might be shown as passed.'],
  ])('%s on "%s": %s', async (law, quote, why) => {
    const { ask } = recorded([{ findings: [{ law, quote, why }] }, confirmed(1)]);
    expect(await judge(ask)).toMatchObject({ state: 'green', findings: [] });
  });

  it('keeps a why that says what the design does, "could not decide" being the law\'s own words', async () => {
    const quote = 'The App writes the acceptance check run';
    const why = 'A check that could not decide shows a pass.';
    const { ask } = recorded([{ findings: [{ law: 'BL-PRODUCT-1', quote, why }] }, confirmed(1)]);
    expect(await judge(ask)).toMatchObject({ state: 'red', findings: [{ law: 'BL-PRODUCT-1', quote, broken: why }] });
  });
});

describe('the spec citing the law it is judged on is no finding', () => {
  it('drops a quote from a paragraph or a list item that names the law', async () => {
    const { ask } = recorded([{ findings: [
      { law: 'BL-ANSWERS-1', quote: 'They are kept apart from the ledger', why: 'The App keeps its own records beside a person\'s answers.' },
      { law: 'BL-ANSWERS-1', quote: 'the checks never write to the ledger', why: 'The checks decide what an answer means.' },
      { law: 'BL-PRODUCT-1', quote: 'are never\n  shown green and never pass', why: 'A check shows a pass for what it did not decide.' },
    ] }, confirmed(3)]);
    expect(await judge(ask)).toMatchObject({ state: 'green', findings: [] });
  });

  it('keeps a quote from a list item that names another law', async () => {
    const quote = 'the checks never write to the ledger';
    const { ask } = recorded([{ findings: [{ law: 'BL-PRODUCT-1', quote, why: 'A check shows a pass for what it did not decide.' }] }, confirmed(1)]);
    expect(await judge(ask)).toMatchObject({ state: 'red', findings: [{ law: 'BL-PRODUCT-1', quote }] });
  });
});

describe('a finding stands only when a second reading confirms it', () => {
  const unhedged = [
    { law: 'BL-ANSWERS-1', quote: 'The App writes the acceptance check run', why: 'The App writes its verdict, which rewords the person\'s answers.' },
    { law: 'BL-ANSWERS-1', quote: 'through two recorded fields', why: 'Matching recorded fields is interpreting a person\'s intent.' },
  ];

  it('drops the findings the second reading says break nothing', async () => {
    const { ask, calls } = recorded([{ findings: unhedged }, { findings: [{ n: 1, breaks: false, why: 'Writing a check run is the App\'s own record.' }, { n: 2, breaks: false }] }]);
    expect(await judge(ask)).toMatchObject({ state: 'green', findings: [] });
    expect(calls()).toBe(2);
  });

  it('drops a confirmation that hedges, or names none', async () => {
    const { ask } = recorded([{ findings: unhedged }, { findings: [{ n: 1, breaks: true, why: 'It could be read as rewording.' }] }]);
    expect(await judge(ask)).toMatchObject({ state: 'green', findings: [] });
  });

  it('keeps what it confirms, red', async () => {
    const { ask } = recorded([{ findings: unhedged }, { findings: [{ n: 2, breaks: true, why: 'The App replaces the person\'s answer with its reading of it.' }] }]);
    expect(await judge(ask)).toMatchObject({ state: 'red', reason: '1 law broken', findings: [{ law: 'BL-ANSWERS-1', quote: 'through two recorded fields' }] });
  });

  it('is not judged when the second reading fails, never red', async () => {
    for (const second of [new Error('timeout'), { breaks: [] }]) {
      const { ask } = recorded([{ findings: unhedged }, second]);
      expect(await judge(ask)).toMatchObject({ state: 'neutral', findings: [] });
    }
  });

  it('is not asked when the first reading finds nothing', async () => {
    const { ask, calls } = recorded([{ findings: [] }]);
    expect(await judge(ask)).toMatchObject({ state: 'green', reason: '2 judged' });
    expect(calls()).toBe(1);
  });
});
