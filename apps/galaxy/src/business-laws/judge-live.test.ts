import { readFileSync } from 'node:fs';
import { join } from 'node:path';
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
  });

  it('is still red on a design that breaks BL-GATE-1, and says what breaks it', async () => {
    const verdict = await judge(BREAKS);
    expect(verdict.state).toBe('red');
    expect(verdict.findings[0]?.broken).not.toBe('');
  });
});

// Bug #2815: product PRD omni-loop-8's spec changes only code (a Jev decision, two job kinds, tables, a page)
// and says nothing under the knowledge changes, yet each push went red on BL-PRODUCTKNOWLEDGE-4, or on BL-JEV-2,
// for what the spec does not describe. A law binds only what a spec designs: the spec below must stay green
// against the real laws of its areas, and a design that breaks BL-PRODUCTKNOWLEDGE-4 must stay red.

const AREAS = ['product-knowledge', 'jev'].flatMap((domain) => {
  const file = `.omni-loop/knowledge/domains/${domain}/business-laws.md`;
  return parseBusinessLaws(file, readFileSync(join(process.cwd(), file), 'utf8'), { scope: 'domain', domain });
});

const CODE_ONLY = [
  '---',
  'title: "The eval set: top@k and recall@k over time"',
  'areas: [product-knowledge, jev]',
  '---',
  '',
  '## Solution',
  '',
  '- **The right answers.** For each question in the set, a new Jev decision, `search-relevant`, judges each of',
  "  the question's top 10 hits and the entries agents opened for its group: does this entry answer the question?",
  '  It is a `noul` (how true, 0 to 1). An entry judged above 0.6 is a right answer.',
  '- **A person can fix it.** On the page, a member confirms or removes any right answer, or adds an entry Jev',
  "  missed. A person's word wins over Jev's, is kept with who gave it, and is never overwritten by a later judgement.",
  '- **When.** A job runs the whole set daily, and after every knowledge-embed job that stored new vectors for the',
  '  product. It searches each question as an agent would, and records the ranks of its right answers.',
  '',
  '## Risks',
  '',
  '**What merging publishes:** two job kinds, a Jev decision, tables for the set, its answers and its runs, and a',
  'page view.',
  '',
  '**The business laws:**',
  '- BL-PRODUCTKNOWLEDGE-1, -2: kept. Correcting a right answer is not an edit of Legal or Glossary; the',
  '  knowledge itself is never changed here.',
  "- BL-PRODUCTKNOWLEDGE-4: does not apply. This PRD merges no file of the repository's knowledge: nothing under",
  '  `.omni-loop/knowledge/` changes (no register, law, ADR, Legal entry, Glossary term or persona). A Jev',
  '  decision, a job kind, a table and a page are code, not knowledge, so there is no knowledge change for the',
  '  merge to carry to the product.',
  '- BL-JEV-1: kept. `search-relevant` changes something only where the workspace has switched it On, and only',
  "  for a verdict at or above the confidence floor. Otherwise today's rule decides: no right answer is added,",
  '  and the question waits in the set, with no right answers, until a member gives them on the page.',
  '',
].join('\n');
const BREAKS_SYNC = CODE_ONLY.replace(
  '## Risks',
  "- **Sync.** A merge that changes the repository's knowledge reaches the product only once a member presses Sync on the page; when the sync fails, nobody is told.\n\n## Risks",
);

describe.runIf(live)('the judge, against its real model, on a spec that changes only code (bug #2815)', () => {
  const judge = (text: string) => judgeSpec({ spec: text, laws: AREAS, glossary: [], owners: [], ask: lawsModel({ key }) });

  it.each([1, 2, 3])('is green on omni-loop-8, which changes no knowledge (run %i)', async () => {
    const verdict = await judge(CODE_ONLY);
    expect(verdict.findings).toEqual([]);
    expect(verdict.state).toBe('green');
  });

  it('is still red on a design that breaks BL-PRODUCTKNOWLEDGE-4', async () => {
    const verdict = await judge(BREAKS_SYNC);
    expect(verdict.state).toBe('red');
    expect(verdict.findings.map((finding) => finding.law)).toContain('BL-PRODUCTKNOWLEDGE-4');
  });
});
