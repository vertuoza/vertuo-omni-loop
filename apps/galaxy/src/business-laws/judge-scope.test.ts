import { describe, expect, it } from 'vitest';
import { parseBusinessLaws } from 'omni-loop/kit/lib/knowledge/business-laws.ts';
import { judgeSpec, type AskLaws } from './judge.service';

// A law binds only what a spec designs (bug #2815): a spec that changes only code went red, push after push, on a
// law about changes to the knowledge, each time for what the spec does not describe. A finding that only names
// the spec's silence says nothing the design does that the law forbids, so it never turns a verdict red; and the
// model is told that a law the design does not touch, a gap in the spec, or a sentence saying a law does not
// apply is no finding. Every law and spec is fictional.

const SYNC = parseBusinessLaws('k/domains/library/business-laws.md', [
  '## BL-LIBRARY-1',
  "A merge that changes a repository's books reaches its shelf without anyone doing anything. When it cannot, a",
  'person is told.',
  'Why: A team believes its shelf is current while it is not.',
  '',
].join('\n'), { scope: 'domain', domain: 'library' });
const SPEC = [
  '---',
  'areas: [library]',
  '---',
  '',
  '## Solution',
  '',
  'A job counts the loans each night and stores the counts in a new table, shown on the Loans page.',
  '',
  '## Risks',
  '',
  "- BL-LIBRARY-1: does not apply. Nothing of the repository's books changes: a job, a table and a page are code.",
  '',
].join('\n');
const QUOTE = 'A job counts the loans each night and stores the counts in a new table';

function model(reply: unknown): { ask: AskLaws; system: string[] } {
  const system: string[] = [];
  return { system, ask: (request) => { system.push(request.system); return Promise.resolve({ ok: true as const, reply }); } };
}

const judge = (ask: AskLaws) => judgeSpec({ spec: SPEC, laws: SYNC, glossary: [], owners: ['ana'], ask });

describe('a finding that only names what the spec does not say', () => {
  it.each([
    "The spec describes a job that stores counts, which changes the repository's books, but does not explain how this change reaches the shelf.",
    'The spec does not describe how the loan counts themselves reach the shelf.',
    "It doesn't mention what happens when the job cannot reach the shelf.",
    'The spec fails to specify who is told when the counts are not stored.',
  ])('is no finding: the verdict stays green — %s', async (why) => {
    const { ask } = model({ findings: [{ law: 'BL-LIBRARY-1', quote: QUOTE, why }] });
    expect(await judge(ask)).toMatchObject({ state: 'green', findings: [] });
  });

  it('a finding that says what the design does is still kept', async () => {
    const why = 'The counts reach the shelf only when a member presses Sync, and nobody is told when it fails.';
    const { ask } = model({ findings: [{ law: 'BL-LIBRARY-1', quote: QUOTE, why }] });
    const verdict = await judge(ask);
    expect(verdict.state).toBe('red');
    expect(verdict.findings).toEqual([expect.objectContaining({ law: 'BL-LIBRARY-1', broken: why })]);
  });
});

describe('what the model is told about a law the design does not touch', () => {
  it('a law binds only what the spec designs, a gap is no finding, and "does not apply" is no finding', async () => {
    const { ask, system } = model({ findings: [] });
    await judge(ask);
    expect(system[0]).toContain('A law binds only what the spec designs');
    expect(system[0]).toContain('When the spec designs nothing a law speaks of, that law has no finding');
    expect(system[0]).toContain('What the spec does not say is never a finding');
    expect(system[0]).toContain('A sentence that says a law does not apply, and why, is no finding');
  });
});
