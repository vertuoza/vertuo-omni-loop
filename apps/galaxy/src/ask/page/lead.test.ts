import { describe, it, expect } from 'vitest';
import { LEAD_FOLD_LINES, leadFolds, leadOf } from './lead';

// The message Claude wrote before asking (PRD 752): which rounds show it, and when it folds.

describe('the lead of a round', () => {
  it('is the text Claude wrote, trimmed', () => {
    expect(leadOf({ lead: '\nHere is the design.\n\n' })).toBe('Here is the design.');
  });

  it('is nothing for a round without one, an empty one, or a row read before the column', () => {
    expect(leadOf({ lead: null })).toBeNull();
    expect(leadOf({ lead: '  \n ' })).toBeNull();
    expect(leadOf({})).toBeNull();
  });
});

describe('folding a lead after about 12 lines', () => {
  const lines = (n: number, width = 20) => Array.from({ length: n }, (_, i) => `${i}`.padEnd(width, 'x')).join('\n');

  it(`keeps a lead of ${LEAD_FOLD_LINES} short lines open`, () => {
    expect(leadFolds(lines(LEAD_FOLD_LINES))).toBe(false);
  });

  it('folds one with more lines', () => {
    expect(leadFolds(lines(LEAD_FOLD_LINES + 1))).toBe(true);
  });

  it('counts a long line as the lines it wraps into', () => {
    expect(leadFolds('word '.repeat(300))).toBe(true);
    expect(leadFolds('word '.repeat(20))).toBe(false);
  });
});
