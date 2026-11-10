import { describe, expect, it } from 'vitest';
import { parseBusinessLaws } from 'omni-loop/kit/lib/knowledge/business-laws.ts';
import { judgeSpec } from './judge.service';
import { lawsModel } from './model';

// The judge against its real model (bug #2696), off unless BUSINESS_LAWS_LIVE=1 and OPENROUTER_API_KEY are
// set: no ordinary run, and no CI run, calls a model. Run it by hand after changing the judge's prompt:
//
//   BUSINESS_LAWS_LIVE=1 OPENROUTER_API_KEY=… pnpm vitest run apps/galaxy/src/business-laws/judge-live.test.ts
//
// The cases are the sentences of product PRD omni-loop-2 that went red on BL-GATE-1 while keeping it: each
// restates the law or says the design keeps it, so none may turn a verdict red. The last case breaks the law,
// and must stay red: a judge that reports nothing would pass the others.

const key = process.env.OPENROUTER_API_KEY ?? '';
const live = process.env.BUSINESS_LAWS_LIVE === '1' && key !== '';

const GATE = parseBusinessLaws('k/product/business-laws.md', [
  '## BL-GATE-1',
  'A check that could not decide says so in its result, as "not judged" with the reason. It never shows a',
  'plain pass.',
  'Why: A green that means "nobody looked" teaches people to ignore every green.',
  '',
].join('\n'), { scope: 'product', domain: 'product' });

const spec = (sentence: string) => [
  '## Solution',
  '',
  'Each check of a pull request runs as one job of the job ledger: it reads the pull request fresh, evaluates, and publishes the check run.',
  sentence,
  '',
].join('\n');

const KEEPS = [
  'When a check cannot decide, its check run says so: its result reads `not judged: <reason>`.',
  'BL-GATE-1: A check that could not decide says so in its result, as "not judged" with the reason. It never shows a plain pass. The design keeps it: no check changes what it decides or says.',
  'A check whose job fails publishes a neutral check run that reads `not judged: the job failed`, never a pass.',
];
const BREAKS = 'When a check cannot decide within 30 seconds, its check run shows a green pass, so the pull request is never held.';

describe.runIf(live)('the judge, against its real model', () => {
  const judge = (sentence: string) => judgeSpec({ spec: spec(sentence), laws: GATE, glossary: [], owners: [], ask: lawsModel({ key }) });

  it.each(KEEPS)('is not red on a sentence of omni-loop-2 that keeps BL-GATE-1: %s', async (sentence) => {
    expect(await judge(sentence)).toMatchObject({ state: 'green', findings: [] });
  }, 60_000);

  it('is still red on a design that breaks BL-GATE-1, and says what breaks it', async () => {
    const verdict = await judge(BREAKS);
    expect(verdict.state).toBe('red');
    expect(verdict.findings[0]?.broken).not.toBe('');
  }, 60_000);
});
