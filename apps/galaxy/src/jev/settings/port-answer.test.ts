// The schema the browser parses the key route's answer with (PRD 1030): the route's own answers
// pass, and a missing field, a wrong type and a forbidden null each fail.
import { describe, expect, it } from 'vitest';
import { KeyAnswer } from './port';

const STORED = { stored: true, lastFour: '1a2b', setAt: '2026-09-30T10:00:00Z' };

describe('KeyAnswer', () => {
  it('parses the key route\'s answers: the key\'s status, or why it refused', () => {
    expect(KeyAnswer.parse({ key: STORED })).toEqual({ key: STORED });
    expect(KeyAnswer.parse({ key: { stored: false, lastFour: null, setAt: null } })).toEqual({ key: { stored: false, lastFour: null, setAt: null } });
    expect(KeyAnswer.parse({ error: 'Sign in first.' })).toEqual({ error: 'Sign in first.' });
  });

  it('refuses a missing field, a wrong type and a forbidden null', () => {
    expect(KeyAnswer.safeParse({ key: { stored: true, lastFour: '1a2b' } }).success).toBe(false);
    expect(KeyAnswer.safeParse({ key: { ...STORED, stored: 'yes' } }).success).toBe(false);
    expect(KeyAnswer.safeParse({ key: { ...STORED, stored: null } }).success).toBe(false);
    expect(KeyAnswer.safeParse({ error: null }).success).toBe(false);
  });
});
