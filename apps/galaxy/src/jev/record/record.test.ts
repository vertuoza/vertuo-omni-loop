import { describe, expect, it } from 'vitest';
import type { JevCallRow } from '../store';
import { RECORD_DAYS, decisionRecord, jevRecords, recordSince, refLink } from './record';

// Each decision's record on Settings › Jev (PRD 812 s4), from fixture jev_calls rows: over the last 30
// days, the calls, how often Jev agreed with today's path, and the last ten disagreements, newest
// first, each with a link to what it was about.

const NOW = new Date('2026-09-30T12:00:00Z');
let id = 0;

function call(over: Partial<JevCallRow> = {}): JevCallRow {
  return {
    id: ++id, decision: 'question-category', mode: 'shadow', outcome: 'answered', model: 'jev-1.13.0',
    jevAnswer: 'product', confidence: 0.8, oldAnswer: 'product', counted: 'product', decidedBy: 'old',
    ref: null, reason: null, ms: 120, calledAt: '2026-09-29T10:00:00Z', ...over,
  };
}

const daysAgo = (days: number, minutes = 0) => new Date(NOW.getTime() - days * 86_400_000 - minutes * 60_000).toISOString();

describe('the record\'s window', () => {
  it('is the last 30 days', () => {
    expect(RECORD_DAYS).toBe(30);
    expect(recordSince(NOW)).toBe('2026-08-31T12:00:00.000Z');
  });

  it('counts nothing older than 30 days', () => {
    const record = decisionRecord([
      call({ calledAt: daysAgo(29) }),
      call({ calledAt: daysAgo(30, 1), jevAnswer: 'ux' }),
      call({ calledAt: daysAgo(45), jevAnswer: 'ux' }),
    ], 'question-category', NOW);
    expect(record.calls).toBe(1);
    expect(record.disagreements).toEqual([]);
  });
});

describe('a decision\'s record', () => {
  it('counts every call, compares only the calls where Jev and today\'s path both answered', () => {
    const record = decisionRecord([
      call(),
      call({ jevAnswer: 'ux', counted: 'product' }),
      call({ outcome: 'under-floor', jevAnswer: 'business', confidence: 0.2 }),
      call({ outcome: 'failed', jevAnswer: null, confidence: null, reason: 'Jev did not answer in 5 s.' }),
      call({ outcome: 'no-key', jevAnswer: null, confidence: null }),
      call({ outcome: 'failed', jevAnswer: 'nonsense', reason: 'Jev answered outside the decision’s options.' }),
      call({ oldAnswer: null, counted: 'product', decidedBy: 'jev' }),
    ], 'question-category', NOW);
    expect(record).toMatchObject({ calls: 7, compared: 3, agreed: 1 });
    expect(record.agreement).toBeCloseTo(1 / 3);
  });

  it('keeps only its own decision\'s calls', () => {
    const records = jevRecords([call(), call({ decision: 'outbox-risk', jevAnswer: 'true', oldAnswer: 'false' })], NOW);
    expect(records['question-category']).toMatchObject({ calls: 1, compared: 1, agreed: 1, agreement: 1 });
    expect(records['outbox-risk']).toMatchObject({ calls: 1, compared: 1, agreed: 0, agreement: 0 });
    expect(records['bug-risk']).toEqual({ calls: 0, compared: 0, agreed: 0, agreement: null, disagreements: [] });
  });

  it('has no agreement rate when nothing could be compared', () => {
    expect(decisionRecord([call({ outcome: 'no-key', jevAnswer: null })], 'question-category', NOW).agreement).toBeNull();
  });

  it('lists the last ten disagreements, newest first, with both answers, who decided and a link', () => {
    const calls = Array.from({ length: 12 }, (_, i) =>
      call({ calledAt: daysAgo(12 - i), jevAnswer: 'ux', oldAnswer: 'product', ref: `round:r-${i}` }));
    calls.push(call({ calledAt: daysAgo(0, 5), jevAnswer: 'harness', oldAnswer: 'harness' }));
    calls.push(call({ calledAt: daysAgo(0, 1), mode: 'on', jevAnswer: 'business', oldAnswer: 'other', counted: 'business', decidedBy: 'jev', confidence: 0.91, ref: 'round:r-last' }));
    const record = decisionRecord(calls.reverse(), 'question-category', NOW);
    expect(record.disagreements).toHaveLength(10);
    expect(record.disagreements[0]).toEqual({
      calledAt: daysAgo(0, 1), jevAnswer: 'business', oldAnswer: 'other', decidedBy: 'jev', confidence: 0.91,
      ref: { text: 'the round', href: '/ask/q/r-last' },
    });
    expect(record.disagreements.slice(1).map((d) => d.ref?.href)).toEqual(
      [11, 10, 9, 8, 7, 6, 5, 4, 3].map((i) => `/ask/q/r-${i}`));
  });

  it('sorts by the time of the call, whatever order the rows came in', () => {
    const record = decisionRecord([
      call({ calledAt: daysAgo(3), jevAnswer: 'ux', ref: 'round:older' }),
      call({ calledAt: daysAgo(1), jevAnswer: 'ux', ref: 'round:newer' }),
    ], 'question-category', NOW);
    expect(record.disagreements.map((d) => d.ref?.href)).toEqual(['/ask/q/newer', '/ask/q/older']);
  });
});

describe('what a call was about', () => {
  it('links a round to its page', () => {
    expect(refLink('round:6f1c2a4e-0000-4000-8000-000000000001')).toEqual({ text: 'the round', href: '/ask/q/6f1c2a4e-0000-4000-8000-000000000001' });
  });

  it('links an issue or a pull request named owner/repo#n to GitHub', () => {
    expect(refLink('vertuoza/vertuo-omni-loop#812')).toEqual({ text: 'vertuoza/vertuo-omni-loop#812', href: 'https://github.com/vertuoza/vertuo-omni-loop/issues/812' });
  });

  it('links a GitHub address as it is', () => {
    const url = 'https://github.com/vertuoza/vertuo-omni-loop/pull/828';
    expect(refLink(url)).toEqual({ text: 'vertuoza/vertuo-omni-loop#828', href: url });
  });

  it('shows anything else as text, and nothing for no ref', () => {
    expect(refLink('s3-01-decide-route-shape')).toEqual({ text: 's3-01-decide-route-shape', href: null });
    expect(refLink('round:')).toEqual({ text: 'round:', href: null });
    expect(refLink('round:../../admin')).toEqual({ text: 'round:../../admin', href: null });
    expect(refLink('javascript:alert(1)')).toEqual({ text: 'javascript:alert(1)', href: null });
    expect(refLink('https://evil.example/x')).toEqual({ text: 'https://evil.example/x', href: null });
    expect(refLink('  ')).toBeNull();
    expect(refLink(null)).toBeNull();
  });
});
