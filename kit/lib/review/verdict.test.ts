// PRD 2871, s1: the Reviewer's verdict — `pass`, or 1 to 5 findings — checked before anything is
// posted, and rendered as one GitHub review: a summary under its round marker, one thread a finding.
import { describe, expect, it } from 'vitest';
import { parseVerdict, readReviewMarker, renderReview, reviewMarker } from './verdict.ts';

const finding = (over: Record<string, unknown> = {}) => ({
  file: 'kit/lib/care/decide.ts',
  line: 42,
  severity: 'major',
  rule: 'default › Correctness',
  problem: 'A sub-PR with no checks reads as green.',
  fix: 'Read an empty rollup as pending.',
  ...over,
});

const changes = (findings: unknown[], over: Record<string, unknown> = {}) => ({ round: 1, verdict: 'changes', findings, ...over });

/** The verdict `input` parses to, or a failure naming its errors. */
const ok = (input: unknown) => {
  const parsed = parseVerdict(input);
  if (!parsed.ok) throw new Error(`refused: ${parsed.errors.join('; ')}`);
  return parsed.verdict;
};

/** The errors `input` is refused with. */
const refused = (input: unknown): string[] => {
  const parsed = parseVerdict(input);
  if (parsed.ok) throw new Error('accepted');
  return parsed.errors;
};

describe('parseVerdict — what a verdict may hold', () => {
  it('takes a pass with no finding, and a changes verdict of one to five findings', () => {
    expect(ok({ round: 1, verdict: 'pass', findings: [] })).toMatchObject({ round: 1, verdict: 'pass', findings: [] });
    expect(ok({ round: 2, verdict: 'pass' })).toMatchObject({ round: 2, verdict: 'pass', findings: [] });
    expect(ok(changes([finding()])).findings).toHaveLength(1);
    expect(ok(changes([1, 2, 3, 4, 5].map((line) => finding({ line })))).findings).toHaveLength(5);
  });

  it('refuses a changes verdict with no finding, and one with six', () => {
    expect(refused(changes([])).join('\n')).toMatch(/findings: a changes verdict holds 1 to 5 findings/);
    expect(refused(changes([1, 2, 3, 4, 5, 6].map((line) => finding({ line })))).join('\n')).toMatch(/findings: a changes verdict holds 1 to 5 findings/);
  });

  it('refuses a pass that carries a finding', () => {
    expect(refused({ round: 1, verdict: 'pass', findings: [finding()] }).join('\n')).toMatch(/findings: a pass holds no finding/);
  });

  it('refuses a finding with no rule, no file or no line', () => {
    for (const field of ['rule', 'file', 'line']) {
      const without = finding();
      Reflect.deleteProperty(without, field);
      expect(refused(changes([without])).join('\n'), field).toMatch(new RegExp(`findings\\.0\\.${field}:`));
    }
    expect(refused(changes([finding({ rule: '  ' })])).join('\n')).toMatch(/findings\.0\.rule:/);
    expect(refused(changes([finding({ line: 0 })])).join('\n')).toMatch(/findings\.0\.line:/);
    expect(refused(changes([finding({ line: 1.5 })])).join('\n')).toMatch(/findings\.0\.line:/);
  });

  it('refuses a severity other than blocker, major or minor', () => {
    for (const severity of ['blocker', 'major', 'minor']) expect(ok(changes([finding({ severity })])).findings[0]?.severity).toBe(severity);
    expect(refused(changes([finding({ severity: 'nit' })])).join('\n')).toMatch(/findings\.0\.severity:/);
  });

  it('refuses a finding with no problem or no fix, or one that runs over a line', () => {
    expect(refused(changes([finding({ problem: '' })])).join('\n')).toMatch(/findings\.0\.problem:/);
    expect(refused(changes([finding({ fix: 'one\ntwo' })])).join('\n')).toMatch(/findings\.0\.fix: one line/);
  });

  it('refuses a file path that leaves the repository', () => {
    for (const file of ['/etc/passwd', '../outside.ts', 'kit/../../x.ts']) expect(refused(changes([finding({ file })])).join('\n'), file).toMatch(/findings\.0\.file:/);
  });

  it('refuses a round other than 1 or 2, an unknown verdict and an unknown field', () => {
    expect(refused({ round: 3, verdict: 'pass' }).join('\n')).toMatch(/^round:/m);
    expect(refused({ round: 1, verdict: 'approve' }).join('\n')).toMatch(/^verdict:/m);
    expect(refused({ round: 1, verdict: 'pass', mood: 'happy' }).join('\n')).toMatch(/mood/);
    expect(refused(changes([finding({ author: 'x' })])).join('\n')).toMatch(/author/);
    expect(refused('pass')).toEqual(['(verdict): an object { round, verdict, findings }']);
  });
});

