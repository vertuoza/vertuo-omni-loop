// @ts-nocheck
// PRD #99, slices s3 and s4: the text report — the pull request lines, the PRD issues, what the app
// opened, the co-authored commits, by repository and by month — and the `--list` lines (AC 8, AC 9).
import { describe, expect, it } from 'vitest';
import { summarize } from './classify.ts';
import { creditsList, creditsReport } from './report.ts';

/** The spec's own example, as a summary. */
const EXAMPLE = {
  prs: {
    total: 56,
    states: { merged: 53, open: 3 },
    kinds: { 'phase-0': 5, feature: 4, slice: 45, other: 2 },
    signatures: { signed: 12, 'before signing': 44, missed: 0 },
  },
  prdIssues: { total: 26, states: { open: 3, closed: 23 }, signatures: { signed: 4, 'before signing': 22, missed: 0 } },
  byTheApp: { issues: 9, prs: 0 },
  commits: 11,
  byRepo: [{ repo: 'acme/omni-loop', count: 47 }, { repo: 'acme/core', count: 9 }],
  byMonth: [{ month: '2026-07', count: 8 }, { month: '2026-08', count: 21 }, { month: '2026-09', count: 27 }],
};

describe('creditsReport', () => {
  it('prints the spec\'s report: pull requests, PRD issues, the app, the commits, by repository and by month', () => {
    expect(creditsReport({ name: 'OmniMan', scope: 'acme', since: null, summary: EXAMPLE })).toEqual([
      'OmniMan · acme · all time',
      'PRs        56   (merged 53 · open 3)      phase-0 5 · feature 4 · slices 45 · other 2',
      '  signed 12 · before signing 44 · missed 0',
      'PRD issues 26   signed 4 · before signing 22 · missed 0',
      'Opened by the app: 9 issues',
      'Co-authored commits on default branches: 11',
      'By repo    omni-loop 47 · core 9',
      'By month   2026-07 8 · 2026-08 21 · 2026-09 27',
    ]);
  });

  it('names the month it counts from, and the one repository it was narrowed to', () => {
    const [heading] = creditsReport({ name: 'OmniMan', scope: 'acme/core', since: '2026-07', summary: EXAMPLE });
    expect(heading).toBe('OmniMan · acme/core · since 2026-07');
  });

  it('counts the app\'s pull requests beside its issues, one or many', () => {
    const line = (byTheApp) => creditsReport({ name: 'OmniMan', scope: 'acme', since: null, summary: { ...EXAMPLE, byTheApp } })[4];
    expect(line({ issues: 1, prs: 1 })).toBe('Opened by the app: 1 issue · 1 pull request');
    expect(line({ issues: 0, prs: 2 })).toBe('Opened by the app: 0 issues · 2 pull requests');
    expect(line({ issues: 0, prs: 0 })).toBe('Opened by the app: 0 issues');
  });

  it('leaves out the app when no account was looked for', () => {
    const lines = creditsReport({ name: 'OmniMan', scope: 'acme', since: null, summary: { ...EXAMPLE, byTheApp: null } });
    expect(lines.some((line) => line.startsWith('Opened by the app'))).toBe(false);
    expect(lines).toContain('Co-authored commits on default branches: 11');
  });

  it('with signing off, says so, and leaves out what only a signature finds', () => {
    const off = { ...EXAMPLE, byTheApp: null, commits: null };
    expect(creditsReport({ name: null, scope: 'acme', since: null, summary: off })).toEqual([
      'Omni Loop · acme · all time',
      'PRs        56   (merged 53 · open 3)      phase-0 5 · feature 4 · slices 45 · other 2',
      '  signing is off in this repository',
      'PRD issues 26',
      'By repo    omni-loop 47 · core 9',
      'By month   2026-07 8 · 2026-08 21 · 2026-09 27',
    ]);
  });

  it('keeps a space between columns however large the numbers grow', () => {
    const big = { ...EXAMPLE, prs: { ...EXAMPLE.prs, total: 123456, states: { merged: 123450, open: 123456 } } };
    const [, line] = creditsReport({ name: 'OmniMan', scope: 'acme', since: null, summary: big });
    expect(line).toBe('PRs        123456 (merged 123450 · open 123456)  phase-0 5 · feature 4 · slices 45 · other 2');
  });

  it('says none when there is nothing to count', () => {
    expect(creditsReport({ name: 'OmniMan', scope: 'acme', since: null, summary: summarize([], { commits: [], app: true }) })).toEqual([
      'OmniMan · acme · all time',
      'PRs        0    (merged 0 · open 0)       phase-0 0 · feature 0 · slices 0 · other 0',
      '  signed 0 · before signing 0 · missed 0',
      'PRD issues 0    signed 0 · before signing 0 · missed 0',
      'Opened by the app: 0 issues',
      'Co-authored commits on default branches: 0',
      'By repo    none',
      'By month   none',
    ]);
  });
});

describe('creditsList (AC 9)', () => {
  const item = (overrides) => ({
    type: 'pr',
    repo: 'acme/omni-loop',
    number: 101,
    title: 'feat(kit): OmniMan',
    kind: 'feature',
    state: 'merged',
    createdAt: '2026-09-28T10:00:00Z',
    reasons: ['label'],
    signature: 'signed',
    ...overrides,
  });

  it('one line per item, in the order given: repository, number, kind, state, created date, signature, title', () => {
    const items = [
      item({}),
      item({ number: 102, kind: 'slice', title: 's1 — the signature', createdAt: '2026-09-28T11:00:00Z' }),
      item({ type: 'issue', repo: 'acme/core', number: 7, kind: 'prd', state: 'closed', createdAt: '2026-09-29T23:30:00Z', signature: 'before signing', title: 'PRD: credits' }),
    ];
    expect(creditsList(items)).toEqual([
      'omni-loop #101 feature merged 2026-09-28 signed         feat(kit): OmniMan',
      'omni-loop #102 slice   merged 2026-09-28 signed         s1 — the signature',
      'core      #7   prd     closed 2026-09-29 before signing PRD: credits',
    ]);
  });

  it('marks an item with no signature, as when signing is off, with a dash', () => {
    expect(creditsList([item({ signature: null })])).toEqual(['omni-loop #101 feature merged 2026-09-28 - feat(kit): OmniMan']);
  });

  it('is empty on nothing', () => {
    expect(creditsList([])).toEqual([]);
  });
});
