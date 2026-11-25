// The steps' usual times the seat keeps in long-term memory (PRD omni-loop-34 s2): the newest note of a step wins.
import { describe, expect, it } from 'vitest';
import { baselinesOf } from './baselines.ts';

describe('baselinesOf — the steps\' usual times from long-term notes', () => {
  it('reads one usual time per step, the newest note winning, and leaves any other note out', () => {
    expect(baselinesOf([
      'Baseline wave: 2.5 min (median of the last 9)',
      'Baseline do-work: 12 min',
      'Baseline wave: 4 min (median of the last 9)',
      'Silent jobs on atlas-01 come back after a restart',
      'Baseline plan: 0 min',
    ])).toEqual({ wave: 2.5, 'do-work': 12 });
  });

  it('reads nothing from no note', () => {
    expect(baselinesOf([])).toEqual({});
  });
});
