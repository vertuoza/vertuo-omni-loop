// PRD #99, slice s3: the text report's pull request lines, by repository and by month.
import { describe, expect, it } from 'vitest';
import { summarize } from './classify.mjs';
import { creditsReport } from './report.mjs';

/** The spec's own example, as a summary. */
const EXAMPLE = {
  total: 56,
  states: { merged: 53, open: 3 },
  kinds: { 'phase-0': 5, feature: 4, slice: 45, other: 2 },
  signatures: { signed: 12, 'before signing': 44, missed: 0 },
  byRepo: [{ repo: 'acme/omni-loop', count: 47 }, { repo: 'acme/core', count: 9 }],
  byMonth: [{ month: '2026-07', count: 8 }, { month: '2026-08', count: 21 }, { month: '2026-09', count: 27 }],
};

describe('creditsReport', () => {
  it('prints the heading, the pull request lines, then by repository and by month', () => {
    expect(creditsReport({ name: 'OmniMan', scope: 'acme', since: null, summary: EXAMPLE })).toEqual([
      'OmniMan · acme · all time',
      'PRs        56   (merged 53 · open 3)      phase-0 5 · feature 4 · slices 45 · other 2',
      '  signed 12 · before signing 44 · missed 0',
      'By repo    omni-loop 47 · core 9',
      'By month   2026-07 8 · 2026-08 21 · 2026-09 27',
    ]);
  });

  it('names the month it counts from, and the one repository it was narrowed to', () => {
    const [heading] = creditsReport({ name: 'OmniMan', scope: 'acme/core', since: '2026-07', summary: EXAMPLE });
    expect(heading).toBe('OmniMan · acme/core · since 2026-07');
  });

  it('with signing off, says so in place of the signature line', () => {
    const lines = creditsReport({ name: null, scope: 'acme', since: null, summary: EXAMPLE });
    expect(lines[0]).toBe('Omni Loop · acme · all time');
    expect(lines[2]).toBe('  signing is off in this repository');
  });

  it('keeps a space between columns however large the numbers grow', () => {
    const big = { ...EXAMPLE, total: 123456, states: { merged: 123450, open: 123456 } };
    const [, line] = creditsReport({ name: 'OmniMan', scope: 'acme', since: null, summary: big });
    expect(line).toBe('PRs        123456 (merged 123450 · open 123456)  phase-0 5 · feature 4 · slices 45 · other 2');
  });

  it('says none when there is nothing to count', () => {
    expect(creditsReport({ name: 'OmniMan', scope: 'acme', since: null, summary: summarize([]) })).toEqual([
      'OmniMan · acme · all time',
      'PRs        0    (merged 0 · open 0)       phase-0 0 · feature 0 · slices 0 · other 0',
      '  signed 0 · before signing 0 · missed 0',
      'By repo    none',
      'By month   none',
    ]);
  });
});
