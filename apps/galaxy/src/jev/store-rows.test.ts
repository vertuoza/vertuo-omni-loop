// The schemas Jev's store parses its rows with (PRD 1030): the store's own fixtures pass, and a
// missing column, a wrong type and a forbidden null each fail.
import { describe, expect, it } from 'vitest';
import { StoredCall, StoredDecision } from './store';

const decision = { decision: 'outbox-risk', mode: 'shadow', threshold: '0.65', confidence_floor: 0.3 };
const call = {
  id: 7, decision: 'question-category', mode: 'shadow', outcome: 'answered', model: 'jev-1.13.0', jev_answer: 'product', confidence: '0.8200',
  old_answer: 'business', counted: 'business', decided_by: 'old', ref: 'round:9', reason: null, ms: 180, called_at: '2026-09-30T10:00:00Z',
};

const without = (row: Record<string, unknown>, key: string) => Object.fromEntries(Object.entries(row).filter(([k]) => k !== key));

describe('StoredDecision', () => {
  it('parses a jev_decisions row, its numerics as numbers or decimal text', () => {
    expect(StoredDecision.parse(decision)).toEqual({ decision: 'outbox-risk', mode: 'shadow', threshold: 0.65, confidence_floor: 0.3 });
  });

  it('refuses a missing column, a wrong type and a forbidden null', () => {
    expect(StoredDecision.safeParse(without(decision, 'threshold')).success).toBe(false);
    expect(StoredDecision.safeParse({ ...decision, mode: 'maybe' }).success).toBe(false);
    expect(StoredDecision.safeParse({ ...decision, threshold: 'high' }).success).toBe(false);
    expect(StoredDecision.safeParse({ ...decision, confidence_floor: null }).success).toBe(false);
  });
});

describe('StoredCall', () => {
  it('parses a jev_calls row', () => {
    expect(StoredCall.parse(call)).toMatchObject({ id: 7, outcome: 'answered', confidence: 0.82, reason: null });
    expect(StoredCall.parse({ ...call, confidence: null, ms: null, model: null }).confidence).toBeNull();
  });

  it('refuses a missing column, a wrong type and a forbidden null', () => {
    expect(StoredCall.safeParse(without(call, 'called_at')).success).toBe(false);
    expect(StoredCall.safeParse({ ...call, outcome: 'shrugged' }).success).toBe(false);
    expect(StoredCall.safeParse({ ...call, ms: '180' }).success).toBe(false);
    expect(StoredCall.safeParse({ ...call, decided_by: null }).success).toBe(false);
  });
});