describe('reviewMarker and readReviewMarker', () => {
  it('writes the round and the verdict, and reads them back', () => {
    expect(reviewMarker(1, 'changes')).toBe('<!-- omni-review: 1 changes -->');
    expect(readReviewMarker(`<!-- omni-review: 2 pass -->\n**Round 2 of 2: pass**`)).toEqual({ round: 2, verdict: 'pass' });
  });

  it('reads nothing from a body with no marker, or one naming an unknown round or verdict', () => {
    expect(readReviewMarker('Looks good to me')).toBeNull();
    expect(readReviewMarker(null)).toBeNull();
    expect(readReviewMarker('<!-- omni-review: 3 pass -->')).toBeNull();
    expect(readReviewMarker('<!-- omni-review: 1 approve -->')).toBeNull();
  });
});

describe('renderReview — one GitHub review', () => {
  const FOOTER = '🦸 Omni-man by [Omni Loop](https://www.omni-loop.xyz) © <!-- omni-loop:signed -->';
  const two = ok(changes([finding({ severity: 'minor', line: 9 }), finding({ severity: 'blocker', file: 'kit/bin/commands/review.ts', line: 3, rule: 'BR-PRODUCT-5' })]));

  it('opens on its marker, then names the round and the count', () => {
    const { body } = renderReview(two, { footer: null });
    expect(body.split('\n').slice(0, 3)).toEqual(['<!-- omni-review: 1 changes -->', '**Round 1 of 2: 2 findings**', '']);
    expect(renderReview(ok(changes([finding()])), { footer: null }).body).toContain('**Round 1 of 2: 1 finding**');
    expect(renderReview(ok({ round: 2, verdict: 'pass' }), { footer: null }).body).toMatch(/^<!-- omni-review: 2 pass -->\n\*\*Round 2 of 2: pass\*\*\n/);
  });

  it('lists the findings most severe first, and gives each its own thread on its file and line', () => {
    const { body, comments } = renderReview(two, { footer: null });
    expect(comments.map(({ path, line }) => `${path}:${String(line)}`)).toEqual(['kit/bin/commands/review.ts:3', 'kit/lib/care/decide.ts:9']);
    expect(body.indexOf('`kit/bin/commands/review.ts:3`')).toBeLessThan(body.indexOf('`kit/lib/care/decide.ts:9`'));
    const [first] = comments;
    expect(first?.side).toBe('RIGHT');
    expect(first?.body).toContain('**blocker** · BR-PRODUCT-5');
    expect(first?.body).toContain('A sub-PR with no checks reads as green.');
    expect(first?.body).toContain('**Fix:** Read an empty rollup as pending.');
  });

  it('says an agent wrote it, on the review and on every thread, and ends with the signature when signing is on (L-AIACT-1)', () => {
    const unsigned = renderReview(two, { footer: null });
    expect(unsigned.body).toMatch(/Reviewer · agent/);
    expect(unsigned.body).not.toContain('omni-loop:signed');
    for (const comment of unsigned.comments) expect(comment.body).toMatch(/Reviewer · agent/);
    const signed = renderReview(two, { footer: FOOTER });
    expect(signed.body.trimEnd().endsWith(FOOTER)).toBe(true);
  });

  it('carries the summary when the verdict gives one', () => {
    expect(renderReview(ok({ round: 1, verdict: 'pass', summary: 'The spec’s six criteria each have a test.' }), { footer: null }).body).toContain(
      'The spec’s six criteria each have a test.',
    );
  });

  it('renders the same verdict to the same review, whatever order its fields came in', () => {
    const again = ok({ findings: [...two.findings].reverse(), verdict: 'changes', round: 1 });
    expect(renderReview(again, { footer: FOOTER })).toEqual(renderReview(two, { footer: FOOTER }));
  });
});
