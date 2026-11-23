import { describe, expect, it } from 'vitest';
import { kindWords, waitedFor } from './bell';

// What the Inbox list keeps from the bell (PRD 499): how long a wait has lasted, and how a New documents
// group's kinds read. The bell itself is gone (omni-loop-22 s7).

const MIN = 60_000;

describe('how long a question has waited', () => {
  it('reads in minutes, then hours, then days', () => {
    expect(waitedFor(20_000)).toBe('just now');
    expect(waitedFor(3 * MIN)).toBe('3 min');
    expect(waitedFor(59 * MIN)).toBe('59 min');
    expect(waitedFor(2 * 60 * MIN + 5 * MIN)).toBe('2 h');
    expect(waitedFor(3 * 24 * 60 * MIN)).toBe('3 d');
    expect(waitedFor(-5000)).toBe('just now');
  });
});

describe('the kinds of a New documents group', () => {
  it('reads them in words, in the order given', () => {
    expect(kindWords(['spec', 'plan', 'before-after'])).toBe('spec, plan, before/after');
    expect(kindWords(['plan'])).toBe('plan');
  });
});
